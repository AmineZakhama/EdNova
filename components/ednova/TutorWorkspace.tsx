"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Award,
  BarChart3,
  BellRing,
  BookOpen,
  Bot,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Copy,
  Download,
  Edit2,
  FileText,
  Flame,
  Gamepad2,
  GraduationCap,
  Home,
  Layers,
  Lightbulb,
  LoaderCircle,
  Mic,
  MicOff,
  MoreHorizontal,
  PanelLeft,
  PanelLeftClose,
  Paperclip,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TimerReset,
  Trash2,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";

import type { LearnerProfile, TutorHint } from "@/lib/ednova/types";
import { classifyQuestionIntent } from "@/lib/ednova/tutor";
import { loadLearnerProfile, recordLearningSignal, saveLearnerProfile } from "@/lib/ednova/profile-storage";
import { addKnowledgeNote, loadKnowledgeNotes } from "@/lib/ednova/knowledge-storage";
import { loadLearningProgress } from "@/lib/ednova/progress-storage";
import { getTotalDueCount } from "@/lib/ednova/spaced-repetition";
import { retrieveRelevantChunks } from "@/lib/ednova/rag";
import {
  ChatSession,
  createNewSession,
  deleteSession,
  getActiveSessionId,
  loadChatSessions,
  setActiveSessionId,
  Turn,
  updateSessionTurns,
} from "@/lib/ednova/chat-sessions";

import KnowledgePanel from "@/components/ednova/KnowledgePanel";
import StudyTimer from "@/components/ednova/StudyTimer";
import UserMenu from "@/components/ednova/UserMenu";
import MarkdownViewer from "@/components/ednova/MarkdownViewer";
import LoadingQuizModal from "@/components/ednova/LoadingQuizModal";
import { TokenTopUpModal } from "@/components/ednova/TokenTopUpModal";

const localizedSampleQuestions: Record<string, string[]> = {
  en: [
    "I don't understand why a negative times a negative is positive.",
    "Help me start this quadratic equation: x² - 5x + 6 = 0.",
    "How can I remember the stages of mitosis?",
  ],
  fr: [
    "Je ne comprends pas pourquoi moins par moins donne plus.",
    "Aide-moi à démarrer cette équation: x² - 5x + 6 = 0.",
    "Comment retenir facilement les étapes de la mitose ?",
  ],
  ar: [
    "مش فاهم علاش سالب في سالب يعطي موجب؟",
    "عاوني كيفاش نبدأ حل المعادلة: x² - 5x + 6 = 0.",
    "كيفاش نتفكر مراحل الانقسام الخلوي بسهولة؟",
  ],
  darija: [
    "علاش ضرب عدد سالب في سالب يعطي موجب؟ ما فهمتش.",
    "عاوني نبدا هاد المعادلة: x² - 5x + 6 = 0.",
    "كيفاش نعقل على مراحل الانقسام الميتوزي بالترتيب؟",
  ],
};

const demoProfile: LearnerProfile = {
  nickname: "Learner",
  language: "en",
  level: "secondary school",
  learningStyles: ["step-by-step", "examples"],
  mode: "individual",
};

const interfaceCopy = {
  en: {
    badge: "Hint first, answer when you ask",
    title: "Let’s reason it out together.",
    subtitle: "EdNova guides your next learning step with Socratic hints, structured practice, and collaborative peer learning.",
    placeholder: "Ask a learning question, paste a problem, or attach notes…",
    anonymous: "Anonymous demo mode",
  },
  fr: {
    badge: "Indice d’abord, réponse sur demande",
    title: "Réfléchissons ensemble.",
    subtitle: "EdNova vous guide étape par étape avec des indices socratiques et l’apprentissage collaboratif.",
    placeholder: "Posez une question d’apprentissage ou joignez un cours…",
    anonymous: "Mode anonyme",
  },
  ar: {
    badge: "تلميح أولا ثم الإجابة عند الطلب",
    title: "لنحلل الفكرة معًا.",
    subtitle: "EdNova يرشدك خطوة بخطوة بالأسلوب السقراطي والتعلم التشاركي.",
    placeholder: "اطرح سؤالًا تعليميًا أو أرفق درسًا…",
    anonymous: "وضع مجهول الهوية",
  },
  darija: {
    badge: "تلميحة قبل، والجواب كي تطلبو",
    title: "نفكرو فيها مع بعضنا.",
    subtitle: "EdNova يوجّه خطوتك خطوة بخطوة مع التفكير التشاركي.",
    placeholder: "اسأل سؤال على القراية ولا حط درس…",
    anonymous: "وضع مجهول",
  },
} as const;

