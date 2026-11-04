"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { MEDIA_BUCKET } from "@/lib/media-config";
import { validateUpload } from "@/lib/upload-rules";

type Item = { name: string; state: "uploading" | "done" | "error"; message?: string };

async function api(body: unknown) {
  const res = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Upload failed.");
  return json as Record<string, string>;
}

export function UploadForm({ slug }: { slug: string }) {
  const [name, setName] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [greeting, setGreeting] = useState("");
  const [greetingState, setGreetingState] = useState<{ ok?: boolean; msg?: string }>({});
  const [sending, setSending] = useState(false);
  const guestName = name.trim() || "Guest";

  const update = (i: number, patch: Partial<Item>) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    const offset = items.length;
    setItems((prev) => [...prev, ...list.map((f) => ({ name: f.name, state: "uploading" as const }))]);
    const supabase = createClient();
    await Promise.all(list.map(async (file, k) => {
      const i = offset + k;
      try {
        const check = validateUpload(file);
        if (!check.ok) throw new Error(check.error);
        const { path, token } = await api({ action: "sign", slug, type: file.type, size: file.size });
        const { error } = await supabase.storage.from(MEDIA_BUCKET).uploadToSignedUrl(path, token, file, { contentType: file.type });
        if (error) throw new Error("Upload failed. Please try again.");
        await api({ action: "complete", slug, path, name: guestName });
        update(i, { state: "done" });
      } catch (e) {
        update(i, { state: "error", message: e instanceof Error ? e.message : "Upload failed." });
      }
    }));
  }

  async function sendGreeting(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      await api({ action: "greeting", slug, name: guestName, text: greeting });
      setGreeting("");
      setGreetingState({ ok: true, msg: "Greeting sent. Thank you!" });
    } catch (err) {
      setGreetingState({ ok: false, msg: err instanceof Error ? err.message : "Could not send." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="who" className="label">Your name</label>
        <input id="who" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" placeholder="So the host knows who shared" />
      </div>

      <section className="card space-y-3">
        <h2 className="font-serif text-2xl">Photos &amp; videos</h2>
        <label className="btn-primary w-full cursor-pointer">
          Choose photos or videos
          <input type="file" multiple accept="image/*,video/mp4,video/quicktime,video/webm" className="sr-only" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
        </label>
        <p className="text-xs text-muted">Photos up to 25 MB, videos up to 100 MB. The host reviews everything before it&apos;s shared.</p>
        <ul className="space-y-1 text-sm" aria-live="polite">
          {items.map((it, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="truncate">{it.name}</span>
              <span className={it.state === "error" ? "text-red-700" : it.state === "done" ? "text-emerald-700" : "text-muted"}>
                {it.state === "uploading" ? "Uploading…" : it.state === "done" ? "Sent ✓" : it.message}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={sendGreeting} className="card space-y-3">
        <h2 className="font-serif text-2xl">Leave a greeting</h2>
        <label htmlFor="greeting" className="sr-only">Your greeting</label>
        <textarea id="greeting" rows={4} maxLength={1000} className="input" value={greeting} onChange={(e) => setGreeting(e.target.value)} placeholder="Write something heartfelt…" />
        <button className="btn-soft" disabled={sending || !greeting.trim()}>{sending ? "Sending…" : "Send greeting"}</button>
        {greetingState.msg && <p role="status" className={`text-sm ${greetingState.ok ? "text-emerald-700" : "text-red-700"}`}>{greetingState.msg}</p>}
      </form>
    </div>
  );
}
