export type SupportedLanguage = "en" | "fr" | "ar" | "darija";
export type LearningStyle =
  | "visual"
  | "analogies"
  | "step-by-step"
  | "examples"
  | "repetition"
  | "problem-solving";

export type LearnerProfile = {
  nickname?: string;
  avatar?: string;
  language?: SupportedLanguage;
  level?: string;
  subjects?: string[];
  learningStyles?: LearningStyle[];
  mode?: "individual" | "group" | "both";
  groupSize?: number;
  goals?: string;
  dailyStudyMinutes?: number;
  preferredStudyTime?: string;
  observedSignals?: {
    confusionEvents: number;
    hintsUsed: number;
    focusMinutes: number;
  };
  cognitiveArchetype?: string;
  cognitiveTraits?: {
    abstractReasoning: number;
    reflectivePrecision: number;
    patternSynthesis: number;
    practicalApplication: number;
  };
  scaffoldingPace?: string;
  diagnosticNotes?: string;
};

export type DiagnosticResult = {
  level: string;
  styles: LearningStyle[];
  encouragement: string;
  archetype?: string;
  traits?: {
    abstractReasoning: number;
    reflectivePrecision: number;
    patternSynthesis: number;
    practicalApplication: number;
  };
  scaffoldingPace?: string;
  cognitiveNotes?: string;
  fallback?: boolean;
};

export type KnowledgeChunk = {
  id: string;
  title: string;
  content: string;
};

export type KnowledgeNote = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  sample?: boolean;
};

export type StudySession = {
  id: string;
  kind: "focus" | "break" | "long-break" | "custom";
  plannedMinutes: number;
  completedAt: string;
  subject?: string;
};

export type LearningProgress = {
  xp: number;
  level: number;
  streak: number;
  lastStudyDate?: string;
  badges: string[];
  subjectAccuracy: Record<string, { correct: number; total: number }>;
};

export type InferenceMode = "fast" | "thinking";
export type QuestionIntent = "explanation" | "problem";

export type TutorRequest = {
  message: string;
  profile?: LearnerProfile;
  context?: KnowledgeChunk[];
  answerRequested?: boolean;
  hintLevel?: number;
  questionIntent?: QuestionIntent;
  modification?: "shorter" | "detailed" | "simpler" | "analogy" | "practice";
  inferenceMode?: InferenceMode;
  conversation?: Array<{ role: "user" | "assistant"; content: string }>;
};

export type TutorHint = {
  intent: "concept" | "problem" | "revision" | "quiz" | "other";
  confused: boolean;
  hint: string;
  nextQuestion: string;
  suggestedStyle: LearningStyle;
  hintLevel?: number;
};
