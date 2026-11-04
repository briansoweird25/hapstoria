import { describe, expect, it } from "vitest";
import { handleStripeEvent, WebhookBusyError, type BillingStore } from "@/lib/stripe/webhook-handler";

function fakeStore() {
  const done = new Set<string>();
  const busy = new Set<string>();
  const calls = { premium: [] as string[], subs: [] as any[], paid: [] as string[], completed: [] as string[], failed: [] as string[] }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const orders: Record<string, { kind: string; event_id: string | null; meta: Record<string, unknown>; user_id: string }> = {
    cs_premium: { kind: "event_premium", event_id: "ev1", meta: {}, user_id: "u1" },
    cs_print: { kind: "print", event_id: "ev1", meta: {}, user_id: "u1" },
  };
  const store: BillingStore = {
    async claimEvent(id) { if (done.has(id)) return "done"; if (busy.has(id)) return "busy"; busy.add(id); return "claimed"; },
    async completeEvent(id) { busy.delete(id); done.add(id); calls.completed.push(id); },
    async failEvent(id) { busy.delete(id); calls.failed.push(id); },
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
    await expect(handleStripeEvent(session("cs_nope"), store)).rejects.toThrow("No order");
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

describe("review fixes", () => {
  it("handles delayed payment success like a paid checkout", async () => {
    const { store, calls } = fakeStore();
    const ev = { id: "evt_async", type: "checkout.session.async_payment_succeeded", data: { object: { id: "cs_premium", mode: "payment", payment_status: "paid" } } };
    expect(await handleStripeEvent(ev, store)).toBe("order_paid:event_premium");
    expect(calls.premium).toEqual(["ev1"]);
  });
  it("marks the event completed only after side effects succeed, and failed otherwise", async () => {
    const { store, calls } = fakeStore();
    await handleStripeEvent(session("cs_premium"), store);
    expect(calls.completed).toEqual(["evt_cs_premium"]);
    const failing: BillingStore = { ...store, async setEventPremium() { throw new Error("db down"); } };
    await expect(handleStripeEvent(session("cs_premium", { id: "cs_premium" }) && { ...session("cs_premium"), id: "evt_retry" }, failing)).rejects.toThrow("db down");
    expect(calls.failed).toEqual(["evt_retry"]);
  });
  it("throws a retryable error when another worker is processing the same event", async () => {
    const { store } = fakeStore();
    await store.claimEvent("evt_cs_premium", "x");
    await expect(handleStripeEvent(session("cs_premium"), store)).rejects.toBeInstanceOf(WebhookBusyError);
  });
  it("passes the Stripe event timestamp so out-of-order subscription events can be ignored", async () => {
    const { store, calls } = fakeStore();
    const obj = { id: "sub_1", customer: "cus_1", status: "active", metadata: { tier: "keeper", user_id: "u1" } };
    await handleStripeEvent({ id: "e9", type: "customer.subscription.updated", created: 1_700_000_000, data: { object: obj } } as never, store);
    expect(calls.subs[0].event_created).toBe(1_700_000_000);
  });
  it("records when a subscription ended", async () => {
    const { store, calls } = fakeStore();
    const obj = { id: "sub_1", customer: "cus_1", status: "canceled", ended_at: 1_700_000_500, metadata: { tier: "keeper", user_id: "u1" } };
    await handleStripeEvent({ id: "e10", type: "customer.subscription.deleted", created: 1_700_000_600, data: { object: obj } } as never, store);
    expect(calls.subs[0].ended_at).toBe(new Date(1_700_000_500 * 1000).toISOString());
  });
});
