import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { PRICES, hasActiveSubscription, subscriptionAmount, storageQuotaBytes, type Tier } from "@/lib/billing";
import { openPortal, subscribe } from "./actions";

export const metadata: Metadata = { title: "Billing" };

const usd = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

const PLANS: { tier: Tier; blurb: string }[] = [
  { tier: "keeper", blurb: "Keep every album after the event pass ends. 100 GB." },
  { tier: "keeper_plus", blurb: "More room and full-quality video. 500 GB." },
  { tier: "planner", blurb: "Up to 15 events at once, team access and a client-ready workspace." },
];

export default async function BillingPage({ searchParams }: PageProps<"/dashboard/billing">) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const [{ data: subs }, { data: orders }] = await Promise.all([
    supabase.from("subscriptions").select("*").order("updated_at", { ascending: false }),
    supabase.from("orders").select("id,kind,amount_cents,status,created_at").order("created_at", { ascending: false }).limit(20),
  ]);
  const active = (subs ?? []).filter((s) => hasActiveSubscription(s as { status: string; tier: Tier }));

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-4xl">Billing</h1>
      {sp.subscribed && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Thank you! Your plan will show here in a moment.</p>}
      {sp.error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{sp.error === "unavailable" ? "Payments aren't enabled yet." : "Something went wrong. Please try again."}</p>}

      {active.length > 0 && (
        <section className="card flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="label">Current plan</p>
            {active.map((s) => (
              <p key={s.id} className="font-serif text-2xl">{PRICES[s.tier as Tier].label}
                <span className="ml-2 text-sm text-muted">
                  {s.cancel_at_period_end ? "ends" : "renews"} {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString("en-US") : ""}
                </span>
              </p>
            ))}
          </div>
          <form action={openPortal}><button className="btn-ghost">Manage billing</button></form>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        {PLANS.map(({ tier, blurb }) => (
          <form key={tier} action={subscribe} className="card flex flex-col gap-3">
            <input type="hidden" name="tier" value={tier} />
            <h2 className="font-serif text-2xl">{PRICES[tier].label}</h2>
            <p className="text-sm text-muted">{blurb}</p>
            <p className="font-serif text-3xl">{usd(subscriptionAmount(tier, "month"))}<span className="text-sm text-muted"> / month</span></p>
            <p className="text-xs text-muted">{Math.round(storageQuotaBytes(tier) / 1024 ** 3)} GB · or {usd(subscriptionAmount(tier, "year"))}/year (2 months free)</p>
            <div className="mt-auto flex gap-2">
              <button name="interval" value="month" className="btn-primary flex-1">Monthly</button>
              <button name="interval" value="year" className="btn-soft flex-1">Yearly</button>
            </div>
          </form>
        ))}
      </section>

      <section className="card">
        <h2 className="font-serif text-2xl">Orders</h2>
        {!orders?.length ? <p className="mt-2 text-sm text-muted">No orders yet.</p> : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted"><tr><th className="py-1">Date</th><th>Item</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>{orders.map((o) => (
              <tr key={o.id} className="border-t border-line">
                <td className="py-2">{new Date(o.created_at).toLocaleDateString("en-US")}</td>
                <td>{o.kind.replace("_", " ")}</td><td>{usd(o.amount_cents)}</td><td className="capitalize">{o.status}</td>
              </tr>))}</tbody>
          </table>
        )}
      </section>
    </div>
  );
}
