import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Call = [string, string, unknown?];
let calls: Call[] = [];
let insertFails = false;

// Minimal stand-in for the Supabase admin client: records what the checkout starter does to the `orders` table.
const fakeAdmin = {
  from(table: string) {
    return {
      insert(row: unknown) {
        calls.push(["insert", table, row]);
        return { select: () => ({ single: async () => (insertFails ? { data: null, error: { message: "db" } } : { data: { id: "ord1" }, error: null }) }) };
      },
      update(patch: unknown) {
        calls.push(["update", table, patch]);
        return { eq: async () => ({ error: null }) };
      },
      delete() {
        calls.push(["delete", table]);
        return { eq: async () => ({ error: null }) };
      },
    };
  },
};
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeAdmin }));

const fetchMock = vi.fn();
const base = {
  userId: "u1",
  kind: "event_premium" as const,
  amountCents: 199900,
  name: "Hapstoria Premium: Sofia",
  eventId: "ev1",
  successPath: "/dashboard/events/ev1?upgraded=1",
  cancelPath: "/dashboard/events/ev1",
};

beforeEach(() => {
  calls = [];
  insertFails = false;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://hapstoria.example");
  vi.stubEnv("PAYMONGO_SECRET_KEY", "sk_test_abc");
  vi.stubEnv("PAYPAL_CLIENT_ID", "pid");
  vi.stubEnv("PAYPAL_CLIENT_SECRET", "psecret");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const json = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body });

describe("startCheckout with PayMongo", () => {
  it("records the order first, creates a GCash/Maya/card session in PHP, then stores the session id", async () => {
    const { startCheckout } = await import("@/lib/payments/checkout");
    fetchMock.mockResolvedValueOnce(json({ data: { id: "cs_123", attributes: { checkout_url: "https://checkout.paymongo.com/cs_123" } } }));

    const result = await startCheckout({ ...base, provider: "paymongo" });

    expect(result).toEqual({ url: "https://checkout.paymongo.com/cs_123" });
    expect(calls[0][0]).toBe("insert"); // order exists before the customer is sent to pay
    const order = calls[0][2] as Record<string, unknown>;
    expect(order).toMatchObject({ user_id: "u1", kind: "event_premium", amount_cents: 199900, provider: "paymongo" });
    expect(String(order.provider_ref)).toMatch(/^pending_/);
    expect(calls.at(-1)).toEqual(["update", "orders", { provider_ref: "cs_123" }]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/checkout_sessions");
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("sk_test_abc:").toString("base64")}`);
    const attrs = JSON.parse(init.body).data.attributes;
    expect(attrs.line_items).toEqual([{ name: "Hapstoria Premium: Sofia", amount: 199900, currency: "PHP", quantity: 1 }]);
    expect(attrs.payment_method_types).toEqual(expect.arrayContaining(["gcash", "paymaya", "card"]));
    expect(attrs.success_url).toBe("https://hapstoria.example/dashboard/events/ev1?upgraded=1");
    expect(attrs.cancel_url).toBe("https://hapstoria.example/dashboard/events/ev1");
  });

  it("removes the order and reports an error when PayMongo fails", async () => {
    const { startCheckout } = await import("@/lib/payments/checkout");
    fetchMock.mockResolvedValueOnce(json({ errors: [{ detail: "nope" }] }, 500));
    const result = await startCheckout({ ...base, provider: "paymongo" });
    expect("error" in result).toBe(true);
    expect(calls.some((c) => c[0] === "delete" && c[1] === "orders")).toBe(true);
  });

  it("does not contact the provider if the order could not be recorded", async () => {
    const { startCheckout } = await import("@/lib/payments/checkout");
    insertFails = true;
    const result = await startCheckout({ ...base, provider: "paymongo" });
    expect("error" in result).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a provider that has no keys, and records nothing", async () => {
    const { startCheckout } = await import("@/lib/payments/checkout");
    vi.stubEnv("PAYMONGO_SECRET_KEY", "");
    const result = await startCheckout({ ...base, provider: "paymongo" });
    expect("error" in result).toBe(true);
    expect(calls).toEqual([]);
  });

  it("passes multi-line print orders through as separate line items", async () => {
    const { startCheckout } = await import("@/lib/payments/checkout");
    fetchMock.mockResolvedValueOnce(json({ data: { id: "cs_9", attributes: { checkout_url: "https://x" } } }));
    await startCheckout({
      ...base, provider: "paymongo", kind: "print", amountCents: 815000,
      lineItems: [{ name: "Card", amountCents: 16000, quantity: 50 }, { name: "Shipping", amountCents: 15000, quantity: 1 }],
    });
    const attrs = JSON.parse(fetchMock.mock.calls[0][1].body).data.attributes;
    expect(attrs.line_items).toHaveLength(2);
    expect(attrs.line_items[0]).toMatchObject({ amount: 16000, quantity: 50 });
  });
});

describe("startCheckout with PayPal", () => {
  it("creates a PHP order whose return link carries our order id, and returns the approval link", async () => {
    const { startCheckout } = await import("@/lib/payments/checkout");
    fetchMock
      .mockResolvedValueOnce(json({ access_token: "tok", expires_in: 3000 }))
      .mockResolvedValueOnce(json({ id: "PP1", links: [{ rel: "payer-action", href: "https://paypal.test/approve" }] }, 201));

    const result = await startCheckout({ ...base, provider: "paypal" });

    expect(result).toEqual({ url: "https://paypal.test/approve" });
    const createCall = fetchMock.mock.calls[1];
    expect(createCall[0]).toContain("/v2/checkout/orders");
    const body = JSON.parse(createCall[1].body);
    expect(body.purchase_units[0].amount).toEqual({ currency_code: "PHP", value: "1999.00" });
    expect(body.purchase_units[0].custom_id).toBe("ord1");
    expect(JSON.stringify(body)).toContain("https://hapstoria.example/payments/paypal/return?order=ord1");
    expect(calls.at(-1)).toEqual(["update", "orders", { provider_ref: "PP1" }]);
  });
});

describe("availableProviders", () => {
  it("lists only configured providers", async () => {
    const { availableProviders } = await import("@/lib/payments/checkout");
    expect(availableProviders()).toEqual(["paymongo", "paypal"]);
    vi.stubEnv("PAYPAL_CLIENT_ID", "");
    expect(availableProviders()).toEqual(["paymongo"]);
    vi.stubEnv("PAYMONGO_SECRET_KEY", "");
    expect(availableProviders()).toEqual([]);
  });
});
