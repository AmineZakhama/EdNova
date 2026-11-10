import { NextResponse } from "next/server";
import { z } from "zod";

import { answerQuizQuestion, createQuizRoom, getQuizRoom, joinQuizRoom } from "@/lib/ednova/quiz-rooms";
import type { CollaborativeQuiz } from "@/lib/ednova/quiz-types";

export const runtime = "nodejs";

const questionSchema = z.object({ id: z.string(), question: z.string(), options: z.array(z.string()).length(4), correctAnswer: z.string(), explanation: z.string() });
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), quiz: z.object({ title: z.string(), questions: z.array(questionSchema).min(1).max(8) }), teamMode: z.boolean() }),
  z.object({ action: z.literal("join"), code: z.string().min(4).max(8), nickname: z.string().max(24), team: z.string().max(24).optional() }),
  z.object({ action: z.literal("answer"), code: z.string().min(4).max(8), participantId: z.string(), questionId: z.string(), answer: z.string().max(500) }),
]);

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  const room = code ? getQuizRoom(code) : null;
  return room ? NextResponse.json({ room }) : NextResponse.json({ error: "Room not found or expired." }, { status: 404 });
}

export async function POST(request: Request) {
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid room action." }, { status: 400 });
  if (parsed.data.action === "create") return NextResponse.json({ room: createQuizRoom(parsed.data.quiz as CollaborativeQuiz, parsed.data.teamMode) });
  if (parsed.data.action === "join") {
    const result = joinQuizRoom(parsed.data.code, parsed.data.nickname, parsed.data.team);
    return result ? NextResponse.json(result) : NextResponse.json({ error: "Room not found or expired." }, { status: 404 });
  }
  const result = answerQuizQuestion(parsed.data.code, parsed.data.participantId, parsed.data.questionId, parsed.data.answer);
  return result ? NextResponse.json(result) : NextResponse.json({ error: "Your room or participant session expired." }, { status: 404 });
}
