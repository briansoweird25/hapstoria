import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { createSupabaseBillingStore } from "@/lib/stripe/store";
import { handleStripeEvent } from "@/lib/stripe/webhook-handler";

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
    // The event id is recorded before handling (idempotency); remove it so Stripe's retry (on 500) is processed.
    await createAdminClient().from("stripe_events").delete().eq("id", event.id);
    console.error("stripe webhook failed", event.type, e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}
