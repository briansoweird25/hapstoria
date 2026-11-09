export interface SessionUser {
  id: string;
  email: string | undefined;
}

/** Maps verified JWT claims to the small user object the app needs. Anonymous/anon-key tokens are not users. */
export function userFromClaims(claims: { sub?: string; email?: string; role?: string } | null | undefined): SessionUser | null {
  if (!claims?.sub) return null;
  if (claims.role && claims.role !== "authenticated") return null;
  return { id: claims.sub, email: claims.email };
}

/** True if the request carries a Supabase session cookie (sb-<ref>-auth-token, possibly chunked as .0, .1). */
export function hasAuthCookie(names: string[]): boolean {
  return names.some((n) => /^sb-.+-auth-token(\.\d+)?$/.test(n));
}
