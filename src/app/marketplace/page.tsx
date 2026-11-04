import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { InvitationCard } from "@/components/invitation-card";
import { getOptionalUser } from "@/lib/auth";
import { formatMoney } from "@/lib/gifts";
import { listMarketplace } from "@/lib/marketplace-data";
import { createClient } from "@/lib/supabase/server";
import { buyTemplate } from "./actions";

export const metadata: Metadata = { title: "Creator marketplace" };

const MESSAGES: Record<string, string> = {
  unavailable: "Payments aren't enabled yet.", invalid: "That template isn't available.", own: "That's your own template.", checkout: "Could not start checkout.",
};

export default async function MarketplacePage({ searchParams }: PageProps<"/marketplace">) {
  const sp = await searchParams;
  const [user, templates] = await Promise.all([getOptionalUser(), listMarketplace()]);
  const supabase = await createClient();
  const ownedIds = new Set<string>();
  if (user) {
    const { data } = await supabase.from("template_purchases").select("template_id").eq("buyer_id", user.id);
    (data ?? []).forEach((p) => ownedIds.add(p.template_id));
  }
  return (
    <>
      <SiteHeader signedIn={Boolean(user)} />
      <main className="mx-auto w-full max-w-6xl px-5 py-8">
        <h1 className="font-serif text-4xl">Creator marketplace</h1>
        <p className="mt-1 max-w-xl text-muted">Premium designs from independent creators around the world. Buy once, use on any of your events. Designer? <Link href="/dashboard/creator" className="underline">Become a creator</Link>.</p>
        {sp.purchased && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Thank you! The template will appear in your event editor in a moment.</p>}
        {sp.error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{MESSAGES[String(sp.error)] ?? "Something went wrong."}</p>}
        {!templates.length ? <p className="card mt-8 text-center text-sm text-muted">No templates yet. Check back soon.</p> : (
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <li key={t.id} className="space-y-3">
                <InvitationCard compact data={{ title: t.name, template_id: t.def.id, theme: t.def, host_names: `by ${t.creator_name}` }} />
                <div className="flex items-center justify-between gap-3">
                  <div><p className="font-medium">{t.name}</p><p className="text-xs text-muted">{t.culture || t.kind} · by {t.creator_name}</p></div>
                  {ownedIds.has(t.id) ? <span className="text-sm text-emerald-700">Owned ✓</span> : (
                    <form action={buyTemplate}><input type="hidden" name="template_id" value={t.id} /><button className="btn-soft">Buy · {formatMoney(t.price_cents, "USD")}</button></form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
