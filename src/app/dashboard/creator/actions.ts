"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { definitionFromSubmission, templateSubmissionSchema } from "@/lib/marketplace";

const profileSchema = z.object({
  display_name: z.string().trim().min(2).max(80),
  bio: z.string().trim().max(500).optional(),
  country: z.string().trim().length(2).transform((s) => s.toUpperCase()).optional().or(z.literal("").transform(() => undefined)),
});

export async function applyCreator(formData: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect("/dashboard/creator?notice=invalid");
  const { data: existing } = await supabase.from("creator_profiles").select("user_id").maybeSingle();
  const { error } = existing
    ? await supabase.from("creator_profiles").update(parsed.data).eq("user_id", user.id)
    : await supabase.from("creator_profiles").insert({ user_id: user.id, ...parsed.data });
  redirect(`/dashboard/creator?notice=${error ? "failed" : "applied"}`);
}

export type SubmitState = { ok: boolean; error?: string };

export async function submitTemplate(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const { supabase, user } = await requireUser();
  const parsed = templateSubmissionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const { error } = await supabase.from("marketplace_templates").insert({
    creator_id: user.id, name: v.name, kind: v.kind, culture: v.culture, description: v.description,
    definition: definitionFromSubmission(v), price_cents: v.price_cents,
  });
  if (error) return { ok: false, error: error.message.includes("creator_not_approved") ? "Your creator profile isn't approved yet." : "Could not submit the template." };
  return { ok: true };
}

const payoutSchema = z.object({
  payout_method: z.enum(["gcash", "paypal"]),
  payout_details: z.string().trim().min(3).max(200),
});

/** Where the creator wants earnings sent. Payouts are made by hand from the admin page (GCash or PayPal). */
export async function savePayoutDetails(formData: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = payoutSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect("/dashboard/creator?notice=invalid_payout");
  const { error } = await supabase.from("creator_profiles").update(parsed.data).eq("user_id", user.id);
  redirect(`/dashboard/creator?notice=${error ? "failed" : "payout_saved"}`);
}
