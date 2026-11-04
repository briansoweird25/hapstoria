import { describe, expect, it } from "vitest";
import { formatEventDate, zonedLocalToIso, toZonedLocal } from "@/lib/format";
import { eventInputSchema } from "@/lib/validation";

describe("format", () => {
  it("round-trips datetime-local through ISO", () => {
    const local = "2026-12-12T18:30";
    expect(toZonedLocal(zonedLocalToIso(local, "Asia/Manila"), "Asia/Manila")).toBe(local);
  });
  it("returns empty strings for missing or invalid input", () => {
    expect(zonedLocalToIso("")).toBe("");
    expect(zonedLocalToIso("garbage")).toBe("");
    expect(formatEventDate(null)).toBe("");
    expect(toZonedLocal("nope")).toBe("");
  });
  it("produces ISO strings the event schema accepts", () => {
    const iso = zonedLocalToIso("2026-12-12T18:30", "Asia/Manila");
    const r = eventInputSchema.parse({ title: "T", starts_at: iso, rsvp_deadline: iso });
    expect(r.starts_at).toBe(iso);
  });
  it("formats a readable date", () => {
    expect(formatEventDate("2026-03-14T18:00:00Z")).toContain("2026");
  });
});


describe("timezone-aware formatting", () => {
  it("interprets local input in the event's timezone (Manila = UTC+8)", () => {
    expect(zonedLocalToIso("2026-12-12T18:00", "Asia/Manila")).toBe("2026-12-12T10:00:00.000Z");
  });
  it("handles DST zones", () => {
    expect(zonedLocalToIso("2026-07-01T12:00", "America/New_York")).toBe("2026-07-01T16:00:00.000Z");
    expect(zonedLocalToIso("2026-01-01T12:00", "America/New_York")).toBe("2026-01-01T17:00:00.000Z");
  });
  it("round-trips through the zone", () => {
    expect(toZonedLocal("2026-12-12T10:00:00.000Z", "Asia/Manila")).toBe("2026-12-12T18:00");
  });
  it("formats event dates in the given zone regardless of server tz", () => {
    expect(formatEventDate("2026-12-12T10:00:00.000Z", "Asia/Manila")).toContain("6:00 PM");
  });
  it("falls back to UTC for invalid zones", () => {
    expect(zonedLocalToIso("2026-12-12T18:00", "Not/AZone")).toBe("2026-12-12T18:00:00.000Z");
  });
});
