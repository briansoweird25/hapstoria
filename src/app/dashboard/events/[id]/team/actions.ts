"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getUserTier } from "@/lib/album";
import { escapeHtml } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import { env } from "@/lib/env";
import { inviteSchema } from "@/lib/team";

const path = (id: string) => `/dashboard/events/${id}/team`;

export async function inviteMember(eventId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const tier = await getUserTier(supabase, user.id);
  if (tier !== "planner") redirect(`${path(eventId)}?notice=planner_only`);
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect(`${path(eventId)}?notice=invalid`);
  const { data: event } = await supabase.from("events").select("title,owner_id").eq("id", eventId).maybeSingle();
  if (!event || event.owner_id !== user.id) redirect(`${path(eventId)}?notice=owner_only`);

  const { data: invite, error } = await supabase
    .from("event_invites")
    .upsert({ event_id: eventId, ...parsed.data }, { onConflict: "event_id,email" })
    .select("token")
    .single();
  if (error || !invite) redirect(`${path(eventId)}?notice=failed`);
  const url = `${env.siteUrl}/invite/${invite.token}`;
  await sendEmail(parsed.data.email, {
    subject: `You've been invited to help with ${event.title}`,
    html: `<p>You've been invited as ${parsed.data.role} on <strong>${escapeHtml(event.title)}</strong> on Hapstoria.</p><p><a href="${escapeHtml(url)}">Accept the invitation</a></p>`,
    text: `You've been invited to ${event.title} on Hapstoria: ${url}`,
  });
  revalidatePath(path(eventId));
}

export async function revokeInvite(eventId: string, inviteId: string) {
  const { supabase } = await requireUser();
  await supabase.from("event_invites").delete().eq("id", inviteId).eq("event_id", eventId);
  revalidatePath(path(eventId));
}

export async function removeMember(eventId: string, userId: string) {
  const { supabase } = await requireUser();
  await supabase.from("event_members").delete().eq("event_id", eventId).eq("user_id", userId);
  revalidatePath(path(eventId));
}
