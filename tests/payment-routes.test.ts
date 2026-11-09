import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

// In-memory stand-in for the payment store: one premium order that costs 199900 centavos.
const state = { premium: [] as string[], paid: [] as string[], done: new Set<string>(), busy: new Set<string>() };
const order = { kind: "event_premium", event_id: "ev1", meta: { success_path: "/dashboard/events/ev1", cancel_path: "/dashboard/billing" }, user_id: "u1", amount_cents: 199900 };
vi.mock("@/lib/payments/store", () => ({
  createSupabasePaymentStore: () => ({
    async claimEvent(id: string) { if (state.done.has(id)) return "done"; if (state.busy.has(id)) return "busy"; state.busy.add(id); return "claimed"; },
    async completeEvent(id: string) { state.busy.delete(id); state.done.add(id); },
    async failEvent(id: string) { state.busy.delete(id); },
    async findOrder(ref: string) { return ref === "cs_ok" || ref === "PP1" ? order : null; },
    async markOrderPaid(ref: string) { state.paid.push(ref); return order; },
    async setEventPremium(id: string) { state.premium.push(id); },
    async extendMembership() {},
  }),
}));

// PayPal return route reads our order row through the admin client.
let paypalOrderRow: Record<string, unknown> | null = null;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: paypalOrderRow }) }) }) }) }),
}));

const fetchMock = vi.fn();
const secret = "whsk_secret";
const sign = (t: string, body: string) => crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
const webhookRequest = (body: object, sigOverride?: string) => {
  const raw = JSON.stringify(body);
  const header = sigOverride ?? `t=1700000000,te=${sign("1700000000", raw)},li=`;
  return new Request("https://hapstoria.example/api/paymongo/webhook", { method: "POST", body: raw, headers: { "paymongo-signature": header } });
};
const paidEvent = (id = "evt_1", session = "cs_ok") => ({
  data: { id, type: "event", attributes: { type: "checkout_session.payment.paid", livemode: false, data: { id: session, type: "checkout_session", attributes: {} } } },
});
const sessionWithPayment = (amount: number) => ({ ok: true, status: 200, json: async () => ({ data: { id: "cs_ok", attributes: { payments: [{ attributes: { status: "paid", amount } }] } } }) });

beforeEach(() => {
  state.premium = []; state.paid = []; state.done = new Set(); state.busy = new Set();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("PAYMONGO_WEBHOOK_SECRET", secret);
  vi.stubEnv("PAYMONGO_SECRET_KEY", "sk_test");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://hapstoria.example");
  vi.stubEnv("PAYPAL_CLIENT_ID", "pid");
  vi.stubEnv("PAYPAL_CLIENT_SECRET", "psecret");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("PayMongo webhook", () => {
  it("rejects a bad signature without touching anything", async () => {
    const { POST } = await import("@/app/api/paymongo/webhook/route");
    const res = await POST(webhookRequest(paidEvent(), "t=1,te=deadbeef,li="));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.premium).toEqual([]);
  });

  it("acknowledges and ignores other event types", async () => {
    const { POST } = await import("@/app/api/paymongo/webhook/route");
    const body = { data: { id: "evt_2", type: "event", attributes: { type: "payment.failed", livemode: false, data: { id: "x" } } } };
    const res = await POST(webhookRequest(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ result: "ignored" });
    expect(state.premium).toEqual([]);
  });

  it("grants premium after re-checking the session with PayMongo and the amount paid", async () => {
    const { POST } = await import("@/app/api/paymongo/webhook/route");
    fetchMock.mockResolvedValueOnce(sessionWithPayment(199900));
    const res = await POST(webhookRequest(paidEvent()));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ result: "order_paid:event_premium" });
    expect(state.premium).toEqual(["ev1"]);
    expect(fetchMock.mock.calls[0][0]).toContain("/checkout_sessions/cs_ok"); // verified with PayMongo, not just trusted
  });

  it("answers 500 (so PayMongo retries) and grants nothing when the amount paid is too low", async () => {
    const { POST } = await import("@/app/api/paymongo/webhook/route");
    fetchMock.mockResolvedValueOnce(sessionWithPayment(100));
    const res = await POST(webhookRequest(paidEvent()));
    expect(res.status).toBe(500);
    expect(state.premium).toEqual([]);
  });

  it("is idempotent: a replayed event grants once", async () => {
    const { POST } = await import("@/app/api/paymongo/webhook/route");
    fetchMock.mockResolvedValue(sessionWithPayment(199900));
    await POST(webhookRequest(paidEvent("evt_same")));
    const again = await POST(webhookRequest(paidEvent("evt_same")));
    expect(await again.json()).toMatchObject({ result: "duplicate" });
    expect(state.premium).toHaveLength(1);
  });

  it("answers 409 while another worker is processing the same event", async () => {
    const { POST } = await import("@/app/api/paymongo/webhook/route");
    state.busy.add("paymongo:evt_busy");
    fetchMock.mockResolvedValue(sessionWithPayment(199900));
    const res = await POST(webhookRequest(paidEvent("evt_busy")));
    expect(res.status).toBe(409);
  });
});

