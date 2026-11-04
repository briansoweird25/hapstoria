import { describe, expect, it } from "vitest";
import { summarizeGuests } from "@/lib/stats";

const g = (status: "pending" | "accepted" | "declined", party_size = 1, meal: string | null = null) =>
  ({ status, party_size, meal });

describe("summarizeGuests", () => {
  it("counts headcount from accepted party sizes only", () => {
    const s = summarizeGuests([g("accepted", 3), g("accepted", 1), g("declined", 0), g("pending")]);
    expect(s).toMatchObject({ invited: 4, accepted: 2, declined: 1, pending: 1, headcount: 4 });
  });
  it("tallies meals for accepted guests, weighted by party size not available -> per response", () => {
    const s = summarizeGuests([g("accepted", 2, "Beef"), g("accepted", 1, "Fish"), g("declined", 0, "Beef")]);
    expect(s.meals).toEqual({ Beef: 1, Fish: 1 });
  });
  it("handles empty list", () => {
    expect(summarizeGuests([]).headcount).toBe(0);
  });
});
