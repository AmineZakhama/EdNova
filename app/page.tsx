"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  Gamepad2,
  GraduationCap,
  HelpCircle,
  Languages,
  Layers,
  Lock,
  LogIn,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Volume2,
  Zap,
} from "lucide-react";

import type { SafeUser } from "@/lib/ednova/auth";

const SAMPLE_INTERACTIONS = [
  {
    topic: "Calculus",
    question: "How do I start factoring: x² - 5x + 6 = 0?",
    hintLevel: "Tier 1: Mental Math Scaffolding",
    response:
      "Let's look at the signs! We need two numbers that multiply to +6 and add up to -5.\n\nSince the product is positive and the sum is negative, what does that tell you about the signs of both numbers?",
    takeaway: "Guides student to deduce (-2) and (-3) without giving the final factorized form directly.",
  },
  {
    topic: "Biology",
    question: "Why is a negative times a negative positive?",
    hintLevel: "Tier 1: Physical Analogy",
    response:
      "Think of walking: Facing forward is (+), turning 180° is (-). Walking forward is (+), walking backward is (-).\n\nIf you face the opposite direction (-) and walk backward (-), in which direction is your body physically moving?",
    takeaway: "Builds physical spatial intuition rather than demanding rote memorization.",
  },
  {
    topic: "Physics",
    question: "If net force is doubled and mass is quadrupled, what happens to acceleration?",
    hintLevel: "Tier 1: Ratio Inspection",
    response:
      "Recall Newton's Second Law: a = F / m.\n\nSubstitute the multipliers: (2F) / (4m). Simplify the fraction 2/4. What factor multiplies the original acceleration?",
    takeaway: "Reinforces mathematical scaling laws while holding the student accountable for calculation.",
  },
];

