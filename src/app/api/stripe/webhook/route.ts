import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { createSupabaseBillingStore } from "@/lib/stripe/store";
import { handleStripeEvent, WebhookBusyError } from "@/lib/stripe/webhook-handler";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "Not configured" }, { status: 400 });

  const body = await request.text(); // raw body is required for signature verification
  let event;
  try {
    event = await getStripe().webhooks.constructEventAsync(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  try {
    const result = await handleStripeEvent(event as never, createSupabaseBillingStore());
    return NextResponse.json({ received: true, result });
  } catch (e) {
    // A non-2xx makes Stripe retry. The handler already released the event claim, so the retry is processed.
    if (e instanceof WebhookBusyError) return NextResponse.json({ error: "In progress" }, { status: 409 });
    console.error("stripe webhook failed", event.type, e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}
