import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { requireUser } from "@/lib/auth";
import { signPaths } from "@/lib/media";
import { deleteUpload, moderateUpload } from "../../actions";

export const metadata: Metadata = { title: "Memories" };

export default async function MemoriesPage({ params, searchParams }: PageProps<"/dashboard/events/[id]/memories">) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "pending";
  const { supabase } = await requireUser();
  const { data: event } = await supabase.from("events").select("id,title").eq("id", id).maybeSingle();
  if (!event) notFound();

  const { data: uploads } = await supabase.from("uploads").select("*").eq("event_id", id).order("created_at", { ascending: false });
  const all = uploads ?? [];
  const counts = { pending: 0, approved: 0, hidden: 0 };
  for (const u of all) counts[u.status as keyof typeof counts]++;
  const shown = all.filter((u) => u.status === tab);
  const urls = await signPaths(shown.map((u) => u.storage_path).filter((p): p is string => Boolean(p)));

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/events/${id}`} className="text-sm text-muted hover:text-ink">← {event.title}</Link>
        <h1 className="font-serif text-4xl">Memories</h1>
        <p className="text-sm text-muted">Guests&apos; uploads stay private until you approve them.</p>
        <a href={`/api/events/${id}/download`} className="btn-soft mt-3">Download everything (.zip)</a>
      </div>
      <nav aria-label="Memory status" className="flex gap-2">
        {(["pending", "approved", "hidden"] as const).map((t) => (
          <Link key={t} href={`?tab=${t}`} aria-current={tab === t ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm capitalize ${tab === t ? "border-ink bg-ink text-ivory" : "border-line bg-paper"}`}>
            {t} ({counts[t]})
          </Link>
        ))}
      </nav>
      {shown.length === 0 ? (
        <p className="card py-10 text-center text-sm text-muted">Nothing here yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((u) => {
            const url = u.storage_path ? urls[u.storage_path] : undefined;
            return (
              <li key={u.id} className="card space-y-3 p-3">
                {u.kind === "photo" && url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={`Photo from ${u.uploader_name}`} className="aspect-square w-full rounded-xl object-cover" loading="lazy" />
                )}
                {u.kind === "video" && url && <video src={url} controls preload="metadata" className="aspect-square w-full rounded-xl bg-black object-cover" />}
                {u.kind === "greeting" && <blockquote className="rounded-xl bg-champagne-soft p-4 font-serif text-lg">“{u.greeting_text}”</blockquote>}
                <p className="text-xs text-muted">{u.uploader_name} · {u.kind}</p>
                <div className="flex flex-wrap gap-2">
                  {u.status !== "approved" && (
                    <form action={moderateUpload.bind(null, id, u.id, "approved")}><button className="btn-primary px-3 py-1.5">Approve</button></form>
                  )}
                  {u.status !== "hidden" && (
                    <form action={moderateUpload.bind(null, id, u.id, "hidden")}><button className="btn-ghost px-3 py-1.5">Hide</button></form>
                  )}
                  {url && <a className="btn-ghost px-3 py-1.5" href={url} download>Download</a>}
                  <form action={deleteUpload.bind(null, id, u.id)}>
                    <ConfirmButton className="btn-danger px-3 py-1.5" message="Delete this permanently?">Delete</ConfirmButton>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
