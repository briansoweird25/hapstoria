"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { PRICES, subscriptionAmount } from "@/lib/billing";
import { parseProvider, startCheckout } from "@/lib/payments/checkout";

const tierSchema = z.enum(["keeper", "keeper_plus", "planner"]);
const intervalSchema = z.enum(["month", "year"]);

/** Premium for one event: unlimited guests, longer album. Paid with GCash/Maya/card (PayMongo) or PayPal. */
export async function buyPremium(eventId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const provider = parseProvider(formData.get("provider"));
  if (!provider) redirect(`/dashboard/events/${eventId}?billing=unavailable`);
  const { data: event } = await supabase.from("events").select("id,title,premium,owner_id").eq("id", eventId).maybeSingle();
  if (!event || event.owner_id !== user.id) redirect("/dashboard");
  if (event.premium) redirect(`/dashboard/events/${eventId}`);

  const result = await startCheckout({
    provider, userId: user.id, kind: "event_premium", eventId,
    amountCents: PRICES.event_premium.cents, name: `Hapstoria Premium: ${event.title}`,
    successPath: `/dashboard/events/${eventId}?upgraded=1`, cancelPath: `/dashboard/events/${eventId}`,
  });
  if ("error" in result) redirect(`/dashboard/events/${eventId}?billing=error`);
  redirect(result.url);
}

/** Memory Keeper / Keeper Plus / Planner as a prepaid period (1 or 12 months). Renewing extends the end date. */
export async function buyMembership(formData: FormData) {
  const { user } = await requireUser();
  const tier = tierSchema.safeParse(formData.get("tier"));
  const interval = intervalSchema.safeParse(formData.get("interval"));
  const provider = parseProvider(formData.get("provider"));
  if (!tier.success || !interval.success) redirect("/dashboard/billing?error=invalid");
  if (!provider) redirect("/dashboard/billing?error=unavailable");

  const result = await startCheckout({
    provider, userId: user.id, kind: "membership",
    amountCents: subscriptionAmount(tier.data, interval.data),
    name: `Hapstoria ${PRICES[tier.data].label} · ${interval.data === "year" ? "12 months" : "1 month"}`,
    meta: { tier: tier.data, interval: interval.data },
    successPath: "/dashboard/billing?subscribed=1", cancelPath: "/dashboard/billing",
  });
  if ("error" in result) redirect("/dashboard/billing?error=checkout");
  redirect(result.url);
}
