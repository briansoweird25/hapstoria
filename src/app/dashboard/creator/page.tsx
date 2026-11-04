import type { Metadata } from "next";
import { TemplateStudio } from "@/components/template-studio";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/gifts";
import { CREATOR_SHARE_BPS, MIN_PAYOUT_CENTS, pendingPayoutCents } from "@/lib/marketplace";
import { applyCreator, startConnectOnboarding } from "./actions";

export const metadata: Metadata = { title: "Creator studio" };

const NOTICES: Record<string, string> = {
  applied: "Application received. We'll review it shortly.", invalid: "Please check your details.", failed: "Could not save.",
  payments_unavailable: "Payments aren't enabled yet.", not_approved: "Your profile must be approved first.",
  connected: "Thanks! Stripe will confirm your payout details shortly.", connect_retry: "Onboarding wasn't finished. You can restart it below.",
};
const usd = (c: number) => formatMoney(c, "USD");

export default async function CreatorPage({ searchParams }: PageProps<"/dashboard/creator">) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const { data: profile } = await supabase.from("creator_profiles").select("*").maybeSingle();
  const approved = profile?.status === "approved";
  const [{ data: templates }, { data: sales }, { data: payouts }] = approved
    ? await Promise.all([
        supabase.from("marketplace_templates").select("id,name,status,price_cents,rejection_reason").order("created_at", { ascending: false }),
        supabase.from("template_purchases").select("creator_share_cents,payout_id,price_cents"),
        supabase.from("payouts").select("id,amount_cents,status,created_at").order("created_at", { ascending: false }).limit(10),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const pending = pendingPayoutCents(sales ?? []);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-serif text-4xl">Creator studio</h1>
        <p className="text-sm text-muted">Design invitation templates and earn {CREATOR_SHARE_BPS / 100}% of every sale.</p>
        {sp.notice && <p role="status" className="mt-3 rounded-lg bg-champagne-soft p-3 text-sm">{NOTICES[String(sp.notice)] ?? ""}</p>}
      </div>

      <form action={applyCreator} className="card grid gap-3 sm:grid-cols-2">
        <h2 className="font-serif text-2xl sm:col-span-2">Creator profile {profile && <span className="ml-2 rounded-full bg-champagne-soft px-2 py-0.5 text-xs capitalize">{profile.status}</span>}</h2>
        <div><label className="label" htmlFor="display_name">Display name</label><input id="display_name" name="display_name" required defaultValue={profile?.display_name} className="input" /></div>
        <div><label className="label" htmlFor="country">Country (2-letter code)</label><input id="country" name="country" maxLength={2} defaultValue={profile?.country ?? ""} className="input uppercase" placeholder="PH" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="bio">About you</label><textarea id="bio" name="bio" rows={3} maxLength={500} defaultValue={profile?.bio ?? ""} className="input" /></div>
        <div className="sm:col-span-2"><button className="btn-soft">{profile ? "Update profile" : "Apply to become a creator"}</button></div>
      </form>

      {approved && (
        <>
          <section className="card space-y-4"><h2 className="font-serif text-2xl">New template</h2><TemplateStudio /></section>
          <section className="card">
            <h2 className="font-serif text-2xl">Your templates</h2>
            {!templates?.length ? <p className="mt-2 text-sm text-muted">None yet.</p> : (
              <ul className="mt-2 divide-y divide-line text-sm">{templates.map((t) => (
                <li key={t.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{t.name} · {usd(t.price_cents)}</span>
                  <span className="capitalize">{t.status}{t.rejection_reason ? `: ${t.rejection_reason}` : ""}</span></li>))}</ul>
            )}
          </section>
          <section className="card space-y-2">
            <h2 className="font-serif text-2xl">Earnings</h2>
            <p className="text-sm">Sales: {sales?.length ?? 0} · Unpaid balance: <strong>{usd(pending.cents)}</strong> {pending.payable ? "(paid out next cycle)" : `(paid out once you reach ${usd(MIN_PAYOUT_CENTS)})`}</p>
            {profile?.stripe_account_id
              ? <p className="text-xs text-muted">Payout account connected.</p>
              : <p className="text-xs text-muted">Connect a payout account to receive earnings.</p>}
            <form action={startConnectOnboarding}><button className="btn-ghost">{profile?.stripe_account_id ? "Update payout details" : "Set up payouts"}</button></form>
            {!!payouts?.length && <ul className="mt-2 text-xs text-muted">{payouts.map((p) => <li key={p.id}>{new Date(p.created_at).toLocaleDateString("en-US")}: {usd(p.amount_cents)} ({p.status})</li>)}</ul>}
          </section>
        </>
      )}
    </div>
  );
}
