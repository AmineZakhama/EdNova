import { NextResponse } from "next/server";

import { getLLMRouter, LLMRouterError } from "@/lib/ednova/llm-router";
import {
  addAIMessage,
  createGroupRoom,
  getGroupRoom,
  getParticipationStats,
  joinGroupRoom,
  postMessage,
  setRoomSummary,
} from "@/lib/ednova/group-room";

export const runtime = "nodejs";

// GET — poll room state
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Room code is required." }, { status: 400 });

  const room = getGroupRoom(code);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  return NextResponse.json({ room });
}

// POST — action-based dispatch
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("action" in body)) {
    return NextResponse.json({ error: "Missing action." }, { status: 400 });
  }

  const { action } = body as { action: string };

  try {
    switch (action) {
      case "create": {
        const { topic, nickname, avatar } = body as { topic?: string; nickname?: string; avatar?: string };
        if (!topic?.trim()) return NextResponse.json({ error: "Topic is required." }, { status: 400 });
        const result = createGroupRoom(topic, nickname ?? "Learner", avatar ?? "✨");
        return NextResponse.json(result);
      }

      case "join": {
        const { code, nickname, avatar } = body as { code?: string; nickname?: string; avatar?: string };
        if (!code?.trim()) return NextResponse.json({ error: "Room code is required." }, { status: 400 });
        const result = joinGroupRoom(code, nickname ?? "Learner", avatar ?? "✨");
        if (!result) return NextResponse.json({ error: "Room not found." }, { status: 404 });
        return NextResponse.json(result);
      }

      case "message": {
        const { code, senderId, content } = body as { code?: string; senderId?: string; content?: string };
        if (!code || !senderId || !content?.trim()) {
          return NextResponse.json({ error: "Code, senderId, and content are required." }, { status: 400 });
        }
        const room = postMessage(code, senderId, content);
        if (!room) return NextResponse.json({ error: "Room or participant not found." }, { status: 404 });
        return NextResponse.json({ room });
      }

      case "mediate": {
        const { code } = body as { code?: string };
        if (!code) return NextResponse.json({ error: "Room code is required." }, { status: 400 });
        return await handleMediate(code);
      }

      case "summarize": {
        const { code } = body as { code?: string };
        if (!code) return NextResponse.json({ error: "Room code is required." }, { status: 400 });
        return await handleSummarize(code);
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    const status = error instanceof LLMRouterError && error.status ? error.status : 503;
    return NextResponse.json(
      { error: "The group AI is temporarily unavailable.", retryable: status === 429 || status >= 500 },
      { status },
    );
  }
}

// ---------------------------------------------------------------------------
// AI mediation — FAST model for lightweight moderation check
// ---------------------------------------------------------------------------

async function handleMediate(code: string) {
  const room = getGroupRoom(code);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const stats = getParticipationStats(code);
  const recentMessages = room.messages
    .filter((m) => !m.isAI)
    .slice(-8)
    .map((m) => `${m.senderNickname}: ${m.content}`)
    .join("\n");

  if (!recentMessages.trim()) {
    return NextResponse.json({ room, mediation: null, notice: "No messages to review yet." });
  }

  const participationSummary = stats
    ?.map((s) => `${s.participant.nickname}: ${s.percentage}% of messages${s.isDominant ? " (dominant)" : ""}${s.isPassive ? " (passive)" : ""}`)
    .join(", ") ?? "unknown";

  // FAST model – lightweight moderation check: classification + short feedback
  const response = await getLLMRouter().generate({
    modelClass: "fast",
    purpose: "group_mediation_check",
    messages: [
      {
        role: "system",
        content: `You are a friendly learning group mediator for peer study sessions on "${room.topic}". Review the recent peer discussion messages and check for:
1. Any factual errors in peer explanations (flag them gently and supportively)
2. Participation imbalance (if someone is dominant or passive, suggest how to include everyone)
3. Whether the discussion would benefit from a guiding question to go deeper

Respond in JSON: { "hasError": boolean, "errorMessage": string|null, "balanceNote": string|null, "guidingQuestion": string|null }

Be encouraging, not corrective. If everything looks good, set all to null.`,
      },
      {
        role: "user",
        content: `Recent messages:\n${recentMessages}\n\nParticipation: ${participationSummary}`,
      },
    ],
    responseFormat: "json_object",
    temperature: 0.2,
    cacheTtlMs: 2 * 60_000, // short cache — mediation should be fresh
  });

  let mediation: { hasError: boolean; errorMessage: string | null; balanceNote: string | null; guidingQuestion: string | null };
  try {
    mediation = JSON.parse(response.content);
  } catch {
    return NextResponse.json({ room: getGroupRoom(code), mediation: null, notice: "Could not parse mediation." });
  }

  // Add AI messages for any issues found
  let updatedRoom = getGroupRoom(code);
  if (mediation.hasError && mediation.errorMessage) {
    updatedRoom = addAIMessage(code, `📝 Quick check: ${mediation.errorMessage}`, true, mediation.errorMessage);
  }
  if (mediation.balanceNote) {
    updatedRoom = addAIMessage(code, `💡 ${mediation.balanceNote}`);
  }
  if (mediation.guidingQuestion) {
    updatedRoom = addAIMessage(code, `🤔 ${mediation.guidingQuestion}`);
  }

  if (!mediation.hasError && !mediation.balanceNote && !mediation.guidingQuestion) {
    updatedRoom = addAIMessage(code, "✅ The discussion is going well! Keep explaining your thinking to each other.");
  }

  return NextResponse.json({ room: updatedRoom, mediation, cached: response.cached });
}

// ---------------------------------------------------------------------------
// AI summary — LARGE model for comprehensive discussion summary
// ---------------------------------------------------------------------------

async function handleSummarize(code: string) {
  const room = getGroupRoom(code);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const allMessages = room.messages
    .map((m) => `[${m.isAI ? "AI" : m.senderNickname}] ${m.content}`)
    .join("\n");

  if (room.messages.filter((m) => !m.isAI).length < 2) {
    return NextResponse.json({ room, summary: null, notice: "Need at least two peer messages to summarize." });
  }

  // LARGE model – comprehensive discussion summary with analysis
  const response = await getLLMRouter().generate({
    modelClass: "large",
    purpose: "group_discussion_summary",
    messages: [
      {
        role: "system",
        content: `You are a learning group summarizer. Summarize this peer learning discussion on "${room.topic}" for the study circle participants. Include:
- Key topics discussed and conclusions reached
- Any corrections that were made
- Participation quality and balance
- Suggested next steps for the group

Keep it concise (3-5 short paragraphs). Be encouraging and constructive.`,
      },
      {
        role: "user",
        content: `Discussion transcript:\n${allMessages}`,
      },
    ],
    temperature: 0.3,
    cacheTtlMs: 10 * 60_000,
  });

  setRoomSummary(code, response.content);
  const updatedRoom = getGroupRoom(code);

  return NextResponse.json({
    room: updatedRoom,
    summary: response.content,
    cached: response.cached,
    notice: response.notice,
  });
}
