"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { MEDIA_BUCKET } from "@/lib/media-config";
import { extensionFor, validateUpload } from "@/lib/upload-rules";

/** Uploads a QR image to the owner's folder and exposes the path through a hidden input named `qr_path`. */
export function QrUpload({ userId }: { userId: string }) {
  const [path, setPath] = useState("");
  const [state, setState] = useState<"idle" | "uploading" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    const check = validateUpload(file);
    if (!check.ok || check.kind !== "photo") { setState("error"); setMsg("Please choose an image file (JPG, PNG or WebP)."); return; }
    setState("uploading");
    const p = `${userId}/gifts/${crypto.randomUUID()}.${extensionFor(file.type)}`;
    const { error } = await createClient().storage.from(MEDIA_BUCKET).upload(p, file, { contentType: file.type });
    if (error) { setState("error"); setMsg("Upload failed. Please try again."); return; }
    setPath(p); setState("idle"); setMsg(file.name);
  }

  return (
    <div>
      <input type="hidden" name="qr_path" value={path} />
      <label className="label" htmlFor="qr_file">QR code image (optional)</label>
      <input id="qr_file" type="file" accept="image/png,image/jpeg,image/webp" className="input" onChange={(e) => onFile(e.target.files?.[0])} />
      {state === "uploading" && <p className="mt-1 text-xs text-muted">Uploading…</p>}
      {msg && <p role={state === "error" ? "alert" : "status"} className={`mt-1 text-xs ${state === "error" ? "text-red-700" : "text-emerald-700"}`}>{msg}</p>}
    </div>
  );
}
