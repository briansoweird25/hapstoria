import { describe, expect, it } from "vitest";
import { parseGuestList } from "@/lib/guest-import";

describe("parseGuestList", () => {
  it("parses one name per line", () => {
    expect(parseGuestList("Ana\nBen").guests.map((g) => g.name)).toEqual(["Ana", "Ben"]);
  });
  it("parses CSV with email and phone", () => {
    const r = parseGuestList("Ana, ana@x.com, +63917\nBen,,");
    expect(r.guests[0]).toEqual({ name: "Ana", email: "ana@x.com", phone: "+63917" });
    expect(r.guests[1]).toEqual({ name: "Ben", email: null, phone: null });
  });
  it("parses tab-separated paste from spreadsheets", () => {
    expect(parseGuestList("Ana\tana@x.com").guests[0].email).toBe("ana@x.com");
  });
  it("skips a header row", () => {
    expect(parseGuestList("Name,Email\nAna,a@x.com").guests).toHaveLength(1);
  });
  it("de-duplicates case-insensitively and reports skipped rows", () => {
    const r = parseGuestList("Ana\nana\n,x@y.com");
    expect(r.guests).toHaveLength(1);
    expect(r.skipped).toBe(2);
  });
  it("drops invalid emails but keeps the guest", () => {
    expect(parseGuestList("Ana, not-an-email").guests[0].email).toBeNull();
  });
  it("handles quoted names containing commas", () => {
    expect(parseGuestList('"Cruz, Maria",m@x.com').guests[0].name).toBe("Cruz, Maria");
  });
});
