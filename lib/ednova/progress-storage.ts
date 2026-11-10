import type { LearnerProfile, LearningProgress, StudySession } from "@/lib/ednova/types";

const SESSIONS_KEY = "ednova-study-sessions-v1";
const PROGRESS_KEY = "ednova-progress-v1";
const QUIZ_RESULTS_KEY = "ednova-quiz-results-v1";
const emptyProgress: LearningProgress = { xp: 0, level: 1, streak: 0, badges: [], subjectAccuracy: {} };

// ---------------------------------------------------------------------------
// Quiz result tracking (feeds learner analytics and student mastery tracking)
// ---------------------------------------------------------------------------

export type QuizResult = {
  id: string;
  topic: string;
  total: number;
  correct: number;
  completedAt: string;
};

export function loadQuizResults(): QuizResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUIZ_RESULTS_KEY);
    return raw ? (JSON.parse(raw) as QuizResult[]).filter(isQuizResult) : [];
  } catch {
    return [];
  }
}

export function recordQuizResult(input: Omit<QuizResult, "id" | "completedAt">): QuizResult {
  const result: QuizResult = { ...input, id: crypto.randomUUID(), completedAt: new Date().toISOString() };
  const results = [result, ...loadQuizResults()].slice(0, 200);
  window.localStorage.setItem(QUIZ_RESULTS_KEY, JSON.stringify(results));

  // Award quiz-related badges
  const progress = loadLearningProgress();
  const badges = new Set(progress.badges);
  if (input.correct === input.total && input.total >= 3) badges.add("Perfect quiz");
  if (results.length >= 5) badges.add("Quiz enthusiast");
  if (results.length >= 20) badges.add("Quiz master");

  // Update per-subject accuracy
  const accuracy = { ...progress.subjectAccuracy };
  const topic = input.topic.trim().toLowerCase();
  if (topic) {
    const existing = accuracy[topic] ?? { correct: 0, total: 0 };
    accuracy[topic] = { correct: existing.correct + input.correct, total: existing.total + input.total };
  }

  saveLearningProgress({ ...progress, badges: [...badges], subjectAccuracy: accuracy });

  if (typeof window !== "undefined") {
    try {
      fetch("/api/ednova/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizResult: result }),
      }).catch(() => {});
    } catch {}
  }

  return result;
}

// ---------------------------------------------------------------------------
// Study sessions
// ---------------------------------------------------------------------------

export function loadStudySessions(): StudySession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as StudySession[]).filter(isSession) : [];
  } catch {
    return [];
  }
}

export function loadLearningProgress(): LearningProgress {
  if (typeof window === "undefined") return emptyProgress;
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    const saved = raw ? JSON.parse(raw) as Partial<LearningProgress> : {};
    return {
      ...emptyProgress,
      ...saved,
      badges: Array.isArray(saved.badges) ? saved.badges : [],
      subjectAccuracy: saved.subjectAccuracy && typeof saved.subjectAccuracy === "object" ? saved.subjectAccuracy : {},
    };
  } catch {
    return emptyProgress;
  }
}

export function saveLearningProgress(progress: LearningProgress): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  try {
    fetch("/api/ednova/auth/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progress }),
    }).catch(() => {});
  } catch {}
}

export function completeStudySession(input: Omit<StudySession, "id" | "completedAt">): { session: StudySession; progress: LearningProgress } {
  const session: StudySession = { ...input, id: crypto.randomUUID(), completedAt: new Date().toISOString() };
  const sessions = [session, ...loadStudySessions()].slice(0, 200);
  window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));

  const previous = loadLearningProgress();
  const today = localDateKey(new Date());
  const yesterday = localDateKey(new Date(Date.now() - 24 * 60 * 60_000));
  const streak = previous.lastStudyDate === today ? previous.streak : previous.lastStudyDate === yesterday ? previous.streak + 1 : 1;
  const earnedXp = Math.max(10, Math.min(80, input.plannedMinutes * 2));
  const xp = previous.xp + earnedXp;

  // Badges – extended set
  const badges = new Set(previous.badges);
  const focusSessions = sessions.filter((item) => item.kind === "focus" || item.kind === "custom");
  if (focusSessions.length >= 1) badges.add("First focus session");
  if (streak >= 3) badges.add("3-day streak");
  if (streak >= 7) badges.add("7-day streak");
  if (streak >= 14) badges.add("14-day streak");
  if (streak >= 30) badges.add("Month-long streak");
  if (focusSessions.filter((item) => item.plannedMinutes >= 25).length >= 4) badges.add("Deep focus");
  if (focusSessions.filter((item) => item.plannedMinutes >= 50).length >= 1) badges.add("Marathon session");
  const totalMinutes = focusSessions.reduce((sum, item) => sum + item.plannedMinutes, 0);
  if (totalMinutes >= 60) badges.add("First hour");
  if (totalMinutes >= 600) badges.add("10-hour milestone");

  // Per-subject tracking
  const subjectAccuracy = { ...previous.subjectAccuracy };

  const progress: LearningProgress = {
    xp,
    level: Math.floor(Math.sqrt(xp / 100)) + 1,
    streak,
    lastStudyDate: today,
    badges: [...badges],
    subjectAccuracy,
  };
  saveLearningProgress(progress);

  if (typeof window !== "undefined") {
    try {
      fetch("/api/ednova/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session }),
      }).catch(() => {});
    } catch {}
  }

  return { session, progress };
}

