"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  HelpCircle,
  Layers,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";

import { loadLearnerProfile } from "@/lib/ednova/profile-storage";
import {
  loadLearningProgress,
  recordQuizResult,
  saveLearningProgress,
} from "@/lib/ednova/progress-storage";
import {
  GAMIFIED_QUESTION_BANK,
  GamifiedQuestion,
  pickGamifiedQuestion,
  playQuizOptionClickSound,
  playQuizSuccessSound,
  playQuizTryAgainSound,
} from "@/lib/ednova/gamified-quiz";
import UserMenu from "@/components/ednova/UserMenu";

type QuizMode = "lightning" | "gauntlet";

const PRESET_TOPICS = [
  { name: "Mathematics", icon: "📐", desc: "Calculus, Linear Algebra & Probability" },
  { name: "Biology", icon: "🧬", desc: "Cellular Respiration, Mitosis & Genetics" },
  { name: "Physics", icon: "⚛️", desc: "Mechanics, Thermodynamics & Waves" },
  { name: "Computer Science", icon: "💻", desc: "Data Structures, Algorithms & OS" },
  { name: "Data Science & AI", icon: "🤖", desc: "Machine Learning, Transformers & Optimization" },
  { name: "Chemistry", icon: "🧪", desc: "Acids/Bases, Bonding & Reaction Kinetics" },
];

