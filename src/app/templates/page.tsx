import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { InvitationCard } from "@/components/invitation-card";
import { EVENT_KINDS, TEMPLATES } from "@/lib/templates";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage({ searchParams }: PageProps<"/templates">) {
  const sp = await searchParams;
  const kind = typeof sp.kind === "string" ? sp.kind : "all";
  const list = kind === "all" ? TEMPLATES : TEMPLATES.filter((t) => t.kind === kind);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-5 py-8">
        <h1 className="font-serif text-4xl">Templates</h1>
        <nav aria-label="Filter by event type" className="mt-5 flex flex-wrap gap-2">
          {[{ id: "all", label: "All" }, ...EVENT_KINDS].map((k) => (
            <Link key={k.id} href={k.id === "all" ? "/templates" : `/templates?kind=${k.id}`}
              aria-current={k.id === kind ? "page" : undefined}
              className={`rounded-full border px-4 py-1.5 text-sm ${k.id === kind ? "border-ink bg-ink text-ivory" : "border-line bg-paper hover:border-champagne"}`}>
              {k.label}
            </Link>
          ))}
        </nav>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => (
            <li key={t.id} className="space-y-3">
              <InvitationCard compact data={{ title: t.name, template_id: t.id, host_names: t.culture, starts_at: null }} />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-muted">{t.description}</p>
                </div>
                <Link href={`/login?mode=signup&next=${encodeURIComponent(`/dashboard/events/new?template=${t.id}`)}`} className="btn-soft shrink-0">Use</Link>
              </div>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </>
  );
}
