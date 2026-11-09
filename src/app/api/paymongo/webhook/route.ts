import { NextResponse } from "next/server";
import { AmountMismatchError, handlePaymentConfirmed, PaymentBusyError } from "@/lib/payments/handler";
import { getPaymongoCheckout } from "@/lib/payments/paymongo";
import { parsePaymongoEvent, paidCentsFromSession, verifyPaymongoSignature } from "@/lib/payments/paymongo-parse";
import { createSupabasePaymentStore } from "@/lib/payments/store";

/** PayMongo webhook: verify signature, re-fetch the session from PayMongo, check the amount, then grant. */
export async function POST(request: Request) {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  const header = request.headers.get("paymongo-signature");
  if (!secret || !header) return NextResponse.json({ error: "Not configured" }, { status: 400 });

  const raw = await request.text(); // the signature covers the exact raw body
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const event = parsePaymongoEvent(body);
  if (!event || !verifyPaymongoSignature({ header, rawBody: raw, secret, livemode: event.livemode })) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (event.type !== "checkout_session.payment.paid" || !event.checkoutSessionId) {
    return NextResponse.json({ received: true, result: "ignored" });
  }
  try {
    const session = await getPaymongoCheckout(event.checkoutSessionId);
    const result = await handlePaymentConfirmed(
      { claimId: `paymongo:${event.eventId}`, type: event.type, provider: "paymongo", providerRef: event.checkoutSessionId, paidCents: paidCentsFromSession(session) },
      createSupabasePaymentStore(),
    );
    return NextResponse.json({ received: true, result });
  } catch (e) {
    if (e instanceof PaymentBusyError) return NextResponse.json({ error: "In progress" }, { status: 409 });
    console.error("paymongo webhook failed", event.type, e instanceof AmountMismatchError ? e.message : e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 }); // PayMongo retries on non-2xx
  }
}
