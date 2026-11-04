import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { signPaths } from "@/lib/media";

export interface PublicGifts {
  allow_anonymous: boolean;
  methods: { id: string; kind: string; label: string; url: string | null; details: string | null; qr_path: string | null; qrUrl?: string | null }[];
  funds: { id: string; title: string; goal_cents: number | null; raised_cents: number }[];
  items: { id: string; title: string; url: string | null; reserved: boolean }[];
  wall: { giver: string; amount_cents: number | null; currency: string; message: string | null }[] | null;
}

/** Public gift page data (null when gifts are disabled or the event isn't published). */
export const getPublicGifts = cache(async (slug: string): Promise<PublicGifts | null> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_gifts", { p_slug: slug });
  if (!data) return null;
  const g = data as PublicGifts;
  const signed = await signPaths(g.methods.map((m) => m.qr_path).filter((p): p is string => Boolean(p)), 3600);
  return { ...g, methods: g.methods.map((m) => ({ ...m, qrUrl: m.qr_path ? signed[m.qr_path] ?? null : null })) };
});
