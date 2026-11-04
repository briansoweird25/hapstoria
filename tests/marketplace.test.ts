import { describe, expect, it } from "vitest";
import {
  CREATOR_SHARE_BPS, MAX_PRICE_CENTS, MIN_PRICE_CENTS, MIN_PAYOUT_CENTS, isAdminEmail, pendingPayoutCents,
  splitRevenue, templateSubmissionSchema, definitionFromSubmission, marketplaceTemplateId, parseMarketplaceId,
} from "@/lib/marketplace";
import { getTemplate, resolveTemplate, TEMPLATES } from "@/lib/templates";

describe("splitRevenue", () => {
  it("splits with integer cents that always sum to the price", () => {
    for (const price of [300, 999, 1234, 4999, 9900]) {
      const s = splitRevenue(price);
      expect(s.creatorCents + s.platformCents).toBe(price);
      expect(Number.isInteger(s.creatorCents)).toBe(true);
    }
    expect(splitRevenue(1000).creatorCents).toBe(Math.floor((1000 * CREATOR_SHARE_BPS) / 10000));
  });
  it("rejects out-of-range prices", () => {
    expect(() => splitRevenue(MIN_PRICE_CENTS - 1)).toThrow();
    expect(() => splitRevenue(MAX_PRICE_CENTS + 1)).toThrow();
  });
});

describe("pendingPayoutCents", () => {
  it("sums only unpaid earnings and reports whether the threshold is reached", () => {
    const rows = [{ creator_share_cents: 1500, payout_id: null }, { creator_share_cents: 900, payout_id: null }, { creator_share_cents: 5000, payout_id: "p1" }];
    expect(pendingPayoutCents(rows)).toEqual({ cents: 2400, payable: 2400 >= MIN_PAYOUT_CENTS });
    expect(pendingPayoutCents([{ creator_share_cents: 500, payout_id: null }]).payable).toBe(false);
  });
});

describe("isAdminEmail", () => {
  it("matches the allowlist case-insensitively", () => {
    expect(isAdminEmail("Boss@Hapstoria.com", "boss@hapstoria.com, other@x.com")).toBe(true);
    expect(isAdminEmail("nope@x.com", "boss@hapstoria.com")).toBe(false);
    expect(isAdminEmail("a@x.com", "")).toBe(false);
    expect(isAdminEmail(null, "a@x.com")).toBe(false);
  });
});

describe("templateSubmissionSchema", () => {
  const ok = { name: "Mehndi Night", kind: "cultural", culture: "South Asian", description: "Henna-inspired.", price: "12.00", font: "display",
    bg: "#fff6e5", surface: "#fffcf4", text: "#3a1f2c", accent: "#d9467a", accentSoft: "#ffe0a3" };
  it("accepts a valid submission and converts price to cents", () => {
    const r = templateSubmissionSchema.parse(ok);
    expect(r.price_cents).toBe(1200);
  });
  it("rejects bad colors, kinds, fonts and prices", () => {
    expect(templateSubmissionSchema.safeParse({ ...ok, accent: "pink" }).success).toBe(false);
    expect(templateSubmissionSchema.safeParse({ ...ok, kind: "nope" }).success).toBe(false);
    expect(templateSubmissionSchema.safeParse({ ...ok, font: "comic" }).success).toBe(false);
    expect(templateSubmissionSchema.safeParse({ ...ok, price: "1" }).success).toBe(false);
    expect(templateSubmissionSchema.safeParse({ ...ok, price: "500" }).success).toBe(false);
  });
  it("rejects low-contrast text/background combinations", () => {
    expect(templateSubmissionSchema.safeParse({ ...ok, text: "#fdfcf3" }).success).toBe(false);
  });
  it("builds a stored definition with all sections", () => {
    const def = definitionFromSubmission(templateSubmissionSchema.parse(ok));
    expect(def.palette.accent).toBe("#d9467a");
    expect(def.sections.length).toBeGreaterThan(0);
  });
});

describe("marketplace template ids", () => {
  it("round-trips ids", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(marketplaceTemplateId(id)).toBe(`mkt:${id}`);
    expect(parseMarketplaceId(`mkt:${id}`)).toBe(id);
    expect(parseMarketplaceId("classic-gold")).toBeNull();
    expect(parseMarketplaceId("mkt:not-a-uuid")).toBeNull();
  });
});

describe("resolveTemplate", () => {
  const def = { id: "mkt:x", name: "Custom", kind: "cultural", culture: "X", description: "", font: "serif", sections: ["rsvp"], palette: { bg: "#ffffff", surface: "#ffffff", text: "#000000", accent: "#ff0000", accentSoft: "#eeeeee" } };
  it("uses the snapshot for marketplace ids", () => {
    expect(resolveTemplate("mkt:11111111-1111-4111-8111-111111111111", def).name).toBe("Custom");
  });
  it("ignores invalid snapshots and falls back safely", () => {
    expect(resolveTemplate("mkt:11111111-1111-4111-8111-111111111111", { palette: { bg: "javascript:alert(1)" } }).id).toBe(TEMPLATES[0].id);
  });
  it("uses built-in templates by id and never trusts a snapshot for them", () => {
    expect(resolveTemplate("debut-blush", def).id).toBe("debut-blush");
    expect(getTemplate("debut-blush").id).toBe("debut-blush");
  });
});
