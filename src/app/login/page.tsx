import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand";
import { getOptionalUser } from "@/lib/auth";
import { authMode } from "@/lib/auth-forms";
import { googleAuthEnabled } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

const TITLES = { login: "Welcome back", signup: "Create your account", forgot: "Reset your password", link: "Sign in with a link" } as const;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const rawNext = typeof sp.next === "string" ? sp.next : "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";
  const mode = authMode(sp.mode);
  const error = sp.error;
  // Already signed in: no need to log in again.
  if (await getOptionalUser()) redirect(next);

  const tab = (m: "login" | "signup", label: string) => (
    <Link
      href={`/login?mode=${m}&next=${encodeURIComponent(next)}`}
      aria-current={mode === m ? "page" : undefined}
      className={`flex-1 rounded-full px-4 py-2 text-center text-sm font-medium transition ${mode === m ? "bg-ink text-ivory" : "text-muted hover:text-ink"}`}
    >
      {label}
    </Link>
  );

  return (
    <main className="grid flex-1 place-items-center px-5 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center"><Logo /></div>
        <div className="card space-y-5">
          {(mode === "login" || mode === "signup") && (
            <nav aria-label="Log in or create an account" className="flex gap-1 rounded-full border border-line bg-ivory p-1">
              {tab("login", "Log in")}
              {tab("signup", "Create account")}
            </nav>
          )}
          <h1 className="font-serif text-3xl">{TITLES[mode]}</h1>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Sign-in didn&apos;t complete. Please try again.</p>}
          <LoginForm next={next} mode={mode} showGoogle={googleAuthEnabled()} />
        </div>
        <p className="text-center text-xs text-muted">Guests never need an account to RSVP or upload.</p>
      </div>
    </main>
  );
}
