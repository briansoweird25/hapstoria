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
