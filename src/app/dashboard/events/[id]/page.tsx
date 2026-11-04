import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ConfirmButton } from "@/components/confirm-button";
import { CopyButton } from "@/components/copy-button";
import { requireUser } from "@/lib/auth";
import { getAlbumStatus } from "@/lib/album";
import { env } from "@/lib/env";
import { formatEventDate } from "@/lib/format";
import { summarizeGuests } from "@/lib/stats";
import { buyPremium } from "../../billing/actions";
import { deleteEvent, importGuests, removeGuest, sendRsvpReminders, setPublished } from "../actions";

export const metadata: Metadata = { title: "Event" };

const STATUS_STYLE = {
  accepted: "bg-emerald-100 text-emerald-800",
  declined: "bg-red-100 text-red-800",
  pending: "bg-champagne-soft text-muted",
} as const;

function noticeText(n: string): string {
  if (n === "guest_limit") return "The free plan allows 30 guests. Upgrade to Premium to add more.";
  if (n === "email_unavailable") return "Email sending isn't set up yet, so no reminders were sent.";
  if (n === "reminder_unpublished") return "Publish the invitation before sending reminders.";
  const m = /^reminded_(\d+)$/.exec(n);
  if (m) return `Reminder sent to ${m[1]} ${m[1] === "1" ? "guest" : "guests"}.`;
  return "Could not complete that action.";
}

