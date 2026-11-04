import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatEventDate } from "@/lib/format";

export const metadata: Metadata = { title: "My events" };

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const { data: events } = await supabase
    .from("events")
    .select("id,title,kind,starts_at,timezone,published,owner_id,guests(count)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl">My events</h1>
      {!events?.length ? (
        <div className="card py-14 text-center">
          <p className="font-serif text-2xl">Your first celebration starts here</p>
          <p className="mt-1 text-sm text-muted">Create an invitation in a few minutes.</p>
          <Link href="/dashboard/events/new" className="btn-primary mt-5">Create invitation</Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/dashboard/events/${e.id}`} className="card block transition hover:border-champagne">
                <span className={`rounded-full px-2 py-0.5 text-xs ${e.published ? "bg-emerald-100 text-emerald-800" : "bg-champagne-soft text-muted"}`}>
                  {e.published ? "Published" : "Draft"}
                </span>
                {e.owner_id !== user.id && <span className="ml-2 rounded-full bg-lavender-soft px-2 py-0.5 text-xs">Shared with you</span>}
                <h2 className="mt-3 font-serif text-2xl">{e.title}</h2>
                <p className="text-sm text-muted">{formatEventDate(e.starts_at, e.timezone) || "Date not set"}</p>
                <p className="mt-3 text-xs text-muted">{e.guests?.[0]?.count ?? 0} guests on the list</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
