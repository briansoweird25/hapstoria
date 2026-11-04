import "server-only";
import { sendEmail } from "@/lib/email/send";
import { escapeHtml } from "@/lib/email/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BillingStore } from "./webhook-handler";

/** Supabase-backed implementation of the webhook persistence port (service role). */
export function createSupabaseBillingStore(): BillingStore {
  const admin = createAdminClient();
  return {
    async markEventProcessed(id, type) {
      const { error } = await admin.from("stripe_events").insert({ id, type });
      if (!error) return true;
      if (error.code === "23505") return false;
      throw new Error(`stripe_events insert failed: ${error.message}`);
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
      if (order.kind !== "print") return;
      const printId = order.meta?.print_order_id as string | undefined;
      if (!printId) return;
      await admin.from("print_orders").update({ status: "paid", updated_at: new Date().toISOString() }).eq("id", printId).eq("status", "awaiting_payment");
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
      const { error } = await admin
        .from("subscriptions")
        .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "stripe_subscription_id" });
      if (error) throw new Error(error.message);
    },
  };
}
