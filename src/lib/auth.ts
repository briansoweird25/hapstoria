import { redirect } from "next/navigation";
import { supabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Returns the signed-in user or redirects to login. Use in protected server components/actions. */
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, user: data.user };
}

export async function getOptionalUser() {
  // Public pages call this; a missing or invalid Supabase config or a Supabase outage must not take them down.
  if (!supabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user;
  } catch (e) {
    console.error("getOptionalUser failed", e);
    return null;
  }
}
