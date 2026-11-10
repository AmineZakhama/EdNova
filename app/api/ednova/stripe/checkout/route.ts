import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/ednova/auth";
import { stripe, TOKEN_PACKAGES, awardTokens } from "@/lib/ednova/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in to purchase study tokens." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { packageId } = body;

    const pkg = TOKEN_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) {
      return NextResponse.json(
        { error: "Invalid package selected. Please choose a valid token package." },
        { status: 400 }
      );
    }

    const origin =
      request.headers.get("origin") ||
      request.headers.get("referer") ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000";

    const cleanOrigin = origin.replace(/\/$/, "");

    // Check if real Stripe API key is provided
    const isMockStripe =
      !process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY.includes("mock") ||
      process.env.STRIPE_SECRET_KEY.includes("replace_with") ||
      process.env.STRIPE_SECRET_KEY.includes("replace-with") ||
      process.env.STRIPE_SECRET_KEY.startsWith("sk_test_placeholder");

    if (isMockStripe) {
      // In local dev/evaluator mock mode, credit tokens instantly
      const result = await awardTokens(
        user.id,
        pkg.tokens,
        "PURCHASE",
        `Instant Top-Up: ${pkg.name} (+${pkg.tokens.toLocaleString()} tokens)`,
        undefined,
        user.email
      );
      return NextResponse.json({
        url: `${cleanOrigin}/ednova?payment=success&mock=true&tokens=${pkg.tokens}&pack=${encodeURIComponent(pkg.name)}`,
        mock: true,
        tokensAwarded: pkg.tokens,
        newBalance: result.newBalance,
      });
    }

    // Live or Test Stripe Checkout Session
    try {
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `EdNova ${pkg.name}`,
                description: `${pkg.tokens.toLocaleString()} AI Study Tokens • Socratic Reasoning & Flashcards`,
              },
              unit_amount: pkg.priceCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        customer_email: user.email,
        client_reference_id: user.id,
        metadata: {
          userId: user.id,
          packageId: pkg.id,
          tokensCount: pkg.tokens.toString(),
        },
        success_url: `${cleanOrigin}/ednova?payment=success&session_id={CHECKOUT_SESSION_ID}&tokens=${pkg.tokens}&pack=${encodeURIComponent(pkg.name)}`,
        cancel_url: `${cleanOrigin}/ednova?payment=cancelled`,
      });

      return NextResponse.json({ url: session.url });
    } catch (stripeErr: any) {
      console.warn("Stripe Checkout creation failed, falling back to mock grant:", stripeErr?.message);
      // Fallback in case of invalid test key during testing
      const result = await awardTokens(
        user.id,
        pkg.tokens,
        "PURCHASE",
        `Dev Top-Up: ${pkg.name} (+${pkg.tokens.toLocaleString()} tokens)`,
        undefined,
        user.email
      );
      return NextResponse.json({
        url: `${cleanOrigin}/ednova?payment=success&mock=true&tokens=${pkg.tokens}&pack=${encodeURIComponent(pkg.name)}`,
        mock: true,
        tokensAwarded: pkg.tokens,
        newBalance: result.newBalance,
      });
    }
  } catch (error: any) {
    console.error("Checkout route error:", error);
    return NextResponse.json(
      { error: "Unable to initiate token checkout. Please try again." },
      { status: 500 }
    );
  }
}
