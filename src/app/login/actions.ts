"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { loginSchema, newPasswordSchema, resetRequestSchema, signupSchema } from "@/lib/auth-forms";
import { env, googleAuthEnabled, supabaseConfigured } from "@/lib/env";
import { loginErrorMessage } from "@/lib/login-errors";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { ok: boolean; message: string };

const emailSchema = z.string().trim().email("Enter a valid email address.");

const NOT_CONFIGURED: LoginState = {
  ok: false,
  message: "Sign-in isn't connected to its database yet. Site owner: check the Supabase URL and anon key in the Netlify environment variables, then redeploy.",
};
const UNREACHABLE: LoginState = { ok: false, message: "We couldn't reach the sign-in service. Please try again in a moment." };

function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

const callback = (next: string) => `${env.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;

/** Log in with email and password. On success the session cookie is set and the user is redirected. */
export async function logIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const next = safeNext(formData.get("next"));
  if (!supabaseConfigured()) return NOT_CONFIGURED;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      console.error("password login failed", { code: error.code, status: error.status });
      return { ok: false, message: loginErrorMessage(error) };
    }
  } catch (e) {
    console.error("password login crashed", e);
    return UNREACHABLE;
  }
  redirect(next); // outside try/catch: redirect() works by throwing
}

/** Create an account. If the project requires email confirmation we ask them to check their inbox. */
export async function signUp(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const next = safeNext(formData.get("next"));
  if (!supabaseConfigured()) return NOT_CONFIGURED;
  let signedIn = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo: callback(next) },
    });
    if (error) {
      console.error("signup failed", { code: error.code, status: error.status });
      return { ok: false, message: loginErrorMessage(error) };
    }
    // Supabase hides whether an address is taken by returning a user with no identities.
    if (data.user && (data.user.identities?.length ?? 1) === 0) {
      return { ok: false, message: loginErrorMessage({ code: "user_already_exists" }) };
    }
    signedIn = Boolean(data.session); // email confirmation turned off in Supabase: logged in immediately
  } catch (e) {
    console.error("signup crashed", e);
    return UNREACHABLE;
  }
  if (signedIn) redirect(next);
  return { ok: true, message: `Almost there! We sent a confirmation link to ${parsed.data.email}. Open it to finish creating your account.` };
}

/** Passwordless: email a one-time sign-in link (also creates the account if new). */
export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const next = safeNext(formData.get("next"));
  if (!supabaseConfigured()) return NOT_CONFIGURED;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({ email: parsed.data, options: { emailRedirectTo: callback(next) } });
    if (error) {
      console.error("magic link failed", { code: error.code, status: error.status, message: error.message });
      return { ok: false, message: loginErrorMessage(error) };
    }
  } catch (e) {
    console.error("magic link crashed", e);
    return UNREACHABLE;
  }
  return { ok: true, message: `Check ${parsed.data} for your sign-in link.` };
}

/** Sends a password-reset email. Always answers the same way so it can't be used to discover accounts. */
export async function requestPasswordReset(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = resetRequestSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  if (!supabaseConfigured()) return NOT_CONFIGURED;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: callback("/reset-password") });
    if (error && error.code === "over_email_send_rate_limit") return { ok: false, message: loginErrorMessage(error) };
    if (error) console.error("password reset failed", { code: error.code, status: error.status });
  } catch (e) {
    console.error("password reset crashed", e);
    return UNREACHABLE;
  }
  return { ok: true, message: `If an account exists for ${parsed.data.email}, a reset link is on its way.` };
}

/** Sets a new password for the signed-in user (reached from the reset email). */
export async function setNewPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  if (!supabaseConfigured()) return NOT_CONFIGURED;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      console.error("update password failed", { code: error.code, status: error.status });
      return { ok: false, message: loginErrorMessage(error) };
    }
  } catch (e) {
    console.error("update password crashed", e);
    return UNREACHABLE;
  }
  redirect("/dashboard");
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
