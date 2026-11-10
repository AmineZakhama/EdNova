import { NextResponse } from "next/server";

import { getLLMRouter, LLMRouterError } from "@/lib/ednova/llm-router";
import { buildHintMessages, classifyQuestionIntent, parseHint, tutorRequestSchema } from "@/lib/ednova/tutor";
import { getTranslationService } from "@/lib/ednova/translation";
import { getCurrentUser } from "@/lib/ednova/auth";
import { checkAndDeductTokens } from "@/lib/ednova/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = tutorRequestSchema.safeParse(body);
  if (!parsed.success) {
    console.error("tutorRequestSchema validation error (hint):", JSON.stringify(parsed.error.issues, null, 2));
    return NextResponse.json({ error: "Please enter a valid learning question." }, { status: 400 });
  }

  try {
    const translations = getTranslationService();
    const input = await translations.prepareInput(parsed.data.message, parsed.data.profile?.language);
    const questionIntent = parsed.data.questionIntent ?? classifyQuestionIntent(input.text);

    const tutorRequest = {
      ...parsed.data,
      message: input.text,
      questionIntent,
      // The EdNova model receives English after successful Gemini translation.
      // If Gemini degrades, it receives the original message plus the language cue.
      profile: { ...parsed.data.profile, language: input.degraded ? input.language : ("en" as const) },
    };
    const modelClass = tutorRequest.inferenceMode === "thinking" ? "large" : "fast";

    // Enforce token balance check if user is authenticated
    const user = await getCurrentUser();
    let remainingTokens: number | undefined;

    if (user) {
      const tokenCost = modelClass === "large" ? 50 : 15;
      const tokenCheck = await checkAndDeductTokens(
        user.id,
        tokenCost,
        modelClass === "large" ? "USAGE_THINKING" : "USAGE_FAST"
      );

      if (!tokenCheck.allowed) {
        return NextResponse.json(
          {
            error: "OUT_OF_TOKENS",
            message: `You've run out of study tokens (${tokenCheck.balance.toLocaleString()} available, ${tokenCost} needed). Please top up to continue receiving hints.`,
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
      purpose: "tutor_hint_and_confusion_check",
      messages: buildHintMessages(tutorRequest),
      responseFormat: "json_object",
      temperature: 0.2,
      cacheTtlMs: 15 * 60_000,
    });

    const rawHint = parseHint(response.content, tutorRequest.message, tutorRequest.profile, tutorRequest.hintLevel ?? 1);
    const output = input.degraded ? { hint: rawHint } : await translations.translateHint(rawHint, input.language);

    return NextResponse.json({
      hint: output.hint,
      modelClass: response.modelClass,
      modelName: response.model,
      cached: response.cached,
      notice: input.notice ?? output.notice,
      tokens: remainingTokens,
    });
  } catch (error) {
    return failureResponse(error);
  }
}

function failureResponse(error: unknown) {
  const status = error instanceof LLMRouterError && error.status ? error.status : 503;
  const retryable = status === 429 || status >= 500;
  return NextResponse.json(
    { error: "The tutor is temporarily unavailable. Your question was not lost.", retryable },
    { status },
  );
}
