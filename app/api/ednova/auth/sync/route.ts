import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/ednova/auth";
import { db, isDatabaseAvailable } from "@/lib/ednova/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hasDb = await isDatabaseAvailable();
  if (!hasDb) {
    return NextResponse.json({ success: true, synced: false, reason: "Database not connected" });
  }

  try {
    const body = await request.json();

    // Ensure User row exists in DB before upserting child relations
    let activeUserId = user.id;
    const dbUser = await db.user.findUnique({ where: { id: activeUserId } });
    if (!dbUser) {
      const existingByEmail = await db.user.findUnique({ where: { email: user.email } });
      if (existingByEmail) {
        activeUserId = existingByEmail.id;
      } else {
        const created = await db.user.create({
          data: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar || "🌟",
            role: "STUDENT",
            passwordHash: "oauth-session-managed",
          },
        });
        activeUserId = created.id;
      }
    }

    // 1. Sync Profile if provided
    if (body.profile) {
      const learningStylesStr = JSON.stringify(body.profile.learningStyles || ["step-by-step"]);
      const subjectsStr = JSON.stringify(body.profile.subjects || []);
      const cognitiveTraitsStr = body.profile.cognitiveTraits ? JSON.stringify(body.profile.cognitiveTraits) : null;

      await db.learnerProfile.upsert({
        where: { userId: activeUserId },
        update: {
          onboarded: true,
          level: body.profile.level || "developing learner",
          learningStyles: learningStylesStr,
          subjects: subjectsStr,
          language: body.profile.language || "en",
          mode: body.profile.mode || "individual",
          dailyStudyMinutes: body.profile.dailyStudyMinutes || 25,
          preferredStudyTime: body.profile.preferredStudyTime || "",
          cognitiveArchetype: body.profile.cognitiveArchetype || null,
          cognitiveTraits: cognitiveTraitsStr,
          scaffoldingPace: body.profile.scaffoldingPace || null,
          confusionCount: body.profile.observedSignals?.confusionEvents ?? 0,
          hintsUsed: body.profile.observedSignals?.hintsUsed ?? 0,
          focusMinutes: body.profile.observedSignals?.focusMinutes ?? 0,
        },
        create: {
          userId: activeUserId,
          onboarded: true,
          level: body.profile.level || "developing learner",
          learningStyles: learningStylesStr,
          subjects: subjectsStr,
          language: body.profile.language || "en",
          mode: body.profile.mode || "individual",
          dailyStudyMinutes: body.profile.dailyStudyMinutes || 25,
          preferredStudyTime: body.profile.preferredStudyTime || "",
          cognitiveArchetype: body.profile.cognitiveArchetype || null,
          cognitiveTraits: cognitiveTraitsStr,
          scaffoldingPace: body.profile.scaffoldingPace || null,
          confusionCount: body.profile.observedSignals?.confusionEvents ?? 0,
          hintsUsed: body.profile.observedSignals?.hintsUsed ?? 0,
          focusMinutes: body.profile.observedSignals?.focusMinutes ?? 0,
        },
      });

      // Update User display name and avatar from chosen onboarding persona
      const userUpdates: { name?: string; avatar?: string } = {};
      if (typeof body.profile.nickname === "string" && body.profile.nickname.trim()) {
        userUpdates.name = body.profile.nickname.trim();
      }
      if (typeof body.profile.avatar === "string" && body.profile.avatar.trim()) {
        userUpdates.avatar = body.profile.avatar.trim();
      }
      if (Object.keys(userUpdates).length > 0) {
        await db.user.update({
          where: { id: activeUserId },
          data: userUpdates,
        }).catch(() => {});
      }
    }

    // 2. Sync Progress (XP, badges, streaks) if provided
    if (body.progress) {
      await db.learningProgress.upsert({
        where: { userId: activeUserId },
        update: {
          xp: body.progress.xp ?? 0,
          level: body.progress.level ?? 1,
          streak: body.progress.streak ?? 0,
          badges: JSON.stringify(body.progress.badges || []),
          subjectAccuracy: JSON.stringify(body.progress.subjectAccuracy || {}),
        },
        create: {
          userId: activeUserId,
          xp: body.progress.xp ?? 0,
          level: body.progress.level ?? 1,
          streak: body.progress.streak ?? 0,
          badges: JSON.stringify(body.progress.badges || []),
          subjectAccuracy: JSON.stringify(body.progress.subjectAccuracy || {}),
        },
      });
    }

    // 3. Sync Quiz Result if provided
    if (body.quizResult) {
      await db.quizAttempt.create({
        data: {
          userId: user.id,
          topic: body.quizResult.topic || "General",
          total: body.quizResult.total || 0,
          correct: body.quizResult.correct || 0,
        },
      });
    }

    // 4. Sync Study Session if provided
    if (body.session) {
      await db.studySession.create({
        data: {
          userId: user.id,
          subject: body.session.subject || "General",
          durationMinutes: body.session.plannedMinutes || 25,
          mode: body.session.kind || "focus",
          completedAt: body.session.completedAt ? new Date(body.session.completedAt) : new Date(),
        },
      });
    }

    // 5. Bulk sync study sessions if provided
    if (Array.isArray(body.sessions)) {
      for (const s of body.sessions) {
        if (s && typeof s.plannedMinutes === "number" && !s.id?.startsWith("demo-")) {
          await db.studySession.create({
            data: {
              userId: user.id,
              subject: s.subject || "General",
              durationMinutes: s.plannedMinutes,
              mode: s.kind || "focus",
              completedAt: s.completedAt ? new Date(s.completedAt) : new Date(),
            },
          });
        }
      }
    }

    return NextResponse.json({ success: true, synced: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
