"use server";

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
  return { ok: true, name: v.name, status: v.status };
}
