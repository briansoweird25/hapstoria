import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { handlePaymentConfirmed, PaymentBusyError, AmountMismatchError, type PaymentStore } from "@/lib/payments/handler";
import { verifyPaymongoSignature, parsePaymongoEvent, paidCentsFromSession } from "@/lib/payments/paymongo-parse";
import { buildPaypalOrder, parsePaypalCapture, paypalApprovalUrl } from "@/lib/payments/paypal-parse";

type Order = { kind: string; event_id: string | null; meta: Record<string, unknown>; user_id: string; amount_cents: number };
function fakeStore(orders: Record<string, Order>) {
  const done = new Set<string>(); const busy = new Set<string>();
  const calls = { premium: [] as string[], members: [] as unknown[], paid: [] as string[], completed: [] as string[], failed: [] as string[], onPaid: [] as string[] };
  const store: PaymentStore = {
    async claimEvent(id) { if (done.has(id)) return "done"; if (busy.has(id)) return "busy"; busy.add(id); return "claimed"; },
    async completeEvent(id) { busy.delete(id); done.add(id); calls.completed.push(id); },
    async failEvent(id) { busy.delete(id); calls.failed.push(id); },
    async findOrder(ref) { return orders[ref] ?? null; },
    async markOrderPaid(ref) { calls.paid.push(ref); return orders[ref] ?? null; },
    async setEventPremium(id) { calls.premium.push(id); },
    async extendMembership(userId, tier, days) { calls.members.push({ userId, tier, days }); },
    async onOrderPaid(o) { calls.onPaid.push(o.kind); },
  };
  return { store, calls, busy };
}
const orders = (): Record<string, Order> => ({
  cs_prem: { kind: "event_premium", event_id: "ev1", meta: {}, user_id: "u1", amount_cents: 199900 },
  cs_mem: { kind: "membership", event_id: null, meta: { tier: "keeper", interval: "year" }, user_id: "u1", amount_cents: 549000 },
  cs_tpl: { kind: "template", event_id: null, meta: { template_id: "t1", price_cents: 50000 }, user_id: "u2", amount_cents: 50000 },
});
const conf = (ref: string, paidCents: number, claimId = "paymongo:evt_" + ref) => ({ claimId, type: "test", provider: "paymongo" as const, providerRef: ref, paidCents });

describe("handlePaymentConfirmed", () => {
  it("grants premium to the event when a premium order is paid in full", async () => {
    const { store, calls } = fakeStore(orders());
    expect(await handlePaymentConfirmed(conf("cs_prem", 199900), store)).toBe("order_paid:event_premium");
    expect(calls.premium).toEqual(["ev1"]);
    expect(calls.completed).toHaveLength(1);
  });
  it("extends a membership by the purchased period", async () => {
    const { store, calls } = fakeStore(orders());
    await handlePaymentConfirmed(conf("cs_mem", 549000), store);
    expect(calls.members).toEqual([{ userId: "u1", tier: "keeper", days: 365 }]);
  });
  it("hands template orders to the order hook without granting premium", async () => {
    const { store, calls } = fakeStore(orders());
    await handlePaymentConfirmed(conf("cs_tpl", 50000), store);
    expect(calls.onPaid).toEqual(["template"]);
    expect(calls.premium).toEqual([]);
  });
  it("refuses an underpayment and does not mark the order paid", async () => {
    const { store, calls } = fakeStore(orders());
    await expect(handlePaymentConfirmed(conf("cs_prem", 100), store)).rejects.toBeInstanceOf(AmountMismatchError);
    expect(calls.paid).toEqual([]);
    expect(calls.premium).toEqual([]);
    expect(calls.failed).toHaveLength(1);
  });
  it("throws for unknown orders so the provider retries", async () => {
    const { store } = fakeStore(orders());
    await expect(handlePaymentConfirmed(conf("cs_nope", 1), store)).rejects.toThrow(/No order/);
  });
  it("is idempotent: a replay does nothing", async () => {
    const { store, calls } = fakeStore(orders());
    await handlePaymentConfirmed(conf("cs_prem", 199900), store);
    expect(await handlePaymentConfirmed(conf("cs_prem", 199900), store)).toBe("duplicate");
    expect(calls.premium).toHaveLength(1);
  });
  it("asks for a retry while another worker holds the claim", async () => {
    const { store } = fakeStore(orders());
    await store.claimEvent("paymongo:evt_cs_prem", "x");
    await expect(handlePaymentConfirmed(conf("cs_prem", 199900), store)).rejects.toBeInstanceOf(PaymentBusyError);
  });
  it("releases the claim when a side effect fails", async () => {
    const { store, calls } = fakeStore(orders());
    const failing: PaymentStore = { ...store, async setEventPremium() { throw new Error("db down"); } };
    await expect(handlePaymentConfirmed(conf("cs_prem", 199900), failing)).rejects.toThrow("db down");
    expect(calls.failed).toHaveLength(1);
  });
});

