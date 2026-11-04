"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { definitionFromSubmission, templateSubmissionSchema } from "@/lib/marketplace";
import { env } from "@/lib/env";
import { getStripe, stripeConfigured } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

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

export async function startConnectOnboarding() {
  const { user } = await requireUser();
  if (!stripeConfigured()) redirect("/dashboard/creator?notice=payments_unavailable");
  const admin = createAdminClient();
  const { data: profile } = await admin.from("creator_profiles").select("status,stripe_account_id,country").eq("user_id", user.id).maybeSingle();
  if (!profile || profile.status !== "approved") redirect("/dashboard/creator?notice=not_approved");
  const stripe = getStripe();
  let account = profile.stripe_account_id;
  if (!account) {
    const created = await stripe.accounts.create({
      type: "express", email: user.email ?? undefined, country: profile.country ?? undefined,
      capabilities: { transfers: { requested: true } }, metadata: { user_id: user.id },
    });
    account = created.id;
    await admin.from("creator_profiles").update({ stripe_account_id: account }).eq("user_id", user.id);
  }
  const link = await stripe.accountLinks.create({
    account, type: "account_onboarding",
    refresh_url: `${env.siteUrl}/dashboard/creator?notice=connect_retry`, return_url: `${env.siteUrl}/dashboard/creator?notice=connected`,
  });
  redirect(link.url);
}
