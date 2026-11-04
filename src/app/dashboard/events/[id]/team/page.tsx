import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { getUserTier } from "@/lib/album";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteMember, removeMember, revokeInvite } from "./actions";

export const metadata: Metadata = { title: "Team" };

const NOTICES: Record<string, string> = {
  planner_only: "Team access is part of the Planner plan.", invalid: "Enter a valid email and role.",
  owner_only: "Only the event owner can invite people.", failed: "Could not create the invitation.",
};

export default async function TeamPage({ params, searchParams }: PageProps<"/dashboard/events/[id]/team">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user } = await requireUser();
  const { data: event } = await supabase.from("events").select("id,title,owner_id").eq("id", id).maybeSingle();
  if (!event) notFound();
  const isOwner = event.owner_id === user.id;
  const [tier, { data: members }, { data: invites }] = await Promise.all([
    getUserTier(supabase, user.id),
    supabase.from("event_members").select("user_id,role,created_at").eq("event_id", id),
    isOwner ? supabase.from("event_invites").select("*").eq("event_id", id) : Promise.resolve({ data: [] }),
  ]);
  // Member emails live in auth.users; look them up server-side for display.
  const admin = createAdminClient();
  const emails = new Map<string, string>();
  await Promise.all((members ?? []).map(async (m) => {
    const { data } = await admin.auth.admin.getUserById(m.user_id);
    emails.set(m.user_id, data.user?.email ?? "Unknown");
  }));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href={`/dashboard/events/${id}`} className="text-sm text-muted hover:text-ink">← {event.title}</Link>
        <h1 className="font-serif text-4xl">Team</h1>
        <p className="text-sm text-muted">Editors can change everything except billing and deleting the event. Viewers can look but not change.</p>
        {sp.notice && <p role="alert" className="mt-2 rounded-lg bg-lavender-soft p-3 text-sm">{NOTICES[String(sp.notice)] ?? "Something went wrong."}</p>}
      </div>
      <section className="card">
        <h2 className="font-serif text-2xl">People with access</h2>
        <ul className="mt-2 divide-y divide-line text-sm">
          <li className="py-2">You <span className="text-xs text-muted">{isOwner ? "(owner)" : ""}</span></li>
          {(members ?? []).map((m) => (
            <li key={m.user_id} className="flex items-center justify-between py-2">
              <span>{emails.get(m.user_id)} <span className="text-xs text-muted">({m.role})</span></span>
              {isOwner && <form action={removeMember.bind(null, id, m.user_id)}><button className="text-xs text-red-700 underline">Remove</button></form>}
            </li>
          ))}
        </ul>
      </section>
      {isOwner && (
        <section className="card space-y-3">
          <h2 className="font-serif text-2xl">Invite someone</h2>
          {tier !== "planner" && <p className="text-sm text-muted">Team access needs the <Link className="underline" href="/dashboard/billing">Planner plan</Link>.</p>}
          <form action={inviteMember.bind(null, id)} className="flex flex-wrap gap-2">
            <input name="email" type="email" required className="input flex-1" placeholder="colleague@email.com" aria-label="Email" />
            <select name="role" className="input w-32" aria-label="Role"><option value="editor">Editor</option><option value="viewer">Viewer</option></select>
            <button className="btn-soft" disabled={tier !== "planner"}>Send invite</button>
          </form>
          {!!invites?.length && (
            <ul className="divide-y divide-line text-sm">
              {invites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{i.email} <span className="text-xs text-muted">({i.role}, pending)</span></span>
                  <span className="flex gap-2"><CopyButton text={`${env.siteUrl}/invite/${i.token}`} label="Copy link" />
                    <form action={revokeInvite.bind(null, id, i.id)}><button className="btn-ghost px-3 py-1.5">Revoke</button></form></span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
