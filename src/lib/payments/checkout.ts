import "server-only";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPaymongoCheckout, paymongoConfigured } from "./paymongo";
import { createPaypalOrder, paypalConfigured } from "./paypal";

export type Provider = "paymongo" | "paypal";

export function availableProviders(): Provider[] {
  return [...(paymongoConfigured() ? (["paymongo"] as const) : []), ...(paypalConfigured() ? (["paypal"] as const) : [])];
}

export function parseProvider(v: unknown): Provider | null {
  return v === "paymongo" || v === "paypal" ? v : null;
}

export interface CheckoutInput {
  provider: Provider;
  userId: string;
  kind: "event_premium" | "membership" | "print" | "template";
  amountCents: number;
  /** Shown to the customer on the payment page. */
  name: string;
  eventId?: string | null;
  meta?: Record<string, unknown>;
  /** Site paths (start with "/") to land on after paying or cancelling. */
  successPath: string;
  cancelPath: string;
  /** Print orders show unit price × quantity; everything else is a single line. */
  lineItems?: { name: string; amountCents: number; quantity: number }[];
}

/**
 * Records our order FIRST, then creates the payment page, then stores the provider's reference on the order.
 * If anything fails after the order was recorded, the order is removed so nobody is sent to pay for something we
 * couldn't match later.
 */
export async function startCheckout(input: CheckoutInput): Promise<{ url: string } | { error: string }> {
  if (!availableProviders().includes(input.provider)) return { error: "That payment method isn't available yet." };
  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("orders")
    .insert({
      user_id: input.userId, kind: input.kind, event_id: input.eventId ?? null, amount_cents: input.amountCents,
      provider: input.provider, provider_ref: `pending_${crypto.randomUUID()}`,
      meta: { ...(input.meta ?? {}), success_path: input.successPath, cancel_path: input.cancelPath },
    })
    .select("id")
    .single();
  if (error || !order) return { error: "Could not start checkout. Please try again." };

  try {
    const success = `${env.siteUrl}${input.successPath}`;
    const cancel = `${env.siteUrl}${input.cancelPath}`;
    const created =
      input.provider === "paymongo"
        ? await createPaymongoCheckout({
            description: input.name,
            lineItems: input.lineItems ?? [{ name: input.name, amountCents: input.amountCents, quantity: 1 }],
            successUrl: success,
            cancelUrl: cancel,
            metadata: { order_id: order.id, kind: input.kind },
          })
        : await createPaypalOrder({
            reference: order.id,
            description: input.name,
            amountCents: input.amountCents,
            returnUrl: `${env.siteUrl}/payments/paypal/return?order=${order.id}`,
            cancelUrl: cancel,
          });
    const { error: updateError } = await admin.from("orders").update({ provider_ref: created.id }).eq("id", order.id);
    if (updateError) throw new Error(updateError.message);
    return { url: created.url };
  } catch (e) {
    console.error("checkout failed", input.provider, input.kind, e);
    await admin.from("orders").delete().eq("id", order.id);
    return { error: "Could not reach the payment provider. Please try again." };
  }
}
