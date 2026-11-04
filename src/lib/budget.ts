import { z } from "zod";
import { toCents } from "@/lib/gifts";

export interface BudgetLike { category: string; estimated_cents: number; actual_cents: number | null; paid: boolean }

const committedOf = (i: BudgetLike) => i.actual_cents ?? i.estimated_cents;

export function budgetTotals(items: BudgetLike[], totalBudgetCents: number) {
  const estimated = items.reduce((s, i) => s + i.estimated_cents, 0);
  const committed = items.reduce((s, i) => s + committedOf(i), 0);
  const paid = items.filter((i) => i.paid).reduce((s, i) => s + committedOf(i), 0);
  return { estimated, committed, paid, remaining: totalBudgetCents - estimated, overBudget: committed > totalBudgetCents && totalBudgetCents > 0 };
}

export function categoryBreakdown(items: BudgetLike[]) {
  const map = new Map<string, { category: string; estimated: number; committed: number }>();
  for (const i of items) {
    const row = map.get(i.category) ?? { category: i.category, estimated: 0, committed: 0 };
    row.estimated += i.estimated_cents;
    row.committed += committedOf(i);
    map.set(i.category, row);
  }
  return [...map.values()].sort((a, b) => b.committed - a.committed);
}

const money = (label: string) =>
  z.string().refine((v) => toCents(v) !== null, `${label} must be a positive amount`).transform((v) => toCents(v) as number);

export const budgetItemSchema = z.object({
  title: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(60),
  estimated: money("Estimate"),
  actual: z.string().trim().optional().transform((v) => (v ? toCents(v) : null)),
});
