import { z } from "zod";

const trimmed = (max: number) => z.string().trim().max(max);
const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const mealOptions = z.preprocess(
  (v) =>
    typeof v === "string"
      ? v.split(",").map((s) => s.trim()).filter(Boolean)
      : v,
  z.array(z.string().max(60)).max(10).default([]),
);

export const eventInputSchema = z.object({
  title: trimmed(120).min(1, "Give your event a title"),
  kind: z.string().trim().min(1).max(40).default("birthday"),
  template_id: z.string().trim().min(1).max(60).default("classic-gold"),
  host_names: trimmed(160).default(""),
  starts_at: z.preprocess(emptyToNull, z.string().datetime({ local: true, offset: true }).nullable().default(null)),
  venue_name: trimmed(160).default(""),
  venue_address: trimmed(300).default(""),
  message: trimmed(2000).default(""),
  dress_code: trimmed(160).default(""),
  meal_options: mealOptions,
  rsvp_deadline: z.preprocess(emptyToNull, z.string().datetime({ local: true, offset: true }).nullable().default(null)),
  max_plus_ones: z.coerce.number().int().min(0).max(20).default(4),
  uploads_enabled: z.coerce.boolean().default(true),
});
export type EventInput = z.infer<typeof eventInputSchema>;

export const rsvpInputSchema = z
  .object({
    name: trimmed(120).min(1, "Please enter your name"),
    status: z.enum(["accepted", "declined"]),
    party_size: z.coerce.number().int().min(0).max(25).default(1),
    meal: trimmed(60).optional(),
    note: trimmed(500).optional(),
    email: z.preprocess(emptyToNull, z.string().trim().email().max(200).nullable().optional()),
  })
  .transform((v) => ({ ...v, party_size: v.status === "declined" ? 0 : v.party_size }));
export type RsvpInput = z.infer<typeof rsvpInputSchema>;

export const greetingInputSchema = z.object({
  name: trimmed(120).min(1).default("Guest"),
  text: trimmed(1000).min(1, "Write a greeting first"),
});
