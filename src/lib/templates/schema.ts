import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);

/** Validates a template definition. Used for marketplace snapshots stored in the DB (never trusted unvalidated). */
export const templateDefSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  kind: z.string().min(1).max(40),
  culture: z.string().max(60).default(""),
  description: z.string().max(300).default(""),
  font: z.enum(["serif", "script", "sans", "display"]),
  sections: z.array(z.enum(["program", "venue", "dress", "rsvp", "gifts", "uploads"])).max(6),
  palette: z.object({ bg: hex, surface: hex, text: hex, accent: hex, accentSoft: hex }),
});
