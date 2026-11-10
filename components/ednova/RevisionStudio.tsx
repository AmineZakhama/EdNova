"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Cpu,
  Download,
  Dna,
  FileText,
  Flame,
  HelpCircle,
  Layers,
  Lightbulb,
  LoaderCircle,
  Play,
  RotateCcw,
  Search,
  Sigma,
  Sparkles,
  Square,
  SquareCheck,
  TestTube,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { jsPDF } from "jspdf";

import { loadKnowledgeNotes } from "@/lib/ednova/knowledge-storage";
import { loadLearnerProfile } from "@/lib/ednova/profile-storage";
import { completeStudySession, loadLearningProgress } from "@/lib/ednova/progress-storage";
import { createDeckFromRevision } from "@/lib/ednova/spaced-repetition";
import type { KnowledgeNote } from "@/lib/ednova/types";
import UserMenu from "@/components/ednova/UserMenu";
import FlashcardModal from "@/components/ednova/FlashcardModal";

export type RevisionQuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type RevisionNotes = {
  title: string;
  summary: string;
  keyPoints: string[];
  formulas: string[];
  commonMistakes: string[];
  flashcards: Array<{
    front: string;
    back: string;
    options?: string[];
    correctOptionIndex?: number;
  }>;
  quiz?: RevisionQuizQuestion[];
};

type SubjectCategory = "all" | "biology" | "physics" | "math" | "cs" | "chemistry" | "notes";

type TopicPreset = {
  title: string;
  subject: "biology" | "physics" | "math" | "cs" | "chemistry";
  description: string;
  badge: string;
};

const TOPIC_PRESETS: TopicPreset[] = [
  // Biology
  {
    title: "Cellular Respiration & ATP Synthesis",
    subject: "biology",
    description: "Glycolysis, Krebs cycle, and electron transport chain phosphorylation.",
    badge: "High Yield",
  },
  {
    title: "Mitosis vs. Meiosis & Chromosomal Segregation",
    subject: "biology",
    description: "PMAT phases, diploid vs haploid, crossing over, and nondisjunction.",
    badge: "Exam Core",
  },
  {
    title: "DNA Replication & CRISPR Gene Editing",
    subject: "biology",
    description: "Helicase, leading/lagging strand synthesis, and Cas9 double-strand breaks.",
    badge: "Molecular",
  },
  {
    title: "Enzyme Kinetics & Michaelis-Menten Model",
    subject: "biology",
    description: "Km, Vmax, competitive vs non-competitive inhibition curves.",
    badge: "Biochem",
  },

  // Physics
  {
    title: "Maxwell's Equations & Electromagnetic Waves",
    subject: "physics",
    description: "Gauss's laws, Faraday induction, and Ampère-Maxwell displacement current.",
    badge: "Core Theory",
  },
  {
    title: "Wave-Particle Duality & Quantum Superposition",
    subject: "physics",
    description: "De Broglie wavelength, photoelectric effect, and Heisenberg uncertainty.",
    badge: "Modern Physics",
  },
  {
    title: "Thermodynamics & Carnot Cycle Efficiency",
    subject: "physics",
    description: "Entropy generation, isothermal vs adiabatic work, and the 2nd law.",
    badge: "High Yield",
  },
  {
    title: "Special Relativity & Lorentz Transformations",
    subject: "physics",
    description: "Time dilation, length contraction, and relativistic invariant mass.",
    badge: "Conceptual",
  },

  // Math
  {
    title: "Taylor Series Expansions & Convergence Tests",
    subject: "math",
    description: "Maclaurin series, radius of convergence, and ratio/comparison tests.",
    badge: "Calculus II",
  },
  {
    title: "Linear Algebra: Eigenvalues & Diagonalization",
    subject: "math",
    description: "Characteristic polynomials, eigenspaces, and matrix transformations.",
    badge: "Linear Algebra",
  },
  {
    title: "Bayes' Theorem & Conditional Probability Trees",
    subject: "math",
    description: "Prior, likelihood, posterior updates, and false-positive paradox.",
    badge: "Stats",
  },
  {
    title: "Ordinary Differential Equations: Separation of Variables",
    subject: "math",
    description: "First-order homogeneous models, integrating factors, and Euler's method.",
    badge: "Applied Math",
  },

  // Computer Science
  {
    title: "Algorithm Complexity: Big-O, Big-Omega & Asymptotics",
    subject: "cs",
    description: "Time/space trade-offs, recurrence relations, and Master Theorem.",
    badge: "Algorithms",
  },
  {
    title: "Dynamic Programming & Optimal Substructure",
    subject: "cs",
    description: "Top-down memoization, bottom-up tabulation, and knapsack variants.",
    badge: "Tech Interview",
  },
  {
    title: "Graph Traversal: BFS, DFS & Dijkstra Shortest Path",
    subject: "cs",
    description: "Priority queues, cycle detection, topological sort, and heuristics.",
    badge: "Data Structures",
  },
  {
    title: "Transformer Architecture & Self-Attention Mechanisms",
    subject: "cs",
    description: "Query-Key-Value dot products, multi-head attention, and positional encodings.",
    badge: "AI / ML",
  },

  // Chemistry
  {
    title: "Chemical Equilibrium & Le Chatelier's Principle",
    subject: "chemistry",
    description: "Equilibrium constant Kc vs Q, pressure/temperature shifts, and catalysts.",
    badge: "Physical Chem",
  },
  {
    title: "Acid-Base Equilibria & Henderson-Hasselbalch Buffers",
    subject: "chemistry",
    description: "pH calculations, conjugate pairs, and titration equivalence points.",
    badge: "High Yield",
  },
  {
    title: "Organic Reaction Mechanisms: SN1 vs SN2",
    subject: "chemistry",
    description: "Nucleophilic substitutions, carbocation stability, and steric hindrance.",
    badge: "Organic",
  },
];

