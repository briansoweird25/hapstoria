import type { Tier } from "@/lib/billing";

/** Persistence port so the webhook logic is testable without Supabase or Stripe. */
export interface BillingStore {
  /** Returns false if this Stripe event id was already processed. */
  markEventProcessed(id: string, type: string): Promise<boolean>;
  markOrderPaid(sessionId: string): Promise<{ kind: string; event_id: string | null; meta: Record<string, unknown>; user_id: string } | null>;
  setEventPremium(eventId: string, paidAtIso: string): Promise<void>;
  upsertSubscription(row: {
    user_id: string; stripe_customer_id: string; stripe_subscription_id: string;
    tier: Tier; status: string; current_period_end: string | null; cancel_at_period_end: boolean;
  }): Promise<void>;
  onOrderPaid?(order: { kind: string; event_id: string | null; meta: Record<string, unknown>; user_id: string }): Promise<void>;
}

/** Minimal structural types for the Stripe objects we read (keeps the handler decoupled from the SDK). */
export interface StripeEventLike {
  id: string;
  type: string;
  data: { object: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const TIERS: Tier[] = ["keeper", "keeper_plus", "planner"];

export function tierFromMetadata(meta: Record<string, string> | null | undefined): Tier | null {
  const t = meta?.tier as Tier | undefined;
  return t && TIERS.includes(t) ? t : null;
}

const iso = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString() : null);

/** Applies one verified Stripe event. Idempotent: replays are ignored. Returns what happened. */
export async function handleStripeEvent(event: StripeEventLike, store: BillingStore, now = new Date()): Promise<string> {
  if (!(await store.markEventProcessed(event.id, event.type))) return "duplicate";
  const obj = event.data.object;

  switch (event.type) {
    case "checkout.session.completed": {
      if (obj.payment_status && obj.payment_status !== "paid" && obj.mode === "payment") return "unpaid";
      if (obj.mode === "payment") {
        const order = await store.markOrderPaid(obj.id);
        if (!order) return "unknown_order";
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
      await store.upsertSubscription({
        user_id: userId,
        stripe_customer_id: String(obj.customer),
        stripe_subscription_id: String(obj.id),
        tier,
        status: event.type === "customer.subscription.deleted" ? "canceled" : String(obj.status),
        current_period_end: iso(obj.current_period_end ?? obj.items?.data?.[0]?.current_period_end),
        cancel_at_period_end: Boolean(obj.cancel_at_period_end),
      });
      return `subscription:${tier}`;
    }
    default:
      return "ignored";
  }
}
