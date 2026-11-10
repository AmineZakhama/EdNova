import { NextResponse } from "next/server";
import { z } from "zod";

import { getLLMRouter, LLMRouterError } from "@/lib/ednova/llm-router";
import { retrieveRelevantChunks } from "@/lib/ednova/rag";
import { buildTutorSystemPrompt, learnerProfileSchema } from "@/lib/ednova/tutor";
import type { KnowledgeNote } from "@/lib/ednova/types";

export const runtime = "nodejs";

const schema = z.object({ topic: z.string().trim().min(2).max(180), profile: learnerProfileSchema.optional(), notes: z.array(z.object({ id: z.string(), title: z.string().max(120), content: z.string().max(40_000), createdAt: z.string(), sample: z.boolean().optional() })).max(25).optional() });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a quiz topic first." }, { status: 400 });
  const context = retrieveRelevantChunks(parsed.data.topic, (parsed.data.notes ?? []) as KnowledgeNote[], 4);
  try {
    // LARGE creates all quiz items and their explanations as one cached request.
    const response = await getLLMRouter().generate({
      modelClass: "large", purpose: "collaborative_quiz_with_explanations", responseFormat: "json_object", temperature: 0.3, cacheTtlMs: 24 * 60 * 60_000,
      messages: [
        { role: "system", content: `${buildTutorSystemPrompt(parsed.data.profile, context)}\n\nReturn JSON only: {"title":"...","questions":[{"question":"...","options":["...","...","...","..."],"correctAnswer":"one exact option","explanation":"a short supportive explanation"}]}. Make exactly 5 varied, fair multiple-choice questions. Include all explanations in this one response.` },
        { role: "user", content: `Make a collaborative quiz about ${parsed.data.topic}.` },
      ],
    });
    return NextResponse.json({ quiz: parseQuiz(response.content, parsed.data.topic), fallback: response.fallback, notice: response.notice, cached: response.cached, sources: context.map((chunk) => chunk.title) });
  } catch (error) {
    const status = error instanceof LLMRouterError && error.status ? error.status : 503;
    return NextResponse.json({ error: "Quiz generation is temporarily unavailable. You can launch the synthetic demo quiz instead.", retryable: status === 429 || status >= 500 }, { status });
  }
}

function parseQuiz(raw: string, topic: string) {
  const start = raw.indexOf("{"); const end = raw.lastIndexOf("}"); const json = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
  const value = JSON.parse(json) as { title?: unknown; questions?: unknown };
  const questions = Array.isArray(value.questions) ? value.questions.slice(0, 5).flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const question = entry as Record<string, unknown>;
    const options = Array.isArray(question.options) ? question.options.filter((option): option is string => typeof option === "string" && Boolean(option.trim())).slice(0, 4) : [];
    const correctAnswer = typeof question.correctAnswer === "string" ? question.correctAnswer : "";
    if (options.length !== 4 || !options.includes(correctAnswer) || typeof question.question !== "string" || typeof question.explanation !== "string") return [];
    return [{ id: `generated-${index + 1}`, question: question.question.slice(0, 360), options, correctAnswer, explanation: question.explanation.slice(0, 500) }];
  }) : [];
  if (!questions.length) throw new Error("Quiz format was incomplete.");
  return { title: typeof value.title === "string" ? value.title.slice(0, 120) : `${topic} collaborative quiz`, questions };
}
