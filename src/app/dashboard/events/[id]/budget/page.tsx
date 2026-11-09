import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { budgetTotals, categoryBreakdown } from "@/lib/budget";
import { formatMoney } from "@/lib/gifts";
import { addBudgetItem, deleteBudgetItem, setTotalBudget, togglePaid } from "./actions";

export const metadata: Metadata = { title: "Budget" };
const usd = (c: number) => formatMoney(c, "PHP");

export default async function BudgetPage({ params, searchParams }: PageProps<"/dashboard/events/[id]/budget">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const { data: event } = await supabase.from("events").select("id,title,budget_cents").eq("id", id).maybeSingle();
  if (!event) notFound();
  const { data: items } = await supabase.from("budget_items").select("*").eq("event_id", id).order("created_at");
  const list = items ?? [];
  const totals = budgetTotals(list, event.budget_cents);
  const cats = categoryBreakdown(list);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href={`/dashboard/events/${id}`} className="text-sm text-muted hover:text-ink">← {event.title}</Link>
        <h1 className="font-serif text-4xl">Budget</h1>
        <p className="text-xs text-muted">Amounts are in Philippine pesos (PHP).</p>
        {sp.notice && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">Please check the amounts you entered.</p>}
      </div>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Budget", usd(event.budget_cents)], ["Committed", usd(totals.committed)], ["Paid", usd(totals.paid)], [totals.remaining >= 0 ? "Left to plan" : "Over estimate by", usd(Math.abs(totals.remaining))]].map(([l, v]) => (
          <div key={l} className="card text-center"><p className="font-serif text-2xl">{v}</p><p className="text-xs uppercase tracking-wider text-muted">{l}</p></div>
        ))}
      </section>
      {totals.overBudget && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">You&apos;re over budget. Committed spending exceeds your total.</p>}
      <form action={setTotalBudget.bind(null, id)} className="card flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="budget">Total budget</label><input id="budget" name="budget" inputMode="decimal" defaultValue={(event.budget_cents / 100).toString()} className="input w-40" /></div>
        <button className="btn-soft">Save</button>
      </form>
      <section className="card">
        <h2 className="font-serif text-2xl">Items</h2>
        {!list.length ? <p className="mt-2 text-sm text-muted">Add your first expense below.</p> : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted"><tr><th className="py-1">Item</th><th>Category</th><th>Estimate</th><th>Actual</th><th>Paid</th><th /></tr></thead>
            <tbody>{list.map((i) => (
              <tr key={i.id} className="border-t border-line">
                <td className="py-2">{i.title}</td><td>{i.category}</td><td>{usd(i.estimated_cents)}</td><td>{i.actual_cents === null ? "–" : usd(i.actual_cents)}</td>
                <td><form action={togglePaid.bind(null, id, i.id, !i.paid)}><button className="underline">{i.paid ? "Paid ✓" : "Mark paid"}</button></form></td>
                <td><form action={deleteBudgetItem.bind(null, id, i.id)}><button className="text-xs text-red-700 underline" aria-label={`Delete ${i.title}`}>Delete</button></form></td>
              </tr>))}
            </tbody>
          </table>
        )}
        <form action={addBudgetItem.bind(null, id)} className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-5">
          <input name="title" required className="input sm:col-span-2" placeholder="Item (e.g. Photographer)" aria-label="Item" />
          <input name="category" required className="input" placeholder="Category" aria-label="Category" list="cats" />
          <datalist id="cats">{["Venue", "Food", "Music", "Photo & video", "Decor", "Attire", "Invitations", "Other"].map((c) => <option key={c} value={c} />)}</datalist>
          <input name="estimated" required inputMode="decimal" className="input" placeholder="Estimate" aria-label="Estimate" />
          <input name="actual" inputMode="decimal" className="input" placeholder="Actual" aria-label="Actual" />
          <button className="btn-soft sm:col-span-5">Add item</button>
        </form>
      </section>
      {cats.length > 0 && (
        <section className="card"><h2 className="font-serif text-2xl">By category</h2>
          <ul className="mt-2 space-y-1 text-sm">{cats.map((c) => <li key={c.category} className="flex justify-between"><span>{c.category}</span><span>{usd(c.committed)}</span></li>)}</ul>
        </section>
      )}
    </div>
  );
}