export function getSubjectMinutes(sessions: StudySession[]): Array<{ subject: string; minutes: number }> {
  const totals = new Map<string, number>();
  for (const session of sessions) {
    if (!session.subject || session.kind === "break" || session.kind === "long-break") continue;
    totals.set(session.subject, (totals.get(session.subject) ?? 0) + session.plannedMinutes);
  }
  return [...totals.entries()].map(([subject, minutes]) => ({ subject, minutes })).sort((left, right) => right.minutes - left.minutes);
}

// ---------------------------------------------------------------------------
// Clean up synthetic demo artifacts
// ---------------------------------------------------------------------------

export function purgeDemoData(): void {
  if (typeof window === "undefined") return;
  try {
    const rawSessions = window.localStorage.getItem(SESSIONS_KEY);
    if (rawSessions) {
      const parsed = (JSON.parse(rawSessions) as StudySession[]).filter(isSession);
      const filtered = parsed.filter((s) => !s.id.startsWith("demo-session-"));
      if (filtered.length !== parsed.length) {
        window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(filtered));
      }
    }

    const rawQuizzes = window.localStorage.getItem(QUIZ_RESULTS_KEY);
    if (rawQuizzes) {
      const parsed = (JSON.parse(rawQuizzes) as QuizResult[]).filter(isQuizResult);
      const filtered = parsed.filter((q) => !q.id.startsWith("demo-quiz-"));
      if (filtered.length !== parsed.length) {
        window.localStorage.setItem(QUIZ_RESULTS_KEY, JSON.stringify(filtered));
      }
    }

    // Reset synthetic progress if it was populated by seedDemoData
    const progress = loadLearningProgress();
    const cleanSessions = loadStudySessions();
    const cleanQuizzes = loadQuizResults();
    if (progress.xp === 420 && cleanSessions.length === 0 && cleanQuizzes.length === 0) {
      saveLearningProgress(emptyProgress);
    }
  } catch {}
}

// ---------------------------------------------------------------------------
// Seed demo data for the 90-second demo video
// ---------------------------------------------------------------------------

export function seedDemoData(): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const day = 24 * 60 * 60_000;

  // Seed study sessions over the past 10 days
  const demoSessions: StudySession[] = [];
  const subjects = ["Math", "Biology", "Physics"];
  for (let i = 9; i >= 0; i--) {
    const date = new Date(now - i * day);
    demoSessions.push({
      id: `demo-session-${i}-focus`,
      kind: "focus",
      plannedMinutes: 25,
      completedAt: date.toISOString(),
      subject: subjects[i % subjects.length],
    });
    if (i % 3 === 0) {
      demoSessions.push({
        id: `demo-session-${i}-extra`,
        kind: "focus",
        plannedMinutes: 15,
        completedAt: new Date(date.getTime() + 3600_000).toISOString(),
        subject: subjects[(i + 1) % subjects.length],
      });
    }
  }

  const existing = loadStudySessions();
  if (existing.length === 0) {
    window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(demoSessions));
  }

  // Seed quiz results
  const existingQuizzes = loadQuizResults();
  if (existingQuizzes.length === 0) {
    const demoQuizzes: QuizResult[] = [
      { id: "demo-quiz-1", topic: "Biology", total: 5, correct: 4, completedAt: new Date(now - 3 * day).toISOString() },
      { id: "demo-quiz-2", topic: "Math", total: 5, correct: 3, completedAt: new Date(now - 1 * day).toISOString() },
      { id: "demo-quiz-3", topic: "Physics", total: 3, correct: 3, completedAt: new Date(now - 0.5 * day).toISOString() },
    ];
    window.localStorage.setItem(QUIZ_RESULTS_KEY, JSON.stringify(demoQuizzes));
  }

  // Seed progress with achievements
  const existingProgress = loadLearningProgress();
  if (existingProgress.xp === 0) {
    const progress: LearningProgress = {
      xp: 420,
      level: 3,
      streak: 7,
      lastStudyDate: localDateKey(new Date()),
      badges: ["First focus session", "3-day streak", "7-day streak", "Deep focus", "First hour"],
      subjectAccuracy: {
        biology: { correct: 7, total: 8 },
        math: { correct: 5, total: 8 },
        physics: { correct: 3, total: 3 },
      },
    };
    saveLearningProgress(progress);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isSession(value: unknown): value is StudySession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<StudySession>;
  return typeof session.id === "string" && typeof session.plannedMinutes === "number" && typeof session.completedAt === "string";
}

function isQuizResult(value: unknown): value is QuizResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<QuizResult>;
  return typeof result.id === "string" && typeof result.total === "number" && typeof result.correct === "number";
}
