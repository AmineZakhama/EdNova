import Stripe from "stripe";
import { db, isDatabaseAvailable } from "@/lib/ednova/db";

// Re-export client-safe token constants and types
export * from "@/lib/ednova/token-constants";

// ---------------------------------------------------------------------------
// Stripe Client Configuration
// ---------------------------------------------------------------------------

export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_test_ednova_mock_secret_key_2026",
  {
    apiVersion: "2025-02-24.acacia" as any,
  }
);

// ---------------------------------------------------------------------------
// Database Token Deduction & Balance Checking
// ---------------------------------------------------------------------------

export type TokenCheckResult = {
  allowed: boolean;
  balance: number;
  cost: number;
  error?: string;
};

export async function checkAndDeductTokens(
  userId: string,
  cost: number,
  type: "USAGE_FAST" | "USAGE_THINKING",
  userEmail?: string
): Promise<TokenCheckResult> {
  const hasDb = await isDatabaseAvailable();
  if (!hasDb) {
    // If DB is offline / in-memory demo, default allow
    return { allowed: true, balance: 25000, cost };
  }

  try {
    let user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, tokens: true },
    });

    if (!user && userEmail) {
      user = await db.user.findUnique({
        where: { email: userEmail },
        select: { id: true, tokens: true },
      });
    }

    if (!user) {
      return { allowed: true, balance: 25000, cost };
    }

    if (user.tokens < cost) {
      return {
        allowed: false,
        balance: user.tokens,
        cost,
        error: "Insufficient tokens. Please top up your balance or switch to Fast Mode.",
      };
    }

    // Deduct and log transaction atomically
    const newBalance = user.tokens - cost;
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { tokens: newBalance },
      }),
      db.tokenTransaction.create({
        data: {
          userId: user.id,
          amount: -cost,
          type,
          description: `${type === "USAGE_FAST" ? "Fast Mode" : "Thinking Mode"} Socratic inference (-${cost} tokens)`,
        },
      }),
    ]);

    return { allowed: true, balance: newBalance, cost };
  } catch (error) {
    console.error("Token deduction failed:", error);
    // Allow gracefully if unexpected DB issue
    return { allowed: true, balance: 25000, cost };
  }
}

// ---------------------------------------------------------------------------
// Award Free Tokens (Gamification & Streaks)
// ---------------------------------------------------------------------------

export async function awardTokens(
  userId: string,
  amount: number,
  type: "STREAK_REWARD" | "FOCUS_REWARD" | "SIGNUP_GRANT" | "PURCHASE",
  description: string,
  stripeSessionId?: string,
  userEmail?: string
): Promise<{ success: boolean; newBalance: number }> {
  const hasDb = await isDatabaseAvailable();
  if (!hasDb) return { success: true, newBalance: 25000 + amount };

  try {
    // 1. Locate user in DB by id or email
    let user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, tokens: true },
    });

    if (!user && userEmail) {
      user = await db.user.findUnique({
        where: { email: userEmail },
        select: { id: true, tokens: true },
      });
    }

    // If user does not exist in DB yet, create user with initial balance + grant
    if (!user) {
      const created = await db.user.create({
        data: {
          id: userId,
          email: userEmail || `${userId}@ednova.local`,
          name: "Learner",
          avatar: "🎓",
          role: "STUDENT",
          passwordHash: "session-managed",
          tokens: 25000 + amount,
        },
        select: { id: true, tokens: true },
      });
      user = created;

      await db.tokenTransaction.create({
        data: {
          userId: user.id,
          amount,
          type,
          stripeSessionId,
          description,
        },
      });

      return { success: true, newBalance: user.tokens };
    }

    // 2. If stripeSessionId is provided, check for idempotency
    if (stripeSessionId) {
      const existing = await db.tokenTransaction.findUnique({
        where: { stripeSessionId },
      });
      if (existing) {
        return { success: true, newBalance: user.tokens };
      }
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: { tokens: { increment: amount } },
      select: { tokens: true },
    });

    await db.tokenTransaction.create({
      data: {
        userId: user.id,
        amount,
        type,
        stripeSessionId,
        description,
      },
    });

    return { success: true, newBalance: updated.tokens };
  } catch (error) {
    console.error("awardTokens error:", error);
    return { success: false, newBalance: 0 };
  }
}
