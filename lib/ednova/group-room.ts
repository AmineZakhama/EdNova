import "server-only";

// ---------------------------------------------------------------------------
// Group Discussion Room — server-side in-memory state (polling-based).
// Enables real-time peer discussions with AI mediation.
// ---------------------------------------------------------------------------

export type GroupMessage = {
  id: string;
  senderId: string;
  senderNickname: string;
  senderAvatar: string;
  content: string;
  timestamp: string;
  isAI?: boolean;
  flagged?: boolean;
  correction?: string;
};

export type GroupParticipant = {
  id: string;
  nickname: string;
  avatar: string;
  messageCount: number;
  lastActive: string;
  joinedAt: string;
};

export type GroupRoomSnapshot = {
  code: string;
  topic: string;
  messages: GroupMessage[];
  participants: GroupParticipant[];
  createdAt: string;
  summary?: string;
};

type Room = GroupRoomSnapshot & { createdAtMs: number };

const rooms = new Map<string, Room>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createGroupRoom(
  topic: string,
  creatorNickname: string,
  creatorAvatar: string,
): { room: GroupRoomSnapshot; participant: GroupParticipant } {
  cleanupRooms();
  let code = randomCode();
  while (rooms.has(code)) code = randomCode();

  const now = new Date().toISOString();
  const participant: GroupParticipant = {
    id: crypto.randomUUID(),
    nickname: creatorNickname.trim().slice(0, 24) || "Learner",
    avatar: creatorAvatar || "✨",
    messageCount: 0,
    lastActive: now,
    joinedAt: now,
  };

  const room: Room = {
    code,
    topic: topic.trim().slice(0, 200) || "General discussion",
    messages: [],
    participants: [participant],
    createdAt: now,
    createdAtMs: Date.now(),
  };

  // Welcome message from AI
  room.messages.push({
    id: crypto.randomUUID(),
    senderId: "ai-mediator",
    senderNickname: "AI Mediator",
    senderAvatar: "🧠",
    content: `Welcome to the discussion on "${room.topic}"! Share your thoughts and help each other learn. I'll check in from time to time to help keep things on track.`,
    timestamp: now,
    isAI: true,
  });

  rooms.set(code, room);
  return { room: snapshot(room), participant: { ...participant } };
}

export function getGroupRoom(code: string): GroupRoomSnapshot | null {
  const room = rooms.get(code.toUpperCase());
  return room ? snapshot(room) : null;
}

export function joinGroupRoom(
  code: string,
  nickname: string,
  avatar: string,
): { room: GroupRoomSnapshot; participant: GroupParticipant } | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) return null;

  // Prevent duplicate nicknames
  const safeName = nickname.trim().slice(0, 24) || "Learner";
  const existing = room.participants.find((p) => p.nickname === safeName);
  if (existing) {
    return { room: snapshot(room), participant: { ...existing } };
  }

  const now = new Date().toISOString();
  const participant: GroupParticipant = {
    id: crypto.randomUUID(),
    nickname: safeName,
    avatar: avatar || "✨",
    messageCount: 0,
    lastActive: now,
    joinedAt: now,
  };
  room.participants.push(participant);

  // System join message
  room.messages.push({
    id: crypto.randomUUID(),
    senderId: "ai-mediator",
    senderNickname: "AI Mediator",
    senderAvatar: "🧠",
    content: `${safeName} joined the discussion. Welcome!`,
    timestamp: now,
    isAI: true,
  });

  return { room: snapshot(room), participant: { ...participant } };
}

export function postMessage(
  code: string,
  senderId: string,
  content: string,
): GroupRoomSnapshot | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) return null;

  const participant = room.participants.find((p) => p.id === senderId);
  if (!participant) return null;

  const now = new Date().toISOString();
  participant.messageCount += 1;
  participant.lastActive = now;

  room.messages.push({
    id: crypto.randomUUID(),
    senderId,
    senderNickname: participant.nickname,
    senderAvatar: participant.avatar,
    content: content.trim().slice(0, 2000),
    timestamp: now,
  });

  // Cap messages at 100
  if (room.messages.length > 100) {
    room.messages = room.messages.slice(-100);
  }

  return snapshot(room);
}

export function addAIMessage(
  code: string,
  content: string,
  flagged?: boolean,
  correction?: string,
): GroupRoomSnapshot | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) return null;

  room.messages.push({
    id: crypto.randomUUID(),
    senderId: "ai-mediator",
    senderNickname: "AI Mediator",
    senderAvatar: "🧠",
    content,
    timestamp: new Date().toISOString(),
    isAI: true,
    flagged,
    correction,
  });

  return snapshot(room);
}

export function setRoomSummary(code: string, summary: string): void {
  const room = rooms.get(code.toUpperCase());
  if (room) room.summary = summary;
}

export function getParticipationStats(
  code: string,
): Array<{ participant: GroupParticipant; percentage: number; isDominant: boolean; isPassive: boolean }> | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) return null;

  const totalMessages = room.participants.reduce((s, p) => s + p.messageCount, 0);
  const participantCount = room.participants.length;

  // Check recency — find participants who haven't posted in the last 5 messages
  const recentSenders = new Set(
    room.messages
      .filter((m) => !m.isAI)
      .slice(-5)
      .map((m) => m.senderId),
  );

  return room.participants.map((p) => {
    const percentage = totalMessages > 0 ? Math.round((p.messageCount / totalMessages) * 100) : 0;
    return {
      participant: { ...p },
      percentage,
      isDominant: participantCount >= 3 && percentage > 40,
      isPassive: participantCount >= 3 && totalMessages >= 5 && percentage < 10 && !recentSenders.has(p.id),
    };
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function snapshot(room: Room): GroupRoomSnapshot {
  return {
    code: room.code,
    topic: room.topic,
    messages: room.messages.map((m) => ({ ...m })),
    participants: room.participants.map((p) => ({ ...p })),
    createdAt: room.createdAt,
    summary: room.summary,
  };
}

function randomCode(): string {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

function cleanupRooms(): void {
  const cutoff = Date.now() - 8 * 60 * 60_000;
  for (const [code, room] of rooms) {
    if (room.createdAtMs < cutoff) rooms.delete(code);
  }
}
