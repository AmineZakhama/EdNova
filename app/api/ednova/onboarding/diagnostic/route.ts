import { NextResponse } from "next/server";
import { z } from "zod";

import { getLLMRouter } from "@/lib/ednova/llm-router";
import type { DiagnosticResult, LearningStyle } from "@/lib/ednova/types";

export const runtime = "nodejs";

const learningStyleEnum = z.enum([
  "visual",
  "analogies",
  "step-by-step",
  "examples",
  "repetition",
  "problem-solving",
]);

const diagnosticSchema = z.object({
  selfReportedLevel: z.string().trim().max(80).optional(),
  learningStyles: z.array(learningStyleEnum).max(6).optional(),
  // Legacy format support
  answers: z
    .array(
      z.object({
        question: z.string().max(300),
        answer: z.string().max(500),
      })
    )
    .optional(),
  // Enhanced cognitive scenarios & tricky puzzles
  scenarios: z
    .array(
      z.object({
        id: z.string().max(50),
        chosenStyle: learningStyleEnum,
        chosenLabel: z.string().max(300),
      })
    )
    .optional(),
  puzzles: z
    .array(
      z.object({
        id: z.string().max(50),
        question: z.string().max(300),
        selectedChoice: z.string().max(300),
        explanation: z.string().max(300).optional(),
      })
    )
    .optional(),
  subjects: z.array(z.string().max(60)).max(12).optional(),
  nickname: z.string().max(40).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = diagnosticSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Diagnostic submission payload is invalid." },
      { status: 400 }
    );
  }

  const { scenarios = [], puzzles = [], answers = [], selfReportedLevel, learningStyles = [], subjects = [], nickname } = parsed.data;

  // Ensure there is at least scenario data, puzzle data, or legacy answers
  if (scenarios.length === 0 && puzzles.length === 0 && answers.length === 0) {
    return NextResponse.json(
      { error: "Please complete at least a few diagnostic scenarios or puzzles." },
      { status: 400 }
    );
  }

  // Pre-calculate fallback diagnostic metrics deterministically
  const fallbackResult = computeDeterministicDiagnostic({
    scenarios,
    puzzles,
    answers,
    selfReportedLevel,
    learningStyles,
    nickname,
  });

  try {
    const promptTelemetry = {
      nickname: nickname || "Anonymous Learner",
      subjects,
      scenarios: scenarios.map((s) => ({
        scenarioId: s.id,
        chosenInstinctStyle: s.chosenStyle,
        reaction: s.chosenLabel,
      })),
      puzzles: puzzles.map((p) => ({
        puzzleId: p.id,
        question: p.question,
        chosenOption: p.selectedChoice,
        briefThought: p.explanation || "N/A",
      })),
      legacyAnswers: answers,
    };

    const systemPrompt = `You are EdNova's Adaptive Cognitive Diagnostic Engine.
You analyze an anonymous student's problem-solving choices, indirect scenarios, and tricky reasoning puzzles to deduce their cognitive profile WITHOUT them having to guess their learning styles directly.

Data provided:
1. Scenario decisions: Real-world problem scenarios revealing subconscious learning instincts (visual diagrams, step-by-step algorithms, conceptual analogies, concrete examples, active problem solving).
2. Tricky cognitive puzzles: Testing cognitive reflection (the $110 bundle test where $10 is an intuitive trap and $5 is correct), working memory calculation (drone flight altitude), physical invariance (melting ice in sealed container), and formal logic validity.
3. Subjects of interest.

Respond with valid JSON ONLY matching this schema:
{
  "level": "Concise starting level (e.g. 'Advanced Analytical Thinker', 'Methodical Problem Solver', 'Intuitive Explorer')",
  "styles": ["1 to 3 learning styles strictly from: visual, analogies, step-by-step, examples, repetition, problem-solving"],
  "archetype": "Memorable persona title (e.g. 'The Architectural Strategist', 'The Empirical Explorer', 'The Intuitive Synthesizer', 'The Methodical Logician')",
  "traits": {
    "abstractReasoning": 65-98,
    "reflectivePrecision": 65-98,
    "patternSynthesis": 65-98,
    "practicalApplication": 65-98
  },
  "scaffoldingPace": "Suggested tutor style (e.g. 'Socratic Deep-Dive (Minimal hints, deep probing)' or 'Guided Scaffolding (Structured step proofs)')",
  "encouragement": "Warm, empowering, 2-sentence summary explaining their cognitive superpowers and how EdNova will adapt for them."
}
Never infer personal demographic identity. Never grade harshly; celebrate analytical curiosity.`;

    const result = await getLLMRouter().generate({
      modelClass: "fast",
      purpose: "onboarding_diagnostic_classification",
      responseFormat: "json_object",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(promptTelemetry) },
      ],
      cacheTtlMs: 24 * 60 * 60_000,
    });

    const parsedJson = JSON.parse(extractJson(result.content)) as Partial<DiagnosticResult>;

    const validStyles: LearningStyle[] = Array.isArray(parsedJson.styles)
      ? (parsedJson.styles.filter((s): s is LearningStyle =>
          ["visual", "analogies", "step-by-step", "examples", "repetition", "problem-solving"].includes(s)
        ).slice(0, 3))
      : fallbackResult.styles;

    const finalResult: DiagnosticResult = {
      level: typeof parsedJson.level === "string" && parsedJson.level.trim() ? parsedJson.level.trim().slice(0, 80) : fallbackResult.level,
      styles: validStyles.length > 0 ? validStyles : fallbackResult.styles,
      archetype: typeof parsedJson.archetype === "string" ? parsedJson.archetype.slice(0, 60) : fallbackResult.archetype,
      traits: {
        abstractReasoning: clampTrait(parsedJson.traits?.abstractReasoning, fallbackResult.traits?.abstractReasoning ?? 85),
        reflectivePrecision: clampTrait(parsedJson.traits?.reflectivePrecision, fallbackResult.traits?.reflectivePrecision ?? 80),
        patternSynthesis: clampTrait(parsedJson.traits?.patternSynthesis, fallbackResult.traits?.patternSynthesis ?? 82),
        practicalApplication: clampTrait(parsedJson.traits?.practicalApplication, fallbackResult.traits?.practicalApplication ?? 88),
      },
      scaffoldingPace: typeof parsedJson.scaffoldingPace === "string" ? parsedJson.scaffoldingPace.slice(0, 100) : fallbackResult.scaffoldingPace,
      encouragement: typeof parsedJson.encouragement === "string" && parsedJson.encouragement.trim()
        ? parsedJson.encouragement.trim().slice(0, 320)
        : fallbackResult.encouragement,
    };

    return NextResponse.json(finalResult);
  } catch {
    // If LLM fails or is unreachable, deliver the deterministic diagnostic calculation
    return NextResponse.json({
      ...fallbackResult,
      fallback: true,
    });
  }
}

