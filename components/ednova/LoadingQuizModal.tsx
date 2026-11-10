"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Clock,
  HelpCircle,
  LoaderCircle,
  Sparkles,
  Trophy,
  Volume2,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import {
  GamifiedQuestion,
  pickGamifiedQuestion,
  playQuizOptionClickSound,
  playQuizSuccessSound,
  playQuizTryAgainSound,
} from "@/lib/ednova/gamified-quiz";
import {
  loadLearningProgress,
  recordQuizResult,
  saveLearningProgress,
} from "@/lib/ednova/progress-storage";

interface LoadingQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  isTutorReady: boolean;
  onRevealTutor: () => void;
  favoriteSubjects?: string[];
  contextPrompt?: string;
}

export default function LoadingQuizModal({
  isOpen,
  onClose,
  isTutorReady,
  onRevealTutor,
  favoriteSubjects = [],
  contextPrompt = "",
}: LoadingQuizModalProps) {
  const [question, setQuestion] = useState<GamifiedQuestion | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [earnedXp, setEarnedXp] = useState(0);
  const [usedQuestionIds, setUsedQuestionIds] = useState<string[]>([]);
  const [autoOpenEnabled, setAutoOpenEnabled] = useState(true);

  // Initialize or pick a fresh question when opened
  useEffect(() => {
    if (isOpen) {
      const q = pickGamifiedQuestion(favoriteSubjects, contextPrompt, usedQuestionIds);
      setQuestion(q);
      setSelectedIndex(null);
      setAnswered(false);
      setIsCorrect(false);
      setEarnedXp(0);
      setUsedQuestionIds((prev) => [...prev, q.id]);
    }
  }, [isOpen]);

  // Load preference
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("ednova-auto-loading-quiz");
      if (saved !== null) {
        setAutoOpenEnabled(saved === "true");
      }
    } catch {}
  }, []);

  function handleToggleAuto(val: boolean) {
    setAutoOpenEnabled(val);
    try {
      window.localStorage.setItem("ednova-auto-loading-quiz", String(val));
    } catch {}
  }

  function handleSelectOption(index: number) {
    if (answered || !question) return;

    playQuizOptionClickSound();
    setSelectedIndex(index);
    setAnswered(true);

    const correct = index === question.correctIndex;
    setIsCorrect(correct);

    const xp = correct ? question.xpReward : 5;
    setEarnedXp(xp);

    if (correct) {
      playQuizSuccessSound();
      try {
        window.dispatchEvent(new CustomEvent("ednova-tokens-reward", { detail: { tokens: 50 } }));
      } catch {}
    } else {
      playQuizTryAgainSound();
    }

    // Record to persistent storage & analytics
    try {
      recordQuizResult({
        topic: question.subject,
        total: 1,
        correct: correct ? 1 : 0,
      });

      // Update XP & level
      const progress = loadLearningProgress();
      const newXp = progress.xp + xp;
      saveLearningProgress({
        ...progress,
        xp: newXp,
        level: Math.floor(Math.sqrt(newXp / 100)) + 1,
      });
    } catch {}
  }

  if (!isOpen || !question) return null;

  const optionLetters = ["A", "B", "C", "D"];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 p-5 sm:p-6 shadow-2xl text-white animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Background glow highlights */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />

        {/* Modal Header */}
        <div className="relative z-10 flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 shadow-md shadow-amber-500/20 font-black">
              <Zap className="h-5 w-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                  ⚡ Brain Warm-Up
                </span>
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                  +15 XP Bonus
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Answer while EdNova computes your Socratic guidance
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
            title="Skip quiz"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Subject & Subtopic Pill */}
        <div className="relative z-10 mt-4 flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-200">
            <Sparkles className="h-3 w-3 text-cyan-300" />
            {question.subject}
            <span className="text-[10px] text-cyan-400/70">· Favorite Topic</span>
          </span>
          <span className="text-[11px] text-slate-400 truncate max-w-[200px]">
            {question.subtopic}
          </span>
        </div>

        {/* Question Text */}
        <div className="relative z-10 mt-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <h3 className="text-sm sm:text-base font-bold text-slate-100 leading-snug">
            {question.question}
          </h3>
        </div>

        {/* Multiple Choice Options */}
        <div className="relative z-10 mt-4 space-y-2.5">
          {question.options.map((option, idx) => {
            const isSelected = selectedIndex === idx;
            const isCorrectOption = idx === question.correctIndex;

            let buttonStyle = "border-white/10 bg-white/5 text-slate-200 hover:border-cyan-400/40 hover:bg-cyan-500/5";

            if (answered) {
              if (isCorrectOption) {
                buttonStyle = "border-emerald-400 bg-emerald-500/20 text-emerald-100 ring-2 ring-emerald-500/30";
              } else if (isSelected && !isCorrectOption) {
                buttonStyle = "border-rose-400/80 bg-rose-500/20 text-rose-100";
              } else {
                buttonStyle = "border-white/5 bg-white/[0.02] text-slate-500 opacity-60";
              }
            }

            return (
              <button
                key={option}
                type="button"
                onClick={() => handleSelectOption(idx)}
                disabled={answered}
                className={`group flex w-full items-center justify-between rounded-xl border p-3 text-left text-xs sm:text-sm font-medium transition cursor-pointer ${buttonStyle}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-xs font-black transition ${
                      answered && isCorrectOption
                        ? "bg-emerald-400 text-slate-950"
                        : answered && isSelected && !isCorrectOption
                        ? "bg-rose-500 text-white"
                        : "bg-white/10 text-slate-300 group-hover:bg-cyan-400 group-hover:text-slate-950"
                    }`}
                  >
                    {optionLetters[idx]}
                  </span>
                  <span className="leading-snug">{option}</span>
                </div>

                {answered && isCorrectOption && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                )}
                {answered && isSelected && !isCorrectOption && (
                  <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* Post-Answer Feedback Banner */}
        {answered && (
          <div
            className={`relative z-10 mt-4 rounded-2xl border p-3.5 text-xs animate-in fade-in duration-200 ${
              isCorrect
                ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                : "border-amber-400/40 bg-amber-500/15 text-amber-100"
            }`}
          >
            <div className="flex items-center justify-between gap-2 font-bold mb-1">
              <span className="flex items-center gap-1.5">
                {isCorrect ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Correct!
                  </>
                ) : (
                  <>
                    <HelpCircle className="h-4 w-4 text-amber-400" /> Good Attempt!
                  </>
                )}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-black">
                  +{earnedXp} XP
                </span>
                {isCorrect && (
                  <span className="rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 text-[11px] font-black">
                    +50 🪙 Tokens
                  </span>
                )}
              </div>
            </div>
            <p className="leading-relaxed text-slate-200 text-[11px]">
              {question.explanation}
            </p>
          </div>
        )}

        {/* Bottom AI Tutor Generation Status Bar */}
        <div className="relative z-10 mt-5 border-t border-white/10 pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {!isTutorReady ? (
              <div className="flex items-center gap-2 text-xs text-cyan-300">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                <span className="animate-pulse">EdNova is preparing hints…</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Response ready!</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none rounded-xl border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5 hover:text-white transition cursor-pointer"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={onRevealTutor}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition shadow-lg cursor-pointer ${
                isTutorReady
                  ? "bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 hover:brightness-110 shadow-cyan-500/25 animate-pulse"
                  : "bg-white/10 text-slate-200 hover:bg-white/20"
              }`}
            >
              <span>{isTutorReady ? "Reveal Tutor Answer" : "Open Tutor"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Auto-open Toggle */}
        <div className="relative z-10 mt-3 flex items-center justify-between text-[10px] text-slate-500 border-t border-white/5 pt-2">
          <span>🧠 Quick Quiz during AI wait</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={autoOpenEnabled}
              onChange={(e) => handleToggleAuto(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800 text-cyan-400 focus:ring-0"
            />
            <span>Auto-launch</span>
          </label>
        </div>
      </div>
    </div>
  );
}
