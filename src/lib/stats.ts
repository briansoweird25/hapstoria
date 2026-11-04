export interface GuestLike {
  status: "pending" | "accepted" | "declined";
  party_size: number;
  meal: string | null;
}

export interface GuestSummary {
  invited: number;
  accepted: number;
  declined: number;
  pending: number;
  headcount: number;
  meals: Record<string, number>;
}

export function summarizeGuests(guests: GuestLike[]): GuestSummary {
  const s: GuestSummary = { invited: guests.length, accepted: 0, declined: 0, pending: 0, headcount: 0, meals: {} };
  for (const g of guests) {
    if (g.status === "accepted") {
      s.accepted++;
      s.headcount += g.party_size;
      if (g.meal) s.meals[g.meal] = (s.meals[g.meal] ?? 0) + 1;
    } else if (g.status === "declined") s.declined++;
    else s.pending++;
  }
  return s;
}
