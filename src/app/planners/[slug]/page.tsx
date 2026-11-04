import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Profile = { business_name: string; slug: string; tagline: string | null; brand_color: string };

async function load(slug: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_planner_profile", { p_slug: slug });
  return (data as Profile[] | null)?.[0] ?? null;
}

export async function generateMetadata({ params }: PageProps<"/planners/[slug]">): Promise<Metadata> {
  const p = await load((await params).slug);
  return p ? { title: p.business_name, description: p.tagline ?? undefined } : { title: "Planner" };
}

export default async function PlannerPublicPage({ params }: PageProps<"/planners/[slug]">) {
  const p = await load((await params).slug);
  if (!p) notFound();
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <div className="max-w-md space-y-4 text-center">
        <span className="mx-auto block h-1.5 w-16 rounded-full" style={{ background: p.brand_color }} />
        <h1 className="font-serif text-5xl">{p.business_name}</h1>
        {p.tagline && <p className="text-lg text-muted">{p.tagline}</p>}
        <p className="text-xs tracking-[0.25em] text-muted">EVENTS BY {p.business_name.toUpperCase()}, POWERED BY HAPSTORIA</p>
      </div>
    </main>
  );
}
