export interface ImportedGuest {
  name: string;
  email: string | null;
  phone: string | null;
}

export interface ImportResult {
  guests: ImportedGuest[];
  skipped: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Splits one line on tabs, or on commas that are outside double quotes. */
function splitLine(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      cells.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

/** Parses pasted guest lists: "name[, email[, phone]]" per line (CSV or TSV). */
export function parseGuestList(text: string): ImportResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const seen = new Set<string>();
  const guests: ImportedGuest[] = [];
  let skipped = 0;

  lines.forEach((line, i) => {
    const [name = "", email = "", phone = ""] = splitLine(line);
    if (i === 0 && /^(guest\s*)?name$/i.test(name)) return; // header row
    const key = name.toLowerCase();
    if (!name || seen.has(key)) {
      skipped++;
      return;
    }
    seen.add(key);
    guests.push({
      name: name.slice(0, 120),
      email: EMAIL_RE.test(email) ? email : null,
      phone: phone || null,
    });
  });
  return { guests, skipped };
}
