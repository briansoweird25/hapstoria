"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env, googleAuthEnabled, supabaseConfigured } from "@/lib/env";
import { loginErrorMessage } from "@/lib/login-errors";

export type LoginState = { ok: boolean; message: string };

const emailSchema = z.string().trim().email("Enter a valid email address.");

function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const next = safeNext(formData.get("next"));
  if (!supabaseConfigured()) {
    console.error("magic link: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are missing or invalid");
    return { ok: false, message: "Sign-in isn't connected to its database yet. Site owner: check the Supabase URL and anon key in the Netlify environment variables, then redeploy." };
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: { emailRedirectTo: `${env.siteUrl}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      console.error("magic link failed", { code: error.code, status: error.status, message: error.message });
      return { ok: false, message: loginErrorMessage(error) };
    }
  } catch (e) {
    // Network failure or unexpected error: show a message instead of crashing the page.
    console.error("magic link crashed", e);
    return { ok: false, message: "We couldn't reach the sign-in service. Please try again in a moment." };
  }
  return { ok: true, message: `Check ${parsed.data} for your sign-in link.` };
}

export async function signInWithGoogle(formData: FormData) {
  if (!googleAuthEnabled()) redirect("/login"); // hidden in the UI; also refuse direct calls
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const h = await headers();
  const origin = h.get("origin") ?? env.siteUrl;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}
