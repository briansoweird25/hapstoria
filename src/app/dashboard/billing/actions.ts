"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { PRICES, subscriptionAmount, type Interval, type Tier } from "@/lib/billing";
import { env } from "@/lib/env";
import { getStripe, stripeConfigured } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

const tierSchema = z.enum(["keeper", "keeper_plus", "planner"]);
const intervalSchema = z.enum(["month", "year"]);

async function existingCustomerId(userId: string): Promise<string | undefined> {
  const { data } = await createAdminClient().from("subscriptions").select("stripe_customer_id").eq("user_id", userId).limit(1).maybeSingle();
  return data?.stripe_customer_id;
}

export async function buyPremium(eventId: string) {
  const { supabase, user } = await requireUser();
  if (!stripeConfigured()) redirect(`/dashboard/events/${eventId}?billing=unavailable`);
  const { data: event } = await supabase.from("events").select("id,title,premium").eq("id", eventId).maybeSingle();
  if (!event) redirect("/dashboard");
  if (event.premium) redirect(`/dashboard/events/${eventId}`);

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer_email: user.email ?? undefined,
    client_reference_id: user.id,
    line_items: [{
      quantity: 1,
      price_data: { currency: "usd", unit_amount: PRICES.event_premium.cents, product_data: { name: `Hapstoria Premium: ${event.title}` } },
    }],
    metadata: { kind: "event_premium", event_id: eventId, user_id: user.id },
    success_url: `${env.siteUrl}/dashboard/events/${eventId}?upgraded=1`,
    cancel_url: `${env.siteUrl}/dashboard/events/${eventId}`,
  });
  // `orders` is service-role-write only (owners can read), so insert with the admin client.
  const { error } = await createAdminClient().from("orders").insert({
    user_id: user.id, kind: "event_premium", event_id: eventId,
    amount_cents: PRICES.event_premium.cents, stripe_session_id: session.id,
  });
  if (error || !session.url) redirect(`/dashboard/events/${eventId}?billing=error`);
  redirect(session.url);
}

export async function subscribe(formData: FormData) {
  const { user } = await requireUser();
  const tier = tierSchema.safeParse(formData.get("tier"));
  const interval = intervalSchema.safeParse(formData.get("interval") ?? "month");
  if (!tier.success || !interval.success) redirect("/dashboard/billing?error=invalid");
  if (!stripeConfigured()) redirect("/dashboard/billing?error=unavailable");
  const t: Tier = tier.data;
  const i: Interval = interval.data;
  const customer = await existingCustomerId(user.id);

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    ...(customer ? { customer } : { customer_email: user.email ?? undefined }),
    client_reference_id: user.id,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: subscriptionAmount(t, i),
        recurring: { interval: i },
        product_data: { name: `Hapstoria ${PRICES[t].label}` },
      },
    }],
    subscription_data: { metadata: { tier: t, user_id: user.id } },
    metadata: { kind: "subscription", tier: t, user_id: user.id },
    success_url: `${env.siteUrl}/dashboard/billing?subscribed=1`,
    cancel_url: `${env.siteUrl}/dashboard/billing`,
  });
  if (!session.url) redirect("/dashboard/billing?error=checkout");
  redirect(session.url);
}

export async function openPortal() {
  const { user } = await requireUser();
  if (!stripeConfigured()) redirect("/dashboard/billing?error=unavailable");
  const customer = await existingCustomerId(user.id);
  if (!customer) redirect("/dashboard/billing");
  const portal = await getStripe().billingPortal.sessions.create({ customer, return_url: `${env.siteUrl}/dashboard/billing` });
  redirect(portal.url);
}
