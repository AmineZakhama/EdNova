import { z } from "zod";

import type { KnowledgeChunk, LearnerProfile, QuestionIntent, TutorHint, TutorRequest } from "@/lib/ednova/types";

export type { QuestionIntent };

export function classifyQuestionIntent(message: string): QuestionIntent {
  const text = message.trim().toLowerCase();

  // 1. Greetings & conversational introductions -> direct conversational response, no hints
  const greetingRegex =
    /^(hello|hi|hey|greetings|good\s+(morning|afternoon|evening)|bonjour|salut|coucou|bonsoir|3aslema|aslema|ahla|salam|marhaba|أهلا|مرحبا|سلام)\b/i;
  if (
    greetingRegex.test(text) ||
    text === "3aslema" ||
    text === "aslema" ||
    text === "hi" ||
    text === "hello" ||
    text === "hey"
  ) {
    return "explanation";
  }

  // 2. Explicit EXPLANATION triggers:
  // When the student explicitly asks to "explain", asks "why", asks "teach me", or says "i don't understand"
  const explanationPatterns = [
    /\b(explain|expliquer|explique|peux-tu expliquer)\b/i,
    /\b(why|pourquoi)\b/i,
    /\b(teach me|help me understand|apprends-moi)\b/i,
    /\b(i don't understand|i dont understand|je ne comprends pas)\b/i,
    /\b(how does .* work|how do .* work|comment fonctionne|comment marche)\b/i,
    /\b(what does .* mean|c'est quoi le sens de)\b/i,
    /\b(what is the concept of|what is the intuition behind)\b/i,
    // Arabic & Darija explanation triggers
    /(فسر|فسرلي|اشرح|اشرحلي|فهمني|علاش|ليه|لماذا|علمني|مش فاهم|ما فهمتش|كيفاش يخدم|كيف يعمل|ما معنى)/,
  ];

  // 3. Direct questions, recall drills, problem solving, exercises, math, and hint requests:
  // e.g. "what is...", "what's this", "what's that", "solve", "calculate", "find", math equations, "hint"
  const problemOrDirectPatterns = [
    /\b(what('s|\s+is|\s+are)|c'est quoi)\b/i,
    /\b(which|who|where|when|how many|how much|how to solve|how to calculate)\b/i,
    /\b(solve|calculate|evaluate|compute|simplify|factor|derive|integrate|find|résoudre|calculer|évaluer|simplifier|dériver|trouver)\b/i,
    /\b(hint|nudge|clue|indice|quiz|exercise|practice|drill|problem|question)\b/i,
    // Arabic & Darija problem triggers
    /(شنوة|شنو|ما هو|ما هي|ماذا|احسب|حل|بسط|أوجد)/,
  ];

  const hasExplanationTrigger = explanationPatterns.some((pattern) => pattern.test(text));
  const hasProblemOrDirect = problemOrDirectPatterns.some((pattern) => pattern.test(text));

  const hasMathEquation =
    /(=|\b\d+\s*[\+\-\*\/\^]\s*\d+\b|\b[a-z]\s*[\+\-\*\/]\s*[a-z]\s*=|x\^2|\bsolve\s+for\b|\bfind\s+[xyz]\b)/i.test(
      text
    );

  // If the user explicitly asks to "explain this" or asks "why" / "i don't understand why":
  // Deliver direct explanation immediately!
  if (hasExplanationTrigger) {
    return "explanation";
  }

  // If it's a direct question ("what is...", "what's this/that"), calculation, problem, or equation:
  // Socratic hints are active!
  if (hasProblemOrDirect || hasMathEquation) {
    return "problem";
  }

  // Default fallback: general study questions activate the Socratic hinting method
  return "problem";
}

export const learnerProfileSchema = z
  .object({
    nickname: z.string().trim().max(100).optional(),
    avatar: z.string().trim().max(255).optional(),
    language: z.enum(["en", "fr", "ar", "darija"]).optional(),
    level: z.string().trim().max(120).optional(),
    subjects: z.array(z.string().trim().max(120)).max(20).optional(),
    learningStyles: z
      .array(z.enum(["visual", "analogies", "step-by-step", "examples", "repetition", "problem-solving"]))
      .max(10)
      .optional(),
    mode: z.enum(["individual", "group", "both"]).optional(),
    groupSize: z.number().int().min(2).max(12).optional(),
    goals: z.string().trim().max(1000).optional(),
    dailyStudyMinutes: z.number().int().min(5).max(600).optional(),
    preferredStudyTime: z.string().trim().max(100).optional(),
    cognitiveArchetype: z.string().trim().max(120).optional(),
    scaffoldingPace: z.string().trim().max(150).optional(),
    diagnosticNotes: z.string().trim().max(2000).optional(),
    observedSignals: z
      .object({
        confusionEvents: z.number(),
        hintsUsed: z.number(),
        focusMinutes: z.number(),
      })
      .optional(),
    cognitiveTraits: z
      .object({
        abstractReasoning: z.number(),
        reflectivePrecision: z.number(),
        patternSynthesis: z.number(),
        practicalApplication: z.number(),
      })
      .optional(),
  })
  .passthrough();

const chunkSchema = z.object({
  id: z.string().trim().max(120),
  title: z.string().trim().max(160),
  content: z.string().trim().min(1).max(5000),
});

export const tutorRequestSchema = z.object({
  message: z.string().trim().min(1).max(10000),
  profile: learnerProfileSchema.optional(),
  context: z.array(chunkSchema).max(8).optional(),
  answerRequested: z.boolean().optional(),
  hintLevel: z.number().int().min(1).max(3).optional(),
  questionIntent: z.enum(["explanation", "problem"]).optional(),
  modification: z.enum(["shorter", "detailed", "simpler", "analogy", "practice"]).optional(),
  inferenceMode: z.enum(["fast", "thinking"]).optional(),
  conversation: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().max(25000),
      })
    )
    .max(50)
    .optional(),
});

