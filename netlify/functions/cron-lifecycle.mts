// Scheduled trigger for /api/cron/lifecycle (Netlify scheduled functions run on published deploys only).
// The real work stays in the Next.js route so it shares code with the rest of the app; this just calls it
// with the shared secret. Netlify exposes the site's primary URL as the URL environment variable.
export default async function handler(): Promise<Response> {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) return new Response("Missing URL or CRON_SECRET", { status: 500 });
  const res = await fetch(`${base}/api/cron/lifecycle`, { headers: { Authorization: `Bearer ${secret}` } });
  console.log("cron lifecycle", res.status, await res.text());
  return new Response(null, { status: res.ok ? 200 : 502 });
}

export const config = { schedule: "0 4 * * *" };
