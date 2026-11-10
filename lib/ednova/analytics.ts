import type { LearnerProfile, LearningProgress, StudySession } from "@/lib/ednova/types";

// ---------------------------------------------------------------------------
// Analytics computations – pure functions over stored data.
// These never call an AI model; they prepare chart-ready data structures.
// ---------------------------------------------------------------------------

export type DailyStudy = { date: string; minutes: number };
export type SubjectAccuracy = { subject: string; correct: number; total: number; accuracy: number };
export type ConfusionEvent = { date: string; count: number };
export type HintUsage = { date: string; hintsUsed: number };
export type WeeklyActivity = { week: string; sessions: number; minutes: number; xpEarned: number };

/** Group study sessions by calendar date and sum minutes. */
export function dailyStudyMinutes(sessions: StudySession[]): DailyStudy[] {
  const map = new Map<string, number>();
  for (const session of sessions) {
    if (session.kind === "break" || session.kind === "long-break") continue;
    const date = session.completedAt.slice(0, 10);
    map.set(date, (map.get(date) ?? 0) + session.plannedMinutes);
  }
  return [...map.entries()]
    .map(([date, minutes]) => ({ date, minutes }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Per-subject total minutes from study sessions. */
export function subjectBreakdown(sessions: StudySession[]): Array<{ subject: string; minutes: number }> {
  const map = new Map<string, number>();
  for (const session of sessions) {
    if (!session.subject || session.kind === "break" || session.kind === "long-break") continue;
    map.set(session.subject, (map.get(session.subject) ?? 0) + session.plannedMinutes);
  }
  return [...map.entries()]
    .map(([subject, minutes]) => ({ subject, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Weekly aggregation for overview charts. */
export function weeklyActivity(sessions: StudySession[]): WeeklyActivity[] {
  const map = new Map<string, { sessions: number; minutes: number; xpEarned: number }>();
  for (const session of sessions) {
    if (session.kind === "break" || session.kind === "long-break") continue;
    const date = new Date(session.completedAt);
    const week = isoWeek(date);
    const existing = map.get(week) ?? { sessions: 0, minutes: 0, xpEarned: 0 };
    existing.sessions += 1;
    existing.minutes += session.plannedMinutes;
    existing.xpEarned += Math.max(10, Math.min(80, session.plannedMinutes * 2));
    map.set(week, existing);
  }
  return [...map.entries()]
    .map(([week, data]) => ({ week, ...data }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

/** Streak history: consecutive days with at least one focus session. */
export function streakHistory(sessions: StudySession[]): Array<{ date: string; hadSession: boolean }> {
  const dates = new Set<string>();
  for (const session of sessions) {
    if (session.kind === "break" || session.kind === "long-break") continue;
    dates.add(session.completedAt.slice(0, 10));
  }
  if (!dates.size) return [];

  const sorted = [...dates].sort();
  const start = new Date(sorted[0]);
  const end = new Date(sorted[sorted.length - 1]);
  const result: Array<{ date: string; hadSession: boolean }> = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, hadSession: dates.has(key) });
  }
  return result;
}

/** Learning-style effectiveness: how often each style was active during confusion events. */
export function styleEffectiveness(
  profile: LearnerProfile | null,
): Array<{ style: string; active: boolean; confusionRate: string }> {
  const allStyles = ["visual", "analogies", "step-by-step", "examples", "repetition", "problem-solving"] as const;
  const activeStyles = new Set(profile?.learningStyles ?? []);
  const signals = profile?.observedSignals ?? { confusionEvents: 0, hintsUsed: 0, focusMinutes: 0 };
  return allStyles.map((style) => ({
    style,
    active: activeStyles.has(style),
    confusionRate: activeStyles.has(style) && signals.focusMinutes > 0
      ? `${((signals.confusionEvents / Math.max(1, signals.focusMinutes)) * 100).toFixed(1)}%`
      : "N/A",
  }));
}

/** Summary statistics for the learner dashboard header. */
export function summaryStats(
  sessions: StudySession[],
  progress: LearningProgress,
  profile: LearnerProfile | null,
): {
  totalMinutes: number;
  totalSessions: number;
  averageSessionMinutes: number;
  currentStreak: number;
  totalXp: number;
  level: number;
  badgeCount: number;
  hintsUsed: number;
  confusionEvents: number;
} {
  const focusSessions = sessions.filter((s) => s.kind === "focus" || s.kind === "custom");
  const totalMinutes = focusSessions.reduce((sum, s) => sum + s.plannedMinutes, 0);
  return {
    totalMinutes,
    totalSessions: focusSessions.length,
    averageSessionMinutes: focusSessions.length ? Math.round(totalMinutes / focusSessions.length) : 0,
    currentStreak: progress.streak,
    totalXp: progress.xp,
    level: progress.level,
    badgeCount: progress.badges.length,
    hintsUsed: profile?.observedSignals?.hintsUsed ?? 0,
    confusionEvents: profile?.observedSignals?.confusionEvents ?? 0,
  };
}

// -- Helpers ------------------------------------------------------------------

function isoWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
