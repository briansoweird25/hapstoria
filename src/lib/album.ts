import "server-only";
import { albumStatus, latestEntitlementEnd, tierFor, type AlbumStatus, type SubscriptionLike, type Tier } from "@/lib/billing";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Highest active subscription tier for a user (works with RLS client for self, or admin for anyone). */
export async function getUserTier(client: SupabaseClient, userId: string): Promise<Tier | null> {
  const { data } = await client.from("subscriptions").select("tier,status").eq("user_id", userId);
  return tierFor((data ?? []) as { tier: Tier; status: string }[]);
}

export async function getEntitlements(client: SupabaseClient, userId: string): Promise<{ tier: Tier | null; endedAt: string | null }> {
  const { data } = await client.from("subscriptions").select("tier,status,ended_at").eq("user_id", userId);
  const subs = (data ?? []) as SubscriptionLike[];
  return { tier: tierFor(subs), endedAt: latestEntitlementEnd(subs) };
}

export async function getAlbumStatus(
  event: { owner_id: string; premium: boolean; premium_at: string | null; created_at: string },
  client: SupabaseClient = createAdminClient(),
): Promise<AlbumStatus> {
  // Always read the owner's entitlements with the service role: team members can't see the owner's subscriptions under RLS.
  const { tier, endedAt } = await getEntitlements(client, event.owner_id);
  return albumStatus({ premium: event.premium, premiumAt: event.premium_at, createdAt: event.created_at, tier, entitlementEndedAt: endedAt });
}
