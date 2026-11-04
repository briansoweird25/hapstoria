"use server";

import { giftPledgeSchema } from "@/lib/gifts";
import { createClient } from "@/lib/supabase/server";

export type PledgeState = { ok: boolean; error?: string };

const ERRORS: Record<string, string> = {
  item_unavailable: "Someone just reserved that item. Please choose another.",
  anonymous_not_allowed: "The hosts have turned off anonymous gifts.",
  gifts_unavailable: "Gifts aren't available for this event.",
};

export async function pledgeGift(slug: string, _prev: PledgeState, formData: FormData): Promise<PledgeState> {
  const parsed = giftPledgeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("pledge_gift", {
    p_slug: slug, p_target: v.target, p_target_id: v.target_id ?? null, p_amount_cents: v.amount_cents,
    p_currency: v.currency, p_anonymous: v.anonymous, p_giver_name: v.giver_name ?? "", p_message: v.message ?? "",
  });
  if (error) {
    const key = Object.keys(ERRORS).find((k) => error.message.includes(k));
    return { ok: false, error: key ? ERRORS[key] : "Something went wrong. Please try again." };
  }
  return { ok: true };
}
