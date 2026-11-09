import crypto from "node:crypto";

/**
 * PayMongo webhook signature: header `Paymongo-Signature: t=<unix>,te=<test hex>,li=<live hex>` where each hex is
 * HMAC-SHA256 of `${t}.${rawBody}` with the webhook secret. The test-mode value goes in `te`, live in `li`.
 */
export function verifyPaymongoSignature(input: { header: string; rawBody: string; secret: string; livemode: boolean }): boolean {
  const parts = Object.fromEntries(
    input.header.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()] as const;
    }),
  );
  const t = parts.t;
  const provided = input.livemode ? parts.li : parts.te;
  if (!t || !provided) return false;
  const expected = crypto.createHmac("sha256", input.secret).update(`${t}.${input.rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export interface PaymongoEvent {
  eventId: string;
  type: string;
  livemode: boolean;
  checkoutSessionId: string | null;
}

/** Reads the parts of a webhook body we rely on; everything else is re-fetched from PayMongo's API. */
export function parsePaymongoEvent(body: unknown): PaymongoEvent | null {
  const data = (body as { data?: { id?: unknown; attributes?: { type?: unknown; livemode?: unknown; data?: { id?: unknown } } } } | null)?.data;
  if (!data || typeof data.id !== "string" || typeof data.attributes?.type !== "string") return null;
  const inner = data.attributes.data?.id;
  return {
    eventId: data.id,
    type: data.attributes.type,
    livemode: data.attributes.livemode === true,
    checkoutSessionId: typeof inner === "string" ? inner : null,
  };
}

/** Total centavos actually paid on a (re-fetched) checkout session: only payments with status "paid" count. */
export function paidCentsFromSession(session: unknown): number {
  const payments = (session as { attributes?: { payments?: unknown } } | null)?.attributes?.payments;
  if (!Array.isArray(payments)) return 0;
  return payments.reduce((sum: number, p: { attributes?: { status?: string; amount?: number } }) => {
    return p?.attributes?.status === "paid" && typeof p.attributes.amount === "number" ? sum + p.attributes.amount : sum;
  }, 0);
}
