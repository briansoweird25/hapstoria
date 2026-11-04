export interface SeatTable { id: string; name: string; capacity: number }
export interface SeatGuest { id: string; name: string; party_size: number; status: string; table_id: string | null }

/** Seats taken per table: accepted guests count by party size. */
export function tableUsage(tables: SeatTable[], guests: SeatGuest[]): Record<string, number> {
  const usage: Record<string, number> = Object.fromEntries(tables.map((t) => [t.id, 0]));
  for (const g of guests) {
    if (g.status === "accepted" && g.table_id && g.table_id in usage) usage[g.table_id] += g.party_size;
  }
  return usage;
}

export function canAssign(table: SeatTable, guest: SeatGuest, guests: SeatGuest[]): { ok: true } | { ok: false; reason: string } {
  if (guest.status !== "accepted") return { ok: false, reason: "Only guests who accepted can be seated." };
  const others = guests.filter((x) => x.id !== guest.id);
  const used = tableUsage([table], others)[table.id];
  if (used + guest.party_size > table.capacity) {
    return { ok: false, reason: `${table.name} has ${table.capacity - used} seat(s) left; ${guest.name}'s party needs ${guest.party_size}.` };
  }
  return { ok: true };
}

/**
 * Greedy first-fit-decreasing: seats accepted guests who have no table yet, biggest parties first.
 * Never moves already-seated guests. Returns new assignments and the guests that didn't fit.
 */
export function autoSeat(guests: SeatGuest[], tables: SeatTable[]): { assignments: Record<string, string>; unseated: string[] } {
  const usage = tableUsage(tables, guests);
  const todo = guests
    .filter((g) => g.status === "accepted" && !g.table_id && g.party_size > 0)
    .sort((a, b) => b.party_size - a.party_size || a.name.localeCompare(b.name));
  const assignments: Record<string, string> = {};
  const unseated: string[] = [];
  for (const g of todo) {
    const table = tables.find((t) => usage[t.id] + g.party_size <= t.capacity);
    if (!table) { unseated.push(g.id); continue; }
    usage[table.id] += g.party_size;
    assignments[g.id] = table.id;
  }
  return { assignments, unseated };
}
