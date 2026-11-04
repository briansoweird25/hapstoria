import type { Tier } from "@/lib/billing";

/** Persistence port so the webhook logic is testable without Supabase or Stripe. */
export interface BillingStore {
  /** "claimed": this worker owns the event; "done": already processed; "busy": another worker is mid-flight. */
  claimEvent(id: string, type: string): Promise<"claimed" | "done" | "busy">;
  completeEvent(id: string): Promise<void>;
  failEvent(id: string): Promise<void>;
  markOrderPaid(sessionId: string): Promise<{ kind: string; event_id: string | null; meta: Record<string, unknown>; user_id: string } | null>;
  setEventPremium(eventId: string, paidAtIso: string): Promise<void>;
  upsertSubscription(row: {
    user_id: string; stripe_customer_id: string; stripe_subscription_id: string;
    tier: Tier; status: string; current_period_end: string | null; cancel_at_period_end: boolean;
    ended_at: string | null; event_created: number;
  }): Promise<void>;
  onOrderPaid?(order: { kind: string; event_id: string | null; meta: Record<string, unknown>; user_id: string }): Promise<void>;
}

/** Minimal structural types for the Stripe objects we read (keeps the handler decoupled from the SDK). */
export interface StripeEventLike {
  id: string;
  type: string;
  created?: number;
  data: { object: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** Thrown when another worker is still processing this event; the route answers 409 so Stripe retries later. */
export class WebhookBusyError extends Error {
  constructor(id: string) {
    super(`Stripe event ${id} is being processed`);
  }
}

const TIERS: Tier[] = ["keeper", "keeper_plus", "planner"];

export function tierFromMetadata(meta: Record<string, string> | null | undefined): Tier | null {
  const t = meta?.tier as Tier | undefined;
  return t && TIERS.includes(t) ? t : null;
}

const iso = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString() : null);

/**
 * Applies one verified Stripe event. Idempotent and crash-safe: the event is only marked done after its side
 * effects succeed; on failure it is released so Stripe's retry is processed. Returns what happened.
 */
export async function handleStripeEvent(event: StripeEventLike, store: BillingStore, now = new Date()): Promise<string> {
  const claim = await store.claimEvent(event.id, event.type);
  if (claim === "done") return "duplicate";
  if (claim === "busy") throw new WebhookBusyError(event.id);
  try {
    const result = await apply(event, store, now);
    await store.completeEvent(event.id);
    return result;
  } catch (e) {
    await store.failEvent(event.id).catch(() => undefined);
    throw e;
  }
}

async function apply(event: StripeEventLike, store: BillingStore, now: Date): Promise<string> {
  const obj = event.data.object;
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      if (obj.mode === "payment" && obj.payment_status !== "paid") return "unpaid"; // async methods: success event follows
      if (obj.mode === "payment") {
        const order = await store.markOrderPaid(obj.id);
        if (!order) throw new Error(`No order for checkout session ${obj.id}`); // retried by Stripe; never silently dropped
        if (order.kind === "event_premium" && order.event_id) await store.setEventPremium(order.event_id, now.toISOString());
        await store.onOrderPaid?.(order);
        return `order_paid:${order.kind}`;
      }
      return "subscription_checkout"; // subscription row is written by customer.subscription.* events
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const tier = tierFromMetadata(obj.metadata);
      const userId = obj.metadata?.user_id as string | undefined;
      if (!tier || !userId) return "ignored_subscription";
      const deleted = event.type === "customer.subscription.deleted";
      await store.upsertSubscription({
        user_id: userId,
        stripe_customer_id: String(obj.customer),
        stripe_subscription_id: String(obj.id),
        tier,
        status: deleted ? "canceled" : String(obj.status),
        current_period_end: iso(obj.current_period_end ?? obj.items?.data?.[0]?.current_period_end),
        cancel_at_period_end: Boolean(obj.cancel_at_period_end),
        ended_at: deleted || obj.status === "canceled" ? iso(obj.ended_at ?? obj.canceled_at) ?? now.toISOString() : null,
        event_created: event.created ?? Math.floor(now.getTime() / 1000),
      });
      return `subscription:${tier}`;
    }
    default:
      return "ignored";
  }
}
