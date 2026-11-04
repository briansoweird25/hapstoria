import { describe, expect, it } from "vitest";
import { validateUpload, extensionFor } from "@/lib/upload-rules";

describe("validateUpload", () => {
  it("accepts a jpeg photo under the limit", () => {
    expect(validateUpload({ type: "image/jpeg", size: 1_000_000 })).toEqual({ ok: true, kind: "photo" });
  });
  it("accepts mp4 video", () => {
    expect(validateUpload({ type: "video/mp4", size: 5_000_000 })).toEqual({ ok: true, kind: "video" });
  });
  it("rejects oversize photos and videos with different caps", () => {
    expect(validateUpload({ type: "image/png", size: 30_000_000 }).ok).toBe(false);
    expect(validateUpload({ type: "video/mp4", size: 90_000_000 }).ok).toBe(true);
    expect(validateUpload({ type: "video/mp4", size: 120_000_000 }).ok).toBe(false);
  });
  it("rejects unsupported and dangerous types", () => {
    expect(validateUpload({ type: "application/pdf", size: 10 }).ok).toBe(false);
    expect(validateUpload({ type: "image/svg+xml", size: 10 }).ok).toBe(false);
  });
  it("rejects empty files", () => {
    expect(validateUpload({ type: "image/png", size: 0 }).ok).toBe(false);
  });
  it("maps mime to extension", () => {
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("video/quicktime")).toBe("mov");
  });
});
