import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CollageMaker } from "@/components/collage-maker";
import { requireUser } from "@/lib/auth";
import { signPaths } from "@/lib/media";

export const metadata: Metadata = { title: "Collage" };

export default async function CollagePage({ params }: PageProps<"/dashboard/events/[id]/collage">) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data: event } = await supabase.from("events").select("id,slug,title").eq("id", id).maybeSingle();
  if (!event) notFound();
  const { data: photos } = await supabase.from("uploads").select("id,storage_path").eq("event_id", id).eq("status", "approved").eq("kind", "photo").order("created_at");
  const rows = (photos ?? []).filter((p) => p.storage_path);
  const urls = await signPaths(rows.map((p) => p.storage_path as string), 3600);
  const list = rows.map((p) => ({ id: p.id, url: urls[p.storage_path as string] })).filter((p) => p.url);
  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/events/${id}`} className="text-sm text-muted hover:text-ink">← {event.title}</Link>
        <h1 className="font-serif text-4xl">Collage</h1>
        <p className="text-sm text-muted">Built from approved photos. Open the <Link className="underline" href={`/e/${event.slug}/slideshow`} target="_blank">slideshow</Link> to play them full-screen at the venue.</p>
      </div>
      <CollageMaker photos={list} defaultCaption={event.title} slug={event.slug} />
    </div>
  );
}
