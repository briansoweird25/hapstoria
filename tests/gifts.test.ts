import { describe, expect, it } from "vitest";
import { displayGiver, fundProgress, giftPledgeSchema, giftMethodSchema, toCents, formatMoney } from "@/lib/gifts";

describe("displayGiver", () => {
  it("shows Anonymous for anonymous gifts", () => {
    expect(displayGiver({ anonymous: true, giver_name: null })).toBe("Anonymous");
    expect(displayGiver({ anonymous: false, giver_name: "Ana" })).toBe("Ana");
    expect(displayGiver({ anonymous: false, giver_name: "" })).toBe("A guest");
  });
});

describe("fundProgress", () => {
  it("computes a capped percentage", () => {
    expect(fundProgress(50_000, 12_500)).toBe(25);
    expect(fundProgress(10_000, 25_000)).toBe(100);
    expect(fundProgress(null, 500)).toBeNull();
    expect(fundProgress(0, 500)).toBeNull();
  });
});

describe("money", () => {
  it("converts decimal strings to cents safely", () => {
    expect(toCents("25")).toBe(2500);
    expect(toCents("19.99")).toBe(1999);
    expect(toCents("0.1")).toBe(10);
    expect(toCents("1,000.50")).toBe(100050);
    expect(toCents("abc")).toBeNull();
    expect(toCents("-5")).toBeNull();
    expect(toCents("")).toBeNull();
  });
  it("formats money", () => {
    expect(formatMoney(1999, "USD")).toContain("19.99");
  });
});

describe("giftPledgeSchema", () => {
  it("requires a name unless anonymous, and drops the name when anonymous", () => {
    expect(giftPledgeSchema.safeParse({ target: "fund", target_id: "11111111-1111-4111-8111-111111111111", amount: "20", currency: "USD", anonymous: "false", giver_name: "" }).success).toBe(false);
    const r = giftPledgeSchema.parse({ target: "fund", target_id: "11111111-1111-4111-8111-111111111111", amount: "20", currency: "usd", anonymous: "true", giver_name: "Ana" });
    expect(r.giver_name).toBeNull();
    expect(r.anonymous).toBe(true);
    expect(r.amount_cents).toBe(2000);
    expect(r.currency).toBe("USD");
  });
  it("rejects zero or negative amounts and huge ones", () => {
    const base = { target: "fund", target_id: "11111111-1111-4111-8111-111111111111", currency: "USD", anonymous: "true" };
    expect(giftPledgeSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
    expect(giftPledgeSchema.safeParse({ ...base, amount: "99999999" }).success).toBe(false);
  });
});

describe("giftMethodSchema", () => {
  it("accepts known kinds and limits url scheme to https", () => {
    expect(giftMethodSchema.safeParse({ kind: "paypal", label: "PayPal", url: "https://paypal.me/sofia" }).success).toBe(true);
    expect(giftMethodSchema.safeParse({ kind: "paypal", label: "PayPal", url: "javascript:alert(1)" }).success).toBe(false);
    expect(giftMethodSchema.safeParse({ kind: "weird", label: "x" }).success).toBe(false);
  });
});
