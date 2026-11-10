import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, isDatabaseAvailable } from "@/lib/ednova/db";
import {
  createSessionToken,
  getSessionCookieAttributes,
  SafeUser,
  UserRole,
  verifyPassword,
} from "@/lib/ednova/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const hasDb = await isDatabaseAvailable();

    if (hasDb) {
      const user = await db.user.findUnique({
        where: { email },
        include: { profile: true, progress: true },
      });

      if (!user) {
        return NextResponse.json({ error: "No account found with this email." }, { status: 401 });
      }

      const isValid = verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid password." }, { status: 401 });
      }

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

      const needsOnboarding = !user.profile?.onboarded;

      return NextResponse.json({
        success: true,
        user: safeUser,
        profile: user.profile,
        progress: user.progress,
        needsOnboarding,
        source: "database",
      });
    }

    // Demo / fallback credentials when database is not yet connected
    const safeUser: SafeUser = {
      id: crypto.randomUUID(),
      email,
      name: email.split("@")[0] || "Learner",
      avatar: "✨",
      role: "STUDENT",
    };

    const token = createSessionToken(safeUser);
    const cookieStore = await cookies();
    cookieStore.set(getSessionCookieAttributes(token));

    return NextResponse.json({
      success: true,
      user: safeUser,
      source: "local-session",
      notice: "Signed in to demo session. Set DATABASE_URL in .env to connect PostgreSQL.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sign in";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
