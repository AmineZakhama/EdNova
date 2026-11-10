"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Brain,
  CheckCircle2,
  Clock,
  Layers,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";

import {
  type FlashcardDeck,
  type FlashcardWithSchedule,
  type ReviewQuality,
  deleteDeck,
  getDeckStats,
  getDueCards,
  getTotalDueCount,
  loadDecks,
  reviewCard,
  seedDemoFlashcards,
} from "@/lib/ednova/spaced-repetition";
import { loadLearningProgress, saveLearningProgress } from "@/lib/ednova/progress-storage";

type View = "dashboard" | "review";

export default function SpacedRepetition() {
  const [view, setView] = useState<View>("dashboard");
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [dueQueue, setDueQueue] = useState<FlashcardWithSchedule[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [rated, setRated] = useState(false);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, totalQuality: 0 });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    seedDemoFlashcards();
    setDecks(loadDecks());
  }, []);

  const totalDue = decks.reduce((sum, d) => sum + getDueCards(d).length, 0);
  const totalMastered = decks.reduce((sum, d) => sum + getDeckStats(d).mastered, 0);

  function startReview(deckId: string) {
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;
    const due = getDueCards(deck);
    if (due.length === 0) {
      setMessage("All caught up! No cards due for this deck.");
      return;
    }
    setActiveDeckId(deckId);
    setDueQueue(due);
    setCurrentIndex(0);
    setFlipped(false);
    setRated(false);
    setSessionStats({ reviewed: 0, totalQuality: 0 });
    setView("review");
    setMessage("");
  }

  function handleRate(quality: ReviewQuality) {
    if (!activeDeckId || rated) return;
    const card = dueQueue[currentIndex];
    reviewCard(activeDeckId, card.id, quality);
    setRated(true);
    setSessionStats((s) => ({ reviewed: s.reviewed + 1, totalQuality: s.totalQuality + quality }));

    // Award 5 XP per card reviewed
    const progress = loadLearningProgress();
    const badges = new Set(progress.badges);
    if (!badges.has("First flashcard review")) badges.add("First flashcard review");
    if (sessionStats.reviewed + 1 >= 10) badges.add("Flashcard marathon");
    saveLearningProgress({ ...progress, xp: progress.xp + 5, badges: [...badges] });
  }

  function nextCard() {
    if (currentIndex + 1 < dueQueue.length) {
      setCurrentIndex((i) => i + 1);
      setFlipped(false);
      setRated(false);
    } else {
      // Session complete
      setDecks(loadDecks());
      setView("dashboard");
      const avg = sessionStats.reviewed > 0 ? (sessionStats.totalQuality / sessionStats.reviewed).toFixed(1) : "0";
      setMessage(`Session complete! Reviewed ${sessionStats.reviewed} card${sessionStats.reviewed !== 1 ? "s" : ""}. Average quality: ${avg}/5. +${sessionStats.reviewed * 5} XP earned.`);
    }
  }

  function handleDelete(deckId: string) {
    deleteDeck(deckId);
    setDecks(loadDecks());
    setConfirmDelete(null);
    setMessage("Deck deleted.");
  }

  function backToDashboard() {
    setView("dashboard");
    setDecks(loadDecks());
  }

  const currentCard = dueQueue[currentIndex] ?? null;
  const activeDeck = decks.find((d) => d.id === activeDeckId);

  return (
    <main className="min-h-screen bg-[#070b1b] px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-cyan-200">EdNova spaced repetition</p>
            <h1 className="mt-1 text-3xl font-black">
              {view === "review" ? "Review session" : "Remember what matters."}
            </h1>
          </div>
          <div className="flex gap-2">
            {view === "review" ? (
              <button type="button" onClick={backToDashboard} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            ) : null}
            <Link href="/ednova/revision" className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5">Revision studio</Link>
            <Link href="/ednova" className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5">Tutor</Link>
          </div>
        </header>

        {message ? <p role="status" className="mt-4 rounded-xl bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}

        {/* ---------- Dashboard ---------- */}
        {view === "dashboard" ? (
          <div className="mt-6 space-y-5">
            {/* Summary cards */}
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryCard icon={<Layers className="h-5 w-5" />} label="Decks" value={String(decks.length)} color="violet" />
              <SummaryCard icon={<Clock className="h-5 w-5" />} label="Due today" value={String(totalDue)} color="amber" />
              <SummaryCard icon={<CheckCircle2 className="h-5 w-5" />} label="Mastered" value={String(totalMastered)} color="emerald" />
            </div>

            {/* Deck list */}
            {decks.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 text-center">
                <Brain className="mx-auto mb-3 h-10 w-10 text-violet-300" />
                <h2 className="text-lg font-bold">No flashcard decks yet</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">Generate revision notes in the <Link href="/ednova/revision" className="text-cyan-200 underline underline-offset-2">Revision Studio</Link>, then save the flashcards to create a deck.</p>
              </div>
            ) : (
              decks.map((deck) => {
                const stats = getDeckStats(deck);
                const masteredPct = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0;
                return (
                  <section key={deck.id} className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-white">{deck.topic}</h2>
                        <p className="mt-1 text-xs text-slate-400">
                          {stats.total} cards · {stats.dueToday} due today · {stats.mastered} mastered
                          {stats.nextDueDate ? ` · Next review: ${stats.nextDueDate}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {stats.dueToday > 0 ? (
                          <button type="button" onClick={() => startReview(deck.id)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:scale-[1.02]">
                            <Sparkles className="h-4 w-4" /> Review {stats.dueToday} card{stats.dueToday !== 1 ? "s" : ""}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-400/10 px-4 py-2.5 text-sm font-semibold text-emerald-100">
                            <CheckCircle2 className="h-4 w-4" /> All caught up!
                          </span>
                        )}
                        {confirmDelete === deck.id ? (
                          <div className="flex gap-1">
                            <button type="button" onClick={() => handleDelete(deck.id)} className="rounded-lg bg-rose-500/20 px-3 py-2 text-xs font-bold text-rose-100">Confirm</button>
                            <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Cancel</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setConfirmDelete(deck.id)} className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:bg-white/5 hover:text-rose-300" aria-label="Delete deck">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Mastery progress</span>
                        <span>{masteredPct}%</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-all" style={{ width: `${masteredPct}%` }} />
                      </div>
                    </div>
                    {/* Card status chips */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {stats.learning > 0 ? <Chip color="amber" label={`${stats.learning} learning`} /> : null}
                      {stats.mastered > 0 ? <Chip color="emerald" label={`${stats.mastered} mastered`} /> : null}
                      {(stats.total - stats.learning - stats.mastered) > 0 ? <Chip color="violet" label={`${stats.total - stats.learning - stats.mastered} new`} /> : null}
                    </div>
                  </section>
                );
              })
            )}
          </div>
        ) : null}

        {/* ---------- Review ---------- */}
        {view === "review" && activeDeck && currentCard ? (
          <div className="mt-6 space-y-5">
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>{activeDeck.topic}</span>
              <span>Card {currentIndex + 1} of {dueQueue.length}</span>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all" style={{ width: `${((currentIndex + (rated ? 1 : 0)) / dueQueue.length) * 100}%` }} />
            </div>

            {/* Card */}
            <div className="perspective-1000" style={{ perspective: "1000px" }}>
              <button
                type="button"
                onClick={() => { if (!flipped) setFlipped(true); }}
                className="relative w-full transition-transform duration-500"
                style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0)" }}
                aria-label={flipped ? "Card answer" : "Click to reveal answer"}
              >
                {/* Front */}
                <div className="min-h-56 rounded-3xl border border-violet-300/15 bg-violet-400/5 p-6 sm:p-8" style={{ backfaceVisibility: "hidden" }}>
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-violet-200">Question</p>
                  <p className="text-lg leading-8 text-white">{currentCard.front}</p>
                  <p className="mt-6 flex items-center gap-2 text-xs text-slate-400"><RotateCcw className="h-3.5 w-3.5" /> Click to reveal answer</p>
                </div>
                {/* Back */}
                <div className="absolute inset-0 min-h-56 rounded-3xl border border-cyan-300/15 bg-cyan-400/5 p-6 sm:p-8" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-cyan-200">Answer</p>
                  <p className="text-lg leading-8 text-white">{currentCard.back}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
                    <IntervalBadge card={currentCard} />
                  </div>
                </div>
              </button>
            </div>

            {/* Rating buttons */}
            {flipped && !rated ? (
              <div className="grid grid-cols-4 gap-2">
                <RateButton quality={1} label="Again" sublabel="1 day" color="rose" onClick={handleRate} />
                <RateButton quality={3} label="Hard" sublabel="short" color="amber" onClick={handleRate} />
                <RateButton quality={4} label="Good" sublabel="longer" color="emerald" onClick={handleRate} />
                <RateButton quality={5} label="Easy" sublabel="much longer" color="cyan" onClick={handleRate} />
              </div>
            ) : null}

            {/* Next button */}
            {rated ? (
              <button type="button" onClick={nextCard} className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:scale-[1.01]">
                {currentIndex + 1 < dueQueue.length ? "Next card" : "Finish session"}
              </button>
            ) : null}

            {/* Session stats */}
            <p className="text-center text-xs text-slate-500">
              {sessionStats.reviewed} reviewed · +{sessionStats.reviewed * 5} XP this session
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Small UI components
// ---------------------------------------------------------------------------

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: "violet" | "amber" | "emerald" | "cyan" }) {
  const colors = {
    violet: "border-violet-300/15 bg-violet-400/5 text-violet-200",
    amber: "border-amber-300/15 bg-amber-400/5 text-amber-200",
    emerald: "border-emerald-300/15 bg-emerald-400/5 text-emerald-200",
    cyan: "border-cyan-300/15 bg-cyan-400/5 text-cyan-200",
  };
  return (
    <div className={`rounded-2xl border p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">{icon}{label}</div>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function Chip({ color, label }: { color: "violet" | "amber" | "emerald"; label: string }) {
  const colors = { violet: "bg-violet-400/10 text-violet-200", amber: "bg-amber-400/10 text-amber-200", emerald: "bg-emerald-400/10 text-emerald-200" };
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${colors[color]}`}>{label}</span>;
}

function IntervalBadge({ card }: { card: FlashcardWithSchedule }) {
  if (card.interval >= 21) return <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-emerald-200">Mastered · {card.interval}d interval</span>;
  if (card.repetitions > 0) return <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-amber-200">Learning · {card.interval}d interval</span>;
  return <span className="rounded-full bg-violet-400/10 px-2 py-0.5 text-violet-200">New card</span>;
}

function RateButton({ quality, label, sublabel, color, onClick }: { quality: ReviewQuality; label: string; sublabel: string; color: string; onClick: (q: ReviewQuality) => void }) {
  const colorMap: Record<string, string> = {
    rose: "border-rose-300/30 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20",
    amber: "border-amber-300/30 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20",
    emerald: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20",
    cyan: "border-cyan-300/30 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20",
  };
  return (
    <button type="button" onClick={() => onClick(quality)} className={`rounded-xl border px-3 py-3 text-center transition ${colorMap[color] ?? ""}`}>
      <span className="block text-sm font-bold">{label}</span>
      <span className="block text-[10px] opacity-70">{sublabel}</span>
    </button>
  );
}
