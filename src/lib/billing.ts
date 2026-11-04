/** Pure billing/entitlement rules. No I/O: everything takes plain data so it is unit-testable. */

export type Tier = "keeper" | "keeper_plus" | "planner";
export interface SubscriptionLike {
  status: string;
  tier: Tier;
  /** When the subscription stopped entitling the user (set by the webhook on cancellation). */
  ended_at?: string | null;
}

export const FREE_GUEST_LIMIT = 30;
export const PLANNER_EVENT_LIMIT = 15;
export const ALBUM_DAYS = { free: 30, premium: 90 } as const;
export const GRACE_DAYS = 14;
export const EXPIRING_SOON_DAYS = 14;
const DAY = 86_400_000;
const GB = 1024 ** 3;

export const PRICES = {
  // Amounts in USD cents. Stripe handles currency conversion/localisation.
  event_premium: { cents: 3600, label: "Premium event" },
  keeper: { cents: 999, label: "Memory Keeper" },
  keeper_plus: { cents: 1999, label: "Memory Keeper Plus" },
  planner: { cents: 4900, label: "Planner" },
} as const;

const TIER_RANK: Record<Tier, number> = { keeper: 1, keeper_plus: 2, planner: 3 };

export function hasActiveSubscription(sub: SubscriptionLike | null | undefined): boolean {
  // past_due = Stripe is still retrying the card; keep access during that window.
  return !!sub && (sub.status === "active" || sub.status === "trialing" || sub.status === "past_due");
}

/** The highest tier among active subscriptions, or null. */
export function tierFor(subs: SubscriptionLike[]): Tier | null {
  let best: Tier | null = null;
  for (const s of subs) {
    if (hasActiveSubscription(s) && (!best || TIER_RANK[s.tier] > TIER_RANK[best])) best = s.tier;
  }
  return best;
}

/** Newest end date among subscriptions that no longer entitle the user (null if none). */
export function latestEntitlementEnd(subs: SubscriptionLike[]): string | null {
  let latest: string | null = null;
  for (const s of subs) {
    if (hasActiveSubscription(s) || !s.ended_at) continue;
    if (!latest || new Date(s.ended_at) > new Date(latest)) latest = s.ended_at;
  }
  return latest;
}

/** True if the tier keeps albums alive after the event pass expires. */
export function tierKeepsAlbums(tier: Tier | null): boolean {
  return tier !== null;
}

export function storageQuotaBytes(tier: Tier | null): number {
  switch (tier) {
    case "keeper_plus": return 500 * GB;
    case "keeper": return 100 * GB;
    case "planner": return 100 * GB;
    default: return 5 * GB;
  }
}

export function guestLimit(event: { premium: boolean }): number {
  return event.premium ? Infinity : FREE_GUEST_LIMIT;
}

export function canCreateEvent(input: { events: { premium: boolean }[]; tier: Tier | null }): { ok: true } | { ok: false; reason: string } {
  if (input.tier === "planner") {
    return input.events.length >= PLANNER_EVENT_LIMIT
      ? { ok: false, reason: `Planner plans include up to ${PLANNER_EVENT_LIMIT} events at once.` }
      : { ok: true };
  }
  if (input.events.some((e) => !e.premium)) {
    return { ok: false, reason: "The free plan includes one invitation. Upgrade it to Premium, or delete it, to create another." };
  }
  return { ok: true };
}

export type AlbumState = "active" | "expiring" | "grace" | "deleted" | "kept";
export interface AlbumStatus {
  state: AlbumState;
  expiresAt: Date | null;
  daysLeft: number | null;
}

/** Album lifecycle: 30 days (free) / 90 days (premium), then a grace period, then deletion. Subscribers keep everything. */
export function albumStatus(input: {
  premium: boolean;
  createdAt: string;
  premiumAt: string | null;
  tier: Tier | null;
  now?: Date;
  /** If the owner's subscription ended, the album's expiry clock restarts from this date. */
  entitlementEndedAt?: string | null;
}): AlbumStatus {
  if (tierKeepsAlbums(input.tier)) return { state: "kept", expiresAt: null, daysLeft: null };
  const now = input.now ?? new Date();
  let start = new Date(input.premium && input.premiumAt ? input.premiumAt : input.createdAt);
  if (input.entitlementEndedAt && new Date(input.entitlementEndedAt) > start) start = new Date(input.entitlementEndedAt);
  const days = input.premium ? ALBUM_DAYS.premium : ALBUM_DAYS.free;
  const expiresAt = new Date(start.getTime() + days * DAY);
  const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / DAY);
  let state: AlbumState = "active";
  if (daysLeft <= 0) state = -daysLeft > GRACE_DAYS ? "deleted" : "grace";
  else if (daysLeft <= EXPIRING_SOON_DAYS) state = "expiring";
  return { state, expiresAt, daysLeft };
}

/** Uploads and public album viewing are allowed while the album is not past expiry. */
export function albumAcceptsUploads(state: AlbumState): boolean {
  return state === "active" || state === "expiring" || state === "kept";
}

export type Interval = "month" | "year";

/** Subscription price in USD cents. Yearly = 10 × monthly ("2 months free"). */
export function subscriptionAmount(tier: Tier, interval: Interval): number {
  const monthly = PRICES[tier].cents;
  return interval === "year" ? monthly * 10 : monthly;
}
