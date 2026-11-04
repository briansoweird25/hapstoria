import { describe, expect, it } from "vitest";
import {
  ALBUM_DAYS, FREE_GUEST_LIMIT, GRACE_DAYS, albumStatus, canCreateEvent, guestLimit,
  hasActiveSubscription, latestEntitlementEnd, storageQuotaBytes, tierFor,
} from "@/lib/billing";

const day = 86_400_000;
const now = new Date("2026-06-01T00:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * day).toISOString();

describe("subscriptions", () => {
  it("treats active and trialing as active, others not", () => {
    expect(hasActiveSubscription({ status: "active", tier: "keeper" })).toBe(true);
    expect(hasActiveSubscription({ status: "trialing", tier: "keeper" })).toBe(true);
    expect(hasActiveSubscription({ status: "canceled", tier: "keeper" })).toBe(false);
    expect(hasActiveSubscription(null)).toBe(false);
  });
  it("picks the best active tier", () => {
    expect(tierFor([{ status: "active", tier: "keeper" }, { status: "active", tier: "keeper_plus" }])).toBe("keeper_plus");
    expect(tierFor([{ status: "canceled", tier: "planner" }])).toBeNull();
  });
  it("quota depends on tier", () => {
    expect(storageQuotaBytes("keeper")).toBe(100 * 1024 ** 3);
    expect(storageQuotaBytes("keeper_plus")).toBe(500 * 1024 ** 3);
    expect(storageQuotaBytes(null)).toBeLessThan(storageQuotaBytes("keeper"));
  });
});

describe("limits", () => {
  it("free events cap guests; premium is unlimited", () => {
    expect(guestLimit({ premium: false })).toBe(FREE_GUEST_LIMIT);
    expect(guestLimit({ premium: true })).toBe(Infinity);
  });
  it("free users get one non-premium event; planners up to 15", () => {
    expect(canCreateEvent({ events: [], tier: null })).toEqual({ ok: true });
    expect(canCreateEvent({ events: [{ premium: false }], tier: null }).ok).toBe(false);
    expect(canCreateEvent({ events: [{ premium: true }, { premium: true }], tier: null }).ok).toBe(true);
    expect(canCreateEvent({ events: Array(15).fill({ premium: false }), tier: "planner" }).ok).toBe(false);
    expect(canCreateEvent({ events: Array(14).fill({ premium: false }), tier: "planner" }).ok).toBe(true);
  });
});

describe("albumStatus", () => {
  it("free albums last 30 days from creation", () => {
    const s = albumStatus({ premium: false, createdAt: ago(10), premiumAt: null, tier: null, now });
    expect(s.state).toBe("active");
    expect(s.daysLeft).toBe(ALBUM_DAYS.free - 10);
  });
  it("premium albums last 90 days from purchase", () => {
    const s = albumStatus({ premium: true, createdAt: ago(200), premiumAt: ago(30), tier: null, now });
    expect(s.state).toBe("active");
    expect(s.daysLeft).toBe(ALBUM_DAYS.premium - 30);
  });
  it("flags expiring within 14 days", () => {
    expect(albumStatus({ premium: true, createdAt: ago(100), premiumAt: ago(80), tier: null, now }).state).toBe("expiring");
  });
  it("enters grace after expiry, then deleted after grace", () => {
    expect(albumStatus({ premium: true, createdAt: ago(100), premiumAt: ago(95), tier: null, now }).state).toBe("grace");
    expect(albumStatus({ premium: true, createdAt: ago(200), premiumAt: ago(90 + GRACE_DAYS + 1), tier: null, now }).state).toBe("deleted");
  });
  it("an active subscription keeps the album forever", () => {
    const s = albumStatus({ premium: true, createdAt: ago(900), premiumAt: ago(900), tier: "keeper", now });
    expect(s.state).toBe("kept");
  });
});

import { subscriptionAmount } from "@/lib/billing";
describe("subscriptionAmount", () => {
  it("yearly is ten months", () => {
    expect(subscriptionAmount("keeper", "month")).toBe(999);
    expect(subscriptionAmount("keeper", "year")).toBe(9990);
    expect(subscriptionAmount("planner", "year")).toBe(49000);
  });
});

describe("entitlement edge cases (review fixes)", () => {
  it("past_due and unpaid subscriptions still keep albums (card retry window)", () => {
    expect(hasActiveSubscription({ status: "past_due", tier: "keeper" })).toBe(true);
    expect(hasActiveSubscription({ status: "unpaid", tier: "keeper" })).toBe(false);
  });
  it("after a subscription ends, the expiry clock starts from the end date, not creation", () => {
    const endedAt = ago(5);
    const s = albumStatus({ premium: true, createdAt: ago(400), premiumAt: ago(300), tier: null, now, entitlementEndedAt: endedAt });
    expect(s.state).toBe("active");
    expect(s.daysLeft).toBe(ALBUM_DAYS.premium - 5);
  });
  it("a long-ended subscription still ends up in grace then deleted", () => {
    expect(albumStatus({ premium: true, createdAt: ago(400), premiumAt: ago(300), tier: null, now, entitlementEndedAt: ago(95) }).state).toBe("grace");
    expect(albumStatus({ premium: true, createdAt: ago(400), premiumAt: ago(300), tier: null, now, entitlementEndedAt: ago(120) }).state).toBe("deleted");
  });
  it("latestEntitlementEnd picks the newest end among ended subscriptions", () => {
    expect(latestEntitlementEnd([{ status: "canceled", tier: "keeper", ended_at: ago(30) }, { status: "canceled", tier: "keeper", ended_at: ago(10) }])).toBe(ago(10));
    expect(latestEntitlementEnd([{ status: "active", tier: "keeper", ended_at: null }])).toBeNull();
  });
});