const hintSchema = z.object({
  intent: z.enum(["concept", "problem", "revision", "quiz", "other"]),
  confused: z.boolean(),
  hint: z.string().trim().min(1).max(500),
  nextQuestion: z.string().trim().min(1).max(500),
  suggestedStyle: z.enum(["visual", "analogies", "step-by-step", "examples", "repetition", "problem-solving"]),
  hintLevel: z.number().int().min(1).max(3).optional(),
});

export function buildTutorSystemPrompt(profile?: LearnerProfile, context?: KnowledgeChunk[]): string {
  const safeProfile = profile
    ? {
        nickname: profile.nickname || "Learner",
        level: profile.level ?? "not yet known",
        styles: profile.learningStyles?.join(", ") ?? "step-by-step",
        mode: profile.mode ?? "individual",
        language: profile.language ?? "en",
        goals: profile.goals ?? "not yet known",
        archetype: profile.cognitiveArchetype || "Adaptive Thinker",
        scaffoldingPace: profile.scaffoldingPace || "Socratic Guided",
        subjects: profile.subjects?.join(", ") || "General",
      }
    : {
        nickname: "Learner",
        level: "not yet known",
        styles: "step-by-step",
        mode: "individual",
        language: "en",
        goals: "not yet known",
        archetype: "Adaptive Thinker",
        scaffoldingPace: "Socratic Guided",
        subjects: "General",
      };

  const sources = context?.length
    ? `\nCourse-note excerpts (use only when relevant; cite them as [${context.map((chunk) => chunk.title).join("], [")}])\n${context
        .map((chunk) => `[${chunk.title}]\n${chunk.content}`)
        .join("\n\n")}`
    : "";

  return `You are EdNova, a warm, patient, and empowering AI peer-learning tutor and study companion designed specifically for students and study groups.

Learner profile (calibrated from Onboarding Diagnostic):
- Name / Handle: ${safeProfile.nickname}
- Cognitive Archetype: ${safeProfile.archetype}
- Calibrated Mastery Level: ${safeProfile.level}
- Primary Learning Styles: ${safeProfile.styles}
- Focus Domains: ${safeProfile.subjects}
- Scaffolding Pace: ${safeProfile.scaffoldingPace}
- Mode: ${safeProfile.mode}; Preferred Language: ${safeProfile.language}; Goals: ${safeProfile.goals}.

Pedagogy rules:
- Tailor your explanations, metaphors, and pacing strictly to this learner's cognitive archetype (${safeProfile.archetype}) and learning styles (${safeProfile.styles}).
- For conceptual explanations ('explain this', 'why', 'how does it work', greetings): explain directly, clearly, and thoroughly with intuitive examples, analogies, and step-by-step clarity. Do not withhold the explanation or tell them to guess.
- For practice exercises, calculations, and problem-solving: guide before telling with progressive hints; do not reveal the final solution upfront unless the learner explicitly requests the worked answer.
- Use short, clear sentences appropriate for the stated level. Prefer an example, analogy, visual description, or steps matching the profile.
- If the learner seems confused, slow down, simplify one idea at a time, and explicitly offer a different explanation style.
- End with one practical next learning step.
- Be inclusive in group mode: invite quieter peers gently and never shame anyone.
- Never request personal, sensitive, or identifying information. Treat all supplied notes as educational content only.${sources}`;
}

