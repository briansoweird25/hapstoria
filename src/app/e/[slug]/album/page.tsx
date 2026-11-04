import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { signPaths } from "@/lib/media";
import { getAlbumStatus } from "@/lib/album";
import { albumAcceptsUploads } from "@/lib/billing";
import { getPublicEvent } from "@/lib/public-event";
import { getTemplate } from "@/lib/templates";

export const metadata: Metadata = { title: "Album", robots: { index: false } };

/** Public album: only items the host approved. */
export default async function AlbumPage({ params }: PageProps<"/e/[slug]/album">) {
  const { slug } = await params;
  const e = await getPublicEvent(slug);
  if (!e) notFound();
  const t = getTemplate(e.template_id);
  const admin = createAdminClient();
  const { data: row } = await admin.from("events").select("owner_id,premium,premium_at,created_at").eq("id", e.id).single();
  if (!row || !albumAcceptsUploads((await getAlbumStatus(row, admin)).state)) {
    return (
      <main className="grid min-h-screen place-items-center px-4" style={{ background: t.palette.bg, color: t.palette.text }}>
        <p className="max-w-sm text-center font-serif text-2xl">This album is no longer available. Please ask the host.</p>
      </main>
    );
  }
  const { data } = await admin.from("uploads").select("*").eq("event_id", e.id).eq("status", "approved").order("created_at");
  const items = data ?? [];
  const urls = await signPaths(items.map((u) => u.storage_path).filter((p): p is string => Boolean(p)), 3600);
  const greetings = items.filter((u) => u.kind === "greeting");
  const media = items.filter((u) => u.kind !== "greeting");

  return (
    <main className="min-h-screen px-4 py-8" style={{ background: t.palette.bg, color: t.palette.text }}>
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="text-center">
          <p className="text-[11px] uppercase tracking-[0.3em]" style={{ color: t.palette.accent }}>{e.title}</p>
          <h1 className="mt-2 font-serif text-4xl">The album</h1>
          {e.uploads_enabled && <Link href={`/e/${slug}/upload`} className="btn-ghost mt-4">Add yours</Link>}
        </header>
        {items.length === 0 && <p className="text-center text-sm opacity-70">Nothing has been shared yet.</p>}
        {media.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {media.map((u) => {
              const url = u.storage_path ? urls[u.storage_path] : undefined;
              if (!url) return null;
              return (
                <li key={u.id} className="overflow-hidden rounded-xl">
                  {u.kind === "video" ? (
                    <video src={url} controls preload="metadata" className="aspect-square w-full bg-black object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={`Photo from ${u.uploader_name}`} className="aspect-square w-full object-cover" loading="lazy" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {greetings.length > 0 && (
          <section>
            <h2 className="mb-3 font-serif text-2xl">Greetings</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {greetings.map((g) => (
                <li key={g.id} className="rounded-2xl p-5" style={{ background: t.palette.surface }}>
                  <p className="font-serif text-lg">“{g.greeting_text}”</p>
                  <p className="mt-2 text-xs opacity-70">— {g.uploader_name}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
