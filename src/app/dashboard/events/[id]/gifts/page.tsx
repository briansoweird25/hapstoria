import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QrUpload } from "@/components/qr-upload";
import { requireUser } from "@/lib/auth";
import { METHOD_KINDS, displayGiver, formatMoney, fundProgress } from "@/lib/gifts";
import { addFund, addItem, addMethod, deleteFund, deleteItem, deleteMethod, saveGiftSettings, toggleMethod, updateGift } from "./actions";

export const metadata: Metadata = { title: "Gifts" };

function Check({ name, label, on }: { name: string; label: string; on: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={on} className="size-4 accent-[var(--champagne)]" />{label}</label>
  );
}

export default async function GiftsPage({ params, searchParams }: PageProps<"/dashboard/events/[id]/gifts">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user } = await requireUser();
  const { data: event } = await supabase.from("events").select("id,title,slug,owner_id,gifts_enabled,gift_allow_anonymous,gift_show_amounts,gift_public_wall").eq("id", id).maybeSingle();
  if (!event) notFound();
  const [{ data: methods }, { data: funds }, { data: items }, { data: gifts }] = await Promise.all([
    supabase.from("gift_methods").select("*").eq("event_id", id).order("created_at"),
    supabase.from("gift_funds").select("*").eq("event_id", id).order("created_at"),
    supabase.from("gift_items").select("*").eq("event_id", id).order("created_at"),
    supabase.from("gifts").select("*").eq("event_id", id).order("created_at", { ascending: false }),
  ]);
  const raised = (fundId: string) => (gifts ?? []).filter((g) => g.fund_id === fundId).reduce((s, g) => s + g.amount_cents, 0);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href={`/dashboard/events/${id}`} className="text-sm text-muted hover:text-ink">← {event.title}</Link>
        <h1 className="font-serif text-4xl">Gifts</h1>
        <p className="text-sm text-muted">Guests pay you directly. Hapstoria never holds the money; it only records who gave so you can say thank you.</p>
        {sp.notice === "invalid" && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">Please check what you entered. Links must start with https://.</p>}
      </div>

      <form action={saveGiftSettings.bind(null, id)} className="card space-y-3">
        <h2 className="font-serif text-2xl">Settings</h2>
        <Check name="gifts_enabled" label="Show the gift page on my invitation" on={event.gifts_enabled} />
        <Check name="gift_allow_anonymous" label="Let guests give anonymously" on={event.gift_allow_anonymous} />
        <Check name="gift_public_wall" label="Show a public gift wall (givers and messages)" on={event.gift_public_wall} />
        <Check name="gift_show_amounts" label="Show amounts on the wall" on={event.gift_show_amounts} />
        <button className="btn-soft">Save settings</button>
        {event.gifts_enabled && <p className="text-xs text-muted">Guest link: <Link className="underline" href={`/e/${event.slug}/gifts`} target="_blank">/e/{event.slug}/gifts</Link></p>}
      </form>

      <section className="card space-y-3">
        <h2 className="font-serif text-2xl">How guests can pay you</h2>
        <ul className="divide-y divide-line text-sm">
          {(methods ?? []).map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>{m.label} <span className="text-xs text-muted">({m.kind}{m.qr_path ? ", QR" : ""}{m.enabled ? "" : ", hidden"})</span></span>
              <span className="flex gap-2">
                <form action={toggleMethod.bind(null, id, m.id, !m.enabled)}><button className="text-xs underline">{m.enabled ? "Hide" : "Show"}</button></form>
                <form action={deleteMethod.bind(null, id, m.id)}><button className="text-xs text-red-700 underline">Delete</button></form>
              </span>
            </li>
          ))}
        </ul>
        <form action={addMethod.bind(null, id)} className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="kind">Type</label>
            <select id="kind" name="kind" className="input">{METHOD_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select></div>
          <div><label className="label" htmlFor="label">Label</label><input id="label" name="label" className="input" required placeholder="GCash, PayPal, Bank transfer…" /></div>
          <div><label className="label" htmlFor="url">Payment link (https://…)</label><input id="url" name="url" className="input" placeholder="https://paypal.me/yourname" /></div>
          <div><label className="label" htmlFor="details">Account details (optional)</label><input id="details" name="details" className="input" placeholder="Account name, number, bank" /></div>
          {event.owner_id === user.id && <div className="sm:col-span-2"><QrUpload userId={user.id} /></div>}
          <div className="sm:col-span-2"><button className="btn-soft">Add payment method</button></div>
        </form>
      </section>

      <section className="card space-y-3">
        <h2 className="font-serif text-2xl">Cash funds</h2>
        {(funds ?? []).map((f) => {
          const pct = fundProgress(f.goal_cents, raised(f.id));
          return (
            <div key={f.id} className="space-y-1">
              <div className="flex justify-between text-sm"><span>{f.title}</span>
                <span>{formatMoney(raised(f.id), "USD")}{f.goal_cents ? ` of ${formatMoney(f.goal_cents, "USD")}` : ""}
                  <form action={deleteFund.bind(null, id, f.id)} className="ml-2 inline"><button className="text-xs text-red-700 underline">Delete</button></form></span></div>
              {pct !== null && <div className="h-2 rounded-full bg-champagne-soft" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-2 rounded-full bg-champagne" style={{ width: `${pct}%` }} /></div>}
            </div>
          );
        })}
        <form action={addFund.bind(null, id)} className="flex flex-wrap gap-2 border-t border-line pt-3">
          <input name="title" required className="input flex-1" placeholder="Honeymoon, Tuition, 18th birthday fund…" aria-label="Fund name" />
          <input name="goal" className="input w-40" placeholder="Goal (optional)" aria-label="Goal amount" inputMode="decimal" />
          <button className="btn-soft">Add fund</button>
        </form>
      </section>

      <section className="card space-y-3">
        <h2 className="font-serif text-2xl">Wishlist</h2>
        <ul className="divide-y divide-line text-sm">
          {(items ?? []).map((i) => (
            <li key={i.id} className="flex justify-between gap-2 py-2">
              <span>{i.url ? <a href={i.url} target="_blank" rel="noreferrer" className="underline">{i.title}</a> : i.title}{i.reserved_at && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Reserved</span>}</span>
              <form action={deleteItem.bind(null, id, i.id)}><button className="text-xs text-red-700 underline">Delete</button></form>
            </li>
          ))}
        </ul>
        <form action={addItem.bind(null, id)} className="flex flex-wrap gap-2 border-t border-line pt-3">
          <input name="title" required className="input flex-1" placeholder="Item" aria-label="Item name" />
          <input name="url" className="input flex-1" placeholder="Store link (https://…)" aria-label="Store link" />
          <button className="btn-soft">Add item</button>
        </form>
      </section>

      <section className="card">
        <h2 className="font-serif text-2xl">Received</h2>
        {!gifts?.length ? <p className="mt-2 text-sm text-muted">No gifts recorded yet.</p> : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted"><tr><th className="py-1">From</th><th>Gift</th><th>Status</th><th>Thanked</th></tr></thead>
            <tbody>{gifts.map((g) => (
              <tr key={g.id} className="border-t border-line align-top">
                <td className="py-2">{displayGiver(g)}{g.message && <p className="text-xs text-muted">“{g.message}”</p>}</td>
                <td>{g.item_id ? "Wishlist item" : formatMoney(g.amount_cents, g.currency)}</td>
                <td><form action={updateGift.bind(null, id, g.id, { status: g.status === "received" ? "pledged" : "received" })}><button className="underline">{g.status === "received" ? "Received ✓" : "Mark received"}</button></form></td>
                <td><form action={updateGift.bind(null, id, g.id, { thanked: !g.thanked })}><button className="underline">{g.thanked ? "Thanked ✓" : "Mark thanked"}</button></form></td>
              </tr>))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
