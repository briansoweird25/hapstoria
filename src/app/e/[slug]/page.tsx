import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvitationCard } from "@/components/invitation-card";
import { RsvpForm } from "@/components/rsvp-form";
import { getPublicEvent } from "@/lib/public-event";
import { getPublicGifts } from "@/lib/public-gifts";
import { createClient } from "@/lib/supabase/server";
import { resolveTemplate } from "@/lib/templates";

async function getBranding(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_event_branding", { p_slug: slug });
  return (data as { business_name: string; brand_color: string }[] | null)?.[0] ?? null;
}

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const e = await getPublicEvent(slug);
  return e ? { title: e.title, description: `You're invited to ${e.title}`, robots: { index: false } } : { title: "Invitation" };
}

export default async function InvitationPage({ params }: PageProps<"/e/[slug]">) {
  const { slug } = await params;
  // All three lookups are independent, so they run together (each is a network round trip to Supabase).
  const [e, gifts, branding] = await Promise.all([getPublicEvent(slug), getPublicGifts(slug), getBranding(slug)]);
  if (!e) notFound();
  const t = resolveTemplate(e.template_id, e.theme);
  const closed = e.rsvp_deadline ? new Date(e.rsvp_deadline) < new Date() : false;
  return (
    <main className="min-h-screen px-4 py-8" style={{ background: t.palette.bg, color: t.palette.text }}>
      <div className="mx-auto max-w-md space-y-6">
        <InvitationCard data={{ ...e, coverUrl: e.coverUrl }} />
        <section className="rounded-3xl border p-6" style={{ background: t.palette.surface, borderColor: t.palette.accentSoft }}>
          <h2 className="mb-4 text-center text-2xl font-semibold">RSVP</h2>
          <RsvpForm slug={slug} mealOptions={e.meal_options} maxPlusOnes={e.max_plus_ones} closed={closed} />
        </section>
        {gifts && <Link href={`/e/${slug}/gifts`} className="btn-ghost w-full">Gift registry</Link>}
        {e.uploads_enabled && (
          <div className="flex flex-col gap-2 text-center">
            <Link href={`/e/${slug}/upload`} className="btn-ghost">Share photos, videos &amp; greetings</Link>
            <Link href={`/e/${slug}/album`} className="text-sm underline opacity-70">View the album</Link>
          </div>
        )}
        <p className="pt-2 text-center text-[11px] tracking-[0.25em] opacity-60" style={branding ? { color: branding.brand_color } : undefined}>
          {branding ? branding.business_name.toUpperCase() : "HAPSTORIA"}
        </p>
      </div>
    </main>
  );
}
