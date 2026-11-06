import { describe, expect, it } from "vitest";
import { loginErrorMessage } from "@/lib/login-errors";

describe("loginErrorMessage", () => {
  it("explains the email rate limit", () => {
    expect(loginErrorMessage({ code: "over_email_send_rate_limit", status: 429 })).toMatch(/wait/i);
  });
  it("explains the default-sender restriction", () => {
    expect(loginErrorMessage({ code: "email_address_not_authorized", status: 400 })).toMatch(/email (sender|service)/i);
    expect(loginErrorMessage({ message: "Email address not authorized", status: 400 })).toMatch(/email (sender|service)/i);
  });
  it("explains disabled sign-ups and invalid addresses", () => {
    expect(loginErrorMessage({ code: "signup_disabled" })).toMatch(/sign-?ups/i);
    expect(loginErrorMessage({ code: "email_address_invalid" })).toMatch(/valid email/i);
  });
  it("falls back to a generic message that still carries the code for support", () => {
    const m = loginErrorMessage({ code: "unexpected_failure", status: 500 });
    expect(m).toContain("unexpected_failure");
  });
  it("handles errors with no code", () => {
    expect(loginErrorMessage({ message: "fetch failed" })).toMatch(/couldn't send/i);
  });
});