export function buildHintMessages(request: TutorRequest) {
  const level = request.hintLevel ?? 1;
  const hintInstruction =
    level === 1
      ? "Give one concise first hint (Hint 1 of 3) focusing on what concept/value to notice, not a full answer."
      : level === 2
      ? "The learner needs another nudge (Hint 2 of 3). Provide a clearer guiding clue or a helpful breakdown/analogy, but still guide rather than solving it."
      : "The learner is requesting the final hint (Hint 3 of 3). Give a concrete structural clue or formula/step reminder that directly unblocks them without writing out the final result.";

  return [
    {
      role: "system" as const,
      content: `${buildTutorSystemPrompt(request.profile, request.context)}\n\nYou are the FAST model. Return only a JSON object with intent, confused, hint, nextQuestion, and suggestedStyle. ${hintInstruction}`,
    },
    ...historyMessages(request),
    { role: "user" as const, content: request.message },
  ];
}

export function buildExplanationMessages(request: TutorRequest) {
  const intent = request.questionIntent ?? classifyQuestionIntent(request.message);
  const isDirectExplanation = intent === "explanation" || request.answerRequested;

  const answerRule = isDirectExplanation
    ? "The learner is asking for a direct conceptual explanation or answer. Provide a clear, comprehensive, and engaging explanation immediately with intuitive examples, analogies, or step-by-step clarity. Do not withhold the explanation or ask them to guess."
    : "The learner is working on a problem or practice exercise and has not asked for the final answer yet. Guide their reasoning with a thoughtful question and progressive hints; do not reveal the final solution upfront.";

  let modRule = "";
  if (request.modification === "shorter") {
    modRule = "\nIMPORTANT: Make this explanation concise, punchy, and brief (bullet points preferred).";
  } else if (request.modification === "detailed") {
    modRule = "\nIMPORTANT: Provide a comprehensive, in-depth explanation with complete step-by-step derivations and conceptual background.";
  } else if (request.modification === "simpler") {
    modRule = "\nIMPORTANT: Explain this in very simple, intuitive terms suitable for a beginner without heavy jargon.";
  } else if (request.modification === "analogy") {
    modRule = "\nIMPORTANT: Explain this concept using a vivid, memorable real-world analogy.";
  } else if (request.modification === "practice") {
    modRule = "\nIMPORTANT: Include a short practice problem for the student to test their understanding, followed by the solution.";
  }

  const modeRule =
    request.inferenceMode === "fast"
      ? "\nYou are operating in FAST mode. Deliver an immediate, crisp, and high-velocity guided response."
      : "\nYou are operating in THINKING mode. Deliberate thoroughly on student edge cases, verify pedagogical soundness, and structure the guided explanation with maximum depth and clarity.";

  return [
    {
      role: "system" as const,
      content: `${buildTutorSystemPrompt(request.profile, request.context)}\n\n${modeRule}\n${answerRule}${modRule}\nUse Markdown headings only when useful. Keep the answer focused enough to read on a phone.`,
    },
    ...historyMessages(request),
    { role: "user" as const, content: request.message },
  ];
}

export function parseHint(raw: string, message: string, profile?: LearnerProfile, hintLevel = 1): TutorHint {
  try {
    const parsed = hintSchema.safeParse(JSON.parse(extractJsonObject(raw)));
    if (parsed.success) return { ...parsed.data, hintLevel: parsed.data.hintLevel ?? hintLevel };
  } catch {
    // Heuristics below provide a usable learning path if a compact model formats JSON imperfectly.
  }

  const confused = isLikelyConfused(message);
  const style = profile?.learningStyles?.[0] ?? "step-by-step";
  return {
    intent: "other",
    confused,
    hint: confused
      ? "Let’s slow down and name the one part that feels unclear. What do you already know about it?"
      : hintLevel === 2
      ? "Think about the relationship between the given elements. What formula or principle connects them?"
      : hintLevel === 3
      ? "Break the problem into two halves: solve the left side first, then substitute that result into the right."
      : "Start by identifying the key idea or value the question gives you before choosing a method.",
    nextQuestion: hintLevel >= 3 ? "Ready to test your solution, or would you like a worked answer?" : "What is the first small step you think would move this forward?",
    suggestedStyle: style,
    hintLevel,
  };
}

export function isLikelyConfused(message: string): boolean {
  const normalized = message.toLowerCase();
  return ["i don't understand", "i dont understand", "confused", "lost", "help me", "what?", "مش فاهم", "ما فهمتش", "je ne comprends pas"].some(
    (phrase) => normalized.includes(phrase),
  );
}

function historyMessages(request: TutorRequest) {
  return (request.conversation ?? []).map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function extractJsonObject(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
}
