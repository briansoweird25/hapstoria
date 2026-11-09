import { membershipDays, type Interval, type Tier } from "@/lib/billing";

export interface OrderRow {
  kind: string;
  event_id: string | null;
  meta: Record<string, unknown>;
  user_id: string;
  amount_cents: number;
}

/** Persistence port so confirmation logic is testable without Supabase or any payment provider. */
export interface PaymentStore {
  /** "claimed": this worker owns it; "done": already processed; "busy": another worker is mid-flight. */
  claimEvent(id: string, type: string): Promise<"claimed" | "done" | "busy">;
  completeEvent(id: string): Promise<void>;
  failEvent(id: string): Promise<void>;
  findOrder(providerRef: string): Promise<OrderRow | null>;
  markOrderPaid(providerRef: string): Promise<OrderRow | null>;
  setEventPremium(eventId: string, paidAtIso: string): Promise<void>;
  extendMembership(userId: string, tier: Tier, days: number): Promise<void>;
  onOrderPaid?(order: OrderRow): Promise<void>;
}

export interface PaymentConfirmation {
  /** Idempotency key, e.g. "paymongo:evt_123" or "paypal:ORDERID". */
  claimId: string;
  type: string;
  provider: "paymongo" | "paypal";
  /** The provider's checkout/order id that we stored on our order row. */
  providerRef: string;
  /** What the provider says was actually paid (centavos), verified by the caller with the provider. */
  paidCents: number;
}

/** Thrown when another worker is processing the same payment; callers answer "retry later". */
export class PaymentBusyError extends Error {
  constructor(id: string) {
    super(`Payment ${id} is being processed`);
  }
}

/** The customer paid less than the order costs: never grant anything. */
export class AmountMismatchError extends Error {
  constructor(ref: string, paid: number, expected: number) {
    super(`Order ${ref}: paid ${paid} but expected ${expected}`);
  }
}

/**
 * Applies one provider-confirmed payment. Idempotent and crash-safe: the claim is only marked done after the
 * side effects succeed; on failure it is released so the provider's retry is processed.
 */
export async function handlePaymentConfirmed(c: PaymentConfirmation, store: PaymentStore, now = new Date()): Promise<string> {
  const claim = await store.claimEvent(c.claimId, c.type);
  if (claim === "done") return "duplicate";
  if (claim === "busy") throw new PaymentBusyError(c.claimId);
  try {
    const order = await store.findOrder(c.providerRef);
    if (!order) throw new Error(`No order for ${c.provider} reference ${c.providerRef}`); // retried; never silently dropped
    if (c.paidCents < order.amount_cents) throw new AmountMismatchError(c.providerRef, c.paidCents, order.amount_cents);

    const paid = (await store.markOrderPaid(c.providerRef)) ?? order;
    if (paid.kind === "event_premium" && paid.event_id) await store.setEventPremium(paid.event_id, now.toISOString());
    if (paid.kind === "membership") {
      const tier = paid.meta?.tier as Tier | undefined;
      const interval = (paid.meta?.interval as Interval | undefined) ?? "month";
      if (!tier) throw new Error(`Membership order ${c.providerRef} has no tier`);
      await store.extendMembership(paid.user_id, tier, membershipDays(interval));
    }
    await store.onOrderPaid?.(paid);
    await store.completeEvent(c.claimId);
    return `order_paid:${paid.kind}`;
  } catch (e) {
    await store.failEvent(c.claimId).catch(() => undefined);
    throw e;
  }
}
