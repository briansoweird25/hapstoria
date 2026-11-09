import { describe, expect, it } from "vitest";
import { expiryReminderKind, reminderGuests } from "@/lib/reminders";
import { escapeHtml, rsvpConfirmationEmail, rsvpReminderEmail, expiryEmail } from "@/lib/email/templates";

describe("expiryReminderKind", () => {
  const st = (state: string, daysLeft: number | null) => ({ state, daysLeft, expiresAt: null }) as never;
  it("fires at 30, 7 and 1 days left", () => {
    expect(expiryReminderKind(st("active", 30))).toBe("expiry_30");
    expect(expiryReminderKind(st("expiring", 7))).toBe("expiry_7");
    expect(expiryReminderKind(st("expiring", 1))).toBe("expiry_1");
  });
  it("catches up to the nearest due reminder if a day was missed", () => {
    expect(expiryReminderKind(st("expiring", 6))).toBe("expiry_7");
    expect(expiryReminderKind(st("active", 25))).toBe("expiry_30");
  });
  it("sends the grace notice once expired", () => {
    expect(expiryReminderKind(st("grace", -3))).toBe("grace");
  });
  it("sends nothing for kept, deleted, or far-off expiry", () => {
    expect(expiryReminderKind(st("kept", null))).toBeNull();
    expect(expiryReminderKind(st("deleted", -30))).toBeNull();
    expect(expiryReminderKind(st("active", 60))).toBeNull();
  });
});

describe("reminderGuests", () => {
  const now = new Date("2026-06-10T00:00:00Z");
  const g = (over: object) => ({ id: "1", name: "A", email: "a@x.com", status: "pending", reminded_at: null, ...over });
  it("selects pending guests with email who weren't reminded in the last 3 days", () => {
    const list = [g({ id: "1" }), g({ id: "2", email: null }), g({ id: "3", status: "accepted" }),
      g({ id: "4", reminded_at: "2026-06-09T00:00:00Z" }), g({ id: "5", reminded_at: "2026-06-01T00:00:00Z" })];
    expect(reminderGuests(list as never, now).map((x) => x.id)).toEqual(["1", "5"]);
  });
});

describe("email templates", () => {
  it("escapes HTML in user content", () => {
    expect(escapeHtml(`<script>"&'`)).toBe("&lt;script&gt;&quot;&amp;&#39;");
    const m = rsvpConfirmationEmail({ guestName: "<b>Ana</b>", eventTitle: "Sofia & Co", status: "accepted", partySize: 2, inviteUrl: "https://x/e/a" });
    expect(m.html).not.toContain("<b>Ana</b>");
    expect(m.html).toContain("Sofia &amp; Co");
    expect(m.subject).toContain("Sofia & Co");
  });
  it("builds reminder and expiry emails with links", () => {
    expect(rsvpReminderEmail({ guestName: "Ana", eventTitle: "T", inviteUrl: "https://x/e/a" }).html).toContain("https://x/e/a");
    const e = expiryEmail({ eventTitle: "T", kind: "expiry_7", daysLeft: 7, dashboardUrl: "https://x/d" });
    expect(e.subject).toMatch(/7 days/);
    expect(expiryEmail({ eventTitle: "T", kind: "grace", daysLeft: -2, dashboardUrl: "u" }).subject).toMatch(/expired/i);
  });
});

import { membershipEmail } from "@/lib/email/templates";
describe("membershipEmail", () => {
  it("names the plan, date and renewal link, and escapes HTML", () => {
    const m = membershipEmail({ planLabel: "Memory <Keeper>", kind: "m7", endsOn: "December 9, 2026", renewUrl: "https://x/dashboard/billing" });
    expect(m.subject).toMatch(/7 days|week/i);
    expect(m.html).toContain("December 9, 2026");
    expect(m.html).toContain("https://x/dashboard/billing");
    expect(m.html).not.toContain("<Keeper>");
  });
  it("uses stronger wording the day before", () => {
    expect(membershipEmail({ planLabel: "Planner", kind: "m1", endsOn: "x", renewUrl: "u" }).subject).toMatch(/tomorrow/i);
  });
});