export default function TutorWorkspace() {
  const [draft, setDraft] = useState("");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "understanding" | "notes" | "writing">("idle");
  const [profile, setProfile] = useState<LearnerProfile>(demoProfile);
  const [listening, setListening] = useState(false);
  const [speakingTurnId, setSpeakingTurnId] = useState<string | null>(null);
  const [voiceNotice, setVoiceNotice] = useState("");
  const [noteCount, setNoteCount] = useState(0);
  const [progressSummary, setProgressSummary] = useState({ level: 1, xp: 0 });
  const [dueCardsCount, setDueCardsCount] = useState(0);

  // Gemini-like state controls
  const [showSidebar, setShowSidebar] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingTurnId, setEditingTurnId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [tuneMenuTurnId, setTuneMenuTurnId] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const [attaching, setAttaching] = useState(false);

  // Modern Dashboard Modal Controls
  const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLoadingQuizOpen, setIsLoadingQuizOpen] = useState(false);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [isTutorReady, setIsTutorReady] = useState(false);
  const [inferenceMode, setInferenceMode] = useState<"fast" | "thinking">("thinking");
  const [userTokens, setUserTokens] = useState<number>(25000);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("ednova-inference-mode");
      if (saved === "fast" || saved === "thinking") {
        setInferenceMode(saved);
      }
    } catch { }
  }, []);

  // Fetch initial student token balance and sync Stripe payment returns
  useEffect(() => {
    fetch("/api/ednova/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.tokens !== undefined) {
          setUserTokens(data.user.tokens);
        }
      })
      .catch(() => { });

    function handleTokenReward(e: Event) {
      const customEvent = e as CustomEvent<{ tokens: number }>;
      if (customEvent.detail?.tokens) {
        setUserTokens((prev) => prev + customEvent.detail.tokens);
      }
    }
    window.addEventListener("ednova-tokens-reward", handleTokenReward);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("payment") === "success") {
        const sessionId = params.get("session_id");
        const tokensAdded = params.get("tokens");
        const pack = params.get("pack");
        const isMock = params.get("mock") === "true";
        setPaymentNotice(
          `Payment successful! Added +${tokensAdded ? Number(tokensAdded).toLocaleString() : ""} tokens to your study balance (${pack || "Token Pack"})${isMock ? " [Demo Mode]" : ""}.`
        );

        if (tokensAdded) {
          setUserTokens((prev) => prev + Number(tokensAdded));
        }

        // Call verify endpoint to guarantee persistence in PostgreSQL
        fetch("/api/ednova/stripe/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            tokens: tokensAdded ? parseInt(tokensAdded, 10) : undefined,
            pack,
            mock: isMock,
          }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.tokens !== undefined) {
              setUserTokens(data.tokens);
            }
          })
          .catch(() => { });

        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (params.get("payment") === "cancelled") {
        setPaymentNotice("Token checkout was cancelled. You can top up anytime.");
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    return () => {
      window.removeEventListener("ednova-tokens-reward", handleTokenReward);
    };
  }, []);

  function handleSetInferenceMode(mode: "fast" | "thinking") {
    setInferenceMode(mode);
    try {
      window.localStorage.setItem("ednova-inference-mode", mode);
    } catch { }
  }
  const [timerState, setTimerState] = useState({
    formatted: "25:00",
    remaining: 1500,
    phase: "focus",
    isRunning: false,
    isAlarmRinging: false,
  });

  // Listen to background StudyTimer events
  useEffect(() => {
    function handleTimerTick(e: Event) {
      const customEvent = e as CustomEvent<{
        formatted: string;
        remaining: number;
        phase: string;
        isRunning: boolean;
        isAlarmRinging: boolean;
      }>;
      if (customEvent.detail) {
        setTimerState(customEvent.detail);
        if (customEvent.detail.isAlarmRinging) {
          setIsTimerModalOpen(true); // Automatically surface timer modal when alarm rings!
        }
      }
    }

    window.addEventListener("ednova-timer-tick", handleTimerTick);
    return () => window.removeEventListener("ednova-timer-tick", handleTimerTick);
  }, []);

  // Keyboard shortcut: Esc to dismiss modals
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsTimerModalOpen(false);
        setIsNotesModalOpen(false);
        setIsProfileModalOpen(false);
        setIsLoadingQuizOpen(false);
        setIsTokenModalOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
    } else if (chatScrollContainerRef.current) {
      chatScrollContainerRef.current.scrollTop = chatScrollContainerRef.current.scrollHeight;
    }
  }, []);

  // Auto-scroll chat down when new turns arrive or when tutor is streaming an answer
  useEffect(() => {
    const container = chatScrollContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 320;
    if (isNearBottom || activeTurnId) {
      scrollToBottom(true);
    }
  }, [turns, activeTurnId, scrollToBottom]);

  const handleChatScroll = () => {
    const container = chatScrollContainerRef.current;
    if (!container) return;
    const isScrolledUp = container.scrollHeight - container.scrollTop - container.clientHeight > 200;
    setShowScrollBottom(isScrolledUp);
  };

  // Initialize profile & chat sessions
  useEffect(() => {
    const storedProfile = loadLearnerProfile();
    if (storedProfile) setProfile(storedProfile);

    const loadedSessions = loadChatSessions();
    setSessions(loadedSessions);

    const activeId = getActiveSessionId();
    if (activeId && loadedSessions.some((s) => s.id === activeId)) {
      setCurrentSessionId(activeId);
      const activeSession = loadedSessions.find((s) => s.id === activeId);
      if (activeSession) setTurns(activeSession.turns);
    } else if (loadedSessions.length > 0) {
      setCurrentSessionId(loadedSessions[0].id);
      setTurns(loadedSessions[0].turns);
      setActiveSessionId(loadedSessions[0].id);
    } else {
      const newSess = createNewSession();
      setSessions([newSess]);
      setCurrentSessionId(newSess.id);
      setTurns([]);
    }

    const notes = loadKnowledgeNotes();
    setNoteCount(notes.length);

    const prog = loadLearningProgress();
    setProgressSummary({ level: prog.level, xp: prog.xp });

    setDueCardsCount(getTotalDueCount());
  }, []);

  // Sync turns to active chat session
  useEffect(() => {
    if (!currentSessionId) return;
    updateSessionTurns(currentSessionId, turns);
    setSessions(loadChatSessions());
  }, [turns, currentSessionId]);

  const copy = interfaceCopy[profile.language ?? "en"];
  const samples = localizedSampleQuestions[profile.language ?? "en"] ?? localizedSampleQuestions.en;

  const conversation = useMemo(
    () =>
      turns.flatMap((turn) => [
        { role: "user" as const, content: turn.question },
        ...(turn.explanation ? [{ role: "assistant" as const, content: turn.explanation }] : []),
      ]),
    [turns],
  );

  // -------------------------------------------------------------------------
  // Session Actions (Gemini Sidebar)
  // -------------------------------------------------------------------------

  function handleNewChat() {
    const newSess = createNewSession();
    setSessions(loadChatSessions());
    setCurrentSessionId(newSess.id);
    setTurns([]);
    setDraft("");
    setAttachedFile(null);
    setTimeout(() => scrollToBottom(false), 50);
  }

  function handleSelectSession(sessionId: string) {
    if (sessionId === currentSessionId) return;
    const sess = sessions.find((s) => s.id === sessionId);
    if (!sess) return;
    setCurrentSessionId(sessionId);
    setActiveSessionId(sessionId);
    setTurns(sess.turns);
    setDraft("");
    setAttachedFile(null);
    setTimeout(() => scrollToBottom(false), 50);
  }

  function handleDeleteSession(e: React.MouseEvent, sessionId: string) {
    e.stopPropagation();
    const updated = deleteSession(sessionId);
    setSessions(updated);
    if (sessionId === currentSessionId) {
      if (updated.length > 0) {
        setCurrentSessionId(updated[0].id);
        setActiveSessionId(updated[0].id);
        setTurns(updated[0].turns);
      } else {
        handleNewChat();
      }
    }
  }

  // -------------------------------------------------------------------------
  // Core AI Query Execution
  // -------------------------------------------------------------------------

  async function ask(
    event?: FormEvent,
    answerRequested = false,
    messageOverride?: string,
    modification?: "shorter" | "detailed" | "simpler" | "analogy" | "practice",
  ) {
    event?.preventDefault();
    const message = (messageOverride ?? draft).trim();
    if (!message || activeTurnId) return;

    const id = crypto.randomUUID();
    const notes = loadKnowledgeNotes();

    // If an extra file note is attached, prepend it to RAG context
    let extraContext: Array<{ id: string; title: string; content: string }> = [];
    if (attachedFile) {
      extraContext = [
        {
          id: crypto.randomUUID(),
          title: attachedFile.name,
          content: attachedFile.content.slice(0, 1800),
        },
      ];
    }

    const context = [...extraContext, ...retrieveRelevantChunks(message, notes)].slice(0, 4);
    const questionIntent = classifyQuestionIntent(message);

    const payload = {
      message,
      profile,
      answerRequested: answerRequested || questionIntent === "explanation",
      questionIntent,
      conversation: conversation.slice(-10),
      context,
      hintLevel: 1,
      modification,
      inferenceMode,
    };

    setTurns((previous) => [
      ...previous,
      {
        id,
        question: message,
        questionIntent,
        hints: [],
        sources: context.map((chunk) => ({ id: chunk.id, title: chunk.title })),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        attachmentName: attachedFile?.name,
        inferenceMode,
      },
    ]);
    setTimeout(() => scrollToBottom(true), 50);

    setDraft("");
    setAttachedFile(null);
    setActiveTurnId(id);
    setStage("understanding");
    setIsTutorReady(false);

    // Gamification: If tutor inference takes > 950ms, open 1-question recall mini-quiz on favorite topic
    const quizModalTimer = window.setTimeout(() => {
      try {
        const autoEnabled = window.localStorage.getItem("ednova-auto-loading-quiz") !== "false";
        if (autoEnabled) {
          setIsLoadingQuizOpen(true);
        }
      } catch { }
    }, 950);

    const stageTimers = [
      window.setTimeout(() => setStage("notes"), 450),
      window.setTimeout(() => setStage("writing"), 950),
    ];

    const updateTurn = (update: Partial<Turn>) => {
      setTurns((previous) => previous.map((turn) => (turn.id === id ? { ...turn, ...update } : turn)));
    };

    // Fast-model hint task: conditional on question intent
    // Direct questions / problem-solving get Socratic hints; conceptual explanations skip hints to avoid roadblocks
    const hintTask =
      questionIntent === "explanation"
        ? Promise.resolve()
        : fetch("/api/ednova/tutor/hint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
          .then(async (response) => {
            const data = (await response.json()) as { hint?: TutorHint; error?: string; notice?: string; tokens?: number };
            if (response.status === 402 || data.error === "OUT_OF_TOKENS") {
              setIsTokenModalOpen(true);
              throw new Error("You've run out of study tokens! Top up to continue or earn tokens in the Mini-Quiz.");
            }
            if (!response.ok || !data.hint) throw new Error(data.error ?? "The first hint is unavailable.");
            if (data.tokens !== undefined) setUserTokens(data.tokens);
            updateTurn({ hints: [data.hint], hintNotice: data.notice });
            recordLearningSignal("hint");
            if (data.hint.confused) recordLearningSignal("confusion");
          })
          .catch((error: unknown) => updateTurn({ hintError: toMessage(error, "The first hint is unavailable.") }));

    // Model explanation task (routes to fast or large based on user preference)
    const explanationTask = fetch("/api/ednova/tutor/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (response) => {
        const data = (await response.json()) as {
          explanation?: string;
          error?: string;
          notice?: string;
          modelClass?: string;
          modelName?: string;
          tokens?: number;
        };
        if (response.status === 402 || data.error === "OUT_OF_TOKENS") {
          setIsTokenModalOpen(true);
          throw new Error("You've run out of study tokens! Top up your balance or switch to Fast Mode.");
        }
        if (!response.ok || !data.explanation) throw new Error(data.error ?? "The detailed guide is unavailable.");
        if (data.tokens !== undefined) setUserTokens(data.tokens);
        updateTurn({
          explanation: data.explanation,
          fallbackNotice: data.notice,
          modelName: data.modelName,
          inferenceMode,
        });
      })
      .catch((error: unknown) => updateTurn({ explanationError: toMessage(error, "The detailed guide is unavailable.") }));

    await Promise.allSettled([hintTask, explanationTask]);
    window.clearTimeout(quizModalTimer);
    setIsTutorReady(true);
    stageTimers.forEach((timer) => window.clearTimeout(timer));
    setStage("idle");
    setActiveTurnId(null);
  }

  // -------------------------------------------------------------------------
  // Gemini-like Message Controls
  // -------------------------------------------------------------------------

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleReaction(turnId: string, reaction: "like" | "dislike") {
    setTurns((prev) =>
      prev.map((t) => (t.id === turnId ? { ...t, reaction: t.reaction === reaction ? null : reaction } : t)),
    );
  }

  function handleRegenerate(turn: Turn) {
    void ask(undefined, false, turn.question);
  }

  function handleModify(turn: Turn, mod: "shorter" | "detailed" | "simpler" | "analogy" | "practice") {
    setTuneMenuTurnId(null);
    void ask(undefined, false, turn.question, mod);
  }

  function startEditQuestion(turn: Turn) {
    setEditingTurnId(turn.id);
    setEditDraft(turn.question);
  }

  function submitEditedQuestion(turnId: string) {
    if (!editDraft.trim()) return;
    setEditingTurnId(null);
    void ask(undefined, false, editDraft);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttaching(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/ednova/rag/extract", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "File could not be extracted.");

      setAttachedFile({ name: file.name, content: data.text });
      // Also save to Knowledge Notes store
      addKnowledgeNote({
        title: data.title || file.name,
        content: data.text,
      });
      setNoteCount(loadKnowledgeNotes().length);
    } catch (err) {
      setVoiceNotice(err instanceof Error ? err.message : "Upload error");
    } finally {
      setAttaching(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function exportChatMarkdown() {
    if (turns.length === 0) return;
    let md = `# EdNova Learning Session\n**Date:** ${new Date().toLocaleDateString()}\n\n---\n\n`;
    turns.forEach((t, i) => {
      md += `### ${i + 1}. Learner:\n${t.question}\n\n`;
      if (t.hints.length) {
        t.hints.forEach((h, hIdx) => {
          md += `> **Hint ${hIdx + 1}:** ${h.hint}\n> *Guiding Question:* ${h.nextQuestion}\n\n`;
        });
      }
      if (t.explanation) {
        md += `### EdNova Tutor:\n${t.explanation}\n\n---\n\n`;
      }
    });

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `EdNova_Study_Chat_${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Request progressive hint (Hint 1, Hint 2, or Hint 3)
  async function requestNextHint(turnId: string) {
    const turn = turns.find((t) => t.id === turnId);
    if (!turn || turn.hintLoading) return;
    if (turn.hints.length >= 3) return;
    const nextLevel = (turn.hints.length + 1) as 1 | 2 | 3;

    setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, hintLoading: true } : t)));

    try {
      const context = retrieveRelevantChunks(turn.question, loadKnowledgeNotes());
      const response = await fetch("/api/ednova/tutor/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: turn.question,
          profile,
          context,
          hintLevel: nextLevel,
          conversation: conversation.slice(-10),
        }),
      });

      const data = (await response.json()) as { hint?: TutorHint; error?: string; notice?: string; tokens?: number };
      if (response.status === 402 || data.error === "OUT_OF_TOKENS") {
        setIsTokenModalOpen(true);
        throw new Error("You've run out of study tokens! Top up to continue receiving hints.");
      }
      if (!response.ok || !data.hint) throw new Error(data.error ?? "Could not load next hint.");
      if (data.tokens !== undefined) setUserTokens(data.tokens);

      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? { ...t, hints: [...t.hints, data.hint!], hintLoading: false, hintNotice: data.notice ?? t.hintNotice }
            : t,
        ),
      );
      recordLearningSignal("hint");
    } catch (error) {
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? { ...t, hintLoading: false, hintNotice: toMessage(error, "Next hint unavailable.") }
            : t,
        ),
      );
    }
  }

  function setLanguage(language: LearnerProfile["language"]) {
    if (!language) return;
    setProfile(saveLearnerProfile({ ...profile, language }));
  }

  function toggleListening() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceNotice("Speech recognition is not available in this browser. You can still type your question.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang =
      profile.language === "fr"
        ? "fr-FR"
        : profile.language === "ar" || profile.language === "darija"
          ? "ar-TN"
          : "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setVoiceNotice("We could not hear that clearly. You can type your question instead.");
    };
    recognition.onresult = (event: { results: Array<Array<{ transcript: string }>> }) => {
      setDraft((current) => `${current}${current ? " " : ""}${event.results[0][0].transcript}`);
      setVoiceNotice("");
    };
    recognition.start();
  }

  function toggleSpeech(turnId: string, text: string) {
    if (!("speechSynthesis" in window)) {
      setVoiceNotice("Read-aloud is not available in this browser.");
      return;
    }

    if (speakingTurnId === turnId) {
      window.speechSynthesis.cancel();
      setSpeakingTurnId(null);
      return;
    }

    window.speechSynthesis.cancel();
    setSpeakingTurnId(turnId);

    const utterance = new SpeechSynthesisUtterance(text.replace(/[#*_`>-]/g, " "));
    utterance.lang =
      profile.language === "fr"
        ? "fr-FR"
        : profile.language === "ar" || profile.language === "darija"
          ? "ar-TN"
          : "en-US";

    utterance.onend = () => setSpeakingTurnId(null);
    utterance.onerror = () => setSpeakingTurnId(null);

    window.speechSynthesis.speak(utterance);
    setVoiceNotice("");
  }

  // -------------------------------------------------------------------------
  // Contextual Follow-up Chips
  // -------------------------------------------------------------------------
  const lastTurn = turns[turns.length - 1];
  const suggestedFollowUps = useMemo(() => {
    if (!lastTurn || !lastTurn.explanation) return [];
    return [
      "Can you give me a real-world example of this?",
      "What is the most common mistake students make here?",
      "Give me a quick practice question to test my understanding.",
    ];
  }, [lastTurn]);

  return (
    <main
      className="h-screen max-h-screen bg-[#070b1b] text-slate-100 flex flex-col overflow-hidden"
      dir={profile.language === "ar" || profile.language === "darija" ? "rtl" : "ltr"}
    >
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute -left-32 top-8 h-80 w-80 rounded-full bg-violet-600/15 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      {/* Top Main Navbar */}
      <header className="shrink-0 relative z-20 border-b border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {/* Sidebar Toggle */}
            <button
              type="button"
              onClick={() => setShowSidebar(!showSidebar)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
              title={showSidebar ? "Collapse Navigation Sidebar" : "Open Navigation Sidebar"}
            >
              {showSidebar ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </button>

            <Link href="/ednova" className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-md shadow-violet-500/25">
                <Brain className="h-4 w-4 text-white" aria-hidden />
              </div>
              <div>
                <p className="text-base font-black tracking-tight leading-none text-white">EdNova</p>
                <p className="text-[10px] text-cyan-300/80 mt-0.5 font-medium">AI Socratic Companion</p>
              </div>
            </Link>
          </div>

          {/* Quick-Access Modal Dock on the Right */}
          <div className="flex items-center gap-2">
            {/* 1. Focus Timer Modal Trigger */}
            <button
              type="button"
              onClick={() => setIsTimerModalOpen(true)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition shadow-sm cursor-pointer ${timerState.isAlarmRinging
                  ? "border-rose-400/80 bg-rose-500/20 text-rose-200 animate-pulse"
                  : timerState.isRunning
                    ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200 shadow-cyan-500/10"
                    : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-400/40 hover:text-white"
                }`}
              title="Open Focus Study Timer & Alarms"
            >
              {timerState.isAlarmRinging ? (
                <BellRing className="h-3.5 w-3.5 text-rose-400 animate-bounce" />
              ) : (
                <TimerReset className={`h-3.5 w-3.5 ${timerState.isRunning ? "text-cyan-400 animate-spin" : "text-cyan-300"}`} />
              )}
              <span className="hidden sm:inline">
                {timerState.isAlarmRinging
                  ? "Alarm Ringing!"
                  : timerState.isRunning
                    ? `${timerState.formatted} (${timerState.phase})`
                    : "Study Timer"}
              </span>
              {timerState.isRunning && (
                <span className="flex h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
              )}
            </button>

            {/* 2. Knowledge Notes & RAG Modal Trigger */}
            <button
              type="button"
              onClick={() => {
                setNoteCount(loadKnowledgeNotes().length);
                setIsNotesModalOpen(true);
              }}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition shadow-sm cursor-pointer ${noteCount > 0
                  ? "border-violet-400/40 bg-violet-500/15 text-violet-200"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-violet-400/40 hover:text-white"
                }`}
              title="Open Course Notes & RAG Grounding"
            >
              <BookOpen className="h-3.5 w-3.5 text-violet-400" />
              <span className="hidden sm:inline">Notes & RAG</span>
              <span className="rounded-full bg-violet-400/20 px-1.5 py-0.2 text-[10px] font-extrabold text-violet-200">
                {noteCount}
              </span>
            </button>

            {/* 3. Learner Profile & Diagnostic Modal Trigger */}
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-emerald-400/40 hover:text-white transition shadow-sm cursor-pointer"
              title="View Learner Profile & Calibration"
            >
              <span className="text-sm">{profile.avatar || "🎓"}</span>
              <span className="font-semibold text-slate-200 hidden md:inline">{profile.nickname || "Learner"}</span>
              <span className="hidden lg:inline rounded-full bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                {profile.cognitiveArchetype || "Adaptive"}
              </span>
            </button>

            {/* 4. Instant 1-Question Brain-Check Trigger */}
            <button
              type="button"
              onClick={() => {
                setIsTutorReady(true);
                setIsLoadingQuizOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-amber-200 transition hover:bg-amber-500/20 shadow-sm cursor-pointer"
              title="Quick Recall Brain-Check (+15 XP)"
            >
              <Zap className="h-3.5 w-3.5 text-amber-400 fill-current" />
              <span className="hidden sm:inline">Brain-Check</span>
              <span className="rounded-full bg-amber-400/20 px-1.5 py-0.2 text-[10px] font-extrabold text-amber-300">
                +15 XP
              </span>
            </button>

            {/* 5. Token Treasury & Top-Up Trigger */}
            <button
              type="button"
              onClick={() => setIsTokenModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-600/10 to-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-300 hover:border-amber-400 hover:bg-amber-500/25 transition shadow-sm shadow-amber-500/10 cursor-pointer"
              title="EdNova Token Treasury • Click to Top Up"
            >
              <span className="text-sm">🪙</span>
              <span className="font-extrabold tracking-tight">{userTokens.toLocaleString()}</span>
              <span className="hidden sm:inline text-[10px] text-amber-400/80 font-semibold uppercase">Tokens</span>
              <span className="rounded-full bg-amber-400/20 px-1.5 py-0.2 text-[9px] font-black text-amber-300 hover:bg-amber-400/30">
                +
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Payment Notice Banner */}
      {paymentNotice && (
        <div className="shrink-0 relative z-20 mx-auto max-w-7xl px-3 sm:px-6 pt-3">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 text-xs sm:text-sm font-medium shadow-lg animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🎉</span>
              <span>{paymentNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setPaymentNotice(null)}
              className="rounded-lg p-1 text-emerald-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Multi-Column Layout: Navigation Sidebar + Chat Area */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 min-h-0 px-3 py-3 sm:px-6 gap-4 overflow-hidden">
        {/* Mobile Backdrop Overlay */}
        {showSidebar && (
          <div
            className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm md:hidden"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* Modern App Navigation & History Sidebar with PRETTY ICONS */}
        {showSidebar && (
          <aside className="fixed md:static inset-y-0 left-0 z-40 md:z-auto w-72 shrink-0 h-full min-h-0 rounded-r-3xl md:rounded-3xl border border-white/10 bg-slate-900/95 p-4 backdrop-blur-2xl flex flex-col justify-between shadow-2xl shadow-black/50 transition-all duration-300 overflow-hidden">
            <div className="flex flex-col space-y-4 min-h-0 overflow-y-auto pr-1">
              {/* Sidebar Header & Brand */}
              <div className="flex items-center justify-between px-1 pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-md shadow-violet-500/25">
                    <Brain className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white leading-none">Navigation</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">EdNova Platform</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSidebar(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
                  title="Close Sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </div>

              {/* Navigation Items with PRETTY ICONS */}
              <nav className="space-y-1">
                <Link
                  href="/"
                  className="group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-white transition"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-slate-300 group-hover:scale-105 group-hover:bg-cyan-500/20 group-hover:text-cyan-300 transition">
                      <Home className="h-3.5 w-3.5" />
                    </div>
                    <span>Home Page</span>
                  </div>
                </Link>

                <Link
                  href="/ednova"
                  className="group flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-bold bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-cyan-400/40 text-white shadow-sm transition"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-400/20 text-cyan-300">
                      <Bot className="h-4 w-4" />
                    </div>
                    <span>AI Socratic Tutor</span>
                  </div>
                  <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                </Link>
                <Link
                  href="/ednova/analytics"
                  className="group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-white transition"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-500/15 text-cyan-300 group-hover:scale-105 transition">
                      <BarChart3 className="h-3.5 w-3.5" />
                    </div>
                    <span>Analytics</span>
                  </div>
                </Link>

                <Link
                  href="/ednova/revision"
                  className="group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-white transition"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/15 text-emerald-300 group-hover:scale-105 transition">
                      <FileText className="h-3.5 w-3.5" />
                    </div>
                    <span>Revision Studio</span>
                  </div>
                </Link>

                <Link
                  href="/ednova/revision?openFlashcards=true"
                  className="group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-white transition"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-amber-500/15 text-amber-300 group-hover:scale-105 transition">
                      <Layers className="h-3.5 w-3.5" />
                    </div>
                    <span>Flashcards</span>
                  </div>
                  {dueCardsCount > 0 ? (
                    <span className="rounded-full border border-amber-400/40 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-black text-amber-300 animate-pulse">
                      {dueCardsCount} due
                    </span>
                  ) : null}
                </Link>

                <Link
                  href="/ednova/quiz"
                  className="group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-white transition"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-500/15 text-indigo-300 group-hover:scale-105 transition">
                      <Gamepad2 className="h-3.5 w-3.5" />
                    </div>
                    <span>Live Quiz</span>
                  </div>
                </Link>

                <Link
                  href="/ednova/group"
                  className="group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-white transition"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-pink-500/15 text-pink-300 group-hover:scale-105 transition">
                      <Users className="h-3.5 w-3.5" />
                    </div>
                    <span>Group Room</span>
                  </div>
                  <span className="rounded-md border border-pink-400/30 bg-pink-500/20 px-1.5 py-0.5 text-[9px] font-bold text-pink-300">
                    Live
                  </span>
                </Link>
              </nav>

              {/* Chat Sessions Divider & Section */}
              <div className="border-t border-white/10 pt-3">
                <div className="flex items-center justify-between px-1 mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recent Chats</p>
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="flex items-center gap-1 text-[11px] font-bold text-cyan-300 hover:text-cyan-200 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> New
                  </button>
                </div>
                <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1">
                  {sessions.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-slate-500 italic">No past chats yet.</p>
                  ) : (
                    sessions.map((sess) => {
                      const isActive = sess.id === currentSessionId;
                      return (
                        <div
                          key={sess.id}
                          onClick={() => handleSelectSession(sess.id)}
                          className={`group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition cursor-pointer ${isActive
                              ? "bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 font-semibold"
                              : "text-slate-300 hover:bg-white/5"
                            }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Sparkles className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-indigo-400" : "text-slate-500"}`} />
                            <span className="truncate">{sess.title}</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSession(e, sess.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition"
                            title="Delete Chat"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Bottom User Profile, Language & Logout */}
            <div className="shrink-0 border-t border-white/10 pt-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <UserMenu />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 px-1 pt-1 border-t border-white/5">
                <span className="text-[11px]">Language:</span>
                <select
                  aria-label="Interface language"
                  value={profile.language ?? "en"}
                  onChange={(event) => setLanguage(event.target.value as LearnerProfile["language"])}
                  className="rounded-lg border border-white/10 bg-slate-900 px-2 py-0.5 text-xs text-slate-200 outline-none focus:border-cyan-300/60"
                >
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="ar">العربية</option>
                  <option value="darija">Darija</option>
                </select>
              </div>
            </div>
          </aside>
        )}

        {/* Center: Gemini-Powered Tutor Chat Area */}
        <section className="relative flex-1 flex flex-col min-h-0 h-full overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 shadow-2xl shadow-black/20 backdrop-blur-xl min-w-0">
          {/* Chat Stream Header */}
          <div className="shrink-0 border-b border-white/10 px-5 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-200">
                <Sparkles className="h-3 w-3" /> {copy.badge}
              </p>
              <h1 className="text-xl font-black tracking-tight text-white mt-1">{copy.title}</h1>
            </div>

            <div className="flex items-center gap-1.5">
              {turns.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={exportChatMarkdown}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-white/5 cursor-pointer"
                    title="Export chat as Markdown"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-400" /> Export .md
                  </button>
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-2.5 py-1.5 text-xs text-slate-400 transition hover:bg-white/5 hover:text-rose-300 cursor-pointer"
                    title="Clear current conversation"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Conversation Stream */}
          <div
            ref={chatScrollContainerRef}
            onScroll={handleChatScroll}
            className="flex-1 min-h-0 overflow-y-auto space-y-6 px-4 py-6 sm:px-6 scroll-smooth"
          >
            {turns.length === 0 ? (
              <div className="py-12 text-center max-w-lg mx-auto">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-3xl bg-indigo-500/15 text-indigo-300 shadow-md shadow-indigo-500/20">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h2 className="text-lg font-bold text-white">What would you like to master today?</h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  Ask a question, attach course notes, or pick a starter below. EdNova gives you progressive Socratic hints before revealing solutions so you build permanent intuition.
                </p>

                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {samples.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => setDraft(question)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-left text-xs text-slate-300 transition hover:border-indigo-400/50 hover:bg-indigo-500/10 hover:text-white cursor-pointer"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              turns.map((turn) => (
                <article key={turn.id} className="space-y-3">
                  {/* User Question Bubble */}
                  <div className="flex flex-col items-end">
                    <div className="group relative max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-indigo-600 to-purple-600 px-4 py-3 text-sm leading-6 text-white shadow-lg shadow-indigo-950/30">
                      {editingTurnId === turn.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            className="w-full rounded-lg bg-black/30 p-2 text-xs text-white outline-none"
                            rows={3}
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingTurnId(null)}
                              className="px-2 py-0.5 rounded text-xs bg-white/10 hover:bg-white/20"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => submitEditedQuestion(turn.id)}
                              className="px-2 py-0.5 rounded text-xs bg-indigo-500 hover:bg-indigo-600 font-semibold"
                            >
                              Resubmit
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {turn.attachmentName && (
                            <div className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-indigo-200 bg-black/20 rounded-md px-2 py-0.5 w-fit">
                              <Paperclip className="w-3 h-3" /> Attached: {turn.attachmentName}
                            </div>
                          )}
                          <p>{turn.question}</p>
                          <div className="mt-1 flex items-center justify-between text-[10px] text-indigo-200/80">
                            <span>{turn.timestamp || "Just now"}</span>
                            <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1.5 ml-3">
                              <button
                                type="button"
                                onClick={() => startEditQuestion(turn)}
                                className="hover:text-white transition"
                                title="Edit question"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => copyText(turn.question, `q-${turn.id}`)}
                                className="hover:text-white transition"
                                title="Copy question"
                              >
                                {copiedId === `q-${turn.id}` ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Socratic Progressive Hints Section */}
                  {turn.hints.length > 0 ? (
                    <div className="space-y-2 max-w-[92%]">
                      {turn.hints.map((hint, idx) => (
                        <div
                          key={`${hint.hint.slice(0, 20)}-${idx}`}
                          className="rounded-2xl rounded-tl-sm border border-amber-300/20 bg-amber-400/5 p-4"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-200">
                              <Lightbulb className="h-4 w-4 text-amber-400" /> Socratic Nudge {idx + 1} of 3
                            </p>
                            <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                              {hint.suggestedStyle} style
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-100">{hint.hint}</p>
                          <p className="mt-2.5 border-t border-white/10 pt-2 text-xs font-medium text-cyan-200">
                            {hint.nextQuestion}
                          </p>
                        </div>
                      ))}

                      {turn.hints.length < 3 && (
                        <button
                          type="button"
                          onClick={() => requestNextHint(turn.id)}
                          disabled={turn.hintLoading}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/20 disabled:opacity-50 cursor-pointer"
                        >
                          {turn.hintLoading ? (
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Lightbulb className="h-3.5 w-3.5" />
                          )}
                          Need another nudge? Get Hint {turn.hints.length + 1} of 3
                        </button>
                      )}
                    </div>
                  ) : turn.hintError ? (
                    <Failure message={turn.hintError} />
                  ) : null}

                  {/* Guided Explanation / Worked Answer with Gemini Action Toolbar */}
                  {turn.explanation ? (
                    <div className="max-w-[94%] rounded-2xl rounded-tl-sm border border-cyan-300/20 bg-slate-950/60 p-4 shadow-xl">
                      {/* Model Mode Indicator Header */}
                      <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          {turn.inferenceMode === "fast" ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                              <Zap className="h-2.5 w-2.5 fill-current" /> Fast Mode {turn.modelName ? `· ${turn.modelName}` : "· qwen2.5-3b"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                              <Brain className="h-2.5 w-2.5" /> Thinking Mode {turn.modelName ? `· ${turn.modelName}` : "· llama3.1-8b"}
                            </span>
                          )}
                        </div>
                        {turn.timestamp && (
                          <span className="text-[10px] text-slate-500 font-mono">{turn.timestamp}</span>
                        )}
                      </div>

                      {turn.fallbackNotice && (
                        <p className="mb-3 rounded-lg bg-amber-400/10 px-3 py-1.5 text-xs text-amber-100 border border-amber-400/20">
                          {turn.fallbackNotice}
                        </p>
                      )}

                      <MarkdownViewer content={turn.explanation} />

                      {turn.sources?.length ? (
                        <p className="mt-4 border-t border-white/10 pt-2.5 text-xs text-slate-400">
                          Curriculum Sources:{" "}
                          {turn.sources.map((source) => (
                            <span key={source.id} className="mr-1 inline-block rounded bg-cyan-400/10 px-2 py-0.5 text-cyan-100 text-[11px]">
                              {source.title}
                            </span>
                          ))}
                        </p>
                      ) : null}

                      {/* Gemini-like Action Toolbar */}
                      <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1 text-slate-400">
                          {/* Copy Response */}
                          <button
                            type="button"
                            onClick={() => copyText(turn.explanation ?? "", `exp-${turn.id}`)}
                            className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition cursor-pointer"
                            title="Copy response"
                          >
                            {copiedId === `exp-${turn.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Read Aloud (TTS) */}
                          <button
                            type="button"
                            onClick={() => toggleSpeech(turn.id, turn.explanation ?? "")}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${speakingTurnId === turn.id ? "bg-cyan-500/20 text-cyan-300" : "hover:bg-white/10 hover:text-white"
                              }`}
                            title={speakingTurnId === turn.id ? "Stop Read Aloud" : "Read Aloud"}
                          >
                            {speakingTurnId === turn.id ? <VolumeX className="w-3.5 h-3.5 animate-pulse" /> : <Volume2 className="w-3.5 h-3.5" />}
                          </button>

                          {/* Regenerate / Try Again */}
                          <button
                            type="button"
                            onClick={() => handleRegenerate(turn)}
                            disabled={Boolean(activeTurnId)}
                            className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition cursor-pointer disabled:opacity-40"
                            title="Regenerate alternative explanation"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          {/* Thumbs Up */}
                          <button
                            type="button"
                            onClick={() => handleReaction(turn.id, "like")}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${turn.reaction === "like" ? "bg-emerald-500/20 text-emerald-300" : "hover:bg-white/10 hover:text-white"
                              }`}
                            title="Good response"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>

                          {/* Thumbs Down */}
                          <button
                            type="button"
                            onClick={() => handleReaction(turn.id, "dislike")}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${turn.reaction === "dislike" ? "bg-rose-500/20 text-rose-300" : "hover:bg-white/10 hover:text-white"
                              }`}
                            title="Needs improvement"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>

                          {/* Gemini "Tune / Modify" Response Dropdown */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setTuneMenuTurnId(tuneMenuTurnId === turn.id ? null : turn.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10 hover:text-white text-xs font-medium transition cursor-pointer"
                              title="Modify response"
                            >
                              <SlidersHorizontal className="w-3 h-3 text-indigo-400" />
                              <span className="text-[11px]">Tune</span>
                            </button>

                            {tuneMenuTurnId === turn.id && (
                              <div className="absolute left-0 bottom-full mb-2 w-48 rounded-xl border border-slate-700 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-xl z-30 space-y-0.5">
                                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  Modify Response
                                </p>
                                <button
                                  type="button"
                                  onClick={() => handleModify(turn, "shorter")}
                                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-white/10 transition cursor-pointer flex items-center gap-1.5"
                                >
                                  ⚡ Shorter & concise
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleModify(turn, "detailed")}
                                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-white/10 transition cursor-pointer flex items-center gap-1.5"
                                >
                                  📖 More detailed
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleModify(turn, "simpler")}
                                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-white/10 transition cursor-pointer flex items-center gap-1.5"
                                >
                                  🧒 Simpler (for beginners)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleModify(turn, "analogy")}
                                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-white/10 transition cursor-pointer flex items-center gap-1.5"
                                >
                                  💡 Real-world analogy
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleModify(turn, "practice")}
                                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-white/10 transition cursor-pointer flex items-center gap-1.5"
                                >
                                  🎯 Practice problem
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {turn.hints.length === 0 && (
                            <button
                              type="button"
                              onClick={() => requestNextHint(turn.id)}
                              disabled={turn.hintLoading}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50 cursor-pointer"
                            >
                              {turn.hintLoading ? (
                                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                              )}
                              💡 Get Socratic Hint
                            </button>
                          )}

                          {turn.questionIntent === "problem" && !turn.question.toLowerCase().includes("answer") ? (
                            <button
                              type="button"
                              onClick={() => ask(undefined, true, turn.question)}
                              disabled={Boolean(activeTurnId)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-50 cursor-pointer"
                            >
                              📖 Show worked answer
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleModify(turn, "practice")}
                              disabled={Boolean(activeTurnId)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-300/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-500/20 disabled:opacity-50 cursor-pointer"
                            >
                              🎯 Practice problem
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : turn.explanationError ? (
                    <Failure message={turn.explanationError} />
                  ) : activeTurnId === turn.id ? (
                    <Progress stage={stage} compact={turn.hints.length > 0} inferenceMode={inferenceMode} />
                  ) : null}
                </article>
              ))
            )}

            {/* Contextual Gemini-like Suggested Next Prompts */}
            {suggestedFollowUps.length > 0 && !activeTurnId && (
              <div className="pt-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Suggested Next Steps</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedFollowUps.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => ask(undefined, false, prompt)}
                      className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 hover:border-indigo-400 hover:text-white hover:bg-indigo-500/10 transition cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Floating Scroll to Bottom Button */}
          {showScrollBottom && (
            <button
              type="button"
              onClick={() => scrollToBottom(true)}
              className="absolute bottom-28 right-6 z-20 flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-slate-950/95 hover:bg-cyan-500/20 text-cyan-300 font-semibold text-xs px-3.5 py-1.5 shadow-xl shadow-black/70 backdrop-blur-md transition-all animate-in fade-in zoom-in-95 cursor-pointer hover:border-cyan-400"
              title="Scroll to latest messages"
            >
              <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
              <span>Scroll to latest</span>
            </button>
          )}

          {/* Gemini-Inspired Chat Input Bar (Permanently docked at bottom of chat) */}
          <form onSubmit={ask} className="shrink-0 border-t border-white/10 bg-slate-950/85 p-3 sm:p-4 backdrop-blur-xl">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".txt,.md,.pdf"
              className="hidden"
            />

            {/* Attached file chip */}
            {attachedFile && (
              <div className="mb-2 flex items-center justify-between rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-200 w-fit gap-2">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <strong>Attachment:</strong> {attachedFile.name}
                </span>
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  className="hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Modern Chatbot Model Selector: Fast vs Thinking */}
            <div className="mb-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1 rounded-xl bg-slate-900 border border-white/10 p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => handleSetInferenceMode("fast")}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${inferenceMode === "fast"
                      ? "bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-950 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                    }`}
                  title="Fast Mode: High-speed compact model (qwen2.5-3b) for rapid answers and quick checks"
                >
                  <Zap className={`h-3 w-3 ${inferenceMode === "fast" ? "fill-current" : "text-cyan-400"}`} />
                  <span>Fast</span>
                  <span className={`text-[10px] ${inferenceMode === "fast" ? "text-slate-950 font-bold" : "text-slate-500"}`}>
                    (qwen2.5-3b)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetInferenceMode("thinking")}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${inferenceMode === "thinking"
                      ? "bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                    }`}
                  title="Thinking Mode: Large reasoning model (llama3.1-8b) for deep pedagogical derivations and multi-step scaffolding"
                >
                  <Brain className="h-3 w-3" />
                  <span>Thinking</span>
                  <span className={`text-[10px] ${inferenceMode === "thinking" ? "text-violet-200 font-bold" : "text-slate-500"}`}>
                    (llama3.1-8b)
                  </span>
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400">
                {inferenceMode === "fast" ? (
                  <span className="text-cyan-300 flex items-center gap-1 font-medium">
                    <Zap className="h-3 w-3 fill-current" /> High-speed compact model
                  </span>
                ) : (
                  <span className="text-violet-300 flex items-center gap-1 font-medium">
                    <Brain className="h-3 w-3" /> Deep reasoning & multi-step scaffolding
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-slate-900 p-2 focus-within:border-indigo-400/60 focus-within:ring-2 focus-within:ring-indigo-500/10">
              {/* Paperclip Document Upload Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={Boolean(activeTurnId) || attaching}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition disabled:opacity-40 cursor-pointer"
                title="Attach PDF or lecture note"
              >
                {attaching ? <LoaderCircle className="w-4 h-4 animate-spin text-indigo-400" /> : <Paperclip className="w-4 h-4" />}
              </button>

              <textarea
                id="ednova-question"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (draft.trim() && !activeTurnId) ask();
                  }
                }}
                placeholder={copy.placeholder}
                rows={2}
                disabled={Boolean(activeTurnId)}
                className="min-h-11 flex-1 resize-none bg-transparent px-2.5 py-1.5 text-sm text-white outline-none placeholder:text-slate-500 disabled:opacity-60"
              />

              {/* Speech Recognition Button */}
              <button
                type="button"
                onClick={toggleListening}
                disabled={Boolean(activeTurnId)}
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition disabled:opacity-40 cursor-pointer ${listening ? "border-rose-400 bg-rose-500/20 text-rose-200" : "border-white/10 text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                aria-label="Use microphone"
                title={listening ? "Listening... click to stop" : "Voice dictation"}
              >
                {listening ? <MicOff className="h-4 w-4 animate-pulse text-rose-300" /> : <Mic className="h-4 w-4" />}
              </button>

              {/* Send Button */}
              <button
                type="submit"
                disabled={!draft.trim() || Boolean(activeTurnId)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20 transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                aria-label="Send question"
              >
                {activeTurnId ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between px-2 pt-2 text-[11px] text-slate-500">
              <span>Press Enter to send, Shift + Enter for new line.</span>
              <span>EdNova scaffolds learning • tailored for individual & peer group study.</span>
            </div>

            {voiceNotice && (
              <p role="status" className="px-2 pt-1 text-xs text-amber-300">
                {voiceNotice}
              </p>
            )}
          </form>
        </section>

      </div>

      {/* ⏱️ Study Timer Glass Modal - Stays mounted so background timer & audio alarm loop continue ticking */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all duration-300 ${isTimerModalOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setIsTimerModalOpen(false);
        }}
      >
        <div className="relative w-full max-w-md animate-in zoom-in-95 duration-200">
          <StudyTimer onClose={() => setIsTimerModalOpen(false)} />
        </div>
      </div>

      {/* 📚 Knowledge Base & RAG Notes Modal */}
      {isNotesModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsNotesModalOpen(false);
          }}
        >
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <KnowledgePanel onClose={() => setIsNotesModalOpen(false)} />
          </div>
        </div>
      )}

      {/* 🎯 Learner Profile & Diagnostic Route Modal */}
      {isProfileModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsProfileModalOpen(false);
          }}
        >
          <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl text-white animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{profile.avatar || "🎓"}</span>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                    {profile.nickname || "Learner"}
                    <span className="rounded-full bg-cyan-400/10 border border-cyan-400/30 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                      Level {progressSummary.level}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Mastery Calibration: <span className="text-cyan-200 font-medium">{profile.level || "Adaptive"}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
                aria-label="Close profile modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Cognitive Calibration Traits */}
            <div className="mt-4 space-y-3.5">
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
                  <Brain className="h-4 w-4 text-violet-400" /> Cognitive Archetype
                </p>
                <p className="mt-1 text-sm font-bold text-white">
                  {profile.cognitiveArchetype || "Adaptive Thinker"}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {profile.diagnosticNotes || "Calibrated via Onboarding Diagnostic for optimal Socratic tutoring pacing."}
                </p>
                <div className="mt-2.5 flex items-center gap-2 text-xs text-cyan-200">
                  <span className="font-semibold text-slate-400">Scaffolding Pace:</span>
                  <span className="rounded-md bg-cyan-500/10 border border-cyan-400/20 px-2 py-0.5 text-[11px] font-medium text-cyan-200">
                    {profile.scaffoldingPace || "Socratic Guided"}
                  </span>
                </div>
              </div>

              {/* Learning Styles */}
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-400" /> Active Learning Styles
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(profile.learningStyles && profile.learningStyles.length > 0
                    ? profile.learningStyles
                    : ["step-by-step", "examples"]
                  ).map((style) => (
                    <span
                      key={style}
                      className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-200 capitalize"
                    >
                      {style}
                    </span>
                  ))}
                </div>
              </div>

              {/* Progress & Focus Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3 text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Total XP</p>
                  <p className="mt-1 text-lg font-black text-amber-300 tabular-nums">{progressSummary.xp} XP</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3 text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Active Notes</p>
                  <p className="mt-1 text-lg font-black text-violet-300 tabular-nums">{noteCount}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3 text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Flashcards Due</p>
                  <p className="mt-1 text-lg font-black text-cyan-300 tabular-nums">{dueCardsCount}</p>
                </div>
              </div>

              {/* Dynamic Learning Route */}
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3.5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5">Learning Route Progress</p>
                <ol className="space-y-2 text-xs">
                  <RouteStep
                    icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                    title="Cognitive Calibration"
                    detail="Profile tuned to archetype & styles"
                    ready
                  />
                  <RouteStep
                    icon={<Lightbulb className="h-3.5 w-3.5" />}
                    title="Guided Tutor"
                    detail={turns.length > 0 ? `${turns.length} message turns in session` : "Ready for questions"}
                    ready={turns.length > 0}
                  />
                  <RouteStep
                    icon={<BookOpen className="h-3.5 w-3.5" />}
                    title="Knowledge Notes"
                    detail={noteCount > 0 ? `${noteCount} note${noteCount !== 1 ? "s" : ""} loaded for RAG` : "Upload notes"}
                    ready={noteCount > 0}
                  />
                </ol>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-between border-t border-white/10">
                <Link
                  href="/ednova/analytics"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
                >
                  View Learning Analytics <ChevronRight className="h-3.5 w-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileModalOpen(false);
                    if (typeof window !== "undefined") {
                      window.localStorage.removeItem("ednova_profile_v1");
                      window.location.reload();
                    }
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:text-rose-300 hover:border-rose-400/30 transition cursor-pointer"
                >
                  Retake Diagnostic
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ⚡ Loading Mini-Quiz Gamification Modal */}
      <LoadingQuizModal
        isOpen={isLoadingQuizOpen}
        onClose={() => setIsLoadingQuizOpen(false)}
        isTutorReady={isTutorReady}
        onRevealTutor={() => {
          setIsLoadingQuizOpen(false);
          // Scroll to the bottom of the conversation stream
          setTimeout(() => {
            window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
          }, 100);
        }}
        favoriteSubjects={profile.subjects ?? ["Mathematics", "Biology", "Physics", "Computer Science"]}
        contextPrompt={turns[turns.length - 1]?.question ?? ""}
      />

      {/* 🪙 Token Treasury Top-Up Modal */}
      <TokenTopUpModal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        currentTokens={userTokens}
        onTokensUpdated={(newBal) => setUserTokens(newBal)}
      />
    </main>
  );
}

function Progress({
  stage,
  compact = false,
  inferenceMode = "thinking",
}: {
  stage: "idle" | "understanding" | "notes" | "writing";
  compact?: boolean;
  inferenceMode?: "fast" | "thinking";
}) {
  const labels = [
    {
      id: "understanding",
      label:
        inferenceMode === "fast"
          ? "Fast intent classification & hint check"
          : "Deep understanding & thinking through misconceptions",
    },
    { id: "notes", label: "Searching learning notes & syllabus grounding" },
    {
      id: "writing",
      label:
        inferenceMode === "fast"
          ? "Generating rapid Socratic guidance (qwen2.5-3b)"
          : "Formulating multi-step pedagogical reasoning (llama3.1-8b)",
    },
  ] as const;
  const stageIndex = labels.findIndex((item) => item.id === stage);
  return (
    <div className={`max-w-[92%] rounded-2xl border border-cyan-300/10 bg-cyan-400/5 ${compact ? "p-3" : "p-4"}`} aria-live="polite">
      <div className="space-y-2">
        {labels.map((item, index) => (
          <p
            key={item.id}
            className={`flex items-center gap-2 text-xs ${index <= stageIndex ? "text-cyan-100 font-medium" : "text-slate-500"}`}
          >
            <LoaderCircle className={`h-3.5 w-3.5 ${index === stageIndex ? "animate-spin text-cyan-300" : ""}`} />
            {item.label}
          </p>
        ))}
      </div>
    </div>
  );
}

function Failure({ message }: { message: string }) {
  return (
    <div role="alert" className="max-w-[92%] rounded-2xl border border-rose-300/15 bg-rose-400/5 p-4 text-sm text-rose-100">
      <p className="flex items-center gap-2 font-semibold">
        <AlertCircle className="h-4 w-4" />
        {message}
      </p>
    </div>
  );
}

function RouteStep({ icon, title, detail, ready = false }: { icon: React.ReactNode; title: string; detail: string; ready?: boolean }) {
  return (
    <li className="flex gap-3">
      <span
        className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${ready ? "bg-cyan-400/15 text-cyan-200" : "bg-white/5 text-slate-500"
          }`}
      >
        {icon}
      </span>
      <span>
        <span className="block font-semibold text-slate-100">{title}</span>
        <span className="block text-xs leading-5 text-slate-400">{detail}</span>
      </span>
    </li>
  );
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}
