const DEFAULT_TZ = "UTC";

function safeZone(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

/** Formats an ISO timestamp in the event's timezone, e.g. "Saturday, December 12, 2026 · 6:00 PM". */
export function formatEventDate(iso: string | null | undefined, tz?: string | null, locale = "en-US"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const timeZone = safeZone(tz);
  const date = d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone });
  const time = d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", timeZone });
  return `${date} · ${time}`;
}

function zonedParts(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour"), mi: get("minute"), s: get("second") };
}

/** ISO timestamp -> "YYYY-MM-DDTHH:mm" wall-clock time in `tz` (for <input type="datetime-local">). */
export function toZonedLocal(iso: string | null | undefined, tz?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = zonedParts(d, safeZone(tz));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

/** Wall-clock "YYYY-MM-DDTHH:mm" in `tz` -> UTC ISO string ("" if invalid). Handles DST. */
export function zonedLocalToIso(local: string | null | undefined, tz?: string | null): string {
  if (!local) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return "";
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const timeZone = safeZone(tz);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes converge on the correct offset, including across DST changes.
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess), timeZone);
    guess += asUtc - Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  }
  const out = new Date(guess);
  return Number.isNaN(out.getTime()) ? "" : out.toISOString();
}
