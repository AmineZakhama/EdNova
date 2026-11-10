"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  HelpCircle,
  Layers,
  RotateCcw,
  Shuffle,
  Sparkles,
  Trophy,
  X,
  Zap,
} from "lucide-react";

import {
  type FlashcardDeck,
  type FlashcardWithSchedule,
  type ReviewQuality,
  deleteDeck,
  getDeckStats,
  getDueCards,
  loadDecks,
  reviewCard,
  seedDemoFlashcards,
} from "@/lib/ednova/spaced-repetition";
import { loadLearningProgress, saveLearningProgress } from "@/lib/ednova/progress-storage";

export type FlashcardItem = {
  front: string;
  back: string;
  options?: string[];
  correctOptionIndex?: number;
};

interface FlashcardModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePackCards?: FlashcardItem[];
  topicTitle?: string;
}

export default function FlashcardModal({
  isOpen,
  onClose,
  activePackCards,
  topicTitle,
}: FlashcardModalProps) {
  const [mode, setMode] = useState<"pack" | "decks">(activePackCards && activePackCards.length > 0 ? "pack" : "decks");
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);

  // Cards currently being reviewed
  const [reviewCards, setReviewCards] = useState<FlashcardItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Multiple-choice state for current card
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answeredCorrectly, setAnsweredCorrectly] = useState<boolean | null>(null);

  // Mastery & Session Stats
  const [sessionReviewedCount, setSessionReviewedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Load saved decks and initialize
  useEffect(() => {
    if (!isOpen) return;
    seedDemoFlashcards();
    const loaded = loadDecks();
    setDecks(loaded);

    if (activePackCards && activePackCards.length > 0) {
      setMode("pack");
      setReviewCards(activePackCards);
    } else if (loaded.length > 0) {
      setMode("decks");
      setSelectedDeckId(loaded[0].id);
      setReviewCards(loaded[0].cards);
    }

    setCurrentIndex(0);
    setIsFlipped(false);
    setSelectedOption(null);
    setAnsweredCorrectly(null);
    setSessionReviewedCount(0);
    setCorrectCount(0);
    setSessionCompleted(false);
    setXpEarned(0);
  }, [isOpen, activePackCards]);

  if (!isOpen) return null;

  const currentCard = reviewCards[currentIndex];

  // Derive multiple choice options for current card (guaranteed 4 options)
  const currentOptions: string[] =
    currentCard?.options && currentCard.options.length >= 2
      ? currentCard.options
      : currentCard
      ? [
          currentCard.back.length > 75 ? currentCard.back.slice(0, 72) + "..." : currentCard.back,
          "Opposite biochemical / physical principle applies",
          "Occurs exclusively under severe equilibrium starvation",
          "Acts as a non-competitive uncoupling agent",
        ]
      : [];

  const correctIndex: number =
    typeof currentCard?.correctOptionIndex === "number" &&
    currentCard.correctOptionIndex >= 0 &&
    currentCard.correctOptionIndex < currentOptions.length
      ? currentCard.correctOptionIndex
      : 0;

  function handleSelectOption(optIdx: number) {
    if (selectedOption !== null) return; // already answered
    setSelectedOption(optIdx);
    const isCorrect = optIdx === correctIndex;
    setAnsweredCorrectly(isCorrect);
    if (isCorrect) setCorrectCount((c) => c + 1);

    // Award +5 XP per question answered
    const progress = loadLearningProgress();
    const badges = new Set(progress.badges);
    if (!badges.has("First flashcard review")) badges.add("First flashcard review");
    saveLearningProgress({ ...progress, xp: progress.xp + 5, badges: [...badges] });
    setXpEarned((prev) => prev + 5);
    setSessionReviewedCount((prev) => prev + 1);
  }

  function handleRateSpacedRepetition(quality: ReviewQuality) {
    if (mode === "decks" && selectedDeckId && currentCard) {
      const deck = decks.find((d) => d.id === selectedDeckId);
      const card = deck?.cards[currentIndex];
      if (card) {
        reviewCard(selectedDeckId, card.id, quality);
      }
    }
    handleNextCard();
  }

  function handleNextCard() {
    if (currentIndex < reviewCards.length - 1) {
      setCurrentIndex((idx) => idx + 1);
      setIsFlipped(false);
      setSelectedOption(null);
      setAnsweredCorrectly(null);
    } else {
      setSessionCompleted(true);
    }
  }

  function handlePrevCard() {
    if (currentIndex > 0) {
      setCurrentIndex((idx) => idx - 1);
      setIsFlipped(false);
      setSelectedOption(null);
      setAnsweredCorrectly(null);
    }
  }

  function handleShuffle() {
    const shuffled = [...reviewCards].sort(() => Math.random() - 0.5);
    setReviewCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSelectedOption(null);
    setAnsweredCorrectly(null);
    setSessionCompleted(false);
  }

  function handleSelectDeck(deckId: string) {
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;
    setSelectedDeckId(deckId);
    setReviewCards(deck.cards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSelectedOption(null);
    setAnsweredCorrectly(null);
    setSessionCompleted(false);
  }

  function handleDeleteDeck(deckId: string) {
    deleteDeck(deckId);
    const updated = loadDecks();
    setDecks(updated);
    if (selectedDeckId === deckId) {
      if (updated.length > 0) {
        setSelectedDeckId(updated[0].id);
        setReviewCards(updated[0].cards);
      } else {
        setSelectedDeckId(null);
        setReviewCards([]);
      }
    }
  }

  const progressPercent = reviewCards.length > 0 ? Math.round(((currentIndex + 1) / reviewCards.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl rounded-3xl border border-white/10 bg-[#070b1b] p-5 sm:p-7 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  {mode === "pack" ? topicTitle || "Revision Pack Flashcards" : "Spaced Repetition Decks"}
                </h3>
                <span className="rounded-full bg-violet-400/10 px-2 py-0.5 text-[10px] font-bold text-violet-300 border border-violet-400/20">
                  Interactive MCQ & Recall
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Choose the correct answer, flip for deep explanation, and schedule reviews.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Switcher */}
            {activePackCards && activePackCards.length > 0 && (
              <div className="hidden sm:flex items-center rounded-xl border border-white/10 bg-white/5 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setMode("pack");
                    setReviewCards(activePackCards);
                    setCurrentIndex(0);
                    setIsFlipped(false);
                    setSelectedOption(null);
                    setSessionCompleted(false);
                  }}
                  className={`px-3 py-1 rounded-lg transition ${
                    mode === "pack" ? "bg-cyan-400 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  This Pack ({activePackCards.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("decks");
                    if (decks.length > 0) {
                      setSelectedDeckId(decks[0].id);
                      setReviewCards(decks[0].cards);
                    }
                    setCurrentIndex(0);
                    setIsFlipped(false);
                    setSelectedOption(null);
                    setSessionCompleted(false);
                  }}
                  className={`px-3 py-1 rounded-lg transition ${
                    mode === "decks" ? "bg-violet-400 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Saved Decks ({decks.length})
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="Close modal (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Deck Selector Bar when in 'decks' mode */}
        {mode === "decks" && decks.length > 0 && (
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/5 text-xs">
            <span className="text-slate-500 uppercase tracking-wider text-[10px] font-bold shrink-0">Decks:</span>
            {decks.map((deck) => {
              const isSelected = selectedDeckId === deck.id;
              const dueCount = getDueCards(deck).length;
              return (
                <div key={deck.id} className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSelectDeck(deck.id)}
                    className={`rounded-xl px-3 py-1.5 transition font-semibold flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-violet-500/20 text-violet-200 border border-violet-400/40"
                        : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200 border border-white/5"
                    }`}
                  >
                    <span>{deck.topic}</span>
                    <span className="rounded-full bg-white/10 px-1.5 py-0.2 text-[10px] text-slate-300">
                      {deck.cards.length}
                    </span>
                    {dueCount > 0 && (
                      <span className="h-2 w-2 rounded-full bg-amber-400" title={`${dueCount} cards due`} />
                    )}
                  </button>
                  {decks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteDeck(deck.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition"
                      title="Delete deck"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Body / Active Review Session */}
        <div className="my-auto overflow-y-auto py-4">
          {!sessionCompleted && currentCard ? (
            <div className="space-y-4">
              {/* Progress and card counter */}
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300">
                  Card {currentIndex + 1} of {reviewCards.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleShuffle}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-300 transition"
                    title="Shuffle cards"
                  >
                    <Shuffle className="h-3 w-3" /> Shuffle
                  </button>
                  <span className="font-bold text-violet-400">{progressPercent}%</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* 3D Perspective Flashcard Container */}
              <div
                className="group relative rounded-3xl border border-violet-400/25 bg-gradient-to-b from-violet-950/30 via-slate-900/60 to-purple-950/30 p-5 sm:p-6 shadow-xl transition-all"
                style={{ perspective: "1000px" }}
              >
                {/* Card Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <span className="rounded-full bg-violet-400/10 px-2.5 py-0.5 text-[11px] font-bold text-violet-300 border border-violet-400/20 uppercase tracking-widest">
                    {isFlipped ? "Full Explanation & Concept" : "Question & Options"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-300 hover:text-white transition cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {isFlipped ? "Show Question" : "Flip to Explanation"}
                  </button>
                </div>

                {/* Card Content */}
                {!isFlipped ? (
                  /* FRONT: Question Prompt & 4 Multiple-Choice Options */
                  <div className="pt-4 space-y-4">
                    <p className="text-base sm:text-lg font-bold text-white leading-relaxed text-center sm:text-left">
                      {currentCard.front}
                    </p>

                    <div className="grid gap-2.5 pt-2">
                      {currentOptions.map((opt, optIdx) => {
                        const isChosen = selectedOption === optIdx;
                        const isTheCorrectOne = optIdx === correctIndex;

                        let style =
                          "border-white/10 bg-white/[0.03] text-slate-200 hover:border-violet-400/40 hover:bg-white/[0.06]";

                        if (selectedOption !== null) {
                          if (isTheCorrectOne) {
                            style =
                              "border-emerald-400/60 bg-emerald-500/20 text-emerald-100 font-bold shadow-lg shadow-emerald-500/10";
                          } else if (isChosen && !isTheCorrectOne) {
                            style =
                              "border-rose-400/60 bg-rose-500/20 text-rose-200 line-through";
                          } else {
                            style = "opacity-40 border-white/5 bg-white/[0.01] text-slate-400";
                          }
                        }

                        const optionLabels = ["A", "B", "C", "D"];

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => handleSelectOption(optIdx)}
                            disabled={selectedOption !== null}
                            className={`group flex items-start gap-3 rounded-2xl border p-3.5 text-left text-xs sm:text-sm transition-all cursor-pointer ${style}`}
                          >
                            <span
                              className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-xs font-bold transition ${
                                isChosen && isTheCorrectOne
                                  ? "bg-emerald-400 text-slate-950"
                                  : isChosen && !isTheCorrectOne
                                  ? "bg-rose-400 text-slate-950"
                                  : "bg-white/10 text-slate-300 group-hover:bg-violet-400 group-hover:text-slate-950"
                              }`}
                            >
                              {selectedOption !== null && isTheCorrectOne ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                optionLabels[optIdx]
                              )}
                            </span>
                            <span className="pt-0.5 leading-relaxed">{opt}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Feedback Banner after selecting */}
                    {selectedOption !== null && (
                      <div
                        className={`rounded-2xl border p-3.5 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-150 ${
                          answeredCorrectly
                            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                            : "border-rose-400/30 bg-rose-400/10 text-rose-200"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold">
                            {answeredCorrectly ? "✓ Correct!" : "✕ Review concept below"}
                          </span>
                          <span className="text-[11px] opacity-80">+5 XP recorded</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsFlipped(true)}
                          className="font-bold underline hover:opacity-80"
                        >
                          View Concept Explanation →
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* BACK: In-Depth Conceptual Explanation */
                  <div className="pt-4 space-y-4">
                    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-xs text-slate-400">
                      <span className="font-bold text-slate-300">Question Prompt:</span> {currentCard.front}
                    </div>

                    <div className="p-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                        Answer & Underlying Principle:
                      </span>
                      <p className="mt-2 text-sm sm:text-base font-semibold leading-relaxed text-slate-100">
                        {currentCard.back}
                      </p>
                    </div>

                    {/* Spaced Repetition Recall Rating */}
                    <div className="border-t border-white/5 pt-4">
                      <p className="text-xs text-slate-400 mb-2 font-medium">
                        Rate your recall to schedule next spaced repetition interval:
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button
                          type="button"
                          onClick={() => handleRateSpacedRepetition(1)}
                          className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-400/20 transition"
                        >
                          Again (1d)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRateSpacedRepetition(2)}
                          className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-400/20 transition"
                        >
                          Hard (3d)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRateSpacedRepetition(4)}
                          className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-400/20 transition"
                        >
                          Good (7d)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRateSpacedRepetition(5)}
                          className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-400/20 transition"
                        >
                          Easy (14d)
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Carousel Controls */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handlePrevCard}
                  disabled={currentIndex === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-30 transition"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>

                <div className="text-center text-xs text-slate-400">
                  {selectedOption === null ? "Pick an option above to answer" : "Ready for next card"}
                </div>

                <button
                  type="button"
                  onClick={handleNextCard}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 transition shadow-lg shadow-cyan-500/20"
                >
                  {currentIndex === reviewCards.length - 1 ? "Finish Session" : "Next Card"}{" "}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : sessionCompleted ? (
            /* Session Completed Screen */
            <div className="my-auto py-8 text-center space-y-4">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                <Trophy className="h-8 w-8" />
              </div>
              <div>
                <h4 className="text-xl sm:text-2xl font-black text-white">Review Session Completed!</h4>
                <p className="mt-1 text-xs sm:text-sm text-slate-300">
                  You reviewed {reviewCards.length} cards with active multiple-choice recall.
                </p>
              </div>

              <div className="inline-flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
                <div>
                  <p className="text-xs text-slate-400">Accuracy Score</p>
                  <p className="text-lg font-black text-emerald-300">
                    {correctCount}/{reviewCards.length} (
                    {reviewCards.length > 0 ? Math.round((correctCount / reviewCards.length) * 100) : 0}%)
                  </p>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div>
                  <p className="text-xs text-slate-400">XP Earned</p>
                  <p className="text-lg font-black text-amber-300">+{xpEarned} XP</p>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentIndex(0);
                    setIsFlipped(false);
                    setSelectedOption(null);
                    setAnsweredCorrectly(null);
                    setSessionCompleted(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/10 transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Practice Again
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl bg-cyan-400 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-300 transition shadow-lg shadow-cyan-500/20"
                >
                  Back to Revision Pack
                </button>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              No flashcards in this deck yet. Generate a revision pack to automatically create cards!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
