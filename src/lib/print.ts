import { z } from "zod";

export const MIN_QUANTITY = 10;
export const MAX_QUANTITY = 1000;
export const PRINT_LEAD_DAYS = 21;
const DAY = 86_400_000;

/**
 * PLACEHOLDER business numbers (USD cents). Replace with real print-partner cost × markup
 * before launch; everything else reads from here.
 */
const UNIT_TIERS = [
  { minQty: 100, unitCents: 220 },
  { minQty: 50, unitCents: 260 },
  { minQty: 0, unitCents: 300 },
];
const SHIP_TO_HOST_CENTS = 800;
const POSTAGE_PER_GUEST_CENTS = 150;

export type PrintMode = "host" | "guests";

export function printPriceCents(input: { quantity: number; mode: PrintMode }): { unitCents: number; shippingCents: number; totalCents: number } {
  if (!Number.isInteger(input.quantity) || input.quantity < MIN_QUANTITY) throw new Error(`Minimum order is ${MIN_QUANTITY} cards`);
  const unitCents = UNIT_TIERS.find((t) => input.quantity >= t.minQty)!.unitCents;
  const shippingCents = input.mode === "host" ? SHIP_TO_HOST_CENTS : input.quantity * POSTAGE_PER_GUEST_CENTS;
  return { unitCents, shippingCents, totalCents: input.quantity * unitCents + shippingCents };
}

export function orderByDate(eventIso: string): Date {
  return new Date(new Date(eventIso).getTime() - PRINT_LEAD_DAYS * DAY);
}

export function canOrderPrint(eventIso: string | null, now = new Date()): { ok: true; orderBy: Date } | { ok: false; reason: string } {
  if (!eventIso) return { ok: false, reason: "Set the event date first so we can check delivery time." };
  const orderBy = orderByDate(eventIso);
  if (now > orderBy) {
    return { ok: false, reason: `Printed invitations need at least ${PRINT_LEAD_DAYS} days before the event for printing and delivery.` };
  }
  return { ok: true, orderBy };
}

export const printOrderSchema = z.object({
  quantity: z.coerce.number().int().min(MIN_QUANTITY).max(MAX_QUANTITY),
  mode: z.enum(["host", "guests"]),
  name: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(120),
  region: z.string().trim().max(120).optional(),
  postal_code: z.string().trim().min(1).max(20),
  country: z.string().trim().length(2).transform((s) => s.toUpperCase()),
  phone: z.string().trim().max(30).optional(),
});
export type PrintOrderInput = z.infer<typeof printOrderSchema>;
