import { NextResponse, type NextRequest } from "next/server";
import { pendingPayoutCents } from "@/lib/marketplace";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

type Admin = ReturnType<typeof createAdminClient>;

/** Errors where Stripe definitely did NOT create the transfer, so the claimed earnings can be released. */
function isDefiniteFailure(e: unknown): boolean {
  const type = (e as { type?: string } | null)?.type;
  return type === "StripeInvalidRequestError" || type === "StripePermissionError" || type === "StripeAuthenticationError";
}

async function sendTransfer(admin: Admin, payoutId: string, amountCents: number, destination: string): Promise<"paid" | "failed" | "unknown"> {
  try {
    // The idempotency key is the payout id, so retrying an ambiguous attempt can never pay twice.
    const transfer = await getStripe().transfers.create(
      { amount: amountCents, currency: "usd", destination, metadata: { payout_id: payoutId } },
      { idempotencyKey: `payout_${payoutId}` },
    );
    await admin.from("payouts").update({ status: "paid", stripe_transfer_id: transfer.id }).eq("id", payoutId);
    return "paid";
  } catch (e) {
    if (isDefiniteFailure(e)) {
      await admin.from("template_purchases").update({ payout_id: null }).eq("payout_id", payoutId);
      await admin.from("payouts").update({ status: "failed" }).eq("id", payoutId);
      console.error("payout failed", payoutId, e);
      return "failed";
    }
    // Network error/timeout: Stripe may or may not have created the transfer. Leave the payout pending with its
    // earnings still claimed; the next run retries with the same idempotency key.
    console.error("payout outcome unknown, will retry", payoutId, e);
    return "unknown";
  }
}

/**
 * Monthly job: transfers each creator's unpaid earnings (once above the minimum) to their connected
 * Stripe account. Earnings are claimed atomically by a payout row, only the rows actually claimed are paid,
 * and pending payouts from earlier ambiguous attempts are retried first. Protected by CRON_SECRET (sent by netlify/functions/cron-payouts.mts).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const result = { paid: 0, failed: 0, unknown: 0, skipped: 0 };
  const count = (r: "paid" | "failed" | "unknown") => { result[r]++; };

  const { data: creators } = await admin.from("creator_profiles").select("user_id,stripe_account_id").eq("status", "approved").not("stripe_account_id", "is", null);
  for (const c of creators ?? []) {
    // 1. Retry payouts whose outcome was unclear last time (same idempotency key).
    const { data: pendingPayouts } = await admin.from("payouts").select("id,amount_cents").eq("creator_id", c.user_id).eq("status", "pending");
    for (const p of pendingPayouts ?? []) count(await sendTransfer(admin, p.id, p.amount_cents, c.stripe_account_id!));

    // 2. New payout for unclaimed earnings.
    const { data: templates } = await admin.from("marketplace_templates").select("id").eq("creator_id", c.user_id);
    const templateIds = (templates ?? []).map((t) => t.id);
    if (!templateIds.length) continue;
    const { data: unpaid } = await admin.from("template_purchases").select("id,creator_share_cents,payout_id").in("template_id", templateIds).is("payout_id", null);
    if (!pendingPayoutCents(unpaid ?? []).payable) { result.skipped++; continue; }

    const { data: payout } = await admin.from("payouts").insert({ creator_id: c.user_id, amount_cents: 1 }).select("id").single();
    if (!payout) continue;
    // Claim: only rows still unclaimed are taken, and the amount is computed from what we actually claimed.
    const { data: claimed } = await admin.from("template_purchases")
      .update({ payout_id: payout.id }).in("id", (unpaid ?? []).map((p) => p.id)).is("payout_id", null).select("creator_share_cents");
    const { cents, payable } = pendingPayoutCents((claimed ?? []).map((r) => ({ creator_share_cents: r.creator_share_cents, payout_id: null })));
    if (!payable) {
      // Another run claimed them (or the total fell below the minimum): release and move on.
      await admin.from("template_purchases").update({ payout_id: null }).eq("payout_id", payout.id);
      await admin.from("payouts").delete().eq("id", payout.id);
      result.skipped++;
      continue;
    }
    await admin.from("payouts").update({ amount_cents: cents }).eq("id", payout.id);
    count(await sendTransfer(admin, payout.id, cents, c.stripe_account_id!));
  }
  return NextResponse.json(result);
}
