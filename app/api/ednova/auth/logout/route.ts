import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getClearedSessionCookieAttributes } from "@/lib/ednova/auth";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(getClearedSessionCookieAttributes());
  return NextResponse.json({ success: true, message: "Logged out successfully" });
}
