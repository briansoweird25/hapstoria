"use client";

import { useEffect, useRef, useState } from "react";
import { collageRects, coverCrop, MAX_COLLAGE_PHOTOS, type CollageLayout } from "@/lib/collage";

export interface CollagePhoto { id: string; url: string }

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // required so the canvas can be exported
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load a photo"));
    img.src = url;
  });
}

export function CollageMaker({ photos, defaultCaption, slug }: { photos: CollagePhoto[]; defaultCaption: string; slug: string }) {
  const [selected, setSelected] = useState<string[]>(photos.slice(0, 6).map((p) => p.id));
  const [layout, setLayout] = useState<CollageLayout>("grid");
  const [caption, setCaption] = useState(defaultCaption);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const chosen = selected.map((id) => photos.find((p) => p.id === id)).filter((p): p is CollagePhoto => Boolean(p));
      const { rects, canvas: size, captionHeight } = collageRects(layout, chosen.length);
      canvas.width = size.w;
      canvas.height = size.h;
      ctx.fillStyle = "#faf6ee";
      ctx.fillRect(0, 0, size.w, size.h);
      try {
        const imgs = await Promise.all(chosen.map((p) => loadImage(p.url)));
        if (cancelled) return;
        setError("");
        imgs.forEach((img, i) => {
          const r = rects[i];
          const c = coverCrop(img.naturalWidth, img.naturalHeight, r.w, r.h);
          ctx.drawImage(img, c.sx, c.sy, c.sw, c.sh, r.x, r.y, r.w, r.h);
        });
      } catch {
        if (!cancelled) setError("Some photos couldn't be loaded. Try again.");
      }
      ctx.fillStyle = "#2b2418";
      ctx.font = `${Math.round(captionHeight * 0.5)}px Georgia, serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(caption, size.w / 2, size.h - captionHeight / 2, size.w - 80);
    })();
    return () => { cancelled = true; };
  }, [selected, layout, caption, photos]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= MAX_COLLAGE_PHOTOS ? prev : [...prev, id]));

  function download() {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return setError("Could not create the image.");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${slug}-collage.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <div className="card space-y-3">
          <p className="label">Layout</p>
          <div className="flex gap-2">
            {(["grid", "mosaic", "filmstrip"] as const).map((l) => (
              <button key={l} type="button" aria-pressed={layout === l} onClick={() => setLayout(l)}
                className={`rounded-full border px-3 py-1 text-sm capitalize ${layout === l ? "border-ink bg-ink text-ivory" : "border-line"}`}>{l}</button>
            ))}
          </div>
          <label className="label" htmlFor="caption">Caption</label>
          <input id="caption" className="input" value={caption} maxLength={60} onChange={(e) => setCaption(e.target.value)} />
          <button type="button" className="btn-primary w-full" onClick={download} disabled={selected.length === 0}>Download collage (PNG)</button>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </div>
        <div className="card">
          <p className="label">Photos ({selected.length}/{MAX_COLLAGE_PHOTOS})</p>
          {photos.length === 0 && <p className="text-sm text-muted">Approve some photos first.</p>}
          <ul className="mt-2 grid grid-cols-4 gap-1.5">
            {photos.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => toggle(p.id)} aria-pressed={selected.includes(p.id)} aria-label="Toggle photo"
                  className={`relative block aspect-square w-full overflow-hidden rounded-md border-2 ${selected.includes(p.id) ? "border-champagne" : "border-transparent opacity-60"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="size-full object-cover" loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="card flex items-center justify-center bg-champagne-soft">
        <canvas ref={canvasRef} className="max-h-[70vh] w-full max-w-full rounded-lg object-contain shadow" aria-label="Collage preview" />
      </div>
    </div>
  );
}
