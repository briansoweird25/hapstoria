import { describe, expect, it } from "vitest";
import { slugify, withSuffix, isValidSlug } from "@/lib/slug";

describe("slug", () => {
  it("lowercases, strips accents and punctuation", () => {
    expect(slugify("Sofía's 18th Birthday!")).toBe("sofias-18th-birthday");
  });
  it("collapses whitespace and dashes", () => {
    expect(slugify("  a   --  b ")).toBe("a-b");
  });
  it("pads very short results so they pass validation", () => {
    expect(isValidSlug(slugify("A"))).toBe(true);
  });
  it("truncates to 60 chars without trailing dash", () => {
    const s = slugify("x".repeat(40) + " " + "y".repeat(40));
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith("-")).toBe(false);
  });
  it("adds a random suffix", () => {
    expect(withSuffix("party", () => 0.5)).toMatch(/^party-[a-z0-9]{4}$/);
  });
  it("rejects invalid slugs", () => {
    expect(isValidSlug("Bad Slug")).toBe(false);
    expect(isValidSlug("ok-slug-1")).toBe(true);
  });
});

describe("slug edge cases", () => {
  it("produces a valid slug for non-latin or emoji-only titles", () => {
    for (const t of ["婚礼", "!!", "🎉🎉", "حفل"]) expect(isValidSlug(slugify(t))).toBe(true);
  });
});
