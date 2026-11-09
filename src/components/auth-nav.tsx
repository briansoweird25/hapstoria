"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { hasAuthCookie } from "@/lib/auth-claims";

const subscribe = () => () => {};
// Same tested check the server uses: only the real session cookie counts (not the temporary "...-code-verifier" one).
const sessionCookiePresent = () =>
  hasAuthCookie(document.cookie.split(";").map((c) => c.split("=")[0].trim()).filter(Boolean));

export function AuthNav({ signedIn }: { signedIn?: boolean }) {
  const fromCookie = useSyncExternalStore(subscribe, sessionCookiePresent, () => false);
  const loggedIn = signedIn ?? fromCookie;
  return loggedIn ? (
    <Link href="/dashboard" className="btn-primary">My events</Link>
  ) : (
    <>
      <Link href="/login" className="px-3 py-2 text-muted hover:text-ink">Log in</Link>
      <Link href="/login?mode=signup&next=/dashboard/events/new" className="btn-primary">Create account</Link>
    </>
  );
}
