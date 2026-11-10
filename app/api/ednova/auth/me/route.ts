import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/ednova/auth";
import { db, isDatabaseAvailable } from "@/lib/ednova/db";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  const hasDb = await isDatabaseAvailable();
  if (hasDb) {
    try {
      let fullUser = await db.user.findUnique({
        where: { id: user.id },
        include: {
          profile: true,
          progress: true,
        },
      });

      // If not found by ID, look up by email
      if (!fullUser && user.email) {
        fullUser = await db.user.findUnique({
          where: { email: user.email },
          include: {
            profile: true,
            progress: true,
          },
        });
      }

      // If still not found, create DB row so user has persistent token balance in PostgreSQL
      if (!fullUser && user.email) {
        fullUser = await db.user.create({
          data: {
            id: user.id,
            email: user.email,
            name: user.name || "Learner",
            avatar: user.avatar || "🎓",
            role: user.role || "STUDENT",
            passwordHash: "session-managed",
            tokens: 25000,
          },
          include: {
            profile: true,
            progress: true,
          },
        });
      }

      if (fullUser) {
        const needsOnboarding = !fullUser.profile?.onboarded;
        return NextResponse.json({
          authenticated: true,
          user: {
            id: fullUser.id,
            email: fullUser.email,
            name: fullUser.name,
            avatar: fullUser.avatar,
            role: fullUser.role,
            tokens: fullUser.tokens,
          },
          profile: fullUser.profile,
          progress: fullUser.progress,
          needsOnboarding,
          databaseConnected: true,
        });
      }
    } catch (dbErr) {
      console.warn("Could not query fullUser from database, falling back to session user:", dbErr);
    }
  }

  return NextResponse.json({
    authenticated: true,
    user,
    databaseConnected: hasDb,
  });
}
