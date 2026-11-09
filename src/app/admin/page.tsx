import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvitationCard } from "@/components/invitation-card";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/gifts";
import { isAdminEmail, marketplaceTemplateId, MIN_PAYOUT_CENTS, pendingPayoutCents } from "@/lib/marketplace";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPayout, markPayoutPaid, reviewCreator, reviewTemplate } from "./actions";

export const metadata: Metadata = { title: "Admin review", robots: { index: false } };

export default async function AdminPage() {
  const { user } = await requireUser();
  if (!isAdminEmail(user.email, process.env.ADMIN_EMAILS)) notFound();
  const admin = createAdminClient();
  const [{ data: creators }, { data: templates }, { data: approvedCreators }, { data: pendingPayouts }] = await Promise.all([
    admin.from("creator_profiles").select("*").eq("status", "pending").order("created_at"),
    admin.from("marketplace_templates").select("*, creator_profiles(display_name)").eq("status", "pending").order("created_at"),
    admin.from("creator_profiles").select("user_id,display_name,payout_method,payout_details").eq("status", "approved"),
    admin.from("payouts").select("id,amount_cents,created_at,creator_profiles(display_name,payout_method,payout_details)").eq("status", "pending").order("created_at"),
  ]);
  // Unpaid earnings per approved creator (earnings are small in number; computed here rather than in SQL for clarity).
  const balances = await Promise.all(
    (approvedCreators ?? []).map(async (c) => {
      const { data: tpls } = await admin.from("marketplace_templates").select("id").eq("creator_id", c.user_id);
      const ids = (tpls ?? []).map((t) => t.id);
      const { data: sales } = ids.length
        ? await admin.from("template_purchases").select("creator_share_cents,payout_id").in("template_id", ids)
        : { data: [] as { creator_share_cents: number; payout_id: string | null }[] };
      return { ...c, ...pendingPayoutCents(sales ?? []) };
    }),
  );
  const owed = balances.filter((b) => b.cents > 0);
  type PayoutTarget = { display_name: string; payout_method: string | null; payout_details: string | null } | null;
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-5 py-8">
      <h1 className="font-serif text-4xl">Review queue</h1>
      <section className="card">
        <h2 className="font-serif text-2xl">Creator applications ({creators?.length ?? 0})</h2>
        {(creators ?? []).map((c) => (
          <div key={c.user_id} className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-sm">
            <div><p className="font-medium">{c.display_name} {c.country && `· ${c.country}`}</p><p className="text-muted">{c.bio}</p></div>
            <div className="flex gap-2">
              <form action={reviewCreator.bind(null, c.user_id, "approved")}><button className="btn-primary px-3 py-1.5">Approve</button></form>
              <form action={reviewCreator.bind(null, c.user_id, "rejected")}><button className="btn-ghost px-3 py-1.5">Reject</button></form>
            </div>
          </div>
        ))}
      </section>
      <section className="card">
        <h2 className="font-serif text-2xl">Templates ({templates?.length ?? 0})</h2>
        <div className="mt-3 grid gap-6 md:grid-cols-2">
          {(templates ?? []).map((t) => (
            <div key={t.id} className="space-y-2 border-t border-line pt-3">
              <InvitationCard compact data={{ title: t.name, template_id: marketplaceTemplateId(t.id), theme: { ...t.definition, id: marketplaceTemplateId(t.id) } }} />
              <p className="text-sm">{t.name} · {formatMoney(t.price_cents, "PHP")} · by {(t.creator_profiles as { display_name: string } | null)?.display_name}</p>
              <form action={reviewTemplate.bind(null, t.id)} className="flex flex-wrap gap-2">
                <input name="reason" className="input flex-1" placeholder="Reason (if rejecting)" aria-label="Rejection reason" />
                <button name="decision" value="approved" className="btn-primary px-3 py-1.5">Approve</button>
                <button name="decision" value="rejected" className="btn-ghost px-3 py-1.5">Reject</button>
              </form>
            </div>
          ))}
        </div>
      </section>
      <section className="card space-y-4">
        <h2 className="font-serif text-2xl">Creator payouts</h2>
        <p className="text-sm text-muted">Earnings are paid by hand. Start a payout (it locks the amount), send the money by GCash or PayPal, then record the reference.</p>
        {!owed.length && !pendingPayouts?.length && <p className="text-sm text-muted">Nothing owed right now.</p>}
        {owed.map((b) => (
          <div key={b.user_id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-sm">
            <div>
              <p className="font-medium">{b.display_name} · {formatMoney(b.cents, "PHP")} unpaid</p>
              <p className="text-muted">{b.payout_method ? `${b.payout_method}: ${b.payout_details}` : "No payout details yet"}</p>
            </div>
            {b.payable
              ? <form action={createPayout.bind(null, b.user_id)}><button className="btn-primary px-3 py-1.5">Start payout</button></form>
              : <span className="text-xs text-muted">Below the {formatMoney(MIN_PAYOUT_CENTS, "PHP")} minimum</span>}
          </div>
        ))}
        {(pendingPayouts ?? []).map((p) => {
          const target = p.creator_profiles as unknown as PayoutTarget;
          return (
            <form key={p.id} action={markPayoutPaid.bind(null, p.id)} className="flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm">
              <span className="flex-1">Pay <strong>{formatMoney(p.amount_cents, "PHP")}</strong> to {target?.display_name} via {target?.payout_method ?? "?"}: {target?.payout_details ?? "no details"}</span>
              <input name="reference" required className="input w-56" placeholder="Payment reference" aria-label="Payment reference" />
              <button className="btn-primary px-3 py-1.5">Mark paid</button>
            </form>
          );
        })}
      </section>
    </main>
  );
}
