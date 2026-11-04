import "server-only";
import { splitRevenue } from "@/lib/marketplace";
import { sendEmail } from "@/lib/email/send";
import { escapeHtml } from "@/lib/email/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BillingStore } from "./webhook-handler";

/** Supabase-backed implementation of the webhook persistence port (service role). */
export function createSupabaseBillingStore(): BillingStore {
  const admin = createAdminClient();
  return {
    async claimEvent(id, type) {
      const { data, error } = await admin.rpc("claim_stripe_event", { p_id: id, p_type: type });
      if (error) throw new Error(`claim_stripe_event failed: ${error.message}`);
      return data as "claimed" | "done" | "busy";
    },
    async completeEvent(id) {
      const { error } = await admin.from("stripe_events").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    async failEvent(id) {
      await admin.from("stripe_events").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", id);
    },
    async markOrderPaid(sessionId) {
      const { data, error } = await admin
        .from("orders")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("stripe_session_id", sessionId)
        .select("kind,event_id,meta,user_id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    async setEventPremium(eventId, paidAtIso) {
      const { error } = await admin.from("events").update({ premium: true, premium_at: paidAtIso }).eq("id", eventId);
      if (error) throw new Error(error.message);
    },
    async onOrderPaid(order) {
      if (order.kind === "template") {
        const templateId = order.meta?.template_id as string | undefined;
        const priceCents = Number(order.meta?.price_cents);
        if (!templateId || !Number.isInteger(priceCents)) return;
        const { creatorCents, platformCents } = splitRevenue(priceCents);
        // unique (template_id, buyer_id) makes webhook replays harmless
        const { error } = await admin.from("template_purchases").upsert(
          { template_id: templateId, buyer_id: order.user_id, price_cents: priceCents, creator_share_cents: creatorCents, platform_fee_cents: platformCents },
          { onConflict: "template_id,buyer_id", ignoreDuplicates: true },
        );
        if (error) throw new Error(error.message);
        return;
      }
      if (order.kind !== "print") return;
      const printId = order.meta?.print_order_id as string | undefined;
      if (!printId) return;
      const { error: printError } = await admin.from("print_orders").update({ status: "paid", updated_at: new Date().toISOString() }).eq("id", printId).eq("status", "awaiting_payment");
      if (printError) throw new Error(printError.message); // surface so Stripe retries instead of losing the order
      // Fulfilment is manual for now: notify the operator so they can place the print job.
      const to = process.env.PRINT_NOTIFY_EMAIL;
      if (to) {
        await sendEmail(to, {
          subject: `New paid print order ${printId}`,
          html: `<p>Print order <strong>${escapeHtml(printId)}</strong> was paid. Open it in the Supabase table <code>print_orders</code>.</p>`,
          text: `Print order ${printId} was paid.`,
        });
      }
    },
    async upsertSubscription(row) {
      // Done in SQL so stale (out-of-order) events can't overwrite newer state.
      const { error } = await admin.rpc("upsert_subscription", {
        p_user_id: row.user_id, p_customer: row.stripe_customer_id, p_subscription: row.stripe_subscription_id,
        p_tier: row.tier, p_status: row.status, p_period_end: row.current_period_end,
        p_cancel_at_period_end: row.cancel_at_period_end, p_ended_at: row.ended_at, p_event_created: row.event_created,
      });
      if (error) throw new Error(error.message);
    },
  };
}
