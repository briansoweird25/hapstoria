import type { Metadata } from "next";
import { Logo } from "@/components/brand";
import { googleAuthEnabled } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const rawNext = typeof sp.next === "string" ? sp.next : "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";
  const error = sp.error;
  return (
    <main className="grid flex-1 place-items-center px-5 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center"><Logo /></div>
        <div className="card space-y-4">
          <div>
            <h1 className="font-serif text-3xl">Welcome</h1>
            <p className="mt-1 text-sm text-muted">Log in or create your account. No password needed.</p>
          </div>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Sign-in didn&apos;t complete. Please try again.</p>}
          <LoginForm next={next} showGoogle={googleAuthEnabled()} />
        </div>
        <p className="text-center text-xs text-muted">Guests never need an account to RSVP or upload.</p>
      </div>
    </main>
  );
}
