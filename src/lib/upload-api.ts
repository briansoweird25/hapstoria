import { z } from "zod";

export const signRequestSchema = z.object({
  action: z.literal("sign"),
  slug: z.string().min(3).max(61),
  type: z.string().max(100),
  size: z.number().int().positive(),
});
export const completeRequestSchema = z.object({
  action: z.literal("complete"),
  slug: z.string().min(3).max(61),
  path: z.string().min(10).max(300),
  name: z.string().trim().max(120).default("Guest"),
});
export const greetingRequestSchema = z.object({
  action: z.literal("greeting"),
  slug: z.string().min(3).max(61),
  name: z.string().trim().min(1).max(120).default("Guest"),
  text: z.string().trim().min(1, "Write a greeting first").max(1000),
});
export const uploadRequestSchema = z.discriminatedUnion("action", [
  signRequestSchema,
  completeRequestSchema,
  greetingRequestSchema,
]);
export type UploadRequest = z.infer<typeof uploadRequestSchema>;

/** Guest uploads live at "<ownerId>/<eventId>/<file>". */
export function guestFolder(ownerId: string, eventId: string) {
  return `${ownerId}/${eventId}`;
}

/** Hard cap on items per event to bound abuse of the anonymous upload endpoint. */
export const MAX_UPLOADS_PER_EVENT = 2000;

/** Max anonymous upload attempts (sign + greeting) per event per hour. */
export const ATTEMPTS_PER_HOUR = 400;

/** Signed-but-never-completed files older than this are deleted by the cleanup job. */
export const ORPHAN_AGE_MS = 2 * 60 * 60 * 1000;
