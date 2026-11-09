"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { isAdminEmail, pendingPayoutCents } from "@/lib/marketplace";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const { user } = await requireUser();
  if (!isAdminEmail(user.email, process.env.ADMIN_EMAILS)) notFound();
}

const decision = z.enum(["approved", "rejected"]);

export async function reviewCreator(userId: string, status: "approved" | "rejected") {
  await requireAdmin();
  const s = decision.parse(status);
  await createAdminClient().from("creator_profiles").update({ status: s }).eq("user_id", z.string().uuid().parse(userId));
  revalidatePath("/admin");
}

/**
 * Starts a payout for one creator: claims their unpaid earnings atomically (only rows still unclaimed are taken)
 * and records the total. The admin then pays by GCash/PayPal and marks it paid with a reference.
 */
export async function createPayout(creatorId: string) {
  await requireAdmin();
  const creator = z.string().uuid().parse(creatorId);
  const admin = createAdminClient();
  const { data: templates } = await admin.from("marketplace_templates").select("id").eq("creator_id", creator);
  const templateIds = (templates ?? []).map((t) => t.id);
  if (!templateIds.length) return;
  const { data: unpaid } = await admin.from("template_purchases").select("id,creator_share_cents,payout_id").in("template_id", templateIds).is("payout_id", null);
  if (pendingPayoutCents(unpaid ?? []).payable === false) return;

  const { data: payout } = await admin.from("payouts").insert({ creator_id: creator, amount_cents: 1 }).select("id").single();
  if (!payout) return;
  const { data: claimed } = await admin
    .from("template_purchases").update({ payout_id: payout.id }).in("id", (unpaid ?? []).map((p) => p.id)).is("payout_id", null).select("creator_share_cents");
  const { cents, payable } = pendingPayoutCents((claimed ?? []).map((r) => ({ creator_share_cents: r.creator_share_cents, payout_id: null })));
  if (!payable) {
    // Someone else claimed them in the meantime: release and stop.
    await admin.from("template_purchases").update({ payout_id: null }).eq("payout_id", payout.id);
    await admin.from("payouts").delete().eq("id", payout.id);
  } else {
    await admin.from("payouts").update({ amount_cents: cents }).eq("id", payout.id);
  }
  revalidatePath("/admin");
}

export async function markPayoutPaid(payoutId: string, formData: FormData) {
  await requireAdmin();
  const reference = String(formData.get("reference") ?? "").trim().slice(0, 120);
  if (!reference) return;
  await createAdminClient()
    .from("payouts").update({ status: "paid", reference, paid_at: new Date().toISOString() }).eq("id", z.string().uuid().parse(payoutId)).eq("status", "pending");
  revalidatePath("/admin");
}

export async function reviewTemplate(templateId: string, formData: FormData) {
  await requireAdmin();
  const s = decision.parse(formData.get("decision"));
  const reason = s === "rejected" ? String(formData.get("reason") ?? "").slice(0, 300) || "Needs changes" : null;
  await createAdminClient().from("marketplace_templates").update({ status: s, rejection_reason: reason }).eq("id", z.string().uuid().parse(templateId));
  revalidatePath("/admin");
}
