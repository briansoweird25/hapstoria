import { CURRENCY, centsToDecimal } from "@/lib/money";

export function buildPaypalOrder(input: { reference: string; description: string; amountCents: number; returnUrl: string; cancelUrl: string }) {
  return {
    intent: "CAPTURE" as const,
    purchase_units: [
      {
        reference_id: "default",
        custom_id: input.reference, // our order id, echoed back in the capture
        description: input.description.slice(0, 127),
        amount: { currency_code: CURRENCY, value: centsToDecimal(input.amountCents) },
      },
    ],
    payment_source: {
      paypal: {
        experience_context: { return_url: input.returnUrl, cancel_url: input.cancelUrl, user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING" },
      },
    },
  };
}

export function paypalApprovalUrl(links: { rel: string; href: string }[] | undefined): string | null {
  const link = links?.find((l) => l.rel === "payer-action") ?? links?.find((l) => l.rel === "approve");
  return link?.href ?? null;
}

export interface PaypalCapture {
  orderId: string;
  completed: boolean;
  paidCents: number;
  currency: string;
}

/** Reads a capture response: only a COMPLETED order with a COMPLETED capture counts as paid. */
export function parsePaypalCapture(json: unknown): PaypalCapture {
  const j = json as { id?: string; status?: string; purchase_units?: { payments?: { captures?: { status?: string; amount?: { currency_code?: string; value?: string } }[] } }[] } | null;
  const capture = j?.purchase_units?.[0]?.payments?.captures?.[0];
  const value = capture?.amount?.value;
  const cents = value && /^\d+(\.\d{1,2})?$/.test(value) ? Math.round(Number(value) * 100) : 0;
  return {
    orderId: j?.id ?? "",
    completed: j?.status === "COMPLETED" && capture?.status === "COMPLETED",
    paidCents: cents,
    currency: capture?.amount?.currency_code ?? "",
  };
}