describe("verifyPaymongoSignature", () => {
  const secret = "whsk_test_secret";
  const body = JSON.stringify({ data: { id: "evt_1", attributes: { livemode: false, type: "checkout_session.payment.paid" } } });
  const sign = (t: string, b: string) => crypto.createHmac("sha256", secret).update(`${t}.${b}`).digest("hex");
  it("accepts a correct test-mode signature", () => {
    const header = `t=1700000000,te=${sign("1700000000", body)},li=`;
    expect(verifyPaymongoSignature({ header, rawBody: body, secret, livemode: false })).toBe(true);
  });
  it("accepts a correct live-mode signature only from the li field", () => {
    const header = `t=1700000000,te=,li=${sign("1700000000", body)}`;
    expect(verifyPaymongoSignature({ header, rawBody: body, secret, livemode: true })).toBe(true);
    expect(verifyPaymongoSignature({ header, rawBody: body, secret, livemode: false })).toBe(false);
  });
  it("rejects tampered bodies, wrong secrets and malformed headers", () => {
    const header = `t=1700000000,te=${sign("1700000000", body)},li=`;
    expect(verifyPaymongoSignature({ header, rawBody: body + " ", secret, livemode: false })).toBe(false);
    expect(verifyPaymongoSignature({ header, rawBody: body, secret: "other", livemode: false })).toBe(false);
    expect(verifyPaymongoSignature({ header: "garbage", rawBody: body, secret, livemode: false })).toBe(false);
    expect(verifyPaymongoSignature({ header: "", rawBody: body, secret, livemode: false })).toBe(false);
  });
});

describe("parsePaymongoEvent", () => {
  const body = { data: { id: "evt_9", type: "event", attributes: { type: "checkout_session.payment.paid", livemode: true, data: { id: "cs_abc", type: "checkout_session", attributes: {} } } } };
  it("extracts event id, type, mode and the checkout session id", () => {
    expect(parsePaymongoEvent(body)).toEqual({ eventId: "evt_9", type: "checkout_session.payment.paid", livemode: true, checkoutSessionId: "cs_abc" });
  });
  it("returns null for unexpected shapes", () => {
    expect(parsePaymongoEvent({})).toBeNull();
    expect(parsePaymongoEvent(null)).toBeNull();
  });
});

describe("paidCentsFromSession", () => {
  it("sums only paid payments", () => {
    const session = { attributes: { payments: [{ attributes: { status: "paid", amount: 100000 } }, { attributes: { status: "failed", amount: 5 } }, { attributes: { status: "paid", amount: 99900 } }] } };
    expect(paidCentsFromSession(session)).toBe(199900);
  });
  it("is 0 without payments", () => {
    expect(paidCentsFromSession({ attributes: {} })).toBe(0);
    expect(paidCentsFromSession(null)).toBe(0);
  });
});

describe("PayPal helpers", () => {
  it("builds an order in PHP with decimal amounts and return links", () => {
    const o = buildPaypalOrder({ reference: "ord_1", description: "Premium event", amountCents: 199900, returnUrl: "https://x/return", cancelUrl: "https://x/cancel" });
    expect(o.intent).toBe("CAPTURE");
    expect(o.purchase_units[0].amount).toEqual({ currency_code: "PHP", value: "1999.00" });
    expect(o.purchase_units[0].custom_id).toBe("ord_1");
    expect(JSON.stringify(o)).toContain("https://x/return");
  });
  it("finds the approval link", () => {
    expect(paypalApprovalUrl([{ rel: "self", href: "a" }, { rel: "payer-action", href: "https://paypal/approve" }])).toBe("https://paypal/approve");
    expect(paypalApprovalUrl([{ rel: "approve", href: "https://paypal/legacy" }])).toBe("https://paypal/legacy");
    expect(paypalApprovalUrl([])).toBeNull();
  });
  it("reads a completed capture and its amount", () => {
    const json = { id: "5O190", status: "COMPLETED", purchase_units: [{ payments: { captures: [{ status: "COMPLETED", amount: { currency_code: "PHP", value: "1999.00" } }] } }] };
    expect(parsePaypalCapture(json)).toEqual({ orderId: "5O190", completed: true, paidCents: 199900, currency: "PHP" });
  });
  it("is not completed for pending captures or wrong shapes", () => {
    expect(parsePaypalCapture({ id: "x", status: "COMPLETED", purchase_units: [{ payments: { captures: [{ status: "PENDING", amount: { currency_code: "PHP", value: "5.00" } }] } }] }).completed).toBe(false);
    expect(parsePaypalCapture({}).completed).toBe(false);
  });
});
