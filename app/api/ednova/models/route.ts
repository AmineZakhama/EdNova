import { NextResponse } from "next/server";

import { getLLMRouter } from "@/lib/ednova/llm-router";

export const runtime = "nodejs";

export async function GET() {
  try {
    const models = await getLLMRouter().listModels();
    return NextResponse.json({ models });
  } catch {
    return NextResponse.json(
      { error: "Unable to discover models. Check the EdNova .env configuration." },
      { status: 503 },
    );
  }
}
