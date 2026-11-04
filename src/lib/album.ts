import "server-only";
import { albumStatus, tierFor, type AlbumStatus, type Tier } from "@/lib/billing";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Highest active subscription tier for a user (works with RLS client for self, or admin for anyone). */
export async function getUserTier(client: SupabaseClient, userId: string): Promise<Tier | null> {
  const { data } = await client.from("subscriptions").select("tier,status").eq("user_id", userId);
  return tierFor((data ?? []) as { tier: Tier; status: string }[]);
}

export async function getAlbumStatus(
  event: { owner_id: string; premium: boolean; premium_at: string | null; created_at: string },
  client: SupabaseClient = createAdminClient(),
): Promise<AlbumStatus> {
  const tier = await getUserTier(client, event.owner_id);
  return albumStatus({ premium: event.premium, premiumAt: event.premium_at, createdAt: event.created_at, tier });
}
