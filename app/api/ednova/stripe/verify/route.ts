import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/ednova/auth";
import { stripe, awardTokens } from "@/lib/ednova/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { sessionId, tokens, pack, mock } = body;

    // 1. Instant fulfillment for mock/demo checkout
    if (mock || !sessionId || sessionId.includes("mock")) {
      const tokenCount = Number(tokens) || 100_000;
      const res = await awardTokens(
        user.id,
        tokenCount,
        "PURCHASE",
        `Top-Up: ${pack || "Study Pack"} (+${tokenCount.toLocaleString()} tokens)`,
        undefined,
        user.email
      );
      return NextResponse.json({ success: true, tokens: res.newBalance });
    }

    // 2. Real Stripe session verification
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid" || session.status === "complete") {
        const tokensCount = parseInt(session.metadata?.tokensCount || String(tokens || 100_000), 10);
        const packageId = session.metadata?.packageId || pack || "custom";

        const res = await awardTokens(
          user.id,
          tokensCount,
          "PURCHASE",
          `Stripe Checkout: ${packageId} (+${tokensCount.toLocaleString()} tokens)`,
          session.id,
          user.email
        );
        return NextResponse.json({ success: true, tokens: res.newBalance });
      } else {
        return NextResponse.json({ success: false, message: "Payment pending or incomplete" });
      }
    } catch (stripeErr: any) {
      console.warn("Could not retrieve Stripe session, fulfilling with fallback:", stripeErr?.message);
      const tokenCount = Number(tokens) || 100_000;
      const res = await awardTokens(
        user.id,
        tokenCount,
        "PURCHASE",
        `Checkout Return: ${pack || "Token Pack"} (+${tokenCount.toLocaleString()} tokens)`,
        sessionId,
        user.email
      );
      return NextResponse.json({ success: true, tokens: res.newBalance });
    }
  } catch (err: any) {
    console.error("Stripe verify route error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
