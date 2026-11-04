import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UploadForm } from "@/components/upload-form";
import { getPublicEvent } from "@/lib/public-event";
import { resolveTemplate } from "@/lib/templates";

export const metadata: Metadata = { title: "Share your memories", robots: { index: false } };

export default async function UploadPage({ params }: PageProps<"/e/[slug]/upload">) {
  const { slug } = await params;
  const e = await getPublicEvent(slug);
  if (!e || !e.uploads_enabled) notFound();
  const t = resolveTemplate(e.template_id, e.theme);
  return (
    <main className="min-h-screen px-4 py-8" style={{ background: t.palette.bg, color: t.palette.text }}>
      <div className="mx-auto max-w-md space-y-6">
        <header className="text-center">
          <p className="text-[11px] uppercase tracking-[0.3em]" style={{ color: t.palette.accent }}>{e.title}</p>
          <h1 className="mt-2 font-serif text-4xl">Share the moment</h1>
        </header>
        <UploadForm slug={slug} />
        <p className="text-center text-sm"><Link href={`/e/${slug}/album`} className="underline opacity-70">View the album</Link></p>
      </div>
    </main>
  );
}
