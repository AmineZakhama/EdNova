import type { QuestionIntent, TutorHint } from "@/lib/ednova/types";

export type TurnReaction = "like" | "dislike" | null;

export type Turn = {
  id: string;
  question: string;
  questionIntent?: QuestionIntent;
  hints: TutorHint[];
  hintError?: string;
  hintNotice?: string;
  hintLoading?: boolean;
  explanation?: string;
  explanationError?: string;
  fallbackNotice?: string;
  sources?: Array<{ id: string; title: string }>;
  reaction?: TurnReaction;
  timestamp?: string;
  attachmentName?: string;
  inferenceMode?: "fast" | "thinking";
  modelName?: string;
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  turns: Turn[];
};

const SESSIONS_STORAGE_KEY = "ednova-chat-sessions-v2";
const ACTIVE_SESSION_ID_KEY = "ednova-active-chat-session-v2";

export function loadChatSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveChatSessions(sessions: ChatSession[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // quota exceeded or private mode
  }
}

export function getActiveSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(ACTIVE_SESSION_ID_KEY);
}

export function setActiveSessionId(id: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ACTIVE_SESSION_ID_KEY, id);
}

export function createNewSession(firstQuestion?: string): ChatSession {
  const title = firstQuestion ? formatChatTitle(firstQuestion) : "New Conversation";
  const now = new Date().toISOString();
  const session: ChatSession = {
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    turns: [],
  };
  const sessions = [session, ...loadChatSessions()].slice(0, 50);
  saveChatSessions(sessions);
  setActiveSessionId(session.id);
  return session;
}

export function updateSessionTurns(sessionId: string, turns: Turn[]): void {
  const sessions = loadChatSessions();
  const index = sessions.findIndex((s) => s.id === sessionId);
  const now = new Date().toISOString();

  if (index >= 0) {
    const current = sessions[index];
    const title =
      current.title === "New Conversation" && turns.length > 0 && turns[0].question
        ? formatChatTitle(turns[0].question)
        : current.title;

    sessions[index] = {
      ...current,
      title,
      updatedAt: now,
      turns,
    };
  } else {
    // Create session if missing
    const title = turns.length > 0 ? formatChatTitle(turns[0].question) : "Study Session";
    sessions.unshift({
      id: sessionId,
      title,
      createdAt: now,
      updatedAt: now,
      turns,
    });
  }
  saveChatSessions(sessions);
}

export function deleteSession(sessionId: string): ChatSession[] {
  const filtered = loadChatSessions().filter((s) => s.id !== sessionId);
  saveChatSessions(filtered);
  return filtered;
}

function formatChatTitle(question: string): string {
  const cleaned = question
    .replace(/[#*`_~]/g, "")
    .replace(/^(help me with|how do i|what is|why is|explain)\s+/i, "")
    .trim();
  return (cleaned.slice(0, 32) || "Study Session") + (cleaned.length > 32 ? "…" : "");
}
