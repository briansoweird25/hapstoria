import "server-only";
import { CURRENCY } from "@/lib/money";

/*
 * PayMongo REST API (https://developers.paymongo.com). Written from the documented checkout-session flow:
 * create a checkout session, redirect the customer to its checkout_url, then confirm via webhook.
 * Verify field names against the current docs when you go live; the webhook handler re-fetches the session
 * from PayMongo and checks the paid amount, so a wrong assumption fails safe (no access is granted).
 */
const BASE = process.env.PAYMONGO_API_BASE ?? "https://api.paymongo.com/v1";

export const paymongoConfigured = () => Boolean(process.env.PAYMONGO_SECRET_KEY);

function authHeader(): string {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw new Error("Missing PAYMONGO_SECRET_KEY");
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: authHeader(), "Content-Type": "application/json", Accept: "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`PayMongo ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json as T;
}

export interface PaymongoCheckoutInput {
  description: string;
  lineItems: { name: string; amountCents: number; quantity: number }[];
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}

/** GCash, Maya and cards are all offered on PayMongo's hosted checkout page. */
export async function createPaymongoCheckout(input: PaymongoCheckoutInput): Promise<{ id: string; url: string }> {
  const json = await call<{ data: { id: string; attributes: { checkout_url: string } } }>("/checkout_sessions", {
    method: "POST",
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: input.lineItems.map((l) => ({ name: l.name, amount: l.amountCents, currency: CURRENCY, quantity: l.quantity })),
          payment_method_types: ["gcash", "paymaya", "card"],
          description: input.description,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          metadata: input.metadata,
        },
      },
    }),
  });
  return { id: json.data.id, url: json.data.attributes.checkout_url };
}

/** The authoritative state of a checkout session (never trust the webhook body alone). */
export async function getPaymongoCheckout(id: string): Promise<unknown> {
  const json = await call<{ data: unknown }>(`/checkout_sessions/${encodeURIComponent(id)}`);
  return json.data;
}
