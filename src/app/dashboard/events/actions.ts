"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { parseGuestList } from "@/lib/guest-import";
import { slugify, withSuffix } from "@/lib/slug";
import { eventInputSchema } from "@/lib/validation";
import { MEDIA_BUCKET } from "@/lib/media-config";

export type EventFormState = { error?: string; fieldErrors?: Record<string, string> };

function coverFields(formData: FormData) {
  const path = String(formData.get("cover_path") ?? "");
  const kind = String(formData.get("cover_kind") ?? "");
  if (!path || !["image", "gif", "video"].includes(kind)) return { cover_path: null, cover_kind: null };
  return { cover_path: path, cover_kind: kind };
}

export async function saveEvent(
  eventId: string | null,
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const { supabase, user } = await requireUser();
  const raw = Object.fromEntries(formData.entries());
  const parsed = eventInputSchema.safeParse({ ...raw, uploads_enabled: formData.get("uploads_enabled") === "on" });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;
  const cover = coverFields(formData);
  // Cover must live under the user's own folder (also enforced by storage RLS).
  if (cover.cover_path && !String(cover.cover_path).startsWith(`${user.id}/`)) return { error: "Invalid cover file." };

  // starts_at / rsvp_deadline arrive as UTC ISO strings (converted in the browser).
  const row = { ...input, ...cover };

  if (eventId) {
    const { error } = await supabase.from("events").update(row).eq("id", eventId);
    if (error) return { error: "Could not save changes. Please try again." };
    revalidatePath(`/dashboard/events/${eventId}`);
    redirect(`/dashboard/events/${eventId}`);
  }

  const base = slugify(input.title);
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = withSuffix(base); // random suffix keeps public links hard to guess
    const { data, error } = await supabase
      .from("events")
      .insert({ ...row, slug, owner_id: user.id })
      .select("id")
      .single();
    if (!error && data) redirect(`/dashboard/events/${data.id}`);
    if (error?.code !== "23505") return { error: "Could not create the event. Please try again." };
  }
  return { error: "Could not find a free link for this event. Try a different title." };
}

export async function setPublished(eventId: string, published: boolean) {
  const { supabase } = await requireUser();
  await supabase.from("events").update({ published }).eq("id", eventId);
  revalidatePath(`/dashboard/events/${eventId}`);
}

export async function deleteEvent(eventId: string) {
  const { supabase, user } = await requireUser();
  // Remove guest-uploaded files first (rows cascade with the event).
  const folder = `${user.id}/${eventId}`;
  const { data: ev } = await supabase.from("events").select("cover_path").eq("id", eventId).maybeSingle();
  const paths: string[] = ev?.cover_path ? [ev.cover_path] : [];
  for (let offset = 0; ; offset += 1000) {
    const { data: files } = await supabase.storage.from(MEDIA_BUCKET).list(folder, { limit: 1000, offset });
    if (!files?.length) break;
    paths.push(...files.map((f) => `${folder}/${f.name}`));
    if (files.length < 1000) break;
  }
  for (let i = 0; i < paths.length; i += 500) await supabase.storage.from(MEDIA_BUCKET).remove(paths.slice(i, i + 500));
  await supabase.from("events").delete().eq("id", eventId);
  redirect("/dashboard");
}

export async function importGuests(eventId: string, formData: FormData) {
  const { supabase } = await requireUser();
  const { guests } = parseGuestList(String(formData.get("list") ?? ""));
  if (guests.length) {
    await supabase
      .from("guests")
      .upsert(
        guests.map((g) => ({ ...g, event_id: eventId })),
        { onConflict: "event_id,name_key", ignoreDuplicates: true },
      );
  }
  revalidatePath(`/dashboard/events/${eventId}`);
}

export async function removeGuest(eventId: string, guestId: string) {
  const { supabase } = await requireUser();
  await supabase.from("guests").delete().eq("id", guestId).eq("event_id", eventId);
  revalidatePath(`/dashboard/events/${eventId}`);
}

export async function moderateUpload(eventId: string, uploadId: string, status: "approved" | "hidden" | "pending") {
  const { supabase } = await requireUser();
  await supabase.from("uploads").update({ status }).eq("id", uploadId).eq("event_id", eventId);
  revalidatePath(`/dashboard/events/${eventId}/memories`);
}

export async function deleteUpload(eventId: string, uploadId: string) {
  const { supabase } = await requireUser();
  // Take the storage path from the row itself, never from client-supplied arguments.
  const { data } = await supabase.from("uploads").delete().eq("id", uploadId).eq("event_id", eventId).select("storage_path").maybeSingle();
  if (data?.storage_path) await supabase.storage.from(MEDIA_BUCKET).remove([data.storage_path]);
  revalidatePath(`/dashboard/events/${eventId}/memories`);
}
