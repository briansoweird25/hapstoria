"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { getStripe, stripeConfigured } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

export async function buyTemplate(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = z.string().uuid().safeParse(formData.get("template_id"));
  if (!id.success) redirect("/marketplace?error=invalid");
  if (!stripeConfigured()) redirect("/marketplace?error=unavailable");

  const admin = createAdminClient();
  const { data: tpl } = await admin
    .from("marketplace_templates").select("id,name,price_cents,status,creator_id").eq("id", id.data).maybeSingle();
  if (!tpl || tpl.status !== "approved") redirect("/marketplace?error=invalid");
  if (tpl.creator_id === user.id) redirect("/marketplace?error=own");
  const { data: owned } = await supabase.from("template_purchases").select("id").eq("template_id", tpl.id).eq("buyer_id", user.id).maybeSingle();
  if (owned) redirect("/marketplace?owned=1");

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer_email: user.email ?? undefined,
    client_reference_id: user.id,
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: tpl.price_cents, product_data: { name: `Hapstoria template: ${tpl.name}` } } }],
    metadata: { kind: "template", template_id: tpl.id, user_id: user.id },
    success_url: `${env.siteUrl}/marketplace?purchased=1`,
    cancel_url: `${env.siteUrl}/marketplace`,
  });
  await admin.from("orders").insert({
    user_id: user.id, kind: "template", amount_cents: tpl.price_cents, stripe_session_id: session.id,
    meta: { template_id: tpl.id, price_cents: tpl.price_cents },
  });
  if (!session.url) redirect("/marketplace?error=checkout");
  redirect(session.url);
}
