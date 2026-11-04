import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { tableUsage } from "@/lib/seating";
import { addTable, assignGuest, deleteTable, runAutoSeat } from "./actions";

export const metadata: Metadata = { title: "Seating plan" };

export default async function SeatingPage({ params, searchParams }: PageProps<"/dashboard/events/[id]/seating">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const { data: event } = await supabase.from("events").select("id,title").eq("id", id).maybeSingle();
  if (!event) notFound();
  const [{ data: tables }, { data: guests }] = await Promise.all([
    supabase.from("seating_tables").select("*").eq("event_id", id).order("created_at"),
    supabase.from("guests").select("id,name,party_size,status,table_id").eq("event_id", id).eq("status", "accepted").order("name"),
  ]);
  const t = tables ?? [];
  const g = guests ?? [];
  const usage = tableUsage(t, g);
  const unseated = g.filter((x) => !x.table_id);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/events/${id}`} className="text-sm text-muted hover:text-ink">← {event.title}</Link>
        <h1 className="font-serif text-4xl">Seating plan</h1>
        <p className="text-sm text-muted">Only guests who accepted appear here. Party size counts toward table capacity.</p>
        {sp.notice && <p role="alert" className="mt-2 rounded-lg bg-lavender-soft p-3 text-sm">{sp.notice === "invalid" ? "Please enter a table name and a capacity between 1 and 30." : String(sp.notice)}</p>}
      </div>

      <form action={addTable.bind(null, id)} className="card flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="name">Table name</label><input id="name" name="name" className="input" required placeholder="Table 1" /></div>
        <div><label className="label" htmlFor="capacity">Seats</label><input id="capacity" name="capacity" type="number" min={1} max={30} defaultValue={8} className="input w-24" /></div>
        <button className="btn-soft">Add table</button>
        <button formAction={runAutoSeat.bind(null, id)} formNoValidate className="btn-ghost" disabled={!t.length || !unseated.length}>Auto-seat {unseated.length} unseated</button>
      </form>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {t.map((table) => (
          <section key={table.id} className="card space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl">{table.name}</h2>
              <span className={`text-sm ${usage[table.id] >= table.capacity ? "text-red-700" : "text-muted"}`}>{usage[table.id]}/{table.capacity}</span>
            </div>
            <ul className="space-y-1 text-sm">
              {g.filter((x) => x.table_id === table.id).map((x) => (
                <li key={x.id} className="flex justify-between"><span>{x.name}{x.party_size > 1 ? ` (+${x.party_size - 1})` : ""}</span></li>
              ))}
            </ul>
            <form action={deleteTable.bind(null, id, table.id)}><button className="text-xs text-red-700 underline">Delete table</button></form>
          </section>
        ))}
      </div>

      <section className="card">
        <h2 className="font-serif text-2xl">Guests</h2>
        {!g.length ? <p className="mt-2 text-sm text-muted">No accepted guests yet.</p> : (
          <ul className="mt-2 divide-y divide-line text-sm">
            {g.map((x) => (
              <li key={x.id}>
                <form action={assignGuest.bind(null, id, x.id)} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{x.name}{x.party_size > 1 ? ` · party of ${x.party_size}` : ""}</span>
                  <span className="flex gap-2">
                    <select name="table_id" defaultValue={x.table_id ?? ""} className="input w-40 py-1" aria-label={`Table for ${x.name}`}>
                      <option value="">Unseated</option>
                      {t.map((tb) => <option key={tb.id} value={tb.id}>{tb.name}</option>)}
                    </select>
                    <button className="btn-ghost px-3 py-1">Save</button>
                  </span>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
