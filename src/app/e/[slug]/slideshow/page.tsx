import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Slideshow, type Slide } from "@/components/slideshow";
import { getAlbumStatus } from "@/lib/album";
import { albumAcceptsUploads } from "@/lib/billing";
import { signPaths } from "@/lib/media";
import { getPublicEvent } from "@/lib/public-event";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Slideshow", robots: { index: false } };

/** Full-screen loop of approved items, meant for a projector at the venue. */
export default async function SlideshowPage({ params }: PageProps<"/e/[slug]/slideshow">) {
  const { slug } = await params;
  const e = await getPublicEvent(slug);
  if (!e) notFound();
  const admin = createAdminClient();
  const { data: row } = await admin.from("events").select("owner_id,premium,premium_at,created_at").eq("id", e.id).single();
  if (!row || !albumAcceptsUploads((await getAlbumStatus(row, admin)).state)) notFound();
  const { data } = await admin.from("uploads").select("*").eq("event_id", e.id).eq("status", "approved").order("created_at");
  const items = data ?? [];
  const urls = await signPaths(items.map((u) => u.storage_path).filter((p): p is string => Boolean(p)), 6 * 3600);
  const slides: Slide[] = items.flatMap((u): Slide[] =>
    u.kind === "greeting"
      ? [{ id: u.id, kind: "greeting", text: u.greeting_text ?? "", by: u.uploader_name }]
      : u.storage_path && urls[u.storage_path]
        ? [{ id: u.id, kind: u.kind as "photo" | "video", url: urls[u.storage_path], by: u.uploader_name }]
        : [],
  );
  return <Slideshow slides={slides} />;
}
