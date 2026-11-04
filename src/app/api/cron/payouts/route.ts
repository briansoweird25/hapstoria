import { NextResponse, type NextRequest } from "next/server";
import { pendingPayoutCents } from "@/lib/marketplace";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

/**
 * Monthly job: transfers each creator's unpaid earnings (once above the minimum) to their
 * connected Stripe account. Purchases are claimed by a payout row first, so a failed transfer
 * releases them for the next run. Protected by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const stripe = getStripe();
  const result = { paid: 0, failed: 0, skipped: 0 };

  const { data: creators } = await admin.from("creator_profiles").select("user_id,stripe_account_id").eq("status", "approved").not("stripe_account_id", "is", null);
  for (const c of creators ?? []) {
    const { data: templates } = await admin.from("marketplace_templates").select("id").eq("creator_id", c.user_id);
    const templateIds = (templates ?? []).map((t) => t.id);
    if (!templateIds.length) continue;
    const { data: unpaid } = await admin.from("template_purchases").select("id,creator_share_cents,payout_id").in("template_id", templateIds).is("payout_id", null);
    const pending = pendingPayoutCents(unpaid ?? []);
    if (!pending.payable) { result.skipped++; continue; }

    const { data: payout } = await admin.from("payouts").insert({ creator_id: c.user_id, amount_cents: pending.cents }).select("id").single();
    if (!payout) continue;
    const ids = (unpaid ?? []).map((p) => p.id);
    await admin.from("template_purchases").update({ payout_id: payout.id }).in("id", ids).is("payout_id", null);
    try {
      const transfer = await stripe.transfers.create(
        { amount: pending.cents, currency: "usd", destination: c.stripe_account_id!, metadata: { payout_id: payout.id } },
        { idempotencyKey: `payout_${payout.id}` },
      );
      await admin.from("payouts").update({ status: "paid", stripe_transfer_id: transfer.id }).eq("id", payout.id);
      result.paid++;
    } catch (e) {
      console.error("payout failed", c.user_id, e);
      await admin.from("template_purchases").update({ payout_id: null }).eq("payout_id", payout.id);
      await admin.from("payouts").update({ status: "failed" }).eq("id", payout.id);
      result.failed++;
    }
  }
  return NextResponse.json(result);
}
