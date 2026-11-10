import "server-only";

import { createHash } from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { detectLikelyLanguage, languageName } from "@/lib/ednova/language";
import type { SupportedLanguage, TutorHint } from "@/lib/ednova/types";

type TranslationResult = {
  text: string;
  language: SupportedLanguage;
  degraded: boolean;
  notice?: string;
};

type CachedValue<T> = { value: T; expiresAt: number };

/**
 * Gemini is a declared external service used only for language access. It is
 * never used for EdNova tutoring, model routing, RAG, diagnostics, or grading.
 */
export class TranslationService {
  private readonly cache = new Map<string, CachedValue<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  private get client(): GoogleGenerativeAI {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("Gemini translation is not configured.");
    return new GoogleGenerativeAI(key);
  }

  private get modelName(): string {
    return process.env.GEMINI_MODEL || "gemini-2.5-flash";
  }

  async prepareInput(message: string, preferredLanguage?: SupportedLanguage): Promise<TranslationResult> {
    const likelyLanguage = detectLikelyLanguage(message, preferredLanguage);
    if (likelyLanguage === "en") return { text: message, language: "en", degraded: false };

    try {
      const translated = await this.cached(`input:${message}`, async () => {
        const raw = await this.generate(`Detect the language and translate this learner message into English. It may be Arabic, Tunisian Darija written in Arabic, Darija in Arabizi/Latin script, or French. Return JSON only: {"language":"ar"|"darija"|"fr"|"en","englishText":"..."}. Preserve the learning meaning and never add personal information.\n\nMessage:\n${message}`, true);
        const value = JSON.parse(extractJson(raw)) as { language?: string; englishText?: string };
        const language = isSupportedLanguage(value.language) ? value.language : likelyLanguage;
        const englishText = typeof value.englishText === "string" && value.englishText.trim() ? value.englishText.trim() : message;
        return { language, englishText };
      });
      return { text: translated.englishText, language: translated.language, degraded: false };
    } catch {
      return {
        text: message,
        language: likelyLanguage,
        degraded: true,
        notice: "Translation is temporarily unavailable. EdNova is answering in your original language when it can.",
      };
    }
  }

  async translateText(text: string, language: SupportedLanguage): Promise<TranslationResult> {
    if (language === "en") return { text, language, degraded: false };
    try {
      const translated = await this.cached(`output:${language}:${text}`, () => this.generate(`Translate the following EdNova learning response into ${languageName(language)}. Preserve Markdown, source labels, formulas, and the supportive peer-tutor tone. Return only the translation.\n\n${text}`));
      return { text: translated, language, degraded: false };
    } catch {
      return { text, language, degraded: true, notice: "The answer is shown in English because the translation service is temporarily unavailable." };
    }
  }

  async translateHint(hint: TutorHint, language: SupportedLanguage): Promise<{ hint: TutorHint; notice?: string }> {
    if (language === "en") return { hint };
    try {
      const translated = await this.cached(`hint:${language}:${JSON.stringify(hint)}`, async () => {
        const raw = await this.generate(`Translate only the values in this JSON object into ${languageName(language)}. Keep all keys and enum values exactly unchanged. Return valid JSON only.\n\n${JSON.stringify(hint)}`, true);
        const value = JSON.parse(extractJson(raw)) as TutorHint;
        return { ...hint, hint: String(value.hint || hint.hint), nextQuestion: String(value.nextQuestion || hint.nextQuestion) };
      });
      return { hint: translated };
    } catch {
      return { hint, notice: "The first hint is shown in English because translation is temporarily unavailable." };
    }
  }

  private async generate(prompt: string, json = false): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      ...(json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    if (!text) throw new Error("Gemini returned an empty translation.");
    return text;
  }

  private async cached<T>(keySource: string, generate: () => Promise<T>): Promise<T> {
    const key = createHash("sha256").update(keySource.replace(/\s+/g, " ").trim()).digest("hex");
    const current = this.cache.get(key) as CachedValue<T> | undefined;
    if (current && current.expiresAt > Date.now()) return current.value;
    const pending = this.inFlight.get(key) as Promise<T> | undefined;
    if (pending) return pending;

    const task = generate().then((value) => {
      this.cache.set(key, { value, expiresAt: Date.now() + 60 * 60_000 });
      return value;
    }).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, task);
    return task;
  }
}

let service: TranslationService | undefined;

export function getTranslationService(): TranslationService {
  service ??= new TranslationService();
  return service;
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return value === "en" || value === "fr" || value === "ar" || value === "darija";
}
