"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  AlertTriangle,
  ArrowUp,
  Brain,
  CheckCircle2,
  Copy,
  Crown,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  Users,
} from "lucide-react";

import { loadLearnerProfile } from "@/lib/ednova/profile-storage";
import type { LearnerProfile } from "@/lib/ednova/types";

type GroupMessage = {
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

type GroupParticipant = {
  id: string;
  nickname: string;
  avatar: string;
  messageCount: number;
  lastActive: string;
  joinedAt: string;
};

type GroupRoomSnapshot = {
  code: string;
  topic: string;
  messages: GroupMessage[];
  participants: GroupParticipant[];
  createdAt: string;
  summary?: string;
};

type Phase = "lobby" | "chat";

export default function GroupRoom() {
  const [phase, setPhase] = useState<Phase>("lobby");
  const [role, setRole] = useState<"create" | "join">("create");
  const [topic, setTopic] = useState("Photosynthesis — how plants make food");
  const [nickname, setNickname] = useState("CuriousComet");
  const [avatar, setAvatar] = useState("✨");
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState<GroupRoomSnapshot | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [mediating, setMediating] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load profile
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const profile = loadLearnerProfile();
      if (profile?.nickname) setNickname(profile.nickname);
      if (profile?.avatar) setAvatar(profile.avatar);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Poll room state
  useEffect(() => {
    if (!room) return;
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/ednova/group?code=${room.code}`);
        if (!response.ok) return;
        const data = (await response.json()) as { room?: GroupRoomSnapshot };
        if (data.room) setRoom(data.room);
      } catch { /* polling failure is silent */ }
    }, 2000);
    return () => window.clearInterval(interval);
  }, [room?.code]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [room?.messages.length]);

  async function handleCreate() {
    if (!topic.trim()) return;
    setBusy(true);
    try {
      const response = await fetch("/api/ednova/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", topic, nickname, avatar }),
      });
      const data = (await response.json()) as { room?: GroupRoomSnapshot; participant?: GroupParticipant; error?: string };
      if (!response.ok || !data.room || !data.participant) throw new Error(data.error ?? "Could not create room.");
      setRoom(data.room);
      setParticipantId(data.participant.id);
      setPhase("chat");
      setMessage(`Room ${data.room.code} created. Share the code with peers (anonymous nicknames only).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create room.");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!roomCode.trim()) return;
    setBusy(true);
    try {
      const response = await fetch("/api/ednova/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", code: roomCode, nickname, avatar }),
      });
      const data = (await response.json()) as { room?: GroupRoomSnapshot; participant?: GroupParticipant; error?: string };
      if (!response.ok || !data.room || !data.participant) throw new Error(data.error ?? "Could not join room.");
      setRoom(data.room);
      setParticipantId(data.participant.id);
      setPhase("chat");
      setMessage("Joined! Share your thinking and help each other learn.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not join room.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    if (!draft.trim() || !room || !participantId || busy) return;
    const content = draft.trim();
    setDraft("");
    setBusy(true);
    try {
      const response = await fetch("/api/ednova/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "message", code: room.code, senderId: participantId, content }),
      });
      const data = (await response.json()) as { room?: GroupRoomSnapshot; error?: string };
      if (data.room) setRoom(data.room);
    } catch { /* silent */ }
    finally { setBusy(false); }
  }

  async function requestMediation() {
    if (!room || mediating) return;
    setMediating(true);
    try {
      const response = await fetch("/api/ednova/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mediate", code: room.code }),
      });
      const data = (await response.json()) as { room?: GroupRoomSnapshot; notice?: string; error?: string };
      if (data.room) setRoom(data.room);
      if (data.notice) setMessage(data.notice);
    } catch {
      setMessage("Mediation is temporarily unavailable.");
    } finally {
      setMediating(false);
    }
  }

  async function requestSummary() {
    if (!room || summarizing) return;
    setSummarizing(true);
    try {
      const response = await fetch("/api/ednova/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "summarize", code: room.code }),
      });
      const data = (await response.json()) as { room?: GroupRoomSnapshot; summary?: string; notice?: string; error?: string };
      if (data.room) setRoom(data.room);
      if (data.notice) setMessage(data.notice);
    } catch {
      setMessage("Summary generation is temporarily unavailable.");
    } finally {
      setSummarizing(false);
    }
  }

  function copyCode() {
    if (!room) return;
    void navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const totalParticipantMessages = room?.participants.reduce((s, p) => s + p.messageCount, 0) ?? 0;

  return (
    <main className="min-h-screen bg-[#070b1b] px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-cyan-200">EdNova group learning</p>
            <h1 className="mt-1 text-3xl font-black">
              {phase === "chat" ? room?.topic ?? "Discussion" : "Learn together, grow together."}
            </h1>
          </div>
          <Link href="/ednova" className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5">Back to tutor</Link>
        </header>

        {message ? <p role="status" className="mt-4 rounded-xl bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">{message}</p> : null}

        {/* ========== LOBBY ========== */}
        {phase === "lobby" ? (
          <div className="mt-6">
            <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-7">
              <div className="flex gap-2 rounded-xl bg-white/[0.04] p-1">
                <button type="button" onClick={() => setRole("create")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${role === "create" ? "bg-violet-400/15 text-violet-100" : "text-slate-500"}`}>Create room</button>
                <button type="button" onClick={() => setRole("join")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${role === "join" ? "bg-cyan-400/15 text-cyan-100" : "text-slate-500"}`}>Join room</button>
              </div>

              <div className="mt-6 space-y-4">
                {role === "create" ? (
                  <label className="block text-sm font-semibold text-slate-200">
                    Discussion topic
                    <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-cyan-300/60" />
                  </label>
                ) : (
                  <label className="block text-sm font-semibold text-slate-200">
                    Room code
                    <input value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} maxLength={8} placeholder="ABCDE" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-white outline-none" />
                  </label>
                )}

                <label className="block text-sm font-semibold text-slate-200">
                  Your nickname
                  <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={24} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" />
                </label>

                <button
                  type="button"
                  onClick={role === "create" ? handleCreate : handleJoin}
                  disabled={busy || (role === "create" ? !topic.trim() : !roomCode.trim())}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:scale-[1.02] disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : role === "create" ? <Users className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                  {role === "create" ? "Start room" : "Join room"}
                </button>
              </div>
            </section>

            <section className="mt-5 rounded-3xl border border-emerald-300/15 bg-emerald-400/5 p-5 text-sm leading-6 text-emerald-50">
              <p className="font-bold">How group learning works</p>
              <p className="mt-1 text-emerald-100/70">Create a room and share the code with peers. Discuss a topic together while the AI mediator checks for errors, balances participation, and asks guiding questions. No real names — use nicknames only.</p>
            </section>
          </div>
        ) : null}

        {/* ========== CHAT ========== */}
        {phase === "chat" && room ? (
          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
            {/* Main chat */}
            <section className="flex flex-col rounded-3xl border border-white/10 bg-slate-900/70">
              {/* Chat header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" title="Connected" />
                  <span className="text-xs font-bold uppercase tracking-widest text-cyan-200">Room {room.code}</span>
                  <button type="button" onClick={copyCode} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-slate-300 transition hover:bg-white/5">
                    {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied!" : "Copy code"}
                  </button>
                </div>
                <span className="text-xs text-slate-400">{room.participants.length} participant{room.participants.length !== 1 ? "s" : ""}</span>
              </div>

              {/* Messages */}
              <div className="min-h-[350px] max-h-[500px] flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {room.messages.map((msg) => (
                  <ChatBubble key={msg.id} msg={msg} isOwn={msg.senderId === participantId} />
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={sendMessage} className="border-t border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-end gap-3 rounded-2xl border border-white/10 bg-slate-900 p-2 focus-within:border-cyan-300/50">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
                    placeholder="Share your thinking…"
                    rows={2}
                    maxLength={2000}
                    disabled={busy}
                    className="min-h-12 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 disabled:opacity-60"
                  />
                  <button type="submit" disabled={!draft.trim() || busy} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 text-slate-950 transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send message">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
                  </button>
                </div>
                <p className="px-2 pt-2 text-xs text-slate-500">Use only anonymous or synthetic content. Do not share private information.</p>
              </form>
            </section>

            {/* Sidebar */}
            <aside className="space-y-4">
              {/* Participants */}
              <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-violet-200"><Crown className="h-4 w-4" /> Participants</p>
                <ul className="mt-4 space-y-3">
                  {room.participants.map((p) => {
                    const pct = totalParticipantMessages > 0 ? Math.round((p.messageCount / totalParticipantMessages) * 100) : 0;
                    return (
                      <li key={p.id} className="text-sm">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <span>{p.avatar}</span>
                            <span className="truncate text-slate-200">{p.nickname}</span>
                            {p.id === participantId ? <span className="text-[10px] text-cyan-300">(you)</span> : null}
                          </span>
                          <span className="text-xs text-slate-500">{p.messageCount} msg</span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-violet-400/40 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {/* AI actions */}
              <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-5 space-y-3">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cyan-200"><Brain className="h-4 w-4" /> AI Facilitator</p>
                <button type="button" onClick={requestMediation} disabled={mediating} className="w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5 disabled:opacity-50">
                  {mediating ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Checking…</span> : <span className="flex items-center justify-center gap-2"><Sparkles className="h-4 w-4" /> Check discussion</span>}
                </button>
                <button type="button" onClick={requestSummary} disabled={summarizing} className="w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5 disabled:opacity-50">
                  {summarizing ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Summarizing…</span> : <span className="flex items-center justify-center gap-2"><MessageCircle className="h-4 w-4" /> Summarize</span>}
                </button>
              </section>

              {/* Summary */}
              {room.summary ? (
                <section className="rounded-3xl border border-cyan-300/15 bg-cyan-400/5 p-5">
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-cyan-200">Discussion summary</p>
                  <div className="ednova-markdown text-sm leading-6 text-slate-200">
                    <ReactMarkdown>{room.summary}</ReactMarkdown>
                  </div>
                </section>
              ) : null}

              {/* Peer collaboration notice */}
              <section className="rounded-3xl border border-emerald-300/15 bg-emerald-400/5 p-5 text-sm leading-6 text-emerald-50">
                <p className="font-bold">Collaborative Peer Study</p>
                <p className="mt-1 text-emerald-100/70">The AI mediator helps study peers collaborate, brainstorm, and work through complex concepts together.</p>
              </section>
            </aside>
          </div>
        ) : null}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Chat bubble component
// ---------------------------------------------------------------------------

function ChatBubble({ msg, isOwn }: { msg: GroupMessage; isOwn: boolean }) {
  if (msg.isAI) {
    return (
      <div className={`mx-auto max-w-[90%] rounded-2xl border p-3 ${msg.flagged ? "border-amber-300/20 bg-amber-400/5" : "border-violet-300/15 bg-violet-400/5"}`}>
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-violet-200">
          <Brain className="h-3.5 w-3.5" /> AI Mediator
          {msg.flagged ? <AlertTriangle className="h-3.5 w-3.5 text-amber-300" /> : null}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-200">{msg.content}</p>
        {msg.correction ? <p className="mt-2 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-100">{msg.correction}</p> : null}
        <p className="mt-2 text-[10px] text-slate-500">{formatTime(msg.timestamp)}</p>
      </div>
    );
  }

  if (isOwn) {
    return (
      <div className="ml-auto max-w-[80%]">
        <div className="rounded-2xl rounded-tr-sm bg-gradient-to-br from-violet-500 to-indigo-600 px-4 py-3 text-sm leading-6 text-white shadow-lg shadow-violet-950/30">
          {msg.content}
        </div>
        <p className="mt-1 text-right text-[10px] text-slate-500">{formatTime(msg.timestamp)}</p>
      </div>
    );
  }

  return (
    <div className="max-w-[80%]">
      <p className="mb-1 flex items-center gap-1.5 text-[10px] text-slate-400">
        <span>{msg.senderAvatar}</span> {msg.senderNickname}
      </p>
      <div className="rounded-2xl rounded-tl-sm border border-white/10 bg-slate-800/60 px-4 py-3 text-sm leading-6 text-slate-100">
        {msg.content}
      </div>
      <p className="mt-1 text-[10px] text-slate-500">{formatTime(msg.timestamp)}</p>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}
