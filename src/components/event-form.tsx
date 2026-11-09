"use client";

import { useActionState, useRef, useState, useSyncExternalStore } from "react";
import { InvitationCard } from "@/components/invitation-card";
import { createClient } from "@/lib/supabase/browser";
import { EVENT_KINDS, TEMPLATES, type TemplateDef } from "@/lib/templates";
import { toZonedLocal, zonedLocalToIso } from "@/lib/format";
import { MEDIA_BUCKET } from "@/lib/media-config";
import { compressImage } from "@/lib/image-resize";
import { extensionFor, validateUpload } from "@/lib/upload-rules";
import type { EventFormState } from "@/app/dashboard/events/actions";

export interface EventFormValues {
  title: string; kind: string; template_id: string; host_names: string;
  starts_at: string | null; timezone: string; venue_name: string; venue_address: string; message: string;
  dress_code: string; meal_options: string[]; rsvp_deadline: string | null;
  max_plus_ones: number; uploads_enabled: boolean;
  cover_path: string | null; cover_kind: "image" | "gif" | "video" | null; coverUrl: string | null;
}

const noopSubscribe = () => () => {};
const getBrowserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

type Action = (prev: EventFormState, fd: FormData) => Promise<EventFormState>;

export function EventForm({ action, initial, userId, ownedTemplates = [], canEditCover = true }: { action: Action; initial: EventFormValues; userId: string; ownedTemplates?: TemplateDef[]; canEditCover?: boolean }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [v, setV] = useState(initial);
  // Existing events keep their stored zone; new ones use the host's browser zone (server renders UTC).
  const browserTz = useSyncExternalStore(noopSubscribe, getBrowserTz, () => "UTC");
  const tz = initial.starts_at || initial.timezone !== "UTC" ? initial.timezone : browserTz;
  // Raw wall-clock strings are kept so partially edited inputs aren't wiped.
  const [startsLocal, setStartsLocal] = useState(toZonedLocal(initial.starts_at, initial.timezone));
  const [deadlineLocal, setDeadlineLocal] = useState(toZonedLocal(initial.rsvp_deadline, initial.timezone));
  const [mealText, setMealText] = useState(initial.meal_options.join(", "));
  const [maxPlus, setMaxPlus] = useState(String(initial.max_plus_ones));
  const [uploadsOn, setUploadsOn] = useState(initial.uploads_enabled);
  const startsIso = zonedLocalToIso(startsLocal, tz) || null;
  const deadlineIso = zonedLocalToIso(deadlineLocal, tz) || null;


  const [cover, setCover] = useState({ path: initial.cover_path ?? "", kind: initial.cover_kind ?? "", url: initial.coverUrl });
  const [uploading, setUploading] = useState(false);
  const [coverError, setCoverError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof EventFormValues>(k: K, val: EventFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const err = (k: string) => state.fieldErrors?.[k];

  async function onCover(file: File | undefined) {
    if (!file) return;
    setCoverError("");
    const check = validateUpload(file);
    if (!check.ok) return setCoverError(check.error);
    setUploading(true);
    const toUpload = await compressImage(file); // large photos are shrunk so the invitation opens fast on phones
    const path = `${userId}/covers/${crypto.randomUUID()}.${extensionFor(toUpload.type)}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, toUpload, { contentType: toUpload.type });
    setUploading(false);
    if (error) return setCoverError("Upload failed. Please try again.");
    const kind = check.kind === "video" ? "video" : toUpload.type === "image/gif" ? "gif" : "image";
    setCover({ path, kind, url: URL.createObjectURL(toUpload) });
  }

  return (
    <form action={formAction} className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <input type="hidden" name="cover_path" value={cover.path} />
      <input type="hidden" name="cover_kind" value={cover.kind} />
      <input type="hidden" name="kind" value={v.kind} />
      <input type="hidden" name="timezone" value={tz} />
      <input type="hidden" name="template_id" value={v.template_id} />
      <div className="space-y-6">
        <section className="card space-y-4">
          <h2 className="font-serif text-2xl">Event details</h2>
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input id="title" name="title" className="input" required maxLength={120} value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="Sofia at Eighteen" aria-invalid={!!err("title")} />
            {err("title") && <p className="mt-1 text-xs text-red-700">{err("title")}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="host_names">Hosted by</label>
              <input id="host_names" name="host_names" className="input" value={v.host_names} onChange={(e) => set("host_names", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="starts_at">Date &amp; time</label>
              <input id="starts_at" type="datetime-local" className="input" value={startsLocal} onChange={(e) => setStartsLocal(e.target.value)} />
              <input type="hidden" name="starts_at" value={startsIso ?? ""} />
              <p className="mt-1 text-xs text-muted">Time zone: {tz}</p>
            </div>
            <div>
              <label className="label" htmlFor="venue_name">Venue</label>
              <input id="venue_name" name="venue_name" className="input" value={v.venue_name} onChange={(e) => set("venue_name", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="venue_address">Address</label>
              <input id="venue_address" name="venue_address" className="input" value={v.venue_address} onChange={(e) => set("venue_address", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="dress_code">Dress code</label>
              <input id="dress_code" name="dress_code" className="input" value={v.dress_code} onChange={(e) => set("dress_code", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="message">Message to guests</label>
            <textarea id="message" name="message" rows={4} maxLength={2000} className="input" value={v.message} onChange={(e) => set("message", e.target.value)} />
          </div>
        </section>

        {canEditCover && (
        <section className="card space-y-4">
          <h2 className="font-serif text-2xl">Cover</h2>
          <p className="text-sm text-muted">A photo, GIF or short video guests see first (up to 100 MB).</p>
          <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" className="sr-only" onChange={(e) => onCover(e.target.files?.[0])} aria-label="Upload cover" />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-soft" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? "Uploading…" : cover.path ? "Replace cover" : "Upload cover"}</button>
            {cover.path && <button type="button" className="btn-ghost" onClick={() => setCover({ path: "", kind: "", url: null })}>Remove</button>}
          </div>
          {coverError && <p role="alert" className="text-sm text-red-700">{coverError}</p>}
        </section>
        )}

        <section className="card space-y-4">
          <h2 className="font-serif text-2xl">Style</h2>
          <div className="flex flex-wrap gap-2">
            {EVENT_KINDS.map((k) => (
              <button key={k.id} type="button" onClick={() => setV((p) => ({ ...p, kind: k.id, template_id: TEMPLATES.find((t) => t.kind === k.id)?.id ?? p.template_id }))} aria-pressed={v.kind === k.id}
                className={`rounded-full border px-3 py-1 text-sm ${v.kind === k.id ? "border-ink bg-ink text-ivory" : "border-line"}`}>{k.label}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TEMPLATES.filter((t) => t.kind === v.kind).map((t) => (
              <button key={t.id} type="button" onClick={() => set("template_id", t.id)} aria-pressed={v.template_id === t.id}
                className={`rounded-xl border-2 p-3 text-left ${v.template_id === t.id ? "border-champagne" : "border-line"}`} style={{ background: t.palette.bg, color: t.palette.text }}>
                <span className="mb-2 block h-1.5 w-8 rounded-full" style={{ background: t.palette.accent }} />
                <span className="text-sm font-medium">{t.name}</span>
              </button>
            ))}
          </div>
          {ownedTemplates.length > 0 && (
            <>
              <p className="label">Your marketplace templates</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {ownedTemplates.map((t) => (
                  <button key={t.id} type="button" onClick={() => setV((p) => ({ ...p, template_id: t.id, kind: t.kind }))} aria-pressed={v.template_id === t.id}
                    className={`rounded-xl border-2 p-3 text-left ${v.template_id === t.id ? "border-champagne" : "border-line"}`} style={{ background: t.palette.bg, color: t.palette.text }}>
                    <span className="mb-2 block h-1.5 w-8 rounded-full" style={{ background: t.palette.accent }} />
                    <span className="text-sm font-medium">{t.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="card space-y-4">
          <h2 className="font-serif text-2xl">RSVP &amp; album</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="rsvp_deadline">RSVP deadline</label>
              <input id="rsvp_deadline" type="datetime-local" className="input" value={deadlineLocal} onChange={(e) => setDeadlineLocal(e.target.value)} />
              <input type="hidden" name="rsvp_deadline" value={deadlineIso ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="max_plus_ones">Max guests per reply</label>
              <input id="max_plus_ones" name="max_plus_ones" type="number" min={0} max={20} className="input" value={maxPlus} onChange={(e) => setMaxPlus(e.target.value)} />
              <p className="mt-1 text-xs text-muted">Extra people a guest can bring (0 = just themselves).</p>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="meal_options">Meal choices (comma separated)</label>
            <input id="meal_options" name="meal_options" className="input" value={mealText} onChange={(e) => setMealText(e.target.value)} placeholder="Beef, Fish, Vegetarian" />
            {err("meal_options") && <p className="mt-1 text-xs text-red-700">{err("meal_options")}</p>}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="uploads_enabled" checked={uploadsOn} onChange={(e) => setUploadsOn(e.target.checked)} className="size-4 accent-[var(--champagne)]" />
            Let guests upload photos, videos and greetings
          </label>
        </section>

        {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
        <button className="btn-primary" disabled={pending || uploading}>{pending ? "Saving…" : "Save event"}</button>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <p className="label">Live preview</p>
        <InvitationCard data={{ ...v, theme: ownedTemplates.find((t) => t.id === v.template_id), starts_at: startsIso, timezone: tz, coverUrl: cover.url, cover_kind: (cover.kind || null) as EventFormValues["cover_kind"] }} />
      </aside>
    </form>
  );
}