export default function HomePage() {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [activeSampleIndex, setActiveSampleIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    fetch("/api/ednova/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (mounted && data.authenticated && data.user) {
          setUser(data.user);
        }
      })
      .catch(() => { })
      .finally(() => {
        if (mounted) setLoadingUser(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const activeSample = SAMPLE_INTERACTIONS[activeSampleIndex];

  return (
    <div className="min-h-screen bg-[#070b1b] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background radial glow accents */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-to-b from-indigo-600/15 via-cyan-500/10 to-transparent blur-3xl -z-0" />
      <div className="pointer-events-none fixed bottom-0 right-0 w-[500px] h-[500px] bg-purple-600/10 blur-3xl -z-0" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/25">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="font-black text-lg tracking-tight text-white leading-none block">
                  EdNova
                </span>
                <span className="text-[10px] text-cyan-300 font-medium">
                  AI Socratic Companion
                </span>
              </div>
            </Link>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <a href="#features" className="hover:text-cyan-300 transition">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-cyan-300 transition">
              How It Works
            </a>
          </nav>

          {/* Right Action: Auth & Direct Tutor Access */}
          <div className="flex items-center gap-2 sm:gap-3">
            {loadingUser ? (
              <div className="h-8 w-24 rounded-xl bg-white/5 animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/ednova"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-md shadow-cyan-500/20 hover:brightness-110 transition cursor-pointer"
                >
                  <span>Launch Tutor</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/ednova/profile"
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10 transition"
                  title={`Signed in as ${user.name}`}
                >
                  <span>{user.avatar || "✨"}</span>
                  <span className="max-w-[80px] truncate font-medium hidden sm:inline">
                    {user.name}
                  </span>
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/ednova/login"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  <LogIn className="h-3.5 w-3.5 text-indigo-400" /> Sign In
                </Link>
                <Link
                  href="/ednova/register"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-md shadow-cyan-500/20 hover:brightness-110 transition"
                >
                  <span>Get Started Free</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pt-14 pb-20 sm:px-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-semibold text-cyan-200 mb-6">
          <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
          <span>Next-Generation Socratic AI · Dedicated 100% to Students</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white mb-6 leading-tight max-w-4xl mx-auto">
          Master Any Subject with an AI That{" "}
          <span className="bg-gradient-to-r from-cyan-300 via-indigo-300 to-violet-400 bg-clip-text text-transparent">
            Guides, Never Spoon-Feeds.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 leading-relaxed mb-8 max-w-2xl mx-auto">
          Say goodbye to mindless homework copy-pasting. EdNova provides progressive Socratic hints, 3D SuperMemo flashcards, procedural audio focus timers, and lightning gamified quizzes — grounded directly in your course notes.
        </p>

        {/* Hero CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-14">
          <Link
            href="/ednova"
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-indigo-500 to-violet-600 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-xl shadow-cyan-500/25 transition hover:brightness-110 cursor-pointer"
          >
            <Brain className="h-4 w-4" /> Launch Socratic Tutor
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Interactive Socratic Preview Demonstration */}
        <div className="relative mx-auto max-w-3xl rounded-3xl border border-white/15 bg-slate-900/80 p-5 sm:p-7 shadow-2xl backdrop-blur-2xl text-left">
          {/* Card Header with tabs */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                Interactive Socratic Experience
              </span>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl bg-white/5 p-1 border border-white/5 text-[11px]">
              {SAMPLE_INTERACTIONS.map((item, idx) => (
                <button
                  key={item.topic}
                  type="button"
                  onClick={() => setActiveSampleIndex(idx)}
                  className={`rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer ${activeSampleIndex === idx
                    ? "bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  {item.topic}
                </button>
              ))}
            </div>
          </div>

          {/* Student Bubble */}
          <div className="mt-5 flex items-start gap-3 justify-end">
            <div className="rounded-2xl rounded-tr-sm bg-gradient-to-br from-indigo-600 to-purple-600 px-4 py-3 text-xs sm:text-sm text-white shadow-md max-w-[85%]">
              <p className="font-semibold">{activeSample.question}</p>
            </div>
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-indigo-500/20 text-indigo-300 font-bold text-xs">
              🎓
            </div>
          </div>

          {/* Socratic Response Bubble */}
          <div className="mt-4 flex items-start gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cyan-400/20 text-cyan-300">
              <Brain className="h-4 w-4" />
            </div>
            <div className="rounded-2xl rounded-tl-sm border border-cyan-400/20 bg-slate-950/80 p-4 text-xs sm:text-sm leading-relaxed text-slate-200 shadow-md max-w-[90%]">
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                  {activeSample.hintLevel}
                </span>
                <span className="text-[10px] text-slate-400">Never spoon-feeds</span>
              </div>
              <p className="whitespace-pre-line text-slate-100">{activeSample.response}</p>
              <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center gap-2 text-[11px] text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>{activeSample.takeaway}</span>
              </div>
            </div>
          </div>

          {/* Try It Live Banner */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs">
            <span className="text-slate-300">
              🔒 <strong>Sign in</strong> to interact live with the tutor on any homework or textbook topic.
            </span>
            <Link
              href="/ednova"
              className="shrink-0 inline-flex items-center gap-1.5 font-bold text-cyan-300 hover:text-cyan-200 transition"
            >
              <span>Try Live in Tutor</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section >

      {/* Core Feature Pillars */}
      < section id="features" className="relative z-10 mx-auto max-w-6xl px-4 py-20 sm:px-8 border-t border-white/10" >
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-black uppercase tracking-wider text-cyan-400">
            Engineered for Deep Learning
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white mt-2">
            The Complete Student Powerhouse
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2">
            Every feature is designed to protect your cognitive effort and build lasting intuition.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Feature 1 */}
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-xl hover:border-cyan-400/40 transition">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-400/15 text-cyan-300 mb-4">
              <Brain className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">3-Tier Socratic AI Tutor</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Independent hint and explanation tasks guide your next steps. Real-time confusion detection immediately softens technical jargon and offers analogies.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-xl hover:border-violet-400/40 transition">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-400/15 text-violet-300 mb-4">
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">3D Flashcards & Spaced Repetition</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Integrated revision packs with interactive 4-option multiple choice answers, 3D card flipping, and SuperMemo SM-2 optimal review scheduling.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-xl hover:border-amber-400/40 transition">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-400/15 text-amber-300 mb-4">
              <Zap className="h-5 w-5 fill-current" />
            </div>
            <h3 className="text-base font-bold text-white">Gamified Quizzes & Loading Mini-Quiz</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Solo 1-question lightning sprints while EdNova generates your answer (+15 XP), plus 5-question mastery gauntlets with combo streaks and audio chimes.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-xl hover:border-rose-400/40 transition">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-400/15 text-rose-300 mb-4">
              <Clock className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Focus Study Timer & Web Audio Alarms</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Zero-dependency procedural audio synthesis: digital alarm clocks, campus school bells, marimbas, and 432 Hz mindfulness zen singing bowls.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-xl hover:border-emerald-400/40 transition">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300 mb-4">
              <BookOpen className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Smart Note Grounding (RAG)</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Upload lecture PDFs or notes. EdNova scans them using local BM25 ranking and cites exact chapters so answers are strictly grounded in your syllabus.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-xl hover:border-pink-400/40 transition">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-pink-400/15 text-pink-300 mb-4">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">AI-Mediated Peer Study Groups</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Anonymous room codes for studying with classmates. The AI mediator monitors conversation balance and flags collective misconceptions.
            </p>
          </div>
        </div>
      </section >

      {/* How It Works Walkthrough */}
      < section id="how-it-works" className="relative z-10 mx-auto max-w-6xl px-4 py-20 sm:px-8 border-t border-white/10" >
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-black uppercase tracking-wider text-violet-400">
            Simple 3-Step Flow
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white mt-2">
            How EdNova Guides You to Mastery
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          <div className="relative rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-xl">
            <span className="text-3xl font-black text-cyan-400/40 block mb-3">01</span>
            <h3 className="text-base font-bold text-white mb-2">Calibrate Your Profile</h3>
            <p className="text-xs leading-relaxed text-slate-400">
              Sign in and complete a 2-minute diagnostic puzzle to uncover your cognitive archetype (Visual, Step-by-Step, Analogies) and pick your focal subjects.
            </p>
          </div>

          <div className="relative rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-xl">
            <span className="text-3xl font-black text-indigo-400/40 block mb-3">02</span>
            <h3 className="text-base font-bold text-white mb-2">Ask, Upload & Reason</h3>
            <p className="text-xs leading-relaxed text-slate-400">
              Type or speak your questions, attach course PDFs, and receive guided Socratic hints. Solve mini-quizzes during brief inference pauses for instant XP!
            </p>
          </div>

          <div className="relative rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-xl">
            <span className="text-3xl font-black text-purple-400/40 block mb-3">03</span>
            <h3 className="text-base font-bold text-white mb-2">Retain & Track Mastery</h3>
            <p className="text-xs leading-relaxed text-slate-400">
              Review spaced repetition flashcard decks, beat your combo streaks in the quiz arena, and monitor your personal learning analytics dynamically.
            </p>
          </div>
        </div>
      </section >

      {/* Call to Action Banner */}
      < section className="relative z-10 mx-auto max-w-5xl px-4 py-16 sm:px-8" >
        <div className="rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-indigo-950/60 via-slate-900 to-cyan-950/50 p-8 sm:p-12 text-center backdrop-blur-xl shadow-2xl">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-cyan-400/20 text-cyan-300">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white mb-3">
            Ready to Build Deep, Lasting Intuition?
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto mb-8">
            Sign in with Google or create your free student account to enter your AI Socratic tutoring workspace immediately.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/ednova"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-indigo-500 to-violet-600 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 hover:brightness-110 transition cursor-pointer"
            >
              <Brain className="h-4 w-4" /> Enter Socratic Tutor
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/ednova/register"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-slate-200 hover:bg-white/10 transition cursor-pointer"
            >
              Create Free Account
            </Link>
          </div>
        </div>
      </section >

      {/* Footer */}
      < footer className="relative z-10 border-t border-white/10 bg-slate-950/60 px-4 py-8 sm:px-8 text-xs text-slate-500" >
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 text-white font-bold text-[10px]">
              E
            </div>
            <span className="font-bold text-slate-300">EdNova</span>
            <span>— AI Socratic Peer Learning Companion</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <Link href="/ednova/login" className="hover:text-white transition">
              Sign In
            </Link>
            <Link href="/ednova/register" className="hover:text-white transition">
              Register
            </Link>
          </div>

          <p>© 2026 EdNova Team. All rights reserved.</p>
        </div>
      </footer >
    </div >
  );
}
