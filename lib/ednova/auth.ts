import { cookies } from "next/headers";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export type UserRole = "STUDENT" | "ADMIN";

export type SafeUser = {
  id: string;
  email: string;
  name: string;
  avatar: string;
  role: UserRole;
  tokens?: number;
};

const SESSION_COOKIE_NAME = "ednova_session";
const SESSION_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "ednova-hackathon-secure-fallback-key-2026";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

// ---------------------------------------------------------------------------
// Secure Password Hashing (Built-in Node.js crypto, zero external packages)
// ---------------------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = scryptSync(password, salt, 64);
    return timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 Signed Session Token
// ---------------------------------------------------------------------------

function base64UrlEncode(data: string): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

export function createSessionToken(user: SafeUser): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      ...user,
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
    }),
  );
  const signature = base64UrlEncode(
    createHmac("sha256", SESSION_SECRET).update(`${header}.${payload}`).digest("base64"),
  );
  return `${header}.${payload}.${signature}`;
}

export function verifySessionToken(token: string): SafeUser | null {
  try {
    const [header, payload, signature] = token.split(".");
    if (!header || !payload || !signature) return null;

    const expectedSignature = base64UrlEncode(
      createHmac("sha256", SESSION_SECRET).update(`${header}.${payload}`).digest("base64"),
    );

    const sigBuf = Buffer.from(signature);
    const expSigBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expSigBuf.length || !timingSafeEqual(sigBuf, expSigBuf)) {
      return null;
    }

    const decoded = JSON.parse(base64UrlDecode(payload)) as SafeUser & { exp: number };
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }

    return {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      avatar: decoded.avatar,
      role: decoded.role,
      tokens: decoded.tokens,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cookie Session Helpers (for Next.js App Router)
// ---------------------------------------------------------------------------

export async function getCurrentUser(): Promise<SafeUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function getSessionCookieAttributes(token: string) {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function getClearedSessionCookieAttributes() {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
