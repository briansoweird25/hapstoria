import { describe, expect, it } from "vitest";
import { userFromClaims } from "@/lib/auth-claims";

describe("userFromClaims", () => {
  it("maps verified JWT claims to a minimal user", () => {
    expect(userFromClaims({ sub: "11111111-1111-4111-8111-111111111111", email: "a@x.com", role: "authenticated" }))
      .toEqual({ id: "11111111-1111-4111-8111-111111111111", email: "a@x.com" });
  });
  it("returns null without claims or a subject", () => {
    expect(userFromClaims(null)).toBeNull();
    expect(userFromClaims(undefined)).toBeNull();
    expect(userFromClaims({ email: "a@x.com" })).toBeNull();
  });
  it("rejects non-user roles such as the anon key", () => {
    expect(userFromClaims({ sub: "abc", role: "anon" })).toBeNull();
  });
  it("tolerates a missing email", () => {
    expect(userFromClaims({ sub: "abc", role: "authenticated" })).toEqual({ id: "abc", email: undefined });
  });
});
