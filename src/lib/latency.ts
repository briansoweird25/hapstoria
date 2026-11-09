export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Plain-language reading of the server→database round-trip time (milliseconds). */
export function latencyVerdict(ms: number | null): string {
  if (ms === null) return "Could not reach Supabase from the server. Check NEXT_PUBLIC_SUPABASE_URL and that the project isn't paused.";
  if (ms < 80) return "Good: the server and database are close to each other.";
  if (ms < 160) return "Acceptable, but each page makes several database calls, so it adds up.";
  return "Slow: the server and the database are probably in different parts of the world. Move the Netlify function region closer to your Supabase region (or the reverse). Every database call pays this delay.";
}
