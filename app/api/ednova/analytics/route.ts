import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/ednova/auth";
import { db, isDatabaseAvailable } from "@/lib/ednova/db";
import type { LearningProgress, LearnerProfile, StudySession, SupportedLanguage, LearningStyle } from "@/lib/ednova/types";
import type { QuizResult } from "@/lib/ednova/progress-storage";
import type { StudySession as PrismaStudySession, QuizAttempt as PrismaQuizAttempt } from "@prisma/client";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ authenticated: false, message: "Unauthorized" }, { status: 401 });
  }

  const hasDb = await isDatabaseAvailable();
  if (!hasDb) {
    return NextResponse.json({
      authenticated: true,
      databaseConnected: false,
      user,
      sessions: [],
      quizzes: [],
      progress: { xp: 0, level: 1, streak: 0, badges: [], subjectAccuracy: {} },
      profile: null,
    });
  }

  try {
    const fullUser = await db.user.findUnique({
      where: { id: user.id },
      include: {
        profile: true,
        progress: true,
        sessions: {
          orderBy: { completedAt: "desc" },
          take: 200,
        },
        quizzes: {
          orderBy: { completedAt: "desc" },
          take: 200,
        },
      },
    });

    if (!fullUser) {
      return NextResponse.json({ authenticated: false, message: "User not found" }, { status: 404 });
    }

    // Parse progress
    let badges: string[] = [];
    let subjectAccuracy: Record<string, { correct: number; total: number }> = {};
    if (fullUser.progress?.badges) {
      try {
        badges = JSON.parse(fullUser.progress.badges);
      } catch {}
    }
    if (fullUser.progress?.subjectAccuracy) {
      try {
        subjectAccuracy = JSON.parse(fullUser.progress.subjectAccuracy);
      } catch {}
    }

    const progress: LearningProgress = {
      xp: fullUser.progress?.xp ?? 0,
      level: fullUser.progress?.level ?? 1,
      streak: fullUser.progress?.streak ?? 0,
      badges,
      subjectAccuracy,
    };

    // Parse profile
    let learningStyles: LearningStyle[] = ["step-by-step"];
    let subjects: string[] = [];
    if (fullUser.profile?.learningStyles) {
      try {
        learningStyles = JSON.parse(fullUser.profile.learningStyles) as LearningStyle[];
      } catch {}
    }
    if (fullUser.profile?.subjects) {
      try {
        subjects = JSON.parse(fullUser.profile.subjects);
      } catch {}
    }

    const profile: LearnerProfile | null = fullUser.profile
      ? {
          nickname: fullUser.name,
          avatar: fullUser.avatar,
          level: fullUser.profile.level,
          learningStyles,
          subjects,
          language: (fullUser.profile.language as SupportedLanguage) || "en",
          mode: (fullUser.profile.mode as "individual" | "group") || "individual",
          dailyStudyMinutes: fullUser.profile.dailyStudyMinutes,
          preferredStudyTime: fullUser.profile.preferredStudyTime,
          cognitiveArchetype: fullUser.profile.cognitiveArchetype ?? undefined,
          cognitiveTraits: fullUser.profile.cognitiveTraits ? JSON.parse(fullUser.profile.cognitiveTraits) : undefined,
          scaffoldingPace: fullUser.profile.scaffoldingPace ?? undefined,
          observedSignals: {
            confusionEvents: fullUser.profile.confusionCount,
            hintsUsed: fullUser.profile.hintsUsed,
            focusMinutes: fullUser.profile.focusMinutes,
          },
        }
      : null;

    // Convert sessions
    const sessions: StudySession[] = fullUser.sessions.map((s: PrismaStudySession) => ({
      id: s.id,
      kind: (s.mode as "focus" | "break" | "long-break" | "custom") || "focus",
      plannedMinutes: s.durationMinutes,
      completedAt: s.completedAt.toISOString(),
      subject: s.subject && s.subject !== "General" ? s.subject : undefined,
    }));

    // Convert quizzes
    const quizzes: QuizResult[] = fullUser.quizzes.map((q: PrismaQuizAttempt) => ({
      id: q.id,
      topic: q.topic,
      total: q.total,
      correct: q.correct,
      completedAt: q.completedAt.toISOString(),
    }));

    return NextResponse.json({
      authenticated: true,
      databaseConnected: true,
      user: {
        id: fullUser.id,
        email: fullUser.email,
        name: fullUser.name,
        avatar: fullUser.avatar,
        role: fullUser.role,
      },
      profile,
      progress,
      sessions,
      quizzes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
