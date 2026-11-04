import { z } from "zod";

export const METHOD_KINDS = ["qr", "paypal", "venmo", "wise", "bank", "gcash", "maya", "other"] as const;
export type MethodKind = (typeof METHOD_KINDS)[number];

export function displayGiver(g: { anonymous: boolean; giver_name: string | null }): string {
  if (g.anonymous) return "Anonymous";
  return g.giver_name?.trim() || "A guest";
}

/** Percentage of goal reached (0-100), or null when the fund has no goal. */
export function fundProgress(goalCents: number | null, raisedCents: number): number | null {
  if (!goalCents || goalCents <= 0) return null;
  return Math.min(100, Math.round((raisedCents / goalCents) * 100));
}

/** Parses "1,000.50" style user input into integer cents without float error. Returns null if invalid. */
export function toCents(input: string): number | null {
  const s = input.trim().replace(/,/g, "");
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || 0);
}

export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

const MAX_GIFT_CENTS = 10_000_000; // 100,000.00

const bool = z.preprocess((v) => v === true || v === "true" || v === "on", z.boolean());

/** Guest pledge ("I sent a gift"). The name is discarded when the guest gives anonymously. */
export const giftPledgeSchema = z
  .object({
    target: z.enum(["fund", "item", "general"]),
    target_id: z.string().uuid().optional(),
    amount: z.string().default(""),
    currency: z.string().trim().length(3).transform((s) => s.toUpperCase()).default("USD"),
    anonymous: bool.default(false),
    giver_name: z.string().trim().max(120).optional(),
    message: z.string().trim().max(500).optional(),
    method_id: z.string().uuid().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.anonymous && !v.giver_name) ctx.addIssue({ code: "custom", path: ["giver_name"], message: "Please enter your name or give anonymously" });
    if (v.target !== "item") {
      const c = toCents(v.amount);
      if (c === null || c <= 0 || c > MAX_GIFT_CENTS) ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter a valid amount" });
    }
    if (v.target !== "general" && !v.target_id) ctx.addIssue({ code: "custom", path: ["target_id"], message: "Choose what you're giving to" });
  })
  .transform((v) => ({
    ...v,
    giver_name: v.anonymous ? null : (v.giver_name ?? null),
    amount_cents: v.target === "item" ? 0 : (toCents(v.amount) as number),
  }));
export type GiftPledge = z.infer<typeof giftPledgeSchema>;

const httpsUrl = z.string().trim().max(500).url().refine((u) => u.startsWith("https://"), "Links must start with https://");

export const giftMethodSchema = z.object({
  kind: z.enum(METHOD_KINDS),
  label: z.string().trim().min(1).max(60),
  url: httpsUrl.optional().or(z.literal("").transform(() => undefined)),
  details: z.string().trim().max(300).optional(),
});
export type GiftMethodInput = z.infer<typeof giftMethodSchema>;

export const fundSchema = z.object({
  title: z.string().trim().min(1).max(80),
  goal: z.string().default(""),
});
export const itemSchema = z.object({
  title: z.string().trim().min(1).max(120),
  url: httpsUrl.optional().or(z.literal("").transform(() => undefined)),
});
