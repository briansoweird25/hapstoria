import type { Metadata } from "next";
import { PayButtons } from "@/components/pay-buttons";
import { requireUser } from "@/lib/auth";
import { PRICES, hasActiveSubscription, storageQuotaBytes, subscriptionAmount, type Tier } from "@/lib/billing";
import { formatPeso } from "@/lib/money";
import { availableProviders } from "@/lib/payments/checkout";
import { buyMembership } from "./actions";

export const metadata: Metadata = { title: "Billing" };

const PLANS: { tier: Tier; blurb: string }[] = [
  { tier: "keeper", blurb: "Keep every album after the event pass ends. 100 GB." },
  { tier: "keeper_plus", blurb: "More room and full-quality video. 500 GB." },
  { tier: "planner", blurb: "Up to 15 events at once, team access and a client-ready workspace." },
];

const dateFmt = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });

export default async function BillingPage({ searchParams }: PageProps<"/dashboard/billing">) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const providers = availableProviders();
  const [{ data: subs }, { data: orders }] = await Promise.all([
    supabase.from("subscriptions").select("id,tier,status,valid_until").order("valid_until", { ascending: false }),
    supabase.from("orders").select("id,kind,amount_cents,status,provider,created_at").order("created_at", { ascending: false }).limit(20),
  ]);
  const active = (subs ?? []).filter((s) => hasActiveSubscription({ status: s.status, tier: s.tier as Tier, valid_until: s.valid_until }));

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-4xl">Billing</h1>
      {sp.subscribed && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Thank you! GCash and card payments can take a minute to confirm; your plan will show below as soon as they do.</p>}
      {sp.payment === "failed" && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">The payment wasn&apos;t completed. You have not been charged unless your payment app says otherwise.</p>}
      {sp.error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{sp.error === "unavailable" ? "Payments aren't enabled yet." : "Something went wrong. Please try again."}</p>}

      {active.length > 0 && (
        <section className="card space-y-1">
          <p className="label">Your plans</p>
          {active.map((s) => (
            <p key={s.id} className="font-serif text-2xl">{PRICES[s.tier as Tier].label}
              {s.valid_until && <span className="ml-2 text-sm text-muted">active until {dateFmt(s.valid_until)}</span>}
            </p>
          ))}
          <p className="text-xs text-muted">Memberships are prepaid. We&apos;ll email you before one ends, and renewing adds time to what you have left.</p>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        {PLANS.map(({ tier, blurb }) => (
          <form key={tier} action={buyMembership} className="card flex flex-col gap-3">
            <input type="hidden" name="tier" value={tier} />
            <h2 className="font-serif text-2xl">{PRICES[tier].label}</h2>
            <p className="text-sm text-muted">{blurb}</p>
            <fieldset className="space-y-1 text-sm">
              <legend className="sr-only">Length</legend>
              <label className="flex items-center gap-2"><input type="radio" name="interval" value="month" defaultChecked /> 1 month · {formatPeso(subscriptionAmount(tier, "month"))}</label>
              <label className="flex items-center gap-2"><input type="radio" name="interval" value="year" /> 12 months · {formatPeso(subscriptionAmount(tier, "year"))} <span className="text-xs text-muted">(2 months free)</span></label>
            </fieldset>
            <p className="text-xs text-muted">{Math.round(storageQuotaBytes(tier) / 1024 ** 3)} GB</p>
            <div className="mt-auto"><PayButtons providers={providers} compact /></div>
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
                <td className="py-2">{new Date(o.created_at).toLocaleDateString("en-PH")}</td>
                <td>{o.kind.replace("_", " ")}</td><td>{formatPeso(o.amount_cents)}</td><td className="capitalize">{o.status}</td>
              </tr>))}</tbody>
          </table>
        )}
      </section>
    </div>
  );
}
