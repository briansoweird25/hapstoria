import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventForm, type EventFormValues } from "@/components/event-form";
import { requireUser } from "@/lib/auth";
import { signPaths } from "@/lib/media";
import { saveEvent } from "../../actions";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditEventPage({ params }: PageProps<"/dashboard/events/[id]/edit">) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const { data: e } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!e) notFound();
  const signed = e.cover_path ? await signPaths([e.cover_path]) : {};
  const initial: EventFormValues = {
    title: e.title, kind: e.kind, template_id: e.template_id, host_names: e.host_names,
    starts_at: e.starts_at, timezone: e.timezone, venue_name: e.venue_name, venue_address: e.venue_address,
    message: e.message, dress_code: e.dress_code, meal_options: e.meal_options,
    rsvp_deadline: e.rsvp_deadline, max_plus_ones: e.max_plus_ones, uploads_enabled: e.uploads_enabled,
    cover_path: e.cover_path, cover_kind: e.cover_kind, coverUrl: e.cover_path ? signed[e.cover_path] ?? null : null,
  };
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl">Edit event</h1>
      <EventForm action={saveEvent.bind(null, id)} initial={initial} userId={user.id} />
    </div>
  );
}
