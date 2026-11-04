import { z } from "zod";
import { contrastRatio } from "@/lib/color";
import { EVENT_KINDS, type TemplateDef } from "@/lib/templates";
import { toCents } from "@/lib/gifts";

/** PLACEHOLDER business decision (basis points to the creator). 7000 = 70%. Change here only. */
export const CREATOR_SHARE_BPS = 7000;
export const MIN_PRICE_CENTS = 300;
export const MAX_PRICE_CENTS = 9900;
export const MIN_PAYOUT_CENTS = 2000;
export const MIN_TEXT_CONTRAST = 4.5;

export function splitRevenue(priceCents: number): { creatorCents: number; platformCents: number } {
  if (!Number.isInteger(priceCents) || priceCents < MIN_PRICE_CENTS || priceCents > MAX_PRICE_CENTS) {
    throw new Error("Price out of range");
  }
  const creatorCents = Math.floor((priceCents * CREATOR_SHARE_BPS) / 10_000);
  return { creatorCents, platformCents: priceCents - creatorCents };
}

export function pendingPayoutCents(rows: { creator_share_cents: number; payout_id: string | null }[]) {
  const cents = rows.filter((r) => !r.payout_id).reduce((s, r) => s + r.creator_share_cents, 0);
  return { cents, payable: cents >= MIN_PAYOUT_CENTS };
}

export function isAdminEmail(email: string | null | undefined, allowlist: string | undefined): boolean {
  if (!email || !allowlist) return false;
  return allowlist.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).includes(email.trim().toLowerCase());
}

const hex = z.string().trim().regex(/^#[0-9a-f]{6}$/i, "Use a hex color like #8a6fb5");
const KIND_IDS = EVENT_KINDS.map((k) => k.id) as [string, ...string[]];

export const templateSubmissionSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    kind: z.enum(KIND_IDS),
    culture: z.string().trim().max(60).default(""),
    description: z.string().trim().max(300).default(""),
    price: z.string().refine((v) => { const c = toCents(v); return c !== null && c >= MIN_PRICE_CENTS && c <= MAX_PRICE_CENTS; }, "Price must be between $3 and $99"),
    font: z.enum(["serif", "script", "sans", "display"]),
    bg: hex, surface: hex, text: hex, accent: hex, accentSoft: hex,
  })
  .superRefine((v, ctx) => {
    if (contrastRatio(v.text, v.bg) < MIN_TEXT_CONTRAST || contrastRatio(v.text, v.surface) < MIN_TEXT_CONTRAST) {
      ctx.addIssue({ code: "custom", path: ["text"], message: "Text color needs more contrast against the background (WCAG AA 4.5:1)" });
    }
  })
  .transform((v) => ({ ...v, price_cents: toCents(v.price) as number }));
export type TemplateSubmission = z.infer<typeof templateSubmissionSchema>;

/** The structured definition stored in the DB (same shape as built-in templates). */
export function definitionFromSubmission(s: TemplateSubmission): Omit<TemplateDef, "id"> {
  return {
    name: s.name, kind: s.kind, culture: s.culture, description: s.description, font: s.font,
    palette: { bg: s.bg, surface: s.surface, text: s.text, accent: s.accent, accentSoft: s.accentSoft },
    sections: ["program", "venue", "dress", "rsvp", "gifts", "uploads"],
  };
}

const UUID = z.string().uuid();
export const marketplaceTemplateId = (uuid: string) => `mkt:${uuid}`;
export function parseMarketplaceId(id: string): string | null {
  if (!id.startsWith("mkt:")) return null;
  const parsed = UUID.safeParse(id.slice(4));
  return parsed.success ? parsed.data : null;
}