export default function QuizStudio() {
  const [favoriteSubjects, setFavoriteSubjects] = useState<string[]>(["Mathematics", "Biology", "Physics"]);
  const [selectedTopic, setSelectedTopic] = useState<string>("Biology");
  const [customTopic, setCustomTopic] = useState<string>("");
  const [mode, setMode] = useState<QuizMode>("lightning");

  // Quiz state
  const [questions, setQuestions] = useState<GamifiedQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [totalXpEarned, setTotalXpEarned] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [generatingCustom, setGeneratingCustom] = useState(false);
  const [generateError, setGenerateError] = useState("");

  // Load learner profile favorites
  useEffect(() => {
    const profile = loadLearnerProfile();
    if (profile?.subjects && profile.subjects.length > 0) {
      setFavoriteSubjects(profile.subjects);
      setSelectedTopic(profile.subjects[0]);
    }
  }, []);

  // Initialize questions when topic or mode changes
  useEffect(() => {
    startNewRound(selectedTopic, mode);
  }, [selectedTopic, mode]);

  function startNewRound(topic: string, currentMode: QuizMode) {
    const matchingQuestions = GAMIFIED_QUESTION_BANK.filter(
      (q) => q.subject.toLowerCase() === topic.toLowerCase()
    );

    let roundQuestions: GamifiedQuestion[] = [];

    if (currentMode === "lightning") {
      // 1 question instant sprint
      const q = matchingQuestions.length > 0
        ? matchingQuestions[Math.floor(Math.random() * matchingQuestions.length)]
        : pickGamifiedQuestion([topic]);
      roundQuestions = [q];
    } else {
      // 5-question mastery gauntlet
      if (matchingQuestions.length >= 4) {
        roundQuestions = [...matchingQuestions].sort(() => 0.5 - Math.random()).slice(0, 5);
      } else {
        // Pool matching + general STEM
        const general = GAMIFIED_QUESTION_BANK.filter((q) => q.subject.toLowerCase() !== topic.toLowerCase());
        roundQuestions = [...matchingQuestions, ...general].slice(0, 5);
      }
    }

    setQuestions(roundQuestions);
    setCurrentIndex(0);
    setSelectedOption(null);
    setAnswered(false);
    setScore(0);
    setStreak(0);
    setTotalXpEarned(0);
    setIsCompleted(false);
  }

  function handleSelectOption(index: number) {
    if (answered || !currentQuestion) return;

    playQuizOptionClickSound();
    setSelectedOption(index);
    setAnswered(true);

    const isCorrect = index === currentQuestion.correctIndex;

    let roundXp = 0;
    if (isCorrect) {
      playQuizSuccessSound();
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);
      setScore((s) => s + 1);

      // Streak combo bonus
      const comboMultiplier = newStreak >= 3 ? 1.5 : 1.0;
      roundXp = Math.round(currentQuestion.xpReward * comboMultiplier);
    } else {
      playQuizTryAgainSound();
      setStreak(0);
      roundXp = 5; // participation XP
    }

    setTotalXpEarned((x) => x + roundXp);

    // Record to storage and sync to analytics
    try {
      recordQuizResult({
        topic: currentQuestion.subject,
        total: 1,
        correct: isCorrect ? 1 : 0,
      });

      const progress = loadLearningProgress();
      const newXp = progress.xp + roundXp;
      saveLearningProgress({
        ...progress,
        xp: newXp,
        level: Math.floor(Math.sqrt(newXp / 100)) + 1,
      });
    } catch {}
  }

  function handleNextQuestion() {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((i) => i + 1);
      setSelectedOption(null);
      setAnswered(false);
    } else {
      setIsCompleted(true);
    }
  }

  async function handleGenerateCustomTopic() {
    if (!customTopic.trim()) return;
    setGeneratingCustom(true);
    setGenerateError("");

    try {
      const res = await fetch("/api/ednova/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: customTopic.trim(),
          profile: loadLearnerProfile(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.quiz?.questions?.length) {
        throw new Error(data.error || "Failed to generate AI quiz.");
      }

      // Convert generated questions to GamifiedQuestion format
      const generated: GamifiedQuestion[] = data.quiz.questions.map((q: any, i: number) => ({
        id: `gen-${i}`,
        subject: customTopic.trim(),
        subtopic: "AI Generated Topic",
        question: q.question,
        options: q.options as [string, string, string, string],
        correctIndex: q.options.indexOf(q.correctAnswer),
        explanation: q.explanation,
        xpReward: 20,
      }));

      setSelectedTopic(customTopic.trim());
      setQuestions(generated);
      setCurrentIndex(0);
      setSelectedOption(null);
      setAnswered(false);
      setScore(0);
      setStreak(0);
      setTotalXpEarned(0);
      setIsCompleted(false);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Could not generate questions.");
    } finally {
      setGeneratingCustom(false);
    }
  }

  const currentQuestion = questions[currentIndex];
  const optionLetters = ["A", "B", "C", "D"];

  return (
    <main className="min-h-screen bg-[#070b1b] px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Navigation & Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300 border border-amber-500/20">
                <Zap className="h-3 w-3 fill-current text-amber-400" /> Gamified Quiz Arena
              </span>
              <span className="text-xs text-slate-400">Solo Recall & Instant XP</span>
            </div>
            <h1 className="mt-1.5 text-2xl font-black text-white sm:text-3xl">
              Level up through active cognitive recall.
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Pick your favorite subject, beat your combo streaks, and earn XP with instant feedback.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/ednova"
              className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/5"
            >
              Back to tutor
            </Link>
            <UserMenu />
          </div>
        </header>

        {/* Gamification Dashboard Bar */}
        <section className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3.5 backdrop-blur-xl">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Session XP</p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-amber-400">+{totalXpEarned}</span>
              <span className="text-xs text-slate-400">XP</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3.5 backdrop-blur-xl">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Combo Streak</p>
            <div className="mt-1 flex items-center gap-1.5">
              <Flame className={`h-5 w-5 ${streak > 0 ? "text-orange-400 animate-pulse" : "text-slate-600"}`} />
              <span className="text-xl font-black text-white">{streak}</span>
              {streak >= 3 && (
                <span className="rounded-full bg-orange-500/20 border border-orange-400/30 px-1.5 py-0.2 text-[9px] font-bold text-orange-300">
                  1.5x XP!
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3.5 backdrop-blur-xl">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Accuracy</p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-emerald-400">
                {currentIndex > 0 || answered
                  ? Math.round((score / (currentIndex + (answered ? 1 : 0))) * 100)
                  : 100}
                %
              </span>
              <span className="text-xs text-slate-400">
                ({score}/{currentIndex + (answered ? 1 : 0)})
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3.5 backdrop-blur-xl">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Mode</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-xs font-bold text-cyan-300 capitalize">
                {mode === "lightning" ? "⚡ 1-Q Lightning" : "🎯 5-Q Gauntlet"}
              </span>
            </div>
          </div>
        </section>

        {/* Mode & Topic Selector */}
        <section className="mt-6 rounded-3xl border border-white/10 bg-slate-900/60 p-5 sm:p-6 backdrop-blur-xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Select Topic & Format</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                ⭐ Starred subjects are from your personal learning profile
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="flex rounded-xl bg-white/5 p-1 border border-white/10">
              <button
                type="button"
                onClick={() => setMode("lightning")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  mode === "lightning"
                    ? "bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                ⚡ 1-Q Lightning
              </button>
              <button
                type="button"
                onClick={() => setMode("gauntlet")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  mode === "gauntlet"
                    ? "bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🎯 5-Q Gauntlet
              </button>
            </div>
          </div>

          {/* Preset Topics Badges */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {PRESET_TOPICS.map((topic) => {
              const isSelected = selectedTopic === topic.name;
              const isFav = favoriteSubjects.some(
                (f) => f.toLowerCase() === topic.name.toLowerCase()
              );

              return (
                <button
                  key={topic.name}
                  type="button"
                  onClick={() => {
                    setSelectedTopic(topic.name);
                    setCustomTopic("");
                  }}
                  className={`group flex flex-col items-start rounded-2xl border p-3 text-left transition cursor-pointer ${
                    isSelected
                      ? "border-cyan-400/80 bg-cyan-500/15 shadow-md shadow-cyan-500/15"
                      : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xl">{topic.icon}</span>
                    {isFav && (
                      <span className="text-[10px] text-amber-300 font-bold" title="Favorite Subject">
                        ⭐
                      </span>
                    )}
                  </div>
                  <p className={`mt-2 text-xs font-bold ${isSelected ? "text-cyan-200" : "text-white"}`}>
                    {topic.name}
                  </p>
                  <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{topic.desc}</p>
                </button>
              );
            })}
          </div>

          {/* AI Generator on Custom Topic */}
          <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-3 border-t border-white/5">
            <input
              type="text"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="Or enter any custom topic (e.g. Organic Chemistry, Quantum Physics, Sorting Algorithms)..."
              className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-cyan-400"
              onKeyDown={(e) => e.key === "Enter" && handleGenerateCustomTopic()}
            />
            <button
              type="button"
              onClick={handleGenerateCustomTopic}
              disabled={generatingCustom || !customTopic.trim()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {generatingCustom ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>Generate AI Quiz</span>
            </button>
          </div>
          {generateError && <p className="text-xs text-rose-300 mt-2">{generateError}</p>}
        </section>

        {/* Active Quiz Card */}
        {!isCompleted && currentQuestion && (
          <section className="mt-6 rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-7 shadow-2xl backdrop-blur-xl">
            {/* Question Progress & Subject Bar */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <span className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-bold text-cyan-200">
                  {currentQuestion.subject}
                </span>
                <span className="text-xs text-slate-400 truncate max-w-[240px]">
                  {currentQuestion.subtopic}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <span className="rounded-full bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 text-[10px] font-black text-amber-300">
                  +{currentQuestion.xpReward} XP
                </span>
              </div>
            </div>

            {/* Question Title */}
            <div className="mt-5">
              <h2 className="text-base sm:text-lg font-bold text-white leading-relaxed">
                {currentQuestion.question}
              </h2>
            </div>

            {/* 4 Options Grid */}
            <div className="mt-6 space-y-2.5">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrectOption = idx === currentQuestion.correctIndex;

                let btnStyle = "border-white/10 bg-white/5 text-slate-200 hover:border-cyan-400/40 hover:bg-cyan-500/5";

                if (answered) {
                  if (isCorrectOption) {
                    btnStyle = "border-emerald-400 bg-emerald-500/20 text-emerald-100 ring-2 ring-emerald-500/30";
                  } else if (isSelected && !isCorrectOption) {
                    btnStyle = "border-rose-400 bg-rose-500/20 text-rose-100";
                  } else {
                    btnStyle = "border-white/5 bg-white/[0.02] text-slate-500 opacity-60";
                  }
                }

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelectOption(idx)}
                    disabled={answered}
                    className={`group flex w-full items-center justify-between rounded-2xl border p-4 text-left text-xs sm:text-sm font-medium transition cursor-pointer ${btnStyle}`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-xl text-xs font-black transition ${
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
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                    )}
                    {answered && isSelected && !isCorrectOption && (
                      <XCircle className="h-5 w-5 shrink-0 text-rose-400" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Answer Explanation Box */}
            {answered && (
              <div
                className={`mt-6 rounded-2xl border p-4 animate-in fade-in duration-200 ${
                  selectedOption === currentQuestion.correctIndex
                    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                    : "border-amber-400/40 bg-amber-500/15 text-amber-100"
                }`}
              >
                <div className="flex items-center justify-between gap-2 font-bold mb-1.5">
                  <span className="flex items-center gap-1.5 text-sm">
                    {selectedOption === currentQuestion.correctIndex ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Correct! Excellent reasoning.
                      </>
                    ) : (
                      <>
                        <HelpCircle className="h-4 w-4 text-amber-400" /> Helpful attempt! Here is the concept:
                      </>
                    )}
                  </span>
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-black">
                    +{selectedOption === currentQuestion.correctIndex ? currentQuestion.xpReward : 5} XP
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed mt-1">
                  {currentQuestion.explanation}
                </p>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-2.5 text-xs font-bold text-slate-950 transition hover:brightness-110 shadow-lg shadow-cyan-500/20 cursor-pointer"
                  >
                    <span>
                      {currentIndex + 1 < questions.length ? "Next Question" : "View Results"}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Round Completion Summary Screen */}
        {isCompleted && (
          <section className="mt-6 rounded-3xl border border-white/10 bg-slate-900/80 p-6 sm:p-10 text-center shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-200">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-amber-400/20 text-amber-300 shadow-lg shadow-amber-500/20">
              <Trophy className="h-8 w-8" />
            </div>

            <h2 className="text-2xl font-black text-white">Quiz Sprint Complete!</h2>
            <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
              Your results and accuracy have been recorded to your live learning analytics.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-3 max-w-md mx-auto">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Score</p>
                <p className="text-lg font-black text-white mt-1">
                  {score} / {questions.length}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Accuracy</p>
                <p className="text-lg font-black text-emerald-400 mt-1">
                  {Math.round((score / Math.max(1, questions.length)) * 100)}%
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Total XP</p>
                <p className="text-lg font-black text-amber-400 mt-1">
                  +{totalXpEarned} XP
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => startNewRound(selectedTopic, mode)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-2.5 text-xs font-bold text-slate-950 transition hover:brightness-110 shadow-lg shadow-cyan-500/20 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" /> Play Another Round
              </button>

              <Link
                href="/ednova/analytics"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
              >
                View Analytics Dashboard
              </Link>

              <Link
                href="/ednova"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
              >
                Return to Tutor
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
