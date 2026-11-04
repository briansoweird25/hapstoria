import { describe, expect, it } from "vitest";
import { canWrite, emailsMatch, inviteSchema, profileSchema, isHexColor } from "@/lib/team";

describe("roles", () => {
  it("editors can write, viewers cannot", () => {
    expect(canWrite("editor")).toBe(true);
    expect(canWrite("viewer")).toBe(false);
    expect(canWrite(null)).toBe(false);
  });
});

describe("emailsMatch", () => {
  it("compares case-insensitively and trims", () => {
    expect(emailsMatch(" Ana@Example.com ", "ana@example.com")).toBe(true);
    expect(emailsMatch("a@x.com", "b@x.com")).toBe(false);
    expect(emailsMatch(null, "a@x.com")).toBe(false);
  });
});

describe("inviteSchema", () => {
  it("normalizes email and validates role", () => {
    expect(inviteSchema.parse({ email: " Ana@Example.COM ", role: "editor" })).toEqual({ email: "ana@example.com", role: "editor" });
    expect(inviteSchema.safeParse({ email: "nope", role: "editor" }).success).toBe(false);
    expect(inviteSchema.safeParse({ email: "a@x.com", role: "owner" }).success).toBe(false);
  });
});

describe("profileSchema", () => {
  it("validates slug, color, and lengths", () => {
    expect(profileSchema.safeParse({ business_name: "Luna Events", slug: "luna-events", brand_color: "#8a6fb5", tagline: "Weddings & debuts", is_public: "on" }).success).toBe(true);
    expect(profileSchema.safeParse({ business_name: "L", slug: "Bad Slug", brand_color: "#8a6fb5" }).success).toBe(false);
    expect(profileSchema.safeParse({ business_name: "L", slug: "luna", brand_color: "red" }).success).toBe(false);
  });
  it("hex helper", () => {
    expect(isHexColor("#abcdef")).toBe(true);
    expect(isHexColor("abcdef")).toBe(false);
  });
});
