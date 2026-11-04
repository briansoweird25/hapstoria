import type { Metadata } from "next";
import { EventForm, type EventFormValues } from "@/components/event-form";
import { requireUser } from "@/lib/auth";
import { getTemplate } from "@/lib/templates";
import { getOwnedTemplates } from "@/lib/marketplace-data";
import { saveEvent } from "../actions";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage({ searchParams }: PageProps<"/dashboard/events/new">) {
  const { user } = await requireUser();
  const sp = await searchParams;
  const owned = await getOwnedTemplates(user.id);
  const tpl = getTemplate(typeof sp.template === "string" ? sp.template : "classic-gold");
  const initial: EventFormValues = {
    title: "", kind: tpl.kind, template_id: tpl.id, host_names: "", starts_at: null, timezone: "UTC", venue_name: "",
    venue_address: "", message: "", dress_code: "", meal_options: [], rsvp_deadline: null,
    max_plus_ones: 4, uploads_enabled: true, cover_path: null, cover_kind: null, coverUrl: null,
  };
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl">Create your invitation</h1>
      <EventForm action={saveEvent.bind(null, null)} initial={initial} userId={user.id} ownedTemplates={owned.map((t) => t.def)} />
    </div>
  );
}
