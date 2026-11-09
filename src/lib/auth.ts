import { cache } from "react";
import { redirect } from "next/navigation";
import { userFromClaims, type SessionUser } from "@/lib/auth-claims";
import { supabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * One Supabase client and one identity lookup per request, shared by layouts and pages (React `cache`).
 * Identity comes from the verified JWT (getClaims) instead of a network round trip to Supabase's auth server on
 * every page; the proxy refreshes expiring sessions before rendering.
 */
const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, user: userFromClaims(data?.claims) };
});

/** Returns the signed-in user or redirects to login. Use in protected server components/actions. */
export async function requireUser(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; user: SessionUser }> {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function getOptionalUser(): Promise<SessionUser | null> {
  // Public pages call this; a missing or invalid Supabase config or a Supabase outage must not take them down.
  if (!supabaseConfigured()) return null;
  try {
    return (await getSession()).user;
  } catch (e) {
    console.error("getOptionalUser failed", e);
    return null;
  }
}
