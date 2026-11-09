import { describe, expect, it } from "vitest";
import { MIN_QUANTITY, PRINT_LEAD_DAYS, orderByDate, printPriceCents, printOrderSchema, canOrderPrint } from "@/lib/print";

describe("print pricing", () => {
  it("prices bulk-to-host by quantity with volume discounts", () => {
    expect(printPriceCents({ quantity: 25, mode: "host" }).totalCents).toBe(25 * 16000 + 15000); // PHP centavos
    expect(printPriceCents({ quantity: 100, mode: "host" }).unitCents).toBeLessThan(printPriceCents({ quantity: 25, mode: "host" }).unitCents);
  });
  it("direct mailing costs more per card than shipping to host", () => {
    const host = printPriceCents({ quantity: 50, mode: "host" });
    const direct = printPriceCents({ quantity: 50, mode: "guests" });
    expect(direct.totalCents).toBeGreaterThan(host.totalCents);
  });
  it("rejects quantities below the minimum", () => {
    expect(() => printPriceCents({ quantity: MIN_QUANTITY - 1, mode: "host" })).toThrow();
  });
});

describe("lead time", () => {
  const now = new Date("2026-06-01T12:00:00Z");
  it("order-by date is lead days before the event", () => {
    expect(orderByDate("2026-07-31T10:00:00Z").toISOString().slice(0, 10)).toBe("2026-07-10");
    expect(PRINT_LEAD_DAYS).toBe(21);
  });
  it("blocks orders past the cutoff, allows before", () => {
    expect(canOrderPrint("2026-06-15T10:00:00Z", now).ok).toBe(false);
    expect(canOrderPrint("2026-08-15T10:00:00Z", now).ok).toBe(true);
  });
  it("requires an event date", () => {
    expect(canOrderPrint(null, now).ok).toBe(false);
  });
});

describe("printOrderSchema", () => {
  const addr = { name: "Ana", line1: "1 Rizal St", city: "Manila", postal_code: "1000", country: "PH" };
  it("accepts a valid host-shipped order", () => {
    expect(printOrderSchema.safeParse({ quantity: "30", mode: "host", ...addr }).success).toBe(true);
  });
  it("requires country as ISO-2 and a postal code", () => {
    expect(printOrderSchema.safeParse({ quantity: 30, mode: "host", ...addr, country: "Philippines" }).success).toBe(false);
    expect(printOrderSchema.safeParse({ quantity: 30, mode: "host", ...addr, postal_code: "" }).success).toBe(false);
  });
  it("caps quantity", () => {
    expect(printOrderSchema.safeParse({ quantity: 5000, mode: "host", ...addr }).success).toBe(false);
  });
});
