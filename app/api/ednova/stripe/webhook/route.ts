import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, awardTokens } from "@/lib/ednova/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else {
      // In dev or test environments without signature verification configured
      event = JSON.parse(rawBody) as Stripe.Event;
    }
  } catch (err: any) {
    console.error("Stripe Webhook signature error:", err.message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err.message}` },
      { status: 400 }
    );
  }

  // Handle successful checkout
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId || session.client_reference_id;
    const tokensCount = parseInt(session.metadata?.tokensCount || "0", 10);
    const packageId = session.metadata?.packageId || "token_pack";
    const sessionId = session.id;

    if (userId && tokensCount > 0) {
      try {
        await awardTokens(
          userId,
          tokensCount,
          "PURCHASE",
          `Stripe Checkout: ${packageId} (+${tokensCount.toLocaleString()} tokens)`,
          sessionId
        );
        console.log(`Successfully credited ${tokensCount} tokens to user ${userId} (Session: ${sessionId})`);
      } catch (awardErr) {
        console.error("Failed to credit tokens for completed checkout session:", awardErr);
        return NextResponse.json({ error: "Failed to credit tokens" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