function clampTrait(val: unknown, fallback: number): number {
  if (typeof val === "number" && !isNaN(val)) {
    return Math.max(50, Math.min(99, Math.round(val)));
  }
  return fallback;
}

function computeDeterministicDiagnostic(params: {
  scenarios: Array<{ chosenStyle: LearningStyle; chosenLabel: string }>;
  puzzles: Array<{ id: string; selectedChoice: string; explanation?: string }>;
  answers: Array<{ question: string; answer: string }>;
  selfReportedLevel?: string;
  learningStyles: LearningStyle[];
  nickname?: string;
}): DiagnosticResult {
  const { scenarios, puzzles, selfReportedLevel, learningStyles } = params;

  // 1. Tally styles from indirect scenarios
  const styleScores: Record<LearningStyle, number> = {
    visual: 0,
    analogies: 0,
    "step-by-step": 0,
    examples: 0,
    repetition: 0,
    "problem-solving": 0,
  };

  for (const s of scenarios) {
    if (s.chosenStyle && styleScores[s.chosenStyle] !== undefined) {
      styleScores[s.chosenStyle] += 3;
    }
  }

  // Include any initial/self-reported styles as secondary weights
  for (const ls of learningStyles) {
    if (styleScores[ls] !== undefined) {
      styleScores[ls] += 1;
    }
  }

  // Deduce top styles
  const sortedStyles = (Object.keys(styleScores) as LearningStyle[])
    .sort((a, b) => styleScores[b] - styleScores[a])
    .filter((s) => styleScores[s] > 0);

  const topStyles: LearningStyle[] = sortedStyles.length >= 2
    ? sortedStyles.slice(0, 3)
    : sortedStyles.length === 1
    ? [sortedStyles[0], "problem-solving"]
    : ["visual", "step-by-step", "problem-solving"];

  // 2. Evaluate tricky puzzle responses
  let reflectiveScore = 70;
  let abstractScore = 72;
  let precisionScore = 74;
  let practicalScore = 75;

  for (const p of puzzles) {
    const choice = p.selectedChoice.toLowerCase();

    // Puzzle 1 ($110 tablet bundle: $5 is reflective correct, $10 is intuitive trap)
    if (p.id === "puzzle-1" || choice.includes("$5") || choice === "b") {
      reflectiveScore += 18;
      abstractScore += 8;
    } else if (choice.includes("$10")) {
      // Fast heuristic - practical/intuitive
      practicalScore += 10;
    }

    // Puzzle 2 (Drone altitude: 46m is correct sequential execution)
    if (p.id === "puzzle-2" || choice.includes("46") || choice === "a") {
      precisionScore += 18;
      abstractScore += 6;
    } else {
      precisionScore += 6;
    }

    // Puzzle 3 (Ice melting in sealed vessel: water level identical, scale identical)
    if (p.id === "puzzle-3" || choice.includes("identical") || choice.includes("same")) {
      abstractScore += 16;
      reflectiveScore += 8;
    } else {
      abstractScore += 6;
    }

    // Puzzle 4 (Formal logic syllogism: "None of the above can be guaranteed")
    if (p.id === "puzzle-4" || choice.includes("none of the above") || choice.includes("guaranteed")) {
      abstractScore += 14;
      precisionScore += 12;
    } else {
      precisionScore += 5;
    }
  }

  // Determine Archetype
  let archetype = "The Adaptive Scholar";
  if (topStyles.includes("visual") && topStyles.includes("problem-solving")) {
    archetype = "The Architectural Strategist";
  } else if (topStyles.includes("analogies")) {
    archetype = "The Intuitive Synthesizer";
  } else if (topStyles.includes("step-by-step")) {
    archetype = "The Methodical Logician";
  } else if (topStyles.includes("problem-solving")) {
    archetype = "The Empirical Explorer";
  }

  // Determine Level
  const avgScore = (reflectiveScore + abstractScore + precisionScore + practicalScore) / 4;
  let level = selfReportedLevel || "Curious Explorer";
  if (avgScore >= 88) {
    level = "Advanced Analytical Thinker";
  } else if (avgScore >= 80) {
    level = "Reflective Problem Solver";
  } else if (avgScore >= 74) {
    level = "Methodical Concept Builder";
  }

  const encouragement = `Your answers reveal strong ${topStyles.join(" and ")} intuition with notable reflective precision. EdNova will tailor diagrams, progressive step proofs, and interactive challenges specifically to your rhythm.`;

  return {
    level,
    styles: topStyles,
    archetype,
    traits: {
      abstractReasoning: Math.min(98, abstractScore),
      reflectivePrecision: Math.min(98, reflectiveScore),
      patternSynthesis: Math.min(98, Math.round((abstractScore + precisionScore) / 2)),
      practicalApplication: Math.min(98, practicalScore),
    },
    scaffoldingPace: "Socratic Scaffolding (Reflective & In-depth)",
    encouragement,
  };
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}
