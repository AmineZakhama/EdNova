import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, isDatabaseAvailable } from "@/lib/ednova/db";
import {
  createSessionToken,
  getSessionCookieAttributes,
  hashPassword,
  SafeUser,
  UserRole,
} from "@/lib/ednova/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name.trim() : "Learner";
    const avatar = typeof body.avatar === "string" ? body.avatar : "✨";
    const role: UserRole = "STUDENT";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
    }

    const hasDb = await isDatabaseAvailable();

    if (hasDb) {
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
      }

      const passwordHash = hashPassword(password);

      const user = await db.user.create({
        data: {
          email,
          name,
          avatar,
          role,
          passwordHash,
          profile: {
            create: {
              onboarded: false,
              level: "developing learner",
              learningStyles: JSON.stringify(["step-by-step"]),
              subjects: JSON.stringify([]),
              language: "en",
            },
          },
          progress: {
            create: {
              xp: 0,
              level: 1,
              streak: 0,
              badges: JSON.stringify(["New account"]),
              subjectAccuracy: JSON.stringify({}),
            },
          },
        },
      });

      const safeUser: SafeUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role as UserRole,
      };

      const token = createSessionToken(safeUser);
      const cookieStore = await cookies();
      cookieStore.set(getSessionCookieAttributes(token));

      return NextResponse.json({
        success: true,
        user: safeUser,
        needsOnboarding: true,
        source: "database",
      });
    }

    // Graceful fallback if database is not yet migrated/connected:
    const mockUser: SafeUser = {
      id: crypto.randomUUID(),
      email,
      name,
      avatar,
      role,
    };
    const token = createSessionToken(mockUser);
    const cookieStore = await cookies();
    cookieStore.set(getSessionCookieAttributes(token));

    return NextResponse.json({
      success: true,
      user: mockUser,
      needsOnboarding: true,
      source: "local-session",
      notice: "Account created in active session. Connect DATABASE_URL in .env to persist across server restarts.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to register";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
