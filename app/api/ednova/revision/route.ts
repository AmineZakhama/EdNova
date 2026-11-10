import { NextResponse } from "next/server";
import { z } from "zod";

import { getLLMRouter, LLMRouterError } from "@/lib/ednova/llm-router";
import { retrieveRelevantChunks } from "@/lib/ednova/rag";
import { buildTutorSystemPrompt, learnerProfileSchema } from "@/lib/ednova/tutor";
import type { KnowledgeNote } from "@/lib/ednova/types";

export const runtime = "nodejs";

const requestSchema = z.object({
  topic: z.string().trim().min(2).max(180),
  depth: z.enum(["cram", "comprehensive", "active_recall"]).optional(),
  profile: learnerProfileSchema.optional(),
  notes: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().max(120),
        content: z.string().max(40_000),
        createdAt: z.string(),
        sample: z.boolean().optional(),
      })
    )
    .max(25)
    .optional(),
});

export type RevisionQuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type RevisionNotes = {
  title: string;
  summary: string;
  keyPoints: string[];
  formulas: string[];
  commonMistakes: string[];
  flashcards: Array<{
    front: string;
    back: string;
    options?: string[];
    correctOptionIndex?: number;
  }>;
  quiz: RevisionQuizQuestion[];
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a topic before generating revision notes." }, { status: 400 });
  }

  const context = retrieveRelevantChunks(parsed.data.topic, (parsed.data.notes ?? []) as KnowledgeNote[], 4);
  const depth = parsed.data.depth || "comprehensive";

  const depthPrompt =
    depth === "cram"
      ? "Format as an ultra-high-yield exam cram sheet: concise bullets, core equations, and traps."
      : depth === "active_recall"
      ? "Format with an active-recall focus: conceptual question prompts, memory hooks, and self-checks."
      : "Format as a structured, balanced conceptual revision study pack.";

  try {
    // LARGE is reserved for a complete, internally coherent revision pack in one call.
    const response = await getLLMRouter().generate({
      modelClass: "large",
      purpose: "revision_notes_and_flashcards",
      responseFormat: "json_object",
      temperature: 0.25,
      cacheTtlMs: 24 * 60 * 60_000,
      messages: [
        {
          role: "system",
          content: `${buildTutorSystemPrompt(parsed.data.profile, context)}

${depthPrompt}

Return JSON only:
{
  "title": "Clear Topic Title",
  "summary": "2-3 sentence high-yield summary of the core concept and its significance",
  "keyPoints": ["Concise point 1", "Concise point 2", "Concise point 3", "Concise point 4"],
  "formulas": ["Equation or key term with brief notation", "Formula 2"],
  "commonMistakes": ["Frequent misconception and how to avoid it", "Pitfall 2"],
  "flashcards": [
    {
      "front": "Direct question testing one concept",
      "back": "Concise, precise answer and explanation",
      "options": ["Correct answer choice", "Plausible distractor 1", "Plausible distractor 2", "Plausible distractor 3"],
      "correctOptionIndex": 0
    }
  ],
  "quiz": [
    {
      "question": "Realistic multiple choice question testing application",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why this answer is correct and why other choices fail"
    }
  ]
}

Include 4-6 key points, 2-4 formulas/key terms, 2-4 common mistakes, exactly 5 flashcards, and exactly 3 multiple-choice self-test questions (each with 4 options and 0-indexed correctIndex). Cite note titles in a key point only when a source was supplied.`,
        },
        { role: "user", content: `Create revision notes for: ${parsed.data.topic}` },
      ],
    });

    return NextResponse.json({
      notes: parseNotes(response.content, parsed.data.topic),
      sources: context.map((chunk) => chunk.title),
      fallback: response.fallback,
      notice: response.notice,
      cached: response.cached,
    });
  } catch (error) {
    const status = error instanceof LLMRouterError && error.status ? error.status : 503;
    return NextResponse.json(
      { error: "Revision notes are temporarily unavailable. Try again after the queue clears.", retryable: status === 429 || status >= 500 },
      { status }
    );
  }
}

function parseNotes(raw: string, topic: string): RevisionNotes {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;

  try {
    const value = JSON.parse(candidate) as Record<string, unknown>;
    return {
      title: stringValue(value.title, `${topic} revision notes`),
      summary: stringValue(
        value.summary,
        `High-yield conceptual revision pack covering the core foundations and exam essentials of ${topic}.`
      ),
      keyPoints: stringList(value.keyPoints, 8),
      formulas: stringList(value.formulas, 6),
      commonMistakes: stringList(value.commonMistakes, 6),
      flashcards: Array.isArray(value.flashcards)
        ? value.flashcards.slice(0, 8).flatMap((card) => {
            if (!card || typeof card !== "object") return [];
            const item = card as Record<string, unknown>;
            const front = stringValue(item.front, "");
            const back = stringValue(item.back, "");
            const rawOptions = Array.isArray(item.options)
              ? item.options.filter((opt): opt is string => typeof opt === "string" && Boolean(opt.trim())).slice(0, 4)
              : [];
            const options =
              rawOptions.length >= 2
                ? rawOptions
                : [
                    back.slice(0, 80),
                    "Opposite biochemical / theoretical mechanism",
                    "Only applicable under strict equilibrium starvation",
                    "Reduces efficiency or acts as a non-competitive block",
                  ];
            const correctOptionIndex =
              typeof item.correctOptionIndex === "number" &&
              item.correctOptionIndex >= 0 &&
              item.correctOptionIndex < options.length
                ? item.correctOptionIndex
                : 0;
            return front && back ? [{ front, back, options, correctOptionIndex }] : [];
          })
        : [],
      quiz: Array.isArray(value.quiz)
        ? value.quiz.slice(0, 5).flatMap((q) => {
            if (!q || typeof q !== "object") return [];
            const item = q as Record<string, unknown>;
            const question = stringValue(item.question, "");
            const options = Array.isArray(item.options)
              ? item.options.filter((opt): opt is string => typeof opt === "string" && Boolean(opt.trim())).slice(0, 4)
              : [];
            const correctIndex = typeof item.correctIndex === "number" && item.correctIndex >= 0 && item.correctIndex < options.length ? item.correctIndex : 0;
            const explanation = stringValue(item.explanation, "Review the key points above for this concept.");
            return question && options.length >= 2 ? [{ question, options, correctIndex, explanation }] : [];
          })
        : [],
    };
  } catch {
    return {
      title: `${topic} revision notes`,
      summary: `High-yield overview of ${topic}.`,
      keyPoints: [raw.slice(0, 700)],
      formulas: [],
      commonMistakes: [],
      flashcards: [],
      quiz: [],
    };
  }
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : fallback;
}

function stringList(value: unknown, limit: number): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        .slice(0, limit)
        .map((item) => item.trim().slice(0, 500))
    : [];
}
