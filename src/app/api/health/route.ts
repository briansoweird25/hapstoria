import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/env";
import { latencyVerdict, median } from "@/lib/latency";

/**
 * Open /api/health on the live site to see how long the server takes to reach Supabase. Reveals only timings
 * and the platform's own region name; no keys, no data.
 */
export async function GET() {
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase URL or anon key missing or invalid" }, { status: 503 });
  }
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`;
  const times: number[] = [];
  for (let i = 0; i < 4; i++) {
    const t = performance.now();
    try {
      const res = await fetch(url, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! }, cache: "no-store" });
      await res.arrayBuffer();
      if (res.ok) times.push(Math.round(performance.now() - t));
    } catch {
      /* counted as a failed attempt */
    }
  }
  // The first call includes connection setup; later calls are what each page's queries actually pay.
  const warm = times.slice(1);
  const typical = median(warm.length ? warm : times);
  return NextResponse.json(
    { ok: times.length > 0, serverRegion: process.env.AWS_REGION ?? process.env.NETLIFY_REGION ?? "unknown", roundTripsMs: times, typicalMs: typical, verdict: latencyVerdict(typical) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
