import { describe, expect, it } from "vitest";
import { formatEventDate, localToIso, toDatetimeLocal } from "@/lib/format";
import { eventInputSchema } from "@/lib/validation";

describe("format", () => {
  it("round-trips datetime-local through ISO", () => {
    const local = "2026-12-12T18:30";
    expect(toDatetimeLocal(localToIso(local))).toBe(local);
  });
  it("returns empty strings for missing or invalid input", () => {
    expect(localToIso("")).toBe("");
    expect(localToIso("garbage")).toBe("");
    expect(formatEventDate(null)).toBe("");
    expect(toDatetimeLocal("nope")).toBe("");
  });
  it("produces ISO strings the event schema accepts", () => {
    const iso = localToIso("2026-12-12T18:30");
    const r = eventInputSchema.parse({ title: "T", starts_at: iso, rsvp_deadline: iso });
    expect(r.starts_at).toBe(iso);
  });
  it("formats a readable date", () => {
    expect(formatEventDate("2026-03-14T18:00:00Z")).toContain("2026");
  });
});
