import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "@/lib/env";

afterEach(() => vi.unstubAllEnvs());

describe("env.siteUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL and strips a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://hapstoria.example/");
    vi.stubEnv("URL", "https://netlify.example");
    expect(env.siteUrl).toBe("https://hapstoria.example");
  });
  it("falls back to Netlify's URL when no explicit site URL is set", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("URL", "https://my-site.netlify.app");
    expect(env.siteUrl).toBe("https://my-site.netlify.app");
  });
  it("falls back to Vercel's production URL, then localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "app.vercel.app");
    expect(env.siteUrl).toBe("https://app.vercel.app");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(env.siteUrl).toBe("http://localhost:3000");
  });
});

import { supabaseConfigured } from "@/lib/env";

describe("supabaseConfigured", () => {
  it("is true only for a real http(s) URL and a non-empty anon key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcd.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "eyJabc");
    expect(supabaseConfigured()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "Project URL");
    expect(supabaseConfigured()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "ftp://x.co");
    expect(supabaseConfigured()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcd.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(supabaseConfigured()).toBe(false);
  });
});
