import "server-only";
import { buildPaypalOrder, parsePaypalCapture, paypalApprovalUrl, type PaypalCapture } from "@/lib/payments/paypal-parse";

/*
 * PayPal Orders v2 (https://developer.paypal.com/docs/api/orders/v2/): create order -> customer approves on PayPal ->
 * we capture on return. Money moves only at capture, and we check the captured amount before granting anything.
 */
const BASE = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

export const paypalConfigured = () => Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);

let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!res.ok || !json.access_token) throw new Error(`PayPal auth failed (${res.status})`);
  cached = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 300) * 1000 };
  return json.access_token;
}

async function call(path: string, init: RequestInit & { requestId?: string }): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}),
    },
    cache: "no-store",
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

export async function createPaypalOrder(input: { reference: string; description: string; amountCents: number; returnUrl: string; cancelUrl: string }): Promise<{ id: string; url: string }> {
  const { status, json } = await call("/v2/checkout/orders", { method: "POST", body: JSON.stringify(buildPaypalOrder(input)), requestId: `create-${input.reference}` });
  const j = json as { id?: string; links?: { rel: string; href: string }[] };
  const url = paypalApprovalUrl(j.links);
  if (status >= 300 || !j.id || !url) throw new Error(`PayPal create order failed (${status}): ${JSON.stringify(json).slice(0, 300)}`);
  return { id: j.id, url };
}

/** Captures an approved order. If it was already captured (page refresh), reads its current state instead. */
export async function capturePaypalOrder(orderId: string): Promise<PaypalCapture> {
  const cap = await call(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", body: "{}", requestId: `capture-${orderId}` });
  if (cap.status < 300) return parsePaypalCapture(cap.json);
  const already = JSON.stringify(cap.json).includes("ORDER_ALREADY_CAPTURED");
  if (already) {
    const got = await call(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
    if (got.status < 300) return parsePaypalCapture(got.json);
  }
  throw new Error(`PayPal capture failed (${cap.status}): ${JSON.stringify(cap.json).slice(0, 300)}`);
}
