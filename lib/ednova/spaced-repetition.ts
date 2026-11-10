// Spaced-repetition flashcard tracker – client-side SM-2 algorithm
// All data is stored in localStorage (privacy-by-design, no database).

const DECKS_KEY = "ednova-flashcard-deck-v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FlashcardDeck = {
  id: string;
  topic: string;
  createdAt: string;
  cards: FlashcardWithSchedule[];
};

export type FlashcardWithSchedule = {
  id: string;
  front: string;
  back: string;
  options?: string[];
  correctOptionIndex?: number;
  interval: number;       // days until next review
  easeFactor: number;     // starts at 2.5
  repetitions: number;    // how many times successfully reviewed
  nextReviewDate: string; // ISO date string (YYYY-MM-DD)
  lastReviewDate?: string;
};

export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;
// 0 = complete blackout, 1 = wrong, 2 = wrong but remembered after seeing,
// 3 = correct with difficulty, 4 = correct, 5 = easy

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

export function loadDecks(): FlashcardDeck[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DECKS_KEY);
    return raw ? (JSON.parse(raw) as FlashcardDeck[]).filter(isDeck) : [];
  } catch {
    return [];
  }
}

export function saveDeck(deck: FlashcardDeck): void {
  if (typeof window === "undefined") return;
  const decks = loadDecks();
  const index = decks.findIndex((d) => d.id === deck.id);
  if (index >= 0) {
    decks[index] = deck;
  } else {
    decks.unshift(deck);
  }
  window.localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
}

export function deleteDeck(deckId: string): void {
  if (typeof window === "undefined") return;
  const decks = loadDecks().filter((d) => d.id !== deckId);
  window.localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
}

// ---------------------------------------------------------------------------
// Deck creation
// ---------------------------------------------------------------------------

export function createDeckFromRevision(
  topic: string,
  cards: Array<{ front: string; back: string; options?: string[]; correctOptionIndex?: number }>,
): FlashcardDeck {
  const today = todayKey();
  const deck: FlashcardDeck = {
    id: crypto.randomUUID(),
    topic,
    createdAt: new Date().toISOString(),
    cards: cards.map((c) => ({
      id: crypto.randomUUID(),
      front: c.front,
      back: c.back,
      options: c.options && c.options.length >= 2 ? c.options : generateFallbackOptions(c.back),
      correctOptionIndex: typeof c.correctOptionIndex === "number" ? c.correctOptionIndex : 0,
      interval: 0,
      easeFactor: 2.5,
      repetitions: 0,
      nextReviewDate: today,
    })),
  };
  saveDeck(deck);
  return deck;
}

export function generateFallbackOptions(correctAnswer: string): string[] {
  const shortAnswer = correctAnswer.length > 80 ? correctAnswer.slice(0, 77) + "..." : correctAnswer;
  return [
    shortAnswer,
    "Inverts the biological gradient or decreases reaction efficiency",
    "Only occurs under strict anaerobic starvation conditions",
    "Acts as an uncompetitive inhibitor preventing synthesis",
  ];
}

// ---------------------------------------------------------------------------
// Due-card queries
// ---------------------------------------------------------------------------

export function getDueCards(deck: FlashcardDeck): FlashcardWithSchedule[] {
  const today = todayKey();
  return deck.cards.filter((c) => c.nextReviewDate <= today);
}

export function getTotalDueCount(): number {
  const today = todayKey();
  return loadDecks().reduce(
    (total, deck) => total + deck.cards.filter((c) => c.nextReviewDate <= today).length,
    0,
  );
}

// ---------------------------------------------------------------------------
// Review (SM-2)
// ---------------------------------------------------------------------------

export function reviewCard(
  deckId: string,
  cardId: string,
  quality: ReviewQuality,
): FlashcardWithSchedule {
  const decks = loadDecks();
  const deck = decks.find((d) => d.id === deckId);
  if (!deck) throw new Error(`Deck ${deckId} not found`);
  const card = deck.cards.find((c) => c.id === cardId);
  if (!card) throw new Error(`Card ${cardId} not found in deck ${deckId}`);

  const updates = calculateNextReview(card, quality);
  Object.assign(card, updates);

  saveDeck(deck);
  return card;
}

function calculateNextReview(
  card: FlashcardWithSchedule,
  quality: ReviewQuality,
): Pick<FlashcardWithSchedule, "interval" | "easeFactor" | "repetitions" | "nextReviewDate" | "lastReviewDate"> {
  const today = todayKey();

  // Update ease factor (always applied)
  let easeFactor = card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easeFactor = Math.max(1.3, easeFactor);

  let repetitions: number;
  let interval: number;

  if (quality < 3) {
    // Failed – reset
    repetitions = 0;
    interval = 1;
  } else {
    repetitions = card.repetitions + 1;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(card.interval * easeFactor);
    }
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);

  return {
    interval,
    easeFactor,
    repetitions,
    nextReviewDate: dateKey(nextDate),
    lastReviewDate: today,
  };
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export function getDeckStats(deck: FlashcardDeck): {
  total: number;
  dueToday: number;
  mastered: number;
  learning: number;
  averageEase: number;
  nextDueDate: string | null;
} {
  const today = todayKey();
  const total = deck.cards.length;
  const dueToday = deck.cards.filter((c) => c.nextReviewDate <= today).length;
  const mastered = deck.cards.filter((c) => c.interval >= 21).length;
  const learning = total - mastered;
  const averageEase = total > 0
    ? Math.round((deck.cards.reduce((s, c) => s + c.easeFactor, 0) / total) * 100) / 100
    : 2.5;

  const futureDates = deck.cards
    .map((c) => c.nextReviewDate)
    .filter((d) => d > today)
    .sort();
  const nextDueDate = futureDates.length > 0 ? futureDates[0] : null;

  return { total, dueToday, mastered, learning, averageEase, nextDueDate };
}

