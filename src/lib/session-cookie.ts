/**
 * Reads when the Supabase session cookie's access token expires, without any network call, so the proxy only
 * contacts Supabase when a refresh is actually due. This is NOT a verification: pages still verify the login
 * themselves (requireUser) and the database enforces access with row-level security.
 */
const SESSION_COOKIE = /^sb-.+-auth-token(?:\.(\d+))?$/;

function decodeBase64Url(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

/** Expiry of the access token in unix seconds, or null if it can't be determined. */
export function sessionExpiry(cookies: { name: string; value: string }[]): number | null {
  try {
    const parts = cookies
      .map((c) => ({ c, m: SESSION_COOKIE.exec(c.name) }))
      .filter((x) => x.m)
      .map((x) => ({ index: x.m![1] === undefined ? -1 : Number(x.m![1]), value: x.c.value }))
      .sort((a, b) => a.index - b.index);
    if (!parts.length) return null;
    let raw = parts.map((p) => p.value).join("");
    if (raw.startsWith("base64-")) raw = decodeBase64Url(raw.slice("base64-".length));
    const session = JSON.parse(raw) as { expires_at?: unknown; access_token?: unknown };
    if (typeof session.expires_at === "number") return session.expires_at;
    if (typeof session.access_token === "string") {
      const payload = JSON.parse(decodeBase64Url(session.access_token.split(".")[1] ?? "")) as { exp?: unknown };
      if (typeof payload.exp === "number") return payload.exp;
    }
    return null;
  } catch {
    return null;
  }
}

/** True when the token is unknown, expired, or within `skewSeconds` of expiring, so the proxy should refresh it. */
export function needsRefresh(expiresAt: number | null, nowSeconds: number = Math.floor(Date.now() / 1000), skewSeconds = 60): boolean {
  return expiresAt === null || expiresAt - nowSeconds < skewSeconds;
}
