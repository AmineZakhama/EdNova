// ---------------------------------------------------------------------------
// EdNova Token Economy – Client-Safe Constants & Types
// Zero Node.js / database / Stripe dependencies so this can safely bundle in the browser.
// ---------------------------------------------------------------------------

export const TOKEN_COST_FAST = 25; // 25 tokens per Fast query (qwen2.5-3b)
export const TOKEN_COST_THINKING = 100; // 100 tokens per Thinking query (llama3.1-8b)
export const TOKEN_REWARD_QUIZ_STREAK = 150; // Bonus tokens for quiz streak
export const TOKEN_REWARD_FOCUS_SESSION = 250; // Bonus tokens for completing 25-min study timer

export interface TokenPackage {
  id: string;
  name: string;
  tokens: number;
  priceCents: number;
  popular?: boolean;
  badge?: string;
  description: string;
}

export const TOKEN_PACKAGES: TokenPackage[] = [
  {
    id: "scholar_pack",
    name: "Scholar Pack",
    tokens: 100_000,
    priceCents: 299, // $2.99
    description: "Great for quick homework checks, hints, and flashcards (~4,000 Fast queries)",
  },
  {
    id: "honors_pack",
    name: "Honors Pack",
    tokens: 300_000,
    priceCents: 699, // $6.99
    popular: true,
    badge: "Most Popular",
    description: "Ideal for semester-long study, deep reasoning & active recall (~12,000 Fast / ~3,000 Thinking)",
  },
  {
    id: "genius_pack",
    name: "Genius Pack",
    tokens: 1_000_000,
    priceCents: 1499, // $14.99
    badge: "Best Value",
    description: "Full mastery gauntlet, textbook RAG indexing & unlimited practice (~40,000 Fast / ~10,000 Thinking)",
  },
];
