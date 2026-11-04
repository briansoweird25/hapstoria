import type { AlbumStatus } from "@/lib/billing";

export type ExpiryKind = "expiry_30" | "expiry_7" | "expiry_1" | "grace";

/** Which expiry notice (if any) is due now. Picks the nearest threshold already crossed so a missed cron day still sends. */
export function expiryReminderKind(s: AlbumStatus): ExpiryKind | null {
  if (s.state === "grace") return "grace";
  if (s.state === "kept" || s.state === "deleted" || s.daysLeft === null) return null;
  if (s.daysLeft <= 1) return "expiry_1";
  if (s.daysLeft <= 7) return "expiry_7";
  if (s.daysLeft <= 30) return "expiry_30";
  return null;
}

export interface ReminderGuest {
  id: string;
  name: string;
  email: string | null;
  status: string;
  reminded_at: string | null;
}

export const REMINDER_COOLDOWN_DAYS = 3;

/** Pending guests with an email who haven't been nudged recently. */
export function reminderGuests<T extends ReminderGuest>(guests: T[], now = new Date()): T[] {
  const cutoff = now.getTime() - REMINDER_COOLDOWN_DAYS * 86_400_000;
  return guests.filter(
    (g) => g.status === "pending" && g.email && (!g.reminded_at || new Date(g.reminded_at).getTime() <= cutoff),
  );
}
