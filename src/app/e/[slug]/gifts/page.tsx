import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GiftForm } from "@/components/gift-form";
import { getPublicEvent } from "@/lib/public-event";
import { getPublicGifts } from "@/lib/public-gifts";
import { getTemplate } from "@/lib/templates";

export const metadata: Metadata = { title: "Gifts", robots: { index: false } };

export default async function GiftsPage({ params }: PageProps<"/e/[slug]/gifts">) {
  const { slug } = await params;
  const [e, gifts] = await Promise.all([getPublicEvent(slug), getPublicGifts(slug)]);
  if (!e || !gifts) notFound();
  const t = getTemplate(e.template_id);
  return (
    <main className="min-h-screen px-4 py-8" style={{ background: t.palette.bg, color: t.palette.text }}>
      <div className="mx-auto max-w-md space-y-6">
        <header className="text-center">
          <p className="text-[11px] uppercase tracking-[0.3em]" style={{ color: t.palette.accent }}>{e.title}</p>
          <h1 className="mt-2 font-serif text-4xl">Gifts</h1>
          <p className="mt-1 text-sm opacity-70">Your presence is the best gift. If you&apos;d like to give something, here&apos;s how.</p>
        </header>
        <GiftForm slug={slug} gifts={gifts} />
        <p className="text-center text-sm"><Link href={`/e/${slug}`} className="underline opacity-70">Back to the invitation</Link></p>
      </div>
    </main>
  );
}
