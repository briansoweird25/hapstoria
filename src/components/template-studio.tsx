"use client";

import { useActionState, useState } from "react";
import { submitTemplate, type SubmitState } from "@/app/dashboard/creator/actions";
import { InvitationCard } from "@/components/invitation-card";
import { contrastRatio } from "@/lib/color";
import { EVENT_KINDS } from "@/lib/templates";

const FONTS = ["serif", "script", "sans", "display"] as const;

export function TemplateStudio() {
  const [state, action, pending] = useActionState(submitTemplate, { ok: false } as SubmitState);
  const [v, setV] = useState({ name: "", kind: "cultural", font: "serif" as (typeof FONTS)[number], bg: "#faf6ee", surface: "#fffdf8", text: "#2b2418", accent: "#b8934a", accentSoft: "#f1e6cc" });
  const set = (k: keyof typeof v, val: string) => setV((p) => ({ ...p, [k]: val }));
  const ratio = contrastRatio(v.text, v.bg);
  const theme = { id: "mkt:preview", name: v.name || "Preview", kind: v.kind, culture: "", description: "", font: v.font, sections: [], palette: { bg: v.bg, surface: v.surface, text: v.text, accent: v.accent, accentSoft: v.accentSoft } };

  if (state.ok) return <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Submitted for review. We&apos;ll approve it or tell you what to change.</p>;
  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="name">Template name</label><input id="name" name="name" required className="input" value={v.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div><label className="label" htmlFor="price">Price (₱150–₱5,000)</label><input id="price" name="price" required inputMode="decimal" className="input" placeholder="250" /></div>
        <div><label className="label" htmlFor="kind">Event type</label>
          <select id="kind" name="kind" className="input" value={v.kind} onChange={(e) => set("kind", e.target.value)}>{EVENT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></div>
        <div><label className="label" htmlFor="culture">Culture / tradition</label><input id="culture" name="culture" className="input" placeholder="e.g. Filipino, Mexican, Indian" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="description">Description</label><input id="description" name="description" maxLength={300} className="input" /></div>
        <div><label className="label" htmlFor="font">Heading font</label>
          <select id="font" name="font" className="input" value={v.font} onChange={(e) => set("font", e.target.value)}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select></div>
        <div />
        {(["bg", "surface", "text", "accent", "accentSoft"] as const).map((k) => (
          <div key={k}><label className="label" htmlFor={k}>{k === "accentSoft" ? "Soft accent" : k === "bg" ? "Background" : k}</label>
            <input id={k} name={k} type="color" value={v[k]} onChange={(e) => set(k, e.target.value)} className="h-10 w-full rounded-xl border border-line" /></div>
        ))}
        <p className={`text-xs sm:col-span-2 ${ratio >= 4.5 ? "text-emerald-700" : "text-red-700"}`}>Text contrast: {ratio.toFixed(1)}:1 {ratio >= 4.5 ? "(passes)" : "(needs 4.5:1)"}</p>
        {state.error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{state.error}</p>}
        <div className="sm:col-span-2"><button className="btn-primary" disabled={pending}>{pending ? "Submitting…" : "Submit for review"}</button></div>
      </div>
      <aside><p className="label">Preview</p><InvitationCard compact data={{ title: v.name || "Your template", template_id: "mkt:preview", theme, host_names: "Sample hosts" }} /></aside>
    </form>
  );
}