describe("PayPal return", () => {
  const ppOrder = { id: "ord1", provider: "paypal", provider_ref: "PP1", meta: order.meta, status: "pending" };
  const completed = (value: string, currency = "PHP") => ({
    ok: true, status: 201,
    json: async () => ({ id: "PP1", status: "COMPLETED", purchase_units: [{ payments: { captures: [{ status: "COMPLETED", amount: { currency_code: currency, value } }] } }] }),
  });
  const returnReq = (qs: string) => new NextRequest(`https://hapstoria.example/payments/paypal/return?${qs}`);
  const token = { ok: true, status: 200, json: async () => ({ access_token: "tok", expires_in: 3000 }) };

  it("captures, verifies the amount, grants, and redirects to the success page", async () => {
    const { GET } = await import("@/app/payments/paypal/return/route");
    paypalOrderRow = ppOrder;
    fetchMock.mockResolvedValueOnce(token).mockResolvedValueOnce(completed("1999.00"));
    const res = await GET(returnReq("order=ord1&token=PP1"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://hapstoria.example/dashboard/events/ev1?paid=1");
    expect(state.premium).toEqual(["ev1"]);
  });

  it("refuses a PayPal token that is not the order we created", async () => {
    const { GET } = await import("@/app/payments/paypal/return/route");
    paypalOrderRow = ppOrder;
    const res = await GET(returnReq("order=ord1&token=SOMEONE_ELSES"));
    expect(res.headers.get("location")).toContain("payment=failed");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.premium).toEqual([]);
  });

  it("grants nothing when the captured amount is too low", async () => {
    const { GET } = await import("@/app/payments/paypal/return/route");
    paypalOrderRow = ppOrder;
    fetchMock.mockResolvedValueOnce(token).mockResolvedValueOnce(completed("5.00"));
    const res = await GET(returnReq("order=ord1&token=PP1"));
    expect(res.headers.get("location")).toContain("payment=failed");
    expect(state.premium).toEqual([]);
  });

  it("grants nothing for a capture in the wrong currency", async () => {
    const { GET } = await import("@/app/payments/paypal/return/route");
    paypalOrderRow = ppOrder;
    fetchMock.mockResolvedValueOnce(token).mockResolvedValueOnce(completed("1999.00", "USD"));
    const res = await GET(returnReq("order=ord1&token=PP1"));
    expect(res.headers.get("location")).toContain("payment=failed");
    expect(state.premium).toEqual([]);
  });

  it("a refreshed return page does not grant twice", async () => {
    const { GET } = await import("@/app/payments/paypal/return/route");
    paypalOrderRow = ppOrder;
    fetchMock.mockResolvedValue(completed("1999.00"));
    fetchMock.mockResolvedValueOnce(token);
    await GET(returnReq("order=ord1&token=PP1"));
    await GET(returnReq("order=ord1&token=PP1"));
    expect(state.premium).toHaveLength(1);
  });

  it("ignores missing parameters", async () => {
    const { GET } = await import("@/app/payments/paypal/return/route");
    const res = await GET(returnReq("token=PP1"));
    expect(res.headers.get("location")).toContain("payment=failed");
  });
});