export default async function EventDashboard({ params, searchParams }: PageProps<"/dashboard/events/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const filter = typeof sp.status === "string" ? sp.status : "all";
  const { supabase } = await requireUser();

  const { data: event } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!event) notFound();
  const [{ data: guests }, { count: pendingUploads }] = await Promise.all([
    supabase.from("guests").select("*").eq("event_id", id).order("name"),
    supabase.from("uploads").select("id", { count: "exact", head: true }).eq("event_id", id).eq("status", "pending"),
  ]);

  const album = await getAlbumStatus(event, supabase);
  const all = guests ?? [];
  const summary = summarizeGuests(all);
  const shown = filter === "all" ? all : all.filter((g) => g.status === filter);
  const inviteUrl = `${env.siteUrl}/e/${event.slug}`;
  const qr = await QRCode.toDataURL(`${inviteUrl}/upload`, { margin: 1, width: 240 });
  const meals = Object.entries(summary.meals);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">{event.title}</h1>
          <p className="text-sm text-muted">{formatEventDate(event.starts_at, event.timezone) || "Date not set"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/events/${id}/edit`} className="btn-ghost">Edit</Link>
          <Link href={`/dashboard/events/${id}/memories`} className="btn-ghost">
            Memories{pendingUploads ? ` (${pendingUploads} to review)` : ""}
          </Link>
          <Link href={`/dashboard/events/${id}/collage`} className="btn-ghost">Collage</Link>
          <Link href={`/dashboard/events/${id}/print`} className="btn-ghost">Print cards</Link>
          <form action={setPublished.bind(null, id, !event.published)}>
            <button className={event.published ? "btn-ghost" : "btn-primary"}>{event.published ? "Unpublish" : "Publish invitation"}</button>
          </form>
        </div>
      </div>

      {sp.notice && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {noticeText(String(sp.notice))}
        </p>
      )}
      <section aria-label="Plan" className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label">{event.premium ? "Premium event" : "Free plan · up to 30 guests"}</p>
          <p className="text-sm">
            {album.state === "kept" && "Your Memory Keeper plan keeps this album safe."}
            {album.state === "active" && `Album stays online for ${album.daysLeft} more days.`}
            {album.state === "expiring" && `Album expires in ${album.daysLeft} days. Download everything or subscribe to Memory Keeper.`}
            {album.state === "grace" && "Album has expired and will be deleted soon. Download your files or subscribe to keep them."}
            {album.state === "deleted" && "Album files have been removed."}
          </p>
        </div>
        <div className="flex gap-2">
          {!event.premium && (
            <form action={buyPremium.bind(null, id)}><button className="btn-primary">Upgrade to Premium · $36</button></form>
          )}
          {album.state !== "kept" && <Link href="/dashboard/billing" className="btn-ghost">Memory Keeper</Link>}
        </div>
      </section>

      {!event.published && (
        <p className="rounded-xl bg-lavender-soft p-4 text-sm">This invitation is a draft. Guests can&apos;t open the link until you publish it.</p>
      )}

      <section aria-label="Headcount" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Headcount", summary.headcount], ["Accepted", summary.accepted], ["Declined", summary.declined],
          ["Pending", summary.pending], ["Invited", summary.invited],
        ].map(([label, n]) => (
          <div key={label} className="card text-center">
            <p className="font-serif text-4xl">{n}</p>
            <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-2xl">Guest list</h2>
            <form action={sendRsvpReminders.bind(null, id)}><button className="btn-ghost px-3 py-1.5 text-xs">Remind pending ({summary.pending})</button></form>
            <nav aria-label="Filter guests" className="flex gap-1 text-sm">
              {["all", "accepted", "pending", "declined"].map((f) => (
                <Link key={f} href={f === "all" ? `/dashboard/events/${id}` : `?status=${f}`}
                  className={`rounded-full px-3 py-1 capitalize ${filter === f ? "bg-ink text-ivory" : "text-muted hover:text-ink"}`}>{f}</Link>
              ))}
            </nav>
          </div>
          {shown.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No guests here yet. Import a list or share your link.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted">
                  <tr><th className="py-2 pr-3">Name</th><th className="pr-3">Status</th><th className="pr-3">Party</th><th className="pr-3">Meal</th><th /></tr>
                </thead>
                <tbody>
                  {shown.map((g) => (
                    <tr key={g.id} className="border-t border-line">
                      <td className="py-2 pr-3">
                        <p>{g.name}</p>
                        {g.note && <p className="text-xs text-muted">“{g.note}”</p>}
                      </td>
                      <td className="pr-3"><span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[g.status as keyof typeof STATUS_STYLE]}`}>{g.status}</span></td>
                      <td className="pr-3">{g.status === "accepted" ? g.party_size : "–"}</td>
                      <td className="pr-3">{g.meal ?? "–"}</td>
                      <td className="text-right">
                        <form action={removeGuest.bind(null, id, g.id)}><button className="text-xs text-muted hover:text-red-700" aria-label={`Remove ${g.name}`}>Remove</button></form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <form action={importGuests.bind(null, id)} className="space-y-2 border-t border-line pt-4">
            <label htmlFor="list" className="label">Add guests: paste names, or “name, email, phone” per line (CSV or from a spreadsheet)</label>
            <textarea id="list" name="list" rows={4} className="input" placeholder={"Ana Cruz, ana@email.com\nBen Reyes"} />
            <button className="btn-soft">Add to guest list</button>
          </form>
        </section>

        <aside className="space-y-6">
          <section className="card space-y-3">
            <h2 className="font-serif text-2xl">Share</h2>
            <p className="break-all text-xs text-muted">{inviteUrl}</p>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={inviteUrl} />
              <a className="btn-ghost" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`You're invited! ${inviteUrl}`)}`}>WhatsApp</a>
              <a className="btn-ghost" target="_blank" rel="noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteUrl)}`}>Facebook</a>
            </div>
            <div className="border-t border-line pt-3">
              <p className="label">Table QR · photo &amp; greeting upload</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR code linking to the guest upload page" width={160} height={160} className="rounded-lg border border-line" />
              <a href={qr} download={`${event.slug}-upload-qr.png`} className="mt-2 inline-block text-xs text-champagne underline">Download QR</a>
            </div>
          </section>
          {meals.length > 0 && (
            <section className="card">
              <h2 className="font-serif text-2xl">Meals</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {meals.map(([m, n]) => <li key={m} className="flex justify-between"><span>{m}</span><span>{n}</span></li>)}
              </ul>
            </section>
          )}
          <form action={deleteEvent.bind(null, id)}>
            <ConfirmButton className="btn-danger w-full" message="Delete this event, its guest list and all uploads? This cannot be undone.">Delete event</ConfirmButton>
          </form>
        </aside>
      </div>
    </div>
  );
}
