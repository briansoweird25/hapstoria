"use client";

import { useEffect, useState } from "react";

export interface Slide { id: string; kind: "photo" | "video" | "greeting"; url?: string; text?: string; by: string }

export function Slideshow({ slides, seconds = 6 }: { slides: Slide[]; seconds?: number }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = slides[i % Math.max(slides.length, 1)];

  useEffect(() => {
    if (paused || slides.length < 2 || current?.kind === "video") return;
    const t = setTimeout(() => setI((n) => (n + 1) % slides.length), seconds * 1000);
    return () => clearTimeout(t);
  }, [i, paused, slides.length, seconds, current?.kind]);

  if (!current) return <p className="grid min-h-screen place-items-center text-ivory">Nothing to show yet.</p>;
  const next = () => setI((n) => (n + 1) % slides.length);
  const prev = () => setI((n) => (n - 1 + slides.length) % slides.length);

  return (
    <div className="relative grid min-h-screen place-items-center bg-black text-ivory" onKeyDown={(e) => { if (e.key === "ArrowRight") next(); if (e.key === "ArrowLeft") prev(); if (e.key === " ") setPaused((p) => !p); }} tabIndex={0}>
      {current.kind === "photo" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={current.id} src={current.url} alt={`Photo from ${current.by}`} className="max-h-screen max-w-full object-contain" />
      )}
      {current.kind === "video" && <video key={current.id} src={current.url} autoPlay muted playsInline controls onEnded={next} className="max-h-screen max-w-full" />}
      {current.kind === "greeting" && (
        <blockquote key={current.id} className="max-w-2xl px-8 text-center font-serif text-4xl leading-snug">“{current.text}”<footer className="mt-4 text-lg opacity-70">— {current.by}</footer></blockquote>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-4 text-sm opacity-70 hover:opacity-100">
        <button onClick={prev} className="px-3 py-1" aria-label="Previous">‹</button>
        <button onClick={() => setPaused((p) => !p)} className="px-3 py-1">{paused ? "Play" : "Pause"} · {(i % slides.length) + 1}/{slides.length}</button>
        <button onClick={next} className="px-3 py-1" aria-label="Next">›</button>
      </div>
    </div>
  );
}
