import type { LearnerProfile } from "@/lib/ednova/types";

export const PROFILE_STORAGE_KEY = "ednova-profile-v1";

const defaultSignals = { confusionEvents: 0, hintsUsed: 0, focusMinutes: 0 };

export function loadLearnerProfile(): LearnerProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!value) return null;
    const profile = JSON.parse(value) as LearnerProfile;
    return { ...profile, observedSignals: { ...defaultSignals, ...profile.observedSignals } };
  } catch {
    return null;
  }
}

export function saveLearnerProfile(profile: LearnerProfile): LearnerProfile {
  const normalized: LearnerProfile = {
    ...profile,
    nickname: profile.nickname?.trim().slice(0, 24) || "Learner",
    avatar: profile.avatar || "✨",
    language: profile.language ?? "en",
    learningStyles: profile.learningStyles?.slice(0, 3) ?? ["step-by-step"],
    subjects: profile.subjects?.map((subject) => subject.trim()).filter(Boolean).slice(0, 8) ?? [],
    observedSignals: { ...defaultSignals, ...profile.observedSignals },
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalized));
    try {
      fetch("/api/ednova/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: normalized }),
      }).catch(() => {});
    } catch {}
  }
  return normalized;
}

export function recordLearningSignal(signal: "confusion" | "hint" | "focus", amount = 1): LearnerProfile | null {
  const current = loadLearnerProfile();
  if (!current) return null;

  const observedSignals = { ...defaultSignals, ...current.observedSignals };
  if (signal === "confusion") observedSignals.confusionEvents += amount;
  if (signal === "hint") observedSignals.hintsUsed += amount;
  if (signal === "focus") observedSignals.focusMinutes += amount;

  const styles = new Set(current.learningStyles ?? []);
  if (observedSignals.confusionEvents >= 3) styles.add("step-by-step");
  return saveLearnerProfile({ ...current, learningStyles: [...styles].slice(0, 3), observedSignals });
}
