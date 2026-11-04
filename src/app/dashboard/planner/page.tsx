import type { Metadata } from "next";
import Link from "next/link";
import { getUserTier } from "@/lib/album";
import { requireUser } from "@/lib/auth";
import { PLANNER_EVENT_LIMIT } from "@/lib/billing";
import { env } from "@/lib/env";
import { formatEventDate } from "@/lib/format";
import { summarizeGuests } from "@/lib/stats";
import { saveProfile } from "./actions";

export const metadata: Metadata = { title: "Planner workspace" };

const NOTICES: Record<string, string> = {
  saved: "Profile saved.", invalid: "Please check the profile fields.", slug_taken: "That web address is taken. Try another.", failed: "Could not save.",
};

export default async function PlannerPage({ searchParams }: PageProps<"/dashboard/planner">) {
  const sp = await searchParams;
  const { supabase, user } = await requireUser();
  const [tier, { data: events }, { data: profile }] = await Promise.all([
    getUserTier(supabase, user.id),
    supabase.from("events").select("id,title,starts_at,timezone,published,owner_id,guests(status,party_size,meal)").order("starts_at", { ascending: true, nullsFirst: false }),
    supabase.from("planner_profiles").select("*").eq("user_id", user.id).maybeSingle(),
  ]);
  const isPlanner = tier === "planner";
  const owned = (events ?? []).filter((e) => e.owner_id === user.id).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-4xl">Planner workspace</h1>
        <p className="text-sm text-muted">All your clients&apos; events in one place. {isPlanner ? `${owned}/${PLANNER_EVENT_LIMIT} events in use.` : ""}</p>
        {!isPlanner && <p className="mt-3 rounded-xl bg-lavender-soft p-4 text-sm">The Planner plan unlocks up to {PLANNER_EVENT_LIMIT} events at once, team access and white-label branding. <Link className="underline" href="/dashboard/billing">See plans</Link></p>}
        {sp.notice && <p role="status" className="mt-3 rounded-lg bg-champagne-soft p-3 text-sm">{NOTICES[String(sp.notice)] ?? ""}</p>}
      </div>

      <section className="card overflow-x-auto">
        <h2 className="font-serif text-2xl">Client events</h2>
        {!events?.length ? <p className="mt-2 text-sm text-muted">No events yet.</p> : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted"><tr><th className="py-1">Event</th><th>Date</th><th>Status</th><th>Replies</th><th>Headcount</th><th>Access</th></tr></thead>
            <tbody>
              {events.map((e) => {
                const s = summarizeGuests((e.guests ?? []).map((g) => ({ status: g.status as "pending" | "accepted" | "declined", party_size: g.party_size, meal: g.meal })));
                return (
                  <tr key={e.id} className="border-t border-line">
                    <td className="py-2"><Link className="underline" href={`/dashboard/events/${e.id}`}>{e.title}</Link></td>
                    <td>{formatEventDate(e.starts_at, e.timezone).split(" · ")[0] || "–"}</td>
                    <td>{e.published ? "Published" : "Draft"}</td>
                    <td>{s.accepted + s.declined}/{s.invited}</td><td>{s.headcount}</td>
                    <td>{e.owner_id === user.id ? "Owner" : "Shared"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <form action={saveProfile} className="card grid max-w-2xl gap-3 sm:grid-cols-2">
        <h2 className="font-serif text-2xl sm:col-span-2">Business profile &amp; branding</h2>
        <p className="text-sm text-muted sm:col-span-2">With the Planner plan your business name and color replace Hapstoria branding on your guests&apos; invitation pages, and your public profile can be found by clients.</p>
        <div><label className="label" htmlFor="business_name">Business name</label><input id="business_name" name="business_name" required defaultValue={profile?.business_name} className="input" /></div>
        <div><label className="label" htmlFor="slug">Web address</label><input id="slug" name="slug" required defaultValue={profile?.slug} className="input" placeholder="luna-events" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="tagline">Tagline</label><input id="tagline" name="tagline" defaultValue={profile?.tagline ?? ""} className="input" /></div>
        <div><label className="label" htmlFor="brand_color">Brand color</label><input id="brand_color" name="brand_color" type="color" defaultValue={profile?.brand_color ?? "#b8934a"} className="h-10 w-full rounded-xl border border-line" /></div>
        <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" name="is_public" defaultChecked={profile?.is_public} className="size-4" />Show a public profile page</label>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button className="btn-primary">Save profile</button>
          {profile?.is_public && isPlanner && <Link className="text-sm underline" target="_blank" href={`/planners/${profile.slug}`}>{env.siteUrl}/planners/{profile.slug}</Link>}
        </div>
      </form>
    </div>
  );
}
