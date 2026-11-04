"use server";

import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { rsvpConfirmationEmail } from "@/lib/email/templates";
import { getPublicEvent } from "@/lib/public-event";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { rsvpInputSchema } from "@/lib/validation";

export type RsvpState = { ok: boolean; error?: string; name?: string; status?: "accepted" | "declined" };

const ERRORS: Record<string, string> = {
  rsvp_closed: "Sorry, RSVPs for this event have closed.",
  event_not_found: "This invitation isn't available.",
  guest_limit: "Sorry, this guest list is full.",
  invalid_party_size: "That's more guests than the host allows.",
};

export async function submitRsvp(slug: string, _prev: RsvpState, formData: FormData): Promise<RsvpState> {
  const parsed = rsvpInputSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_rsvp", {
    p_slug: slug,
    p_name: v.name,
    p_status: v.status,
    p_party_size: v.party_size,
    p_meal: v.meal ?? "",
    p_note: v.note ?? "",
    p_email: v.email ?? "",
  });
  if (error) {
    const key = Object.keys(ERRORS).find((k) => error.message.includes(k));
    return { ok: false, error: key ? ERRORS[key] : "Something went wrong. Please try again." };
  }
  if (v.email) {
    const event = await getPublicEvent(slug);
    if (event && (await mayEmail(event.id, v.email))) {
      await sendEmail(v.email, rsvpConfirmationEmail({
        guestName: v.name, eventTitle: event.title, status: v.status, partySize: v.party_size, inviteUrl: `${env.siteUrl}/e/${slug}`,
      }));
    }
  }
  return { ok: true, name: v.name, status: v.status };
}

const MAX_CONFIRMATIONS_PER_EVENT_PER_DAY = 100;

/**
 * Anyone can submit an RSVP with any address, so confirmations are throttled: at most
 * one per recipient per event per day and a daily cap per event. The attempt is logged first.
 */
async function mayEmail(eventId: string, email: string): Promise<boolean> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recipient = email.trim().toLowerCase();
  const [{ count: total }, { count: same }] = await Promise.all([
    admin.from("email_log").select("id", { count: "exact", head: true }).eq("event_id", eventId).gte("created_at", since),
    admin.from("email_log").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("recipient", recipient).gte("created_at", since),
  ]);
  if ((total ?? 0) >= MAX_CONFIRMATIONS_PER_EVENT_PER_DAY || (same ?? 0) > 0) return false;
  await admin.from("email_log").insert({ event_id: eventId, recipient });
  return true;
}
