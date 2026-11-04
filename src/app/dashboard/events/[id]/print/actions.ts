"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { canOrderPrint, printOrderSchema, printPriceCents } from "@/lib/print";
import { getStripe, stripeConfigured } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

export type PrintFormState = { error?: string };

export async function createPrintOrder(eventId: string, _prev: PrintFormState, formData: FormData): Promise<PrintFormState> {
  const { supabase, user } = await requireUser();
  const parsed = printOrderSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Please check the delivery details and quantity." };
  const input = parsed.data;

  const { data: event } = await supabase.from("events").select("id,title,starts_at").eq("id", eventId).maybeSingle();
  if (!event) return { error: "Event not found." };
  const timing = canOrderPrint(event.starts_at);
  if (!timing.ok) return { error: timing.reason };
  if (!stripeConfigured()) return { error: "Payments aren't enabled yet." };

  const price = printPriceCents({ quantity: input.quantity, mode: input.mode });
  const { quantity, mode, ...address } = input;
  // Ownership of the event was verified above through the RLS client; writes need the service role.
  const { data: order, error } = await createAdminClient()
    .from("print_orders")
    .insert({ user_id: user.id, event_id: eventId, quantity, mode, address, amount_cents: price.totalCents })
    .select("id")
    .single();
  if (error || !order) return { error: "Could not create the order. Please try again." };

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer_email: user.email ?? undefined,
    client_reference_id: user.id,
    line_items: [
      { quantity, price_data: { currency: "usd", unit_amount: price.unitCents, product_data: { name: `Printed invitation: ${event.title}` } } },
      { quantity: 1, price_data: { currency: "usd", unit_amount: price.shippingCents, product_data: { name: mode === "host" ? "Shipping to you" : "Mailing to each guest" } } },
    ],
    metadata: { kind: "print", event_id: eventId, user_id: user.id, print_order_id: order.id },
    success_url: `${env.siteUrl}/dashboard/events/${eventId}/print?paid=1`,
    cancel_url: `${env.siteUrl}/dashboard/events/${eventId}/print`,
  });
  // `orders` is service-role-write only, so the order row is created by the admin client.
  const { error: orderError } = await createAdminClient().from("orders").insert({
    user_id: user.id, kind: "print", event_id: eventId, amount_cents: price.totalCents,
    stripe_session_id: session.id, meta: { print_order_id: order.id },
  });
  if (orderError || !session.url) {
    await getStripe().checkout.sessions.expire(session.id).catch(() => undefined);
    return { error: "Could not start checkout. Please try again." };
  }
  redirect(session.url);
}
