import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSessionToken, getSessionCookieAttributes, SafeUser } from "@/lib/ednova/auth";
import { db, isDatabaseAvailable } from "@/lib/ednova/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${url.origin}/api/ednova/auth/google/callback`;

  // 1. Direct Google OAuth (if GOOGLE_CLIENT_ID is provided in .env)
  if (clientId && clientId !== "your_google_oauth_client_id") {
    const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuthUrl.searchParams.set("client_id", clientId);
    googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set("scope", "openid email profile");
    googleAuthUrl.searchParams.set("access_type", "offline");
    googleAuthUrl.searchParams.set("prompt", "select_account");

    return NextResponse.redirect(googleAuthUrl.toString());
  }

  // 2. Supabase Hosted Google OAuth (uses credentials configured in Supabase dashboard)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl && !url.searchParams.has("demo")) {
    const authUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUri)}`;
    return NextResponse.redirect(authUrl);
  }

  // 3. Graceful Demo Google Sign-In when credentials are not yet configured
  const demoGoogleUser: SafeUser = {
    id: "google-demo-user-id",
    email: "learner.google@gmail.com",
    name: "Alex (Google)",
    avatar: "🌟",
    role: "STUDENT",
  };

  const hasDb = await isDatabaseAvailable();
  if (hasDb) {
    try {
      await db.user.upsert({
        where: { email: demoGoogleUser.email },
        update: { name: demoGoogleUser.name },
        create: {
          email: demoGoogleUser.email,
          name: demoGoogleUser.name,
          avatar: demoGoogleUser.avatar,
          passwordHash: "oauth-google-managed",
          role: "STUDENT",
          profile: {
            create: {
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
    } catch {
      // Continue with session
    }
  }

  const token = createSessionToken(demoGoogleUser);
  const cookieStore = await cookies();
  cookieStore.set(getSessionCookieAttributes(token));

  return NextResponse.redirect(`${url.origin}/ednova`);
}