export default function RevisionStudio() {
  const [topic, setTopic] = useState("Photosynthesis and respiration");
  const [activeCategory, setActiveCategory] = useState<SubjectCategory>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [revisionDepth, setRevisionDepth] = useState<"comprehensive" | "cram" | "active_recall">("comprehensive");

  const [notes, setNotes] = useState<RevisionNotes | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [savedToDeck, setSavedToDeck] = useState(false);
  const [copied, setCopied] = useState(false);

  // Active view tab inside generated revision pack
  const [activeTab, setActiveTab] = useState<"overview" | "keypoints" | "formulas" | "mistakes" | "flashcards" | "selftest">("overview");

  // Checklist for understood concepts
  const [understoodPoints, setUnderstoodPoints] = useState<Set<number>>(new Set());

  // Interactive flashcards state
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredCards, setMasteredCards] = useState<Set<number>>(new Set());
  const [onPageOption, setOnPageOption] = useState<number | null>(null);

  // Flashcards extension modal
  const [isFlashcardModalOpen, setIsFlashcardModalOpen] = useState(false);

  // Mini self-test quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizXpAwarded, setQuizXpAwarded] = useState(false);

  // Speech synthesis audio state
  const [isSpeaking, setIsSpeaking] = useState(false);

  // RAG notes from client storage
  const [knowledgeNotes, setKnowledgeNotes] = useState<KnowledgeNote[]>([]);

  useEffect(() => {
    setKnowledgeNotes(loadKnowledgeNotes());
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("openFlashcards") === "true") {
        setIsFlashcardModalOpen(true);
      }
    }
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Filtered preset topics
  const filteredPresets = useMemo(() => {
    return TOPIC_PRESETS.filter((p) => {
      const matchesCategory = activeCategory === "all" || p.subject === activeCategory;
      const matchesSearch =
        !searchFilter.trim() ||
        p.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.description.toLowerCase().includes(searchFilter.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchFilter]);

  async function generate(overrideTopic?: string) {
    const selectedTopic = (overrideTopic ?? topic).trim();
    if (!selectedTopic) return;
    setBusy(true);
    setMessage("Generating high-yield revision pack with multi-step pedagogy…");
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    try {
      const response = await fetch("/api/ednova/revision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: selectedTopic,
          depth: revisionDepth,
          profile: loadLearnerProfile(),
          notes: loadKnowledgeNotes(),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.notes) {
        throw new Error(data.error ?? "Could not make revision notes.");
      }

      setNotes(data.notes);
      setSources(data.sources ?? []);
      setSavedToDeck(false);
      setUnderstoodPoints(new Set());
      setCurrentCardIndex(0);
      setIsFlipped(false);
      setMasteredCards(new Set());
      setQuizAnswers({});
      setQuizSubmitted(false);
      setQuizXpAwarded(false);
      setActiveTab("overview");
      setMessage(data.notice ?? "Revision pack ready! Review key points, flip flashcards, and test yourself below.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not make revision notes.");
    } finally {
      setBusy(false);
    }
  }

  function toggleSpeech() {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !notes) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const textToRead = `${notes.title}. Summary: ${notes.summary}. Key Points: ${notes.keyPoints.slice(0, 4).join(". ")}.`;
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }

  function handleSelectPreset(preset: TopicPreset) {
    setTopic(preset.title);
    void generate(preset.title);
  }

  function handleSelectNote(note: KnowledgeNote) {
    setTopic(note.title);
    void generate(note.title);
  }

  function toggleUnderstood(index: number) {
    setUnderstoodPoints((prev) => {
      const updated = new Set(prev);
      if (updated.has(index)) updated.delete(index);
      else updated.add(index);
      return updated;
    });
  }

  function handleFlashcardAnswer(mastered: boolean) {
    if (!notes) return;
    setMasteredCards((prev) => {
      const updated = new Set(prev);
      if (mastered) updated.add(currentCardIndex);
      else updated.delete(currentCardIndex);
      return updated;
    });

    if (currentCardIndex < notes.flashcards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentCardIndex((curr) => curr + 1), 200);
    }
  }

  function handleSelectQuizOption(qIndex: number, optIndex: number) {
    if (quizSubmitted) return;
    setQuizAnswers((prev) => ({ ...prev, [qIndex]: optIndex }));
  }

  function handleFinishQuiz() {
    if (!notes?.quiz) return;
    setQuizSubmitted(true);

    let correct = 0;
    notes.quiz.forEach((q, idx) => {
      if (quizAnswers[idx] === q.correctIndex) correct++;
    });

    if (!quizXpAwarded) {
      completeStudySession({
        kind: "custom",
        plannedMinutes: 10,
        subject: topic,
      });
      setQuizXpAwarded(true);
      setMessage(`Quiz completed! ${correct}/${notes.quiz.length} correct. +25 XP awarded to your learning profile!`);
    }
  }

  function markdown(): string {
    if (!notes) return "";
    return `# ${notes.title}\n\n${notes.summary}\n\n## Key Points\n${notes.keyPoints
      .map((p) => `- ${p}`)
      .join("\n")}\n\n## Formulas & Key Terms\n${notes.formulas
      .map((f) => `- ${f}`)
      .join("\n")}\n\n## Common Pitfalls & Mistakes\n${notes.commonMistakes
      .map((m) => `- ${m}`)
      .join("\n")}\n\n## Flashcards\n${notes.flashcards
      .map((c) => `- **Q:** ${c.front}\n  **A:** ${c.back}`)
      .join("\n")}`;
  }

  function handleCopyMarkdown() {
    navigator.clipboard.writeText(markdown());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function saveToFlashcards() {
    if (!notes || savedToDeck) return;
    createDeckFromRevision(notes.title, notes.flashcards);
    setSavedToDeck(true);
    setMessage("Flashcard deck saved to your Spaced Repetition collection! Review it anytime under Flashcards.");
  }

  function exportPdf() {
    if (!notes) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text(notes.title, 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text("EdNova Intelligent Revision Pack", 14, 26);

    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    const summaryLines = doc.splitTextToSize(notes.summary, 180);
    doc.text(summaryLines, 14, 34);

    let cursor = 38 + summaryLines.length * 5;

    function addSection(title: string, items: string[]) {
      if (!items.length) return;
      if (cursor > 260) {
        doc.addPage();
        cursor = 20;
      }
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(title, 14, cursor);
      cursor += 7;

      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      for (const item of items) {
        const lines = doc.splitTextToSize(`• ${item}`, 175);
        if (cursor + lines.length * 5 > 280) {
          doc.addPage();
          cursor = 20;
        }
        doc.text(lines, 16, cursor);
        cursor += lines.length * 5 + 2;
      }
      cursor += 4;
    }

    addSection("Key Concepts & Takeaways", notes.keyPoints);
    addSection("Formulas & Core Terminology", notes.formulas);
    addSection("Common Exam Pitfalls & Misconceptions", notes.commonMistakes);

    if (notes.flashcards.length) {
      if (cursor > 250) {
        doc.addPage();
        cursor = 20;
      }
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text("High-Yield Flashcards", 14, cursor);
      cursor += 7;

      doc.setFontSize(9);
      for (const card of notes.flashcards) {
        const qLines = doc.splitTextToSize(`Q: ${card.front}`, 175);
        const aLines = doc.splitTextToSize(`A: ${card.back}`, 175);
        if (cursor + (qLines.length + aLines.length) * 5 > 280) {
          doc.addPage();
          cursor = 20;
        }
        doc.setTextColor(79, 70, 229);
        doc.text(qLines, 16, cursor);
        cursor += qLines.length * 4.5;
        doc.setTextColor(51, 65, 85);
        doc.text(aLines, 16, cursor);
        cursor += aLines.length * 4.5 + 4;
      }
    }

    doc.save(`${safeFileName(notes.title)}.pdf`);
  }

  const currentCard = notes?.flashcards[currentCardIndex];
  const progressRatio = notes ? Math.round((understoodPoints.size / Math.max(1, notes.keyPoints.length)) * 100) : 0;

  return (
    <main className="min-h-screen bg-[#070b1b] px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Navigation & Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-300 border border-cyan-500/20">
                <Sparkles className="h-3 w-3" /> Interactive Revision Studio
              </span>
              <span className="text-xs text-slate-400">Curriculum & RAG Grounded</span>
            </div>
            <h1 className="mt-1.5 text-2xl font-black text-white sm:text-3xl">
              Turn any topic into an active revision pack.
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Select curated subjects, ground in your lecture PDFs, flip 3D flashcards, and test recall with instant self-checks.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFlashcardModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/20 cursor-pointer"
            >
              <Layers className="h-3.5 w-3.5" /> Flashcards Modal
            </button>
            <Link
              href="/ednova"
              className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/5"
            >
              Back to tutor
            </Link>
            <UserMenu />
          </div>
        </header>

        {/* Topic Chooser & Subject Explorer Section */}
        <section className="mt-6 rounded-3xl border border-white/10 bg-slate-900/60 p-5 sm:p-7 backdrop-blur-xl">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Topic to revise or search
              </label>
              <div className="relative mt-2">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void generate()}
                  placeholder="e.g., Cellular Respiration, Taylor Series, Transformer Attention..."
                  maxLength={180}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-400 focus:bg-white/[0.07] transition-all"
                />
              </div>
            </div>

            {/* Revision Depth Selector */}
            <div className="shrink-0">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Revision Depth
              </label>
              <div className="flex items-center rounded-xl border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setRevisionDepth("comprehensive")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    revisionDepth === "comprehensive"
                      ? "bg-cyan-400 text-slate-950 font-bold shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Balanced
                </button>
                <button
                  type="button"
                  onClick={() => setRevisionDepth("cram")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                    revisionDepth === "cram"
                      ? "bg-amber-400 text-slate-950 font-bold shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Flame className="h-3 w-3" /> Exam Cram
                </button>
                <button
                  type="button"
                  onClick={() => setRevisionDepth("active_recall")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                    revisionDepth === "active_recall"
                      ? "bg-purple-400 text-slate-950 font-bold shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Zap className="h-3 w-3" /> Active Recall
                </button>
              </div>
            </div>

            <div className="self-end md:self-auto">
              <button
                type="button"
                onClick={() => void generate()}
                disabled={busy || !topic.trim()}
                className="w-full md:w-auto mt-2 md:mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-indigo-400 to-violet-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 shadow-lg shadow-cyan-500/20 cursor-pointer"
              >
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {busy ? "Synthesizing Pack..." : "Generate Pack"}
              </button>
            </div>
          </div>

          {/* Subject Categories Explorer Tabs */}
          <div className="mt-6 border-t border-white/5 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Explore Curated Disciplines & Attached Notes:
              </p>
              <div className="relative w-48 hidden sm:block">
                <input
                  type="text"
                  placeholder="Filter subjects..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white placeholder:text-slate-500 outline-none"
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  activeCategory === "all"
                    ? "bg-white/20 text-white font-bold"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                }`}
              >
                All Topics ({TOPIC_PRESETS.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("biology")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  activeCategory === "biology"
                    ? "bg-emerald-400/20 text-emerald-200 border border-emerald-400/30"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                }`}
              >
                <Dna className="h-3 w-3 text-emerald-400" /> Biology
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("physics")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  activeCategory === "physics"
                    ? "bg-cyan-400/20 text-cyan-200 border border-cyan-400/30"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                }`}
              >
                <Zap className="h-3 w-3 text-cyan-400" /> Physics
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("math")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  activeCategory === "math"
                    ? "bg-amber-400/20 text-amber-200 border border-amber-400/30"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                }`}
              >
                <Sigma className="h-3 w-3 text-amber-400" /> Calculus & Math
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("cs")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  activeCategory === "cs"
                    ? "bg-indigo-400/20 text-indigo-200 border border-indigo-400/30"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                }`}
              >
                <Cpu className="h-3 w-3 text-indigo-400" /> Computer Science
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("chemistry")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  activeCategory === "chemistry"
                    ? "bg-rose-400/20 text-rose-200 border border-rose-400/30"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                }`}
              >
                <TestTube className="h-3 w-3 text-rose-400" /> Chemistry
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("notes")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  activeCategory === "notes"
                    ? "bg-purple-400/20 text-purple-200 border border-purple-400/30"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                }`}
              >
                <BookOpen className="h-3 w-3 text-purple-400" /> My Course Documents ({knowledgeNotes.length})
              </button>
            </div>

            {/* Presets Grid */}
            {activeCategory !== "notes" ? (
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 max-h-56 overflow-y-auto pr-1">
                {filteredPresets.map((preset) => (
                  <button
                    key={preset.title}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className="group flex flex-col text-left rounded-2xl border border-white/5 bg-white/[0.03] p-3 transition hover:border-cyan-400/40 hover:bg-white/[0.06] active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 transition truncate">
                        {preset.title}
                      </span>
                      <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-400 border border-white/5">
                        {preset.badge}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {preset.description}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              /* Attached RAG Notes List */
              <div className="mt-4">
                {knowledgeNotes.length > 0 ? (
                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {knowledgeNotes.map((note) => (
                      <button
                        key={note.id}
                        type="button"
                        onClick={() => handleSelectNote(note)}
                        className="group flex items-start gap-3 rounded-2xl border border-purple-400/20 bg-purple-500/5 p-3 text-left transition hover:border-purple-400/50 hover:bg-purple-500/10 active:scale-[0.98]"
                      >
                        <FileText className="h-5 w-5 shrink-0 text-purple-400 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-200 group-hover:text-purple-300 truncate">
                            {note.title}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {note.sample ? "Sample course note" : "Custom uploaded note"} · Click to generate pack
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center">
                    <p className="text-xs text-slate-400">No attached course documents found in context.</p>
                    <Link
                      href="/ednova"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:underline"
                    >
                      Attach course PDFs in Tutor Workspace <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {message ? (
            <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3.5 py-2 text-xs text-cyan-100 flex items-center justify-between gap-2">
              <span>{message}</span>
              {busy && <LoaderCircle className="h-3.5 w-3.5 animate-spin shrink-0" />}
            </div>
          ) : null}
        </section>

        {/* Generated Interactive Revision Pack Section */}
        {notes ? (
          <section className="mt-6 rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-7 shadow-2xl backdrop-blur-xl">
            {/* Pack Header & Top Toolbar */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-[11px] font-bold text-indigo-300 border border-indigo-500/30">
                    Active Study Pack
                  </span>
                  {sources.length ? (
                    <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300 border border-emerald-500/20">
                      RAG Grounded in: {sources.join(", ")}
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-1 text-xl sm:text-2xl font-black text-white">{notes.title}</h2>
                <p className="mt-1 text-xs text-slate-300 max-w-2xl leading-relaxed">{notes.summary}</p>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSpeech}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    isSpeaking
                      ? "border-cyan-400 bg-cyan-400/20 text-cyan-200 animate-pulse"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                  title="Listen to summary audio"
                >
                  {isSpeaking ? <VolumeX className="h-3.5 w-3.5 text-cyan-400" /> : <Volume2 className="h-3.5 w-3.5" />}
                  {isSpeaking ? "Stop Audio" : "Listen (TTS)"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsFlashcardModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/30 bg-violet-500/20 px-3 py-2 text-xs font-bold text-violet-100 hover:bg-violet-500/30 transition cursor-pointer"
                  title="Open interactive multi-choice flashcards modal"
                >
                  <Sparkles className="h-3.5 w-3.5 text-violet-300" /> Study in Modal
                </button>
                <button
                  type="button"
                  onClick={saveToFlashcards}
                  disabled={savedToDeck}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/30 bg-violet-500/15 px-3 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-500/25 disabled:opacity-60 transition"
                >
                  <Layers className="h-3.5 w-3.5" />
                  {savedToDeck ? "Saved to Decks ✓" : "Save to Flashcards"}
                </button>
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
                  title="Copy formatted Markdown"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied!" : "Markdown"}
                </button>
                <button
                  type="button"
                  onClick={exportPdf}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
                  title="Download printable PDF cheat-sheet"
                >
                  <Download className="h-3.5 w-3.5" /> PDF
                </button>
              </div>
            </div>

            {/* Mastery Progress Bar */}
            <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                {understoodPoints.size} of {notes.keyPoints.length} core concepts marked understood
              </span>
              <span className="font-bold text-cyan-300">{progressRatio}% Mastered</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500 transition-all duration-300"
                style={{ width: `${progressRatio}%` }}
              />
            </div>

            {/* Interactive Section Tabs */}
            <div className="mt-6 flex flex-wrap gap-2 border-b border-white/10 pb-3">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  activeTab === "overview"
                    ? "bg-cyan-400 text-slate-950 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Key Takeaways ({notes.keyPoints.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("formulas")}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  activeTab === "formulas"
                    ? "bg-cyan-400 text-slate-950 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Formulas & Terminology ({notes.formulas.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("mistakes")}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  activeTab === "mistakes"
                    ? "bg-cyan-400 text-slate-950 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Pitfalls & Traps ({notes.commonMistakes.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("flashcards")}
                className={`inline-flex items-center gap-1 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  activeTab === "flashcards"
                    ? "bg-violet-400 text-slate-950 shadow"
                    : "text-violet-300 hover:text-white"
                }`}
              >
                <Layers className="h-3 w-3" /> 3D Flashcards ({notes.flashcards.length})
              </button>
              {notes.quiz && notes.quiz.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("selftest")}
                  className={`inline-flex items-center gap-1 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                    activeTab === "selftest"
                      ? "bg-amber-400 text-slate-950 shadow"
                      : "text-amber-300 hover:text-white"
                  }`}
                >
                  <Zap className="h-3 w-3" /> Quick Self-Test ({notes.quiz.length})
                </button>
              )}
            </div>

            {/* TAB CONTENT */}

            {/* 1. Overview & Key Points (Interactive Checklist) */}
            {activeTab === "overview" && (
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>Click checkboxes to track your comprehension:</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (understoodPoints.size === notes.keyPoints.length) setUnderstoodPoints(new Set());
                      else setUnderstoodPoints(new Set(notes.keyPoints.map((_, i) => i)));
                    }}
                    className="text-cyan-400 hover:underline"
                  >
                    {understoodPoints.size === notes.keyPoints.length ? "Clear all" : "Mark all understood"}
                  </button>
                </div>

                {notes.keyPoints.map((point, index) => {
                  const isChecked = understoodPoints.has(index);
                  return (
                    <div
                      key={index}
                      onClick={() => toggleUnderstood(index)}
                      className={`group flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition ${
                        isChecked
                          ? "border-emerald-500/30 bg-emerald-500/5 text-slate-200"
                          : "border-white/5 bg-white/[0.02] text-slate-300 hover:border-white/10 hover:bg-white/[0.04]"
                      }`}
                    >
                      <button
                        type="button"
                        aria-label="Toggle point"
                        className="mt-0.5 shrink-0 text-slate-400 group-hover:text-cyan-300 transition"
                      >
                        {isChecked ? (
                          <SquareCheck className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                      <span className={`text-sm leading-relaxed ${isChecked ? "line-through text-slate-400" : ""}`}>
                        {point}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. Formulas & Terms */}
            {activeTab === "formulas" && (
              <div className="mt-5 space-y-3">
                {notes.formulas.length ? (
                  notes.formulas.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-950/20 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <Sigma className="h-5 w-5 shrink-0 text-cyan-300 mt-0.5" />
                        <div>
                          <p className="font-mono text-sm font-semibold text-cyan-100">{item}</p>
                          <p className="mt-1 text-xs text-slate-400">Core formula notation & application rule</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(item)}
                        className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 hover:text-white transition"
                        title="Copy formula"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-6 text-center">No explicit formulas for this conceptual topic.</p>
                )}
              </div>
            )}

            {/* 3. Pitfalls & Mistakes */}
            {activeTab === "mistakes" && (
              <div className="mt-5 space-y-3">
                {notes.commonMistakes.length ? (
                  notes.commonMistakes.map((mistake, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-950/20 p-4 text-amber-100"
                    >
                      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                          Exam Trap #{index + 1}
                        </span>
                        <p className="mt-1 text-sm leading-relaxed text-slate-200">{mistake}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-6 text-center">No major traps recorded for this topic.</p>
                )}
              </div>
            )}

            {/* 4. 3D Flashcard Flip Carousel with Multiple Choice Options */}
            {activeTab === "flashcards" && currentCard && (() => {
              const onPageCardOptions: string[] =
                currentCard?.options && currentCard.options.length >= 2
                  ? currentCard.options
                  : [
                      currentCard.back.length > 70 ? currentCard.back.slice(0, 67) + "..." : currentCard.back,
                      "Inverts the biological gradient or decreases reaction efficiency",
                      "Only occurs under strict anaerobic starvation conditions",
                      "Acts as an uncompetitive inhibitor preventing synthesis",
                    ];
              const onPageCorrectIndex: number =
                typeof currentCard?.correctOptionIndex === "number" &&
                currentCard.correctOptionIndex >= 0 &&
                currentCard.correctOptionIndex < onPageCardOptions.length
                  ? currentCard.correctOptionIndex
                  : 0;

              return (
                <div className="mt-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2 mb-2">
                    <span className="font-semibold text-slate-300">
                      Card {currentCardIndex + 1} of {notes.flashcards.length}
                      {masteredCards.has(currentCardIndex) && (
                        <span className="ml-2 text-emerald-400 font-bold">✓ Mastered</span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsFlashcardModalOpen(true)}
                        className="inline-flex items-center gap-1 rounded-lg border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-200 hover:bg-violet-500/20 transition cursor-pointer"
                      >
                        <Layers className="h-3 w-3" /> Open in Flashcards Modal
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsFlipped(!isFlipped)}
                        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition cursor-pointer"
                      >
                        <RotateCcw className="h-3 w-3" /> {isFlipped ? "Show Question" : "Flip to Answer"}
                      </button>
                    </div>
                  </div>

                  {/* 3D Flip Card Container */}
                  <div className="group relative rounded-3xl border border-violet-400/30 bg-gradient-to-br from-violet-950/40 via-slate-900/60 to-purple-950/40 p-5 sm:p-6 shadow-xl transition-all">
                    {!isFlipped ? (
                      /* FRONT: Question Prompt & 4 Multiple-Choice Options */
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-violet-400/10 px-3 py-1 text-xs font-bold text-violet-300 border border-violet-400/20 uppercase tracking-widest">
                            Question & Choices
                          </span>
                          <span className="text-xs text-slate-400">Select your answer:</span>
                        </div>

                        <p className="text-base sm:text-lg font-bold text-white leading-relaxed">
                          {currentCard.front}
                        </p>

                        <div className="grid gap-2 pt-1">
                          {onPageCardOptions.map((opt, optIdx) => {
                            const isChosen = onPageOption === optIdx;
                            const isCorrect = optIdx === onPageCorrectIndex;
                            let optStyle =
                              "border-white/10 bg-white/[0.03] text-slate-200 hover:border-violet-400/40 hover:bg-white/[0.06]";

                            if (onPageOption !== null) {
                              if (isCorrect) {
                                optStyle =
                                  "border-emerald-400/60 bg-emerald-500/20 text-emerald-100 font-bold shadow-sm";
                              } else if (isChosen && !isCorrect) {
                                optStyle =
                                  "border-rose-400/60 bg-rose-500/20 text-rose-200 line-through";
                              } else {
                                optStyle = "opacity-40 border-white/5 bg-white/[0.01] text-slate-400";
                              }
                            }

                            return (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() => {
                                  if (onPageOption !== null) return;
                                  setOnPageOption(optIdx);
                                  if (isCorrect) {
                                    setMasteredCards((prev) => new Set(prev).add(currentCardIndex));
                                  }
                                }}
                                disabled={onPageOption !== null}
                                className={`flex items-start gap-2.5 rounded-xl border p-3 text-left text-xs sm:text-sm transition-all cursor-pointer ${optStyle}`}
                              >
                                <span className="font-bold shrink-0">{["A", "B", "C", "D"][optIdx]}.</span>
                                <span className="pt-0.5 leading-relaxed">{opt}</span>
                              </button>
                            );
                          })}
                        </div>

                        {onPageOption !== null && (
                          <div className="flex items-center justify-between rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                            <span>
                              {onPageOption === onPageCorrectIndex
                                ? "✓ Correct answer!"
                                : "✕ Incorrect. The correct choice is highlighted above."}
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsFlipped(true)}
                              className="font-bold underline hover:text-white"
                            >
                              Read Full Explanation →
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* BACK: Conceptual Explanation */
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-300 border border-cyan-400/20 uppercase tracking-widest">
                            Explanation & Notes
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsFlipped(false)}
                            className="text-xs text-cyan-300 underline"
                          >
                            Back to Question
                          </button>
                        </div>
                        <p className="text-sm text-slate-300">
                          <span className="font-bold text-white">Q:</span> {currentCard.front}
                        </p>
                        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                          <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                            Answer:
                          </span>
                          <p className="mt-1 text-sm sm:text-base font-semibold text-white leading-relaxed">
                            {currentCard.back}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Flashcard Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={currentCardIndex === 0}
                        onClick={() => {
                          setIsFlipped(false);
                          setOnPageOption(null);
                          setCurrentCardIndex((c) => Math.max(0, c - 1));
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-40 transition"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> Previous
                      </button>
                      <button
                        type="button"
                        disabled={currentCardIndex === notes.flashcards.length - 1}
                        onClick={() => {
                          setIsFlipped(false);
                          setOnPageOption(null);
                          setCurrentCardIndex((c) => Math.min(notes.flashcards.length - 1, c + 1));
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-40 transition"
                      >
                        Next <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleFlashcardAnswer(false);
                          setOnPageOption(null);
                        }}
                        className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-400/20 transition"
                      >
                        Review Later
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleFlashcardAnswer(true);
                          setOnPageOption(null);
                        }}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-300 transition shadow-lg shadow-emerald-500/20"
                      >
                        <Check className="h-3.5 w-3.5" /> Mastered
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 5. Quick Self-Test Quiz (Active Recall) */}
            {activeTab === "selftest" && notes.quiz && notes.quiz.length > 0 && (
              <div className="mt-5 space-y-6">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Answer all questions to check your active retention:</span>
                  {quizXpAwarded && <span className="font-bold text-amber-300">+25 XP Awarded!</span>}
                </div>

                {notes.quiz.map((q, qIndex) => {
                  const selected = quizAnswers[qIndex];
                  return (
                    <div
                      key={qIndex}
                      className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3"
                    >
                      <p className="text-sm font-bold text-white">
                        <span className="text-cyan-400 mr-2">Q{qIndex + 1}.</span>
                        {q.question}
                      </p>

                      <div className="grid gap-2">
                        {q.options.map((opt, optIndex) => {
                          const isSelected = selected === optIndex;
                          const isCorrect = optIndex === q.correctIndex;

                          let btnStyle = "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10";
                          if (quizSubmitted) {
                            if (isCorrect) {
                              btnStyle = "border-emerald-400/40 bg-emerald-500/20 text-emerald-200 font-bold";
                            } else if (isSelected && !isCorrect) {
                              btnStyle = "border-rose-400/40 bg-rose-500/20 text-rose-200 line-through";
                            }
                          } else if (isSelected) {
                            btnStyle = "border-cyan-400/40 bg-cyan-400/20 text-cyan-100 font-semibold";
                          }

                          return (
                            <button
                              key={optIndex}
                              type="button"
                              onClick={() => handleSelectQuizOption(qIndex, optIndex)}
                              disabled={quizSubmitted}
                              className={`flex items-center justify-between rounded-xl border p-3 text-left text-xs transition ${btnStyle}`}
                            >
                              <span>{opt}</span>
                              {quizSubmitted && isCorrect && <Check className="h-4 w-4 text-emerald-400" />}
                            </button>
                          );
                        })}
                      </div>

                      {quizSubmitted && (
                        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-xs text-slate-300 leading-relaxed">
                          <span className="font-bold text-cyan-300">Explanation: </span>
                          {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}

                {!quizSubmitted ? (
                  <button
                    type="button"
                    onClick={handleFinishQuiz}
                    disabled={Object.keys(quizAnswers).length < notes.quiz.length}
                    className="w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 text-xs font-black text-slate-950 transition hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    Submit Self-Check & Claim +25 XP
                  </button>
                ) : (
                  <div className="flex items-center justify-between rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-xs text-emerald-200">
                    <span>Self-test completed! Review the explanations above to solidify any weak spots.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setQuizSubmitted(false);
                        setQuizAnswers({});
                      }}
                      className="font-bold underline hover:text-white"
                    >
                      Retry Quiz
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        ) : null}
        {/* Flashcards Extension Modal with Multiple Choice Active Recall */}
        <FlashcardModal
          isOpen={isFlashcardModalOpen}
          onClose={() => setIsFlashcardModalOpen(false)}
          activePackCards={notes?.flashcards}
          topicTitle={notes?.title}
        />
      </div>
    </main>
  );
}

function safeFileName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "ednova-revision";
}
