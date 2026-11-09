import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema, newPasswordSchema, authMode } from "@/lib/auth-forms";
import { loginErrorMessage } from "@/lib/login-errors";

describe("loginSchema", () => {
  it("needs a valid email and a password", () => {
    expect(loginSchema.safeParse({ email: " Ana@X.com ", password: "secret" }).data).toEqual({ email: "ana@x.com", password: "secret" });
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@x.com", password: "" }).success).toBe(false);
  });
});

describe("signupSchema", () => {
  const ok = { email: "a@x.com", password: "longenough1", confirm: "longenough1" };
  it("accepts matching passwords of at least 8 characters", () => {
    expect(signupSchema.safeParse(ok).success).toBe(true);
  });
  it("rejects short passwords", () => {
    const r = signupSchema.safeParse({ ...ok, password: "short", confirm: "short" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/8 characters/);
  });
  it("rejects mismatched confirmation", () => {
    const r = signupSchema.safeParse({ ...ok, confirm: "different1" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/match/i);
  });
  it("rejects passwords over 72 characters (bcrypt limit)", () => {
    const p = "a".repeat(73);
    expect(signupSchema.safeParse({ ...ok, password: p, confirm: p }).success).toBe(false);
  });
});

describe("newPasswordSchema", () => {
  it("applies the same rules without an email", () => {
    expect(newPasswordSchema.safeParse({ password: "longenough1", confirm: "longenough1" }).success).toBe(true);
    expect(newPasswordSchema.safeParse({ password: "longenough1", confirm: "x" }).success).toBe(false);
  });
});

describe("authMode", () => {
  it("accepts known modes and defaults to login", () => {
    expect(authMode("signup")).toBe("signup");
    expect(authMode("forgot")).toBe("forgot");
    expect(authMode("link")).toBe("link");
    expect(authMode("nonsense")).toBe("login");
    expect(authMode(undefined)).toBe("login");
    expect(authMode(["signup"])).toBe("login");
  });
});

describe("password error messages", () => {
  it("handles wrong credentials without revealing which part was wrong", () => {
    expect(loginErrorMessage({ code: "invalid_credentials" })).toMatch(/email or password/i);
  });
  it("tells unconfirmed users to check their inbox", () => {
    expect(loginErrorMessage({ code: "email_not_confirmed" })).toMatch(/confirm/i);
  });
  it("points existing accounts to log in", () => {
    expect(loginErrorMessage({ code: "user_already_exists" })).toMatch(/already/i);
    expect(loginErrorMessage({ code: "email_exists" })).toMatch(/already/i);
  });
  it("explains weak passwords", () => {
    expect(loginErrorMessage({ code: "weak_password" })).toMatch(/password/i);
  });
});
