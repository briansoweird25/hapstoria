"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { parseProvider, startCheckout } from "@/lib/payments/checkout";
import { createAdminClient } from "@/lib/supabase/admin";

export async function buyTemplate(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = z.string().uuid().safeParse(formData.get("template_id"));
  const provider = parseProvider(formData.get("provider"));
  if (!id.success) redirect("/marketplace?error=invalid");
  if (!provider) redirect("/marketplace?error=unavailable");

  const admin = createAdminClient();
  const { data: tpl } = await admin
    .from("marketplace_templates")
    .select("id,name,price_cents,status,creator_id")
    .eq("id", id.data)
    .maybeSingle();
  if (!tpl || tpl.status !== "approved") redirect("/marketplace?error=invalid");
  if (tpl.creator_id === user.id) redirect("/marketplace?error=own");
  const { data: creator } = await admin.from("creator_profiles").select("status").eq("user_id", tpl.creator_id).maybeSingle();
  if (creator?.status !== "approved") redirect("/marketplace?error=invalid"); // creator was suspended after approval
  const { data: owned } = await supabase.from("template_purchases").select("id").eq("template_id", tpl.id).eq("buyer_id", user.id).maybeSingle();
  if (owned) redirect("/marketplace?owned=1");

  const result = await startCheckout({
    provider,
    userId: user.id,
    kind: "template",
    amountCents: tpl.price_cents,
    name: `Hapstoria template: ${tpl.name}`,
    meta: { template_id: tpl.id, price_cents: tpl.price_cents },
    successPath: "/marketplace?purchased=1",
    cancelPath: "/marketplace",
  });
  if ("error" in result) redirect("/marketplace?error=checkout");
  redirect(result.url);
}