// ---------------------------------------------------------------------------
// Demo seed
// ---------------------------------------------------------------------------

export function seedDemoFlashcards(): void {
  if (typeof window === "undefined") return;
  const existing = loadDecks();
  if (existing.length > 0) return; // Don't overwrite user data

  const today = todayKey();
  const yesterday = dateKey(new Date(Date.now() - 24 * 60 * 60_000));

  const futureDateA = dateKey(new Date(Date.now() + 3 * 24 * 60 * 60_000));
  const futureDateB = dateKey(new Date(Date.now() + 14 * 24 * 60 * 60_000));

  const demoDeck: FlashcardDeck = {
    id: "demo-deck-cell-biology",
    topic: "Cell Biology",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString(),
    cards: [
      {
        id: "demo-card-1",
        front: "What is the powerhouse of the cell?",
        back: "The mitochondria – it produces ATP through cellular respiration (oxidative phosphorylation).",
        options: [
          "The mitochondria (ATP synthesis via respiration)",
          "The ribosome (protein translation)",
          "The nucleus (DNA storage and transcription)",
          "The chloroplast (photosynthetic carbon fixation)"
        ],
        correctOptionIndex: 0,
        interval: 21,
        easeFactor: 2.6,
        repetitions: 4,
        nextReviewDate: futureDateB,
        lastReviewDate: yesterday,
      },
      {
        id: "demo-card-2",
        front: "What is the function of the cell membrane?",
        back: "It is a selectively permeable phospholipid bilayer that controls what enters and exits the cell, maintaining homeostasis.",
        options: [
          "Selectively permeable bilayer regulating transport and homeostasis",
          "Rigid cellulose wall that permanently prevents cell expansion",
          "Nuclear pore complex dedicated strictly to RNA export",
          "Extracellular matrix providing solely mechanical adhesion"
        ],
        correctOptionIndex: 0,
        interval: 6,
        easeFactor: 2.5,
        repetitions: 2,
        nextReviewDate: futureDateA,
        lastReviewDate: yesterday,
      },
      {
        id: "demo-card-3",
        front: "What is the difference between rough and smooth endoplasmic reticulum?",
        back: "Rough ER has ribosomes on its surface and synthesises proteins. Smooth ER lacks ribosomes and synthesises lipids and detoxifies chemicals.",
        options: [
          "Rough ER synthesises proteins (has ribosomes); Smooth ER synthesises lipids",
          "Rough ER produces ATP; Smooth ER stores genetic chromatin",
          "Rough ER is found only in prokaryotes; Smooth ER only in eukaryotes",
          "Rough ER degrades lysosomes; Smooth ER facilitates flagellar movement"
        ],
        correctOptionIndex: 0,
        interval: 1,
        easeFactor: 2.3,
        repetitions: 1,
        nextReviewDate: today, // due today
        lastReviewDate: yesterday,
      },
      {
        id: "demo-card-4",
        front: "What are the stages of mitosis in sequential order?",
        back: "Prophase → Metaphase → Anaphase → Telophase (PMAT). Cytokinesis follows to divide the cytoplasm.",
        options: [
          "Prophase → Metaphase → Anaphase → Telophase (PMAT)",
          "Metaphase → Prophase → Telophase → Anaphase",
          "Interphase → Cytokinesis → Metaphase → Telophase",
          "Anaphase → Telophase → Prophase → Metaphase"
        ],
        correctOptionIndex: 0,
        interval: 0,
        easeFactor: 2.5,
        repetitions: 0,
        nextReviewDate: today, // new, due today
      },
      {
        id: "demo-card-5",
        front: "What is the primary role of the Golgi apparatus?",
        back: "It modifies, sorts, and packages proteins and lipids for secretion or delivery to other organelles.",
        options: [
          "Modifies, sorts, and packages proteins & lipids for transport",
          "Translates mRNA transcripts directly into polypeptide chains",
          "Synthesises ribosomal RNA in the nucleolus",
          "Generates electrochemical proton gradients across cristae"
        ],
        correctOptionIndex: 0,
        interval: 0,
        easeFactor: 2.5,
        repetitions: 0,
        nextReviewDate: today, // new, due today
      },
    ],
  };

  saveDeck(demoDeck);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayKey(): string {
  return dateKey(new Date());
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isDeck(value: unknown): value is FlashcardDeck {
  if (!value || typeof value !== "object") return false;
  const deck = value as Partial<FlashcardDeck>;
  return typeof deck.id === "string" && typeof deck.topic === "string" && Array.isArray(deck.cards);
}
