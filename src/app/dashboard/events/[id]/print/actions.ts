"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { parseProvider, startCheckout } from "@/lib/payments/checkout";
import { canOrderPrint, printOrderSchema, printPriceCents } from "@/lib/print";
import { createAdminClient } from "@/lib/supabase/admin";

export type PrintFormState = { error?: string };

export async function createPrintOrder(eventId: string, _prev: PrintFormState, formData: FormData): Promise<PrintFormState> {
  const { supabase, user } = await requireUser();
  const provider = parseProvider(formData.get("provider"));
  if (!provider) return { error: "Choose how you'd like to pay." };
  const parsed = printOrderSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Please check the delivery details and quantity." };
  const input = parsed.data;

  const { data: event } = await supabase.from("events").select("id,title,starts_at,owner_id").eq("id", eventId).maybeSingle();
  if (!event || event.owner_id !== user.id) return { error: "Event not found." };
  const timing = canOrderPrint(event.starts_at);
  if (!timing.ok) return { error: timing.reason };

  const price = printPriceCents({ quantity: input.quantity, mode: input.mode });
  const { quantity, mode, ...address } = input;
  const admin = createAdminClient();
  // Ownership of the event was verified above through the RLS client; writes need the service role.
  const { data: printOrder, error } = await admin
    .from("print_orders")
    .insert({ user_id: user.id, event_id: eventId, quantity, mode, address, amount_cents: price.totalCents })
    .select("id")
    .single();
  if (error || !printOrder) return { error: "Could not create the order. Please try again." };

  const result = await startCheckout({
    provider,
    userId: user.id,
    kind: "print",
    eventId,
    amountCents: price.totalCents,
    name: `Printed invitations: ${event.title}`,
    meta: { print_order_id: printOrder.id },
    successPath: `/dashboard/events/${eventId}/print?paid=1`,
    cancelPath: `/dashboard/events/${eventId}/print`,
    lineItems: [
      { name: `Printed invitation x ${quantity}`, amountCents: price.unitCents, quantity },
      { name: mode === "host" ? "Shipping to you" : "Mailing to each guest", amountCents: price.shippingCents, quantity: 1 },
    ],
  });
  if ("error" in result) {
    await admin.from("print_orders").delete().eq("id", printOrder.id);
    return { error: result.error };
  }
  redirect(result.url);
}
