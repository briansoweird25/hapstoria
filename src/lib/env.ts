function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  get serviceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
  },
  get siteUrl() {
    // Explicit setting first; then the host platform's own URL (Netlify: URL, Vercel: VERCEL_PROJECT_PRODUCTION_URL).
    const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const url =
      process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || (vercel ? `https://${vercel}` : "") || "http://localhost:3000";
    return normalizeSiteUrl(url);
  },
};

/** True when the public Supabase settings look usable (a real http(s) URL and a key). Never throws. */
export function supabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Google sign-in is hidden until the provider is set up in Supabase and this is set to "true". */
export function googleAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
}

/**
 * Auth emails embed this address, and Supabase rejects anything that isn't a full URL ("requested path is invalid").
 * So accept sloppy input: add a missing scheme, keep only the origin (no path or trailing slash).
 */
function normalizeSiteUrl(raw: string): string {
  const value = raw.trim();
  const withScheme = /^https?:\/\//i.test(value) ? value : `${/^(localhost|127\.0\.0\.1)(:|$)/i.test(value) ? "http" : "https"}://${value}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return "http://localhost:3000";
  }
}
