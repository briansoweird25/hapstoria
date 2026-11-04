const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,60}$/;

export function isValidSlug(s: string): boolean {
  return SLUG_RE.test(s);
}

export function slugify(input: string): string {
  let s = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length > 60) s = s.slice(0, 60).replace(/-+$/g, "");
  if (!/^[a-z0-9]/.test(s)) s = "event"; // non-latin / emoji-only titles
  if (s.length < 3) s = (s + "-event").slice(0, 60);
  return s;
}

/** Appends a short random suffix; `rand` is injectable for tests. */
export function withSuffix(base: string, rand: () => number = Math.random): string {
  const suffix = Math.floor(rand() * 36 ** 4)
    .toString(36)
    .padStart(4, "0");
  return `${base.slice(0, 55)}-${suffix}`;
}
