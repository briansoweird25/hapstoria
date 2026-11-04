import { describe, expect, it } from "vitest";
import { handleStripeEvent, type BillingStore } from "@/lib/stripe/webhook-handler";

function fakeStore() {
  const seen = new Set<string>();
  const calls = { premium: [] as string[], subs: [] as any[], paid: [] as string[] }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const orders: Record<string, { kind: string; event_id: string | null; meta: Record<string, unknown>; user_id: string }> = {
    cs_premium: { kind: "event_premium", event_id: "ev1", meta: {}, user_id: "u1" },
    cs_print: { kind: "print", event_id: "ev1", meta: {}, user_id: "u1" },
  };
  const store: BillingStore = {
    async markEventProcessed(id) { if (seen.has(id)) return false; seen.add(id); return true; },
    async markOrderPaid(s) { calls.paid.push(s); return orders[s] ?? null; },
    async setEventPremium(id) { calls.premium.push(id); },
    async upsertSubscription(row) { calls.subs.push(row); },
  };
  return { store, calls };
}

const session = (id: string, over: Record<string, unknown> = {}) => ({
  id: "evt_" + id, type: "checkout.session.completed",
  data: { object: { id, mode: "payment", payment_status: "paid", ...over } },
});

describe("handleStripeEvent", () => {
  it("marks the event premium when a premium order is paid", async () => {
    const { store, calls } = fakeStore();
    expect(await handleStripeEvent(session("cs_premium"), store)).toBe("order_paid:event_premium");
    expect(calls.premium).toEqual(["ev1"]);
  });
  it("does not grant premium for other order kinds", async () => {
    const { store, calls } = fakeStore();
    expect(await handleStripeEvent(session("cs_print"), store)).toBe("order_paid:print");
    expect(calls.premium).toEqual([]);
  });
  it("is idempotent for replayed events", async () => {
    const { store, calls } = fakeStore();
    await handleStripeEvent(session("cs_premium"), store);
    expect(await handleStripeEvent(session("cs_premium"), store)).toBe("duplicate");
    expect(calls.premium).toHaveLength(1);
  });
  it("ignores unpaid sessions and unknown orders", async () => {
    const { store, calls } = fakeStore();
    expect(await handleStripeEvent(session("cs_premium", { payment_status: "unpaid" }), store)).toBe("unpaid");
    expect(await handleStripeEvent(session("cs_nope"), store)).toBe("unknown_order");
    expect(calls.premium).toEqual([]);
  });
  it("upserts subscriptions from metadata, and marks deleted ones canceled", async () => {
    const { store, calls } = fakeStore();
    const base = { id: "sub_1", customer: "cus_1", status: "active", current_period_end: 1_800_000_000, cancel_at_period_end: false, metadata: { tier: "keeper", user_id: "u1" } };
    await handleStripeEvent({ id: "e1", type: "customer.subscription.created", data: { object: base } }, store);
    await handleStripeEvent({ id: "e2", type: "customer.subscription.deleted", data: { object: base } }, store);
    expect(calls.subs[0]).toMatchObject({ tier: "keeper", status: "active", user_id: "u1" });
    expect(calls.subs[1].status).toBe("canceled");
  });
  it("ignores subscriptions without our metadata", async () => {
    const { store, calls } = fakeStore();
    const r = await handleStripeEvent({ id: "e3", type: "customer.subscription.updated", data: { object: { id: "s", customer: "c", status: "active", metadata: {} } } }, store);
    expect(r).toBe("ignored_subscription");
    expect(calls.subs).toHaveLength(0);
  });
  it("rejects tiers we don't sell", async () => {
    const { store } = fakeStore();
    const r = await handleStripeEvent({ id: "e4", type: "customer.subscription.created", data: { object: { id: "s", customer: "c", status: "active", metadata: { tier: "gold", user_id: "u" } } } }, store);
    expect(r).toBe("ignored_subscription");
  });
});
