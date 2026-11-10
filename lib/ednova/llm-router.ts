import "server-only";

import { createHash } from "crypto";

export type ModelClass = "fast" | "large";

export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMRequest = {
  modelClass: ModelClass;
  messages: LLMMessage[];
  temperature?: number;
  responseFormat?: "text" | "json_object";
  cacheTtlMs?: number;
  /** A short, safe label surfaced in telemetry and UI. Never include user content or secrets. */
  purpose: string;
};

export type LLMResponse = {
  content: string;
  modelClass: ModelClass;
  model: string;
  cached: boolean;
  fallback: boolean;
  notice?: string;
};

type CacheEntry = {
  value: LLMResponse;
  expiresAt: number;
};

type OpenAIModelsResponse = {
  data?: Array<{ id?: string }>;
};

type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
};

type RouterConfig = {
  baseUrl: string;
  apiKey: string;
  fastModel: string;
  largeModel: string;
  geminiApiKey?: string;
  geminiModel?: string;
};

type FetchLike = typeof fetch;

class LLMRouterError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "LLMRouterError";
  }
}

/**
 * The EdNova inference gateway is intentionally shared by every feature.
 *
 * - Fast model: classification, hints, short checks, summaries.
 * - Large model: explanations, multi-step reasoning and whole quizzes.
 *
 * The service is CPU-bound and limited, so the router makes non-streaming calls
 * predictable with a max-two worker pool, an 18/minute token bucket (headroom
 * below 20/min), in-memory request de-duplication/cache, and safe fallback.
 */
export class LLMRouter {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<LLMResponse>>();
  private readonly queue: Array<{
    run: () => Promise<LLMResponse>;
    resolve: (value: LLMResponse) => void;
    reject: (reason: unknown) => void;
  }> = [];
  private active = 0;
  private tokens = 18;
  private lastRefillAt = Date.now();
  private modelsCache?: { ids: string[]; expiresAt: number };

  constructor(
    private readonly config: RouterConfig = LLMRouter.readConfig(),
    private readonly fetcher: FetchLike = fetch,
  ) {}

  static readConfig(): RouterConfig {
    const baseUrl = process.env.BASE_URL?.replace(/\/$/, "");
    const apiKey = process.env.API_KEY;
    const fastModel = process.env.MODEL_FAST;
    const largeModel = process.env.MODEL_LARGE;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const geminiModel = process.env.GEMINI_MODEL || "gemini-3.5-flash";

    if (!baseUrl || !apiKey || !fastModel || !largeModel) {
      throw new LLMRouterError(
        "EdNova AI is not configured. Add BASE_URL, API_KEY, MODEL_FAST, and MODEL_LARGE to .env.",
      );
    }

    return { baseUrl, apiKey, fastModel, largeModel, geminiApiKey, geminiModel };
  }

