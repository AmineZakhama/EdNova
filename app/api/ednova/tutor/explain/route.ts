import { NextResponse } from "next/server";

import { getLLMRouter, LLMRouterError } from "@/lib/ednova/llm-router";
import { buildExplanationMessages, classifyQuestionIntent, tutorRequestSchema } from "@/lib/ednova/tutor";
import { getTranslationService } from "@/lib/ednova/translation";
import { getCurrentUser } from "@/lib/ednova/auth";
import { checkAndDeductTokens, TOKEN_COST_FAST, TOKEN_COST_THINKING } from "@/lib/ednova/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = tutorRequestSchema.safeParse(body);
  if (!parsed.success) {
    console.error("tutorRequestSchema validation error (explain):", JSON.stringify(parsed.error.issues, null, 2));
    return NextResponse.json({ error: "Please enter a valid learning question." }, { status: 400 });
  }

  try {
    const translations = getTranslationService();
    const input = await translations.prepareInput(parsed.data.message, parsed.data.profile?.language);
    const questionIntent = parsed.data.questionIntent ?? classifyQuestionIntent(input.text);
    const isDirectExplanation = questionIntent === "explanation" || parsed.data.answerRequested;
    const tutorRequest = {
      ...parsed.data,
      message: input.text,
      questionIntent,
      answerRequested: isDirectExplanation,
      profile: { ...parsed.data.profile, language: input.degraded ? input.language : ("en" as const) },
    };
    // Choose modelClass based on user preference:
    // "fast" uses fast model (MODEL_FAST / qwen2.5-3b)
    // "thinking" uses large model (MODEL_LARGE / llama3.1-8b)
    const modelClass = tutorRequest.inferenceMode === "fast" ? "fast" : "large";

    // Enforce token balance check if user is authenticated
    const user = await getCurrentUser();
    let remainingTokens: number | undefined;

    if (user) {
      const tokenCost = modelClass === "fast" ? TOKEN_COST_FAST : TOKEN_COST_THINKING;
      const tokenCheck = await checkAndDeductTokens(
        user.id,
        tokenCost,
        modelClass === "fast" ? "USAGE_FAST" : "USAGE_THINKING"
      );

      if (!tokenCheck.allowed) {
        return NextResponse.json(
          {
            error: "OUT_OF_TOKENS",
            message: `You've run out of study tokens (${tokenCheck.balance.toLocaleString()} available, ${tokenCost} needed). Please top up your tokens or switch to Fast Mode.`,
            balance: tokenCheck.balance,
            cost: tokenCheck.cost,
          },
          { status: 402 }
        );
      }
      remainingTokens = tokenCheck.balance;
    }

    const response = await getLLMRouter().generate({
      modelClass,
      purpose: tutorRequest.answerRequested ? "tutor_worked_answer" : "tutor_guided_explanation",
      messages: buildExplanationMessages(tutorRequest),
      temperature: modelClass === "fast" ? 0.25 : 0.35,
      cacheTtlMs: 30 * 60_000,
    });

    const output = input.degraded
      ? { text: response.content, notice: undefined }
      : await translations.translateText(response.content, input.language);
    return NextResponse.json({
      explanation: output.text,
      questionIntent,
      modelClass: response.modelClass,
      modelName: response.model,
      fallback: response.fallback,
      notice: response.notice ?? input.notice ?? output.notice,
      cached: response.cached,
      tokens: remainingTokens,
    });
  } catch (error) {
    const status = error instanceof LLMRouterError && error.status ? error.status : 503;
    return NextResponse.json(
      { error: "The detailed explanation is unavailable right now. Try the hint, then retry when the queue clears.", retryable: status === 429 || status >= 500 },
      { status },
    );
  }
}
