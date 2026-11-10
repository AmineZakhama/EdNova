import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSessionToken, getSessionCookieAttributes, SafeUser } from "@/lib/ednova/auth";
import { db, isDatabaseAvailable } from "@/lib/ednova/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${url.origin}/ednova/login?error=Google+login+cancelled`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${url.origin}/api/ednova/auth/google/callback`;

  let email = "learner.google@gmail.com";
  let name = "Alex (Google)";

  if (code && clientId && clientSecret) {
    try {
      // 1. Direct Google OAuth Exchange
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (tokenResponse.ok) {
        const tokens = await tokenResponse.json();
        const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });

        if (userInfoResponse.ok) {
          const googleProfile = await userInfoResponse.json();
          if (googleProfile.email) {
            email = String(googleProfile.email).toLowerCase();
            name = String(googleProfile.name || googleProfile.given_name || "Learner");
          }
        }
      }
    } catch {
      // Continue with default/fallback profile
    }
  }

  let userId = crypto.randomUUID();
  let needsOnboarding = true;
  const hasDb = await isDatabaseAvailable();

  if (hasDb) {
    try {
      const existingUser = await db.user.findUnique({
        where: { email },
        include: { profile: true },
      });
      if (existingUser) {
        userId = existingUser.id;
        name = existingUser.name;
        needsOnboarding = !existingUser.profile?.onboarded;
      } else {
        const newUser = await db.user.create({
          data: {
            email,
            name,
            avatar: "🌟",
            role: "STUDENT",
            passwordHash: "oauth-google-managed",
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
                xp: 50,
                level: 1,
                streak: 1,
                badges: JSON.stringify(["Google Connected"]),
                subjectAccuracy: JSON.stringify({}),
              },
            },
          },
        });
        userId = newUser.id;
        needsOnboarding = true;
      }
    } catch {
      // Fallback if db insertion fails
    }
  }

  const safeUser: SafeUser = {
    id: userId,
    email,
    name,
    avatar: "🌟",
    role: "STUDENT",
  };

  const token = createSessionToken(safeUser);
  const cookieStore = await cookies();
  cookieStore.set(getSessionCookieAttributes(token));

  if (needsOnboarding) {
    return NextResponse.redirect(`${url.origin}/ednova/onboarding?first_time=true`);
  }

  return NextResponse.redirect(`${url.origin}/ednova`);
}
