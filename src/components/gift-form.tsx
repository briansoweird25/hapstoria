"use client";

import { useActionState, useState } from "react";
import { pledgeGift, type PledgeState } from "@/app/e/[slug]/gifts/actions";
import { formatMoney, fundProgress } from "@/lib/gifts";
import type { PublicGifts } from "@/lib/public-gifts";

export function GiftForm({ slug, gifts }: { slug: string; gifts: PublicGifts }) {
  const [state, action, pending] = useActionState(pledgeGift.bind(null, slug), { ok: false } as PledgeState);
  const [target, setTarget] = useState<"fund" | "item" | "general">(gifts.funds.length ? "fund" : gifts.items.some((i) => !i.reserved) ? "item" : "general");
  const [anonymous, setAnonymous] = useState(false);
  const open = gifts.items.filter((i) => !i.reserved);

  if (state.ok) {
    return <div role="status" className="rounded-2xl bg-emerald-50 p-6 text-center"><p className="font-serif text-3xl">Thank you!</p><p className="mt-1 text-sm">Your gift has been noted for the hosts.</p></div>;
  }
  return (
    <div className="space-y-6">
      {gifts.methods.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-serif text-2xl">Send your gift</h2>
          <p className="text-sm opacity-70">Pay the hosts directly using any of these, then tell them below.</p>
          <ul className="space-y-3">
            {gifts.methods.map((m) => (
              <li key={m.id} className="rounded-2xl border border-black/10 bg-white/60 p-4">
                <p className="font-medium">{m.label}</p>
                {m.details && <p className="whitespace-pre-line text-sm opacity-80">{m.details}</p>}
                {m.url && <a href={m.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm underline">Open payment link</a>}
                {m.qrUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.qrUrl} alt={`${m.label} QR code`} className="mt-2 size-44 rounded-lg bg-white object-contain p-2" />}
              </li>
            ))}
          </ul>
        </section>
      )}
      <form action={action} className="space-y-4">
        <h2 className="font-serif text-2xl">Tell the hosts</h2>
        <input type="hidden" name="target" value={target} />
        <div className="flex flex-wrap gap-2">
          {gifts.funds.length > 0 && <button type="button" aria-pressed={target === "fund"} onClick={() => setTarget("fund")} className={`rounded-full border px-3 py-1 text-sm ${target === "fund" ? "bg-black text-white" : ""}`}>Cash fund</button>}
          {open.length > 0 && <button type="button" aria-pressed={target === "item"} onClick={() => setTarget("item")} className={`rounded-full border px-3 py-1 text-sm ${target === "item" ? "bg-black text-white" : ""}`}>Wishlist item</button>}
          <button type="button" aria-pressed={target === "general"} onClick={() => setTarget("general")} className={`rounded-full border px-3 py-1 text-sm ${target === "general" ? "bg-black text-white" : ""}`}>Cash gift</button>
        </div>
        {target === "fund" && (
          <div className="space-y-2">
            {gifts.funds.map((f, i) => {
              const pct = fundProgress(f.goal_cents, f.raised_cents);
              return (
                <label key={f.id} className="block rounded-xl border border-black/10 p-3 text-sm">
                  <input type="radio" name="target_id" value={f.id} defaultChecked={i === 0} className="mr-2" />{f.title}
                  {pct !== null && <span className="ml-2 opacity-60">{pct}% of {formatMoney(f.goal_cents!, "USD")}</span>}
                </label>
              );
            })}
          </div>
        )}
        {target === "item" && (
          <div className="space-y-2">
            {open.map((i, k) => (
              <label key={i.id} className="block rounded-xl border border-black/10 p-3 text-sm">
                <input type="radio" name="target_id" value={i.id} defaultChecked={k === 0} className="mr-2" />{i.title}
                {i.url && <a href={i.url} target="_blank" rel="noopener noreferrer" className="ml-2 underline">View</a>}
              </label>
            ))}
            <p className="text-xs opacity-60">Reserving marks the item as taken so no one buys a duplicate.</p>
          </div>
        )}
        {target !== "item" && (
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <div><label className="label" htmlFor="amount">Amount sent</label><input id="amount" name="amount" inputMode="decimal" required className="input" placeholder="50" /></div>
            <div><label className="label" htmlFor="currency">Currency</label><input id="currency" name="currency" defaultValue="USD" maxLength={3} className="input uppercase" /></div>
          </div>
        )}
        {gifts.allow_anonymous && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="anonymous" value="true" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="size-4" />Give anonymously (your name won&apos;t be saved)</label>
        )}
        {!anonymous && <div><label className="label" htmlFor="giver_name">Your name</label><input id="giver_name" name="giver_name" required maxLength={120} className="input" autoComplete="name" /></div>}
        <div><label className="label" htmlFor="message">Message (optional)</label><textarea id="message" name="message" rows={2} maxLength={500} className="input" /></div>
        {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
        <button className="btn-primary w-full" disabled={pending}>{pending ? "Sending…" : target === "item" ? "Reserve this item" : "I've sent my gift"}</button>
      </form>
      {gifts.wall && gifts.wall.length > 0 && (
        <section>
          <h2 className="mb-2 font-serif text-2xl">Gift wall</h2>
          <ul className="space-y-2 text-sm">
            {gifts.wall.map((w, i) => (
              <li key={i} className="rounded-xl bg-white/60 p-3"><strong>{w.giver}</strong>{w.amount_cents ? ` · ${formatMoney(w.amount_cents, w.currency)}` : ""}{w.message && <p className="opacity-80">“{w.message}”</p>}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
