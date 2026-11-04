import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { signPaths } from "@/lib/media";

export interface PublicEvent {
  id: string; slug: string; title: string; kind: string; template_id: string;
  host_names: string; starts_at: string | null; venue_name: string; venue_address: string;
  message: string; dress_code: string; cover_path: string | null; cover_kind: "image" | "gif" | "video" | null;
  meal_options: string[]; rsvp_deadline: string | null; max_plus_ones: number; uploads_enabled: boolean;
}

/** Loads a published event through the security-definer RPC (works without login). */
export const getPublicEvent = cache(async (slug: string): Promise<(PublicEvent & { coverUrl: string | null }) | null> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_event", { p_slug: slug });
  const event = (data as PublicEvent[] | null)?.[0];
  if (!event) return null;
  const signed = event.cover_path ? await signPaths([event.cover_path], 3600) : {};
  return { ...event, coverUrl: event.cover_path ? signed[event.cover_path] ?? null : null };
});