  async listModels(): Promise<string[]> {
    if (this.modelsCache && this.modelsCache.expiresAt > Date.now()) {
      return this.modelsCache.ids;
    }

    const response = await this.fetcher(`${this.config.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new LLMRouterError("Unable to discover EdNova models.", response.status, retryAfterMs(response));
    }

    const body = (await response.json()) as OpenAIModelsResponse;
    const ids = (body.data ?? []).flatMap((model) => (model.id ? [model.id] : []));
    this.modelsCache = { ids, expiresAt: Date.now() + 5 * 60_000 };
    return ids;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const key = cacheKey(request);
    const existing = this.cache.get(key);
    if (existing && existing.expiresAt > Date.now()) {
      return { ...existing.value, cached: true };
    }
    if (existing) this.cache.delete(key);

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const task = this.enqueue(async () => {
      try {
        const value = await this.generateWithFallback(request);
        this.cache.set(key, {
          value: { ...value, cached: false },
          expiresAt: Date.now() + (request.cacheTtlMs ?? 30 * 60_000),
        });
        return value;
      } finally {
        this.inFlight.delete(key);
      }
    });

    this.inFlight.set(key, task);
    return task;
  }

  private async generateWithFallback(request: LLMRequest): Promise<LLMResponse> {
    try {
      return await this.callModel(request, request.modelClass);
    } catch (error) {
      if (request.modelClass === "large" && isFallbackEligible(error)) {
        try {
          const fallback = await this.callModel(request, "fast");
          return {
            ...fallback,
            fallback: true,
            notice: "Large model busy, using fast mode",
          };
        } catch {
          // If fast model also fails, check Gemini fallback below
        }
      }

      // External provider safety fallback: if primary endpoint key is blocked (401), rate-limited, or unavailable
      if (this.config.geminiApiKey) {
        try {
          return await this.callGeminiFallback(request);
        } catch {
          // If Gemini fallback also fails, throw the original error
        }
      }

      throw error;
    }
  }

  private async callGeminiFallback(request: LLMRequest): Promise<LLMResponse> {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(this.config.geminiApiKey!);
    const geminiModel = this.config.geminiModel || "gemini-3.5-flash";

    const systemMsg = request.messages.find((m) => m.role === "system")?.content;
    const conversation = request.messages.filter((m) => m.role !== "system");

    const model = genAI.getGenerativeModel({
      model: geminiModel,
      ...(systemMsg ? { systemInstruction: systemMsg } : {}),
      generationConfig: {
        temperature: request.temperature ?? 0.35,
        ...(request.responseFormat === "json_object"
          ? { responseMimeType: "application/json" }
          : {}),
      },
    });

    const promptText =
      conversation.length === 1
        ? conversation[0].content
        : conversation.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n");

    const result = await model.generateContent(promptText);
    let content = result.response.text();

    if (request.responseFormat === "json_object") {
      const start = content.indexOf("{");
      const end = content.lastIndexOf("}");
      if (start >= 0 && end > start) {
        content = content.slice(start, end + 1);
      }
    }

    return {
      content,
      modelClass: request.modelClass,
      model: geminiModel,
      cached: false,
      fallback: true,
      notice: "Inference powered by Gemini 3.5 Flash safety fallback",
    };
  }

  private async callModel(request: LLMRequest, modelClass: ModelClass): Promise<LLMResponse> {
    const model = modelClass === "fast" ? this.config.fastModel : this.config.largeModel;
    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await this.acquireToken();
        const response = await this.fetcher(`${this.config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: request.messages,
            temperature: request.temperature ?? 0.35,
            ...(request.responseFormat === "json_object"
              ? { response_format: { type: "json_object" } }
              : {}),
          }),
          signal: AbortSignal.timeout(45_000),
        });

        if (!response.ok) {
          throw new LLMRouterError(
            "EdNova AI could not complete this request.",
            response.status,
            retryAfterMs(response),
          );
        }

        const body = (await response.json()) as OpenAIChatResponse;
        const content = toText(body.choices?.[0]?.message?.content);
        if (!content) throw new LLMRouterError("EdNova AI returned an empty response.");

        return { content, modelClass, model, cached: false, fallback: false };
      } catch (error) {
        lastError = error;
        if (!isRetryable(error) || attempt === 2) break;
        await sleep(backoffMs(error, attempt));
      }
    }

    if (lastError instanceof LLMRouterError) throw lastError;
    if (lastError instanceof Error && lastError.name === "TimeoutError") {
      throw new LLMRouterError("EdNova AI timed out. Please try again.");
    }
    throw new LLMRouterError("EdNova AI is temporarily unavailable.");
  }

  private enqueue(run: () => Promise<LLMResponse>): Promise<LLMResponse> {
    return new Promise((resolve, reject) => {
      this.queue.push({ run, resolve, reject });
      this.drain();
    });
  }

  private drain(): void {
    while (this.active < 2 && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) return;
      this.active += 1;
      task
        .run()
        .then(task.resolve, task.reject)
        .finally(() => {
          this.active -= 1;
          this.drain();
        });
    }
  }

  private async acquireToken(): Promise<void> {
    this.refillTokens();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    const msUntilToken = Math.max(1, Math.ceil((60_000 / 18) - (Date.now() - this.lastRefillAt)));
    await sleep(msUntilToken);
    return this.acquireToken();
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillAt;
    const replenished = (elapsed / 60_000) * 18;
    if (replenished > 0) {
      this.tokens = Math.min(18, this.tokens + replenished);
      this.lastRefillAt = now;
    }
  }
}

let router: LLMRouter | undefined;

export function getLLMRouter(): LLMRouter {
  router ??= new LLMRouter();
  return router;
}

function cacheKey(request: LLMRequest): string {
  const normalized = JSON.stringify({
    modelClass: request.modelClass,
    purpose: request.purpose,
    temperature: request.temperature ?? 0.35,
    responseFormat: request.responseFormat ?? "text",
    messages: request.messages.map((message) => ({
      role: message.role,
      content: message.content.replace(/\s+/g, " ").trim(),
    })),
  });
  return createHash("sha256").update(normalized).digest("hex");
}

function retryAfterMs(response: Response): number | undefined {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

function isRetryable(error: unknown): boolean {
  if (error instanceof LLMRouterError) {
    return error.status === 429 || (error.status !== undefined && error.status >= 500);
  }
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

function isFallbackEligible(error: unknown): boolean {
  return error instanceof LLMRouterError && (error.status === 429 || (error.status !== undefined && error.status >= 500));
}

function backoffMs(error: unknown, attempt: number): number {
  if (error instanceof LLMRouterError && error.retryAfterMs !== undefined) return error.retryAfterMs;
  return Math.min(8_000, 500 * 2 ** attempt) + Math.round(Math.random() * 250);
}

function toText(content: string | Array<{ text?: string }> | undefined): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.map((part) => part.text ?? "").join("").trim();
  return "";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { LLMRouterError };
