import { describe, expect, it } from "vitest";
import { needsRefresh, sessionExpiry } from "@/lib/session-cookie";
import { fitWithin, shouldCompress, IMAGE_MAX_EDGE } from "@/lib/image-resize";

const b64url = (s: string) => Buffer.from(s).toString("base64url");
const session = (expiresAt: number | undefined, jwtExp?: number) => {
  const jwt = [b64url('{"alg":"HS256"}'), b64url(JSON.stringify({ sub: "u", exp: jwtExp ?? expiresAt })), "sig"].join(".");
  return JSON.stringify({ access_token: jwt, refresh_token: "r", expires_at: expiresAt, token_type: "bearer" });
};
const cookie = (name: string, value: string) => ({ name, value });

describe("sessionExpiry", () => {
  it("reads expires_at from a base64 session cookie", () => {
    const v = "base64-" + b64url(session(1_800_000_000));
    expect(sessionExpiry([cookie("sb-abcd-auth-token", v)])).toBe(1_800_000_000);
  });
  it("falls back to the access token's exp claim", () => {
    const v = "base64-" + b64url(session(undefined, 1_800_000_123));
    expect(sessionExpiry([cookie("sb-abcd-auth-token", v)])).toBe(1_800_000_123);
  });
  it("joins chunked cookies in order", () => {
    const full = "base64-" + b64url(session(1_800_000_456));
    const mid = Math.floor(full.length / 2);
    const chunks = [cookie("sb-abcd-auth-token.1", full.slice(mid)), cookie("sb-abcd-auth-token.0", full.slice(0, mid))];
    expect(sessionExpiry(chunks)).toBe(1_800_000_456);
  });
  it("reads a plain JSON cookie", () => {
    expect(sessionExpiry([cookie("sb-abcd-auth-token", session(1_800_000_789))])).toBe(1_800_000_789);
  });
  it("ignores the temporary code-verifier cookie and garbage", () => {
    expect(sessionExpiry([cookie("sb-abcd-auth-token-code-verifier", "x")])).toBeNull();
    expect(sessionExpiry([cookie("sb-abcd-auth-token", "base64-%%%")])).toBeNull();
    expect(sessionExpiry([cookie("other", "1")])).toBeNull();
    expect(sessionExpiry([])).toBeNull();
  });
});

describe("needsRefresh", () => {
  const now = 1_700_000_000;
  it("is false while the token has more than a minute left", () => {
    expect(needsRefresh(now + 3600, now)).toBe(false);
    expect(needsRefresh(now + 61, now)).toBe(false);
  });
  it("is true when expiring soon, expired, or unknown", () => {
    expect(needsRefresh(now + 30, now)).toBe(true);
    expect(needsRefresh(now - 10, now)).toBe(true);
    expect(needsRefresh(null, now)).toBe(true);
  });
});

describe("fitWithin", () => {
  it("keeps small images as they are", () => {
    expect(fitWithin(800, 600, IMAGE_MAX_EDGE)).toEqual({ width: 800, height: 600 });
  });
  it("scales the long edge down, keeping the aspect ratio", () => {
    expect(fitWithin(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3000, 4000, 2000)).toEqual({ width: 1500, height: 2000 });
  });
  it("never returns zero dimensions", () => {
    const r = fitWithin(10000, 1, 2000);
    expect(r.width).toBe(2000);
    expect(r.height).toBeGreaterThanOrEqual(1);
  });
});

describe("shouldCompress", () => {
  const f = (type: string, size: number) => ({ type, size });
  it("compresses big photos", () => {
    expect(shouldCompress(f("image/jpeg", 4_000_000))).toBe(true);
    expect(shouldCompress(f("image/png", 3_000_000))).toBe(true);
    expect(shouldCompress(f("image/webp", 2_000_000))).toBe(true);
  });
  it("leaves small files, GIFs, videos and unknown types alone", () => {
    expect(shouldCompress(f("image/jpeg", 200_000))).toBe(false);
    expect(shouldCompress(f("image/gif", 9_000_000))).toBe(false);
    expect(shouldCompress(f("video/mp4", 50_000_000))).toBe(false);
    expect(shouldCompress(f("image/heic", 5_000_000))).toBe(false);
    expect(shouldCompress(f("", 5_000_000))).toBe(false);
  });
});
