"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
// Supabase stores the session in a cookie named sb-<project>-auth-token (possibly chunked as ...-token.0).
const hasAuthCookie = () => /(?:^|;\s*)sb-[^=]*-auth-token/.test(document.cookie);

export function AuthNav({ signedIn }: { signedIn?: boolean }) {
  const fromCookie = useSyncExternalStore(subscribe, hasAuthCookie, () => false);
  const loggedIn = signedIn ?? fromCookie;
  return loggedIn ? (
    <Link href="/dashboard" className="btn-primary">My events</Link>
  ) : (
    <>
      <Link href="/login" className="px-3 py-2 text-muted hover:text-ink">Log in</Link>
      <Link href="/login?next=/dashboard/events/new" className="btn-primary">Create invitation</Link>
    </>
  );
}
