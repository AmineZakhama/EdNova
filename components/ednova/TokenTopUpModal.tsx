"use client";

import React, { useState } from "react";
import { TOKEN_PACKAGES, type TokenPackage } from "@/lib/ednova/token-constants";

interface TokenTopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTokens?: number;
  onTokensUpdated?: (newTokens: number) => void;
}

export function TokenTopUpModal({
  isOpen,
  onClose,
  currentTokens = 25000,
  onTokensUpdated,
}: TokenTopUpModalProps) {
  const [loadingPkgId, setLoadingPkgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleCheckout(pkg: TokenPackage) {
    setLoadingPkgId(pkg.id);
    setError(null);

    try {
      const res = await fetch("/api/ednova/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkg.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start checkout session.");
      }

      if (data.mock) {
        // Mock instant purchase in development / evaluator demo mode
        const updatedCount =
          data.newBalance !== undefined && data.newBalance > 0
            ? data.newBalance
            : currentTokens + pkg.tokens;
        if (onTokensUpdated) {
          onTokensUpdated(updatedCount);
        }
        window.location.href = data.url;
      } else if (data.url) {
        // Redirect to live Stripe Checkout
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error("Top-up checkout error:", err);
      setError(err.message || "Failed to initiate purchase. Please try again.");
    } finally {
      setLoadingPkgId(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="token-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-3xl bg-slate-900/95 border border-amber-500/30 p-6 md:p-8 shadow-2xl shadow-amber-500/10 overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow backdrop */}
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between relative z-10 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>🪙</span>
              <span>EdNova Token Treasury</span>
            </div>
            <h2 id="token-modal-title" className="text-2xl md:text-3xl font-extrabold text-white">
              Power Your Socratic Journey
            </h2>
            <p className="text-sm text-slate-300 mt-1">
              Refill tokens for Fast Mode or Deep Socratic Thinking. Never lose your study momentum.
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 hover:bg-white/15 text-slate-400 hover:text-white flex items-center justify-center text-lg transition"
          >
            ✕
          </button>
        </div>

        {/* Current Balance Bar */}
        <div className="relative z-10 flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-800/60 to-slate-800/40 border border-amber-500/25 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl shadow-inner">
              🪙
            </div>
            <div>
              <div className="text-xs uppercase font-medium text-amber-300/80 tracking-wider">Current Balance</div>
              <div className="text-2xl font-black text-amber-400">
                {currentTokens.toLocaleString()}{" "}
                <span className="text-xs font-normal text-slate-400">Tokens</span>
              </div>
            </div>
          </div>

          <div className="text-right text-xs text-slate-400 space-y-0.5">
            <div>⚡ Fast Mode: <strong className="text-slate-200">25 tokens</strong> / turn</div>
            <div>🧠 Thinking Mode: <strong className="text-slate-200">100 tokens</strong> / turn</div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10 mb-6">
          {TOKEN_PACKAGES.map((pkg) => {
            const isProcessing = loadingPkgId === pkg.id;
            const isPopular = pkg.popular;

            return (
              <div
                key={pkg.id}
                className={`relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200 ${
                  isPopular
                    ? "bg-gradient-to-b from-amber-950/40 to-slate-900 border-amber-400/60 shadow-lg shadow-amber-500/10 scale-[1.02]"
                    : "bg-slate-900/60 border-white/10 hover:border-white/20"
                }`}
              >
                {pkg.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-[11px] uppercase tracking-wider shadow">
                    {pkg.badge}
                  </div>
                )}

                <div>
                  <div className="text-lg font-bold text-white mb-1">{pkg.name}</div>
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-3xl font-extrabold text-amber-400">
                      ${(pkg.priceCents / 100).toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-400">USD</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 mb-3">
                    <div className="text-xs text-slate-400 uppercase font-medium">Token Grant</div>
                    <div className="text-xl font-black text-white">
                      +{pkg.tokens.toLocaleString()}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    {pkg.description}
                  </p>
                </div>

                <button
                  onClick={() => handleCheckout(pkg)}
                  disabled={isProcessing}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                    isPopular
                      ? "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 hover:brightness-110 shadow-md shadow-amber-500/25 cursor-pointer"
                      : "bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  } ${isProcessing ? "opacity-75 cursor-wait" : ""}`}
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      <span>Opening Stripe...</span>
                    </>
                  ) : (
                    <>
                      <span>Get {pkg.name}</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Free Ways to Earn Tokens */}
        <div className="relative z-10 p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎓</span>
            <div>
              <div className="text-sm font-semibold text-indigo-200">Want to earn free tokens?</div>
              <div className="text-xs text-slate-400">
                Complete a 5-question Quiz Gauntlet (+150 tokens) or maintain your daily study streak (+250 tokens).
              </div>
            </div>
          </div>
          <a
            href="/ednova/quiz"
            className="px-4 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 text-xs font-semibold whitespace-nowrap transition cursor-pointer"
          >
            Play Quiz Gauntlet →
          </a>
        </div>

        {/* Stripe Security Footer */}
        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500 relative z-10">
          <div className="flex items-center gap-1.5">
            <span>🔒</span>
            <span>Secured 256-bit encrypted checkout via Stripe Payments</span>
          </div>
          <div>All purchases are non-recurring, one-time student credits.</div>
        </div>
      </div>
    </div>
  );
}
