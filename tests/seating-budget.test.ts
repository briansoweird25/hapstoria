import { describe, expect, it } from "vitest";
import { autoSeat, canAssign, tableUsage, type SeatGuest, type SeatTable } from "@/lib/seating";
import { budgetTotals, categoryBreakdown, budgetItemSchema } from "@/lib/budget";

const tables: SeatTable[] = [{ id: "t1", name: "Table 1", capacity: 4 }, { id: "t2", name: "Table 2", capacity: 4 }];
const g = (id: string, party: number, table: string | null = null, status = "accepted"): SeatGuest => ({ id, name: id, party_size: party, status, table_id: table });

describe("tableUsage", () => {
  it("counts party sizes of accepted guests only", () => {
    const u = tableUsage(tables, [g("a", 2, "t1"), g("b", 1, "t1"), g("c", 3, "t1", "declined"), g("d", 1, null)]);
    expect(u.t1).toBe(3);
    expect(u.t2).toBe(0);
  });
});

describe("canAssign", () => {
  it("allows when there is room and rejects when over capacity", () => {
    const guests = [g("a", 3, "t1")];
    expect(canAssign(tables[0], g("b", 1), guests).ok).toBe(true);
    expect(canAssign(tables[0], g("b", 2), guests).ok).toBe(false);
  });
  it("moving a guest within the same table doesn't double count", () => {
    const a = g("a", 4, "t1");
    expect(canAssign(tables[0], a, [a]).ok).toBe(true);
  });
  it("only accepted guests can be seated", () => {
    expect(canAssign(tables[0], g("x", 1, null, "pending"), []).ok).toBe(false);
  });
});

describe("autoSeat", () => {
  it("seats unseated accepted guests, largest parties first, without exceeding capacity", () => {
    const guests = [g("a", 1), g("b", 3), g("c", 2), g("d", 2), g("e", 1, null, "pending")];
    const { assignments, unseated } = autoSeat(guests, tables);
    const usage: Record<string, number> = { t1: 0, t2: 0 };
    for (const [gid, tid] of Object.entries(assignments)) usage[tid] += guests.find((x) => x.id === gid)!.party_size;
    expect(usage.t1).toBeLessThanOrEqual(4);
    expect(usage.t2).toBeLessThanOrEqual(4);
    expect(unseated).toEqual([]);
    expect(assignments.e).toBeUndefined();
  });
  it("reports guests that don't fit and keeps existing seats", () => {
    const guests = [g("a", 4, "t1"), g("b", 4, "t2"), g("c", 2)];
    const r = autoSeat(guests, tables);
    expect(r.unseated).toEqual(["c"]);
    expect(r.assignments).toEqual({});
  });
});

describe("budget", () => {
  const items = [
    { category: "Venue", estimated_cents: 500000, actual_cents: 480000, paid: true },
    { category: "Venue", estimated_cents: 100000, actual_cents: null, paid: false },
    { category: "Food", estimated_cents: 300000, actual_cents: 320000, paid: false },
  ];
  it("totals estimated, actual (falls back to estimate), paid and remaining", () => {
    const t = budgetTotals(items, 1_000_000);
    expect(t.estimated).toBe(900000);
    expect(t.committed).toBe(480000 + 100000 + 320000);
    expect(t.paid).toBe(480000);
    expect(t.remaining).toBe(1_000_000 - 900000);
    expect(t.overBudget).toBe(false);
  });
  it("flags over budget", () => {
    expect(budgetTotals(items, 800_000).overBudget).toBe(true);
  });
  it("groups by category", () => {
    const c = categoryBreakdown(items);
    expect(c.find((x) => x.category === "Venue")?.committed).toBe(580000);
    expect(c[0].committed).toBeGreaterThanOrEqual(c[1].committed);
  });
  it("validates items", () => {
    expect(budgetItemSchema.safeParse({ title: "DJ", category: "Music", estimated: "350.50" }).success).toBe(true);
    expect(budgetItemSchema.safeParse({ title: "", category: "Music", estimated: "1" }).success).toBe(false);
    expect(budgetItemSchema.safeParse({ title: "x", category: "Music", estimated: "-4" }).success).toBe(false);
  });
});
