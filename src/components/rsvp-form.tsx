"use client";

import { useActionState, useState } from "react";
import { submitRsvp, type RsvpState } from "@/app/e/[slug]/actions";

export function RsvpForm({ slug, mealOptions, maxPlusOnes, closed }: { slug: string; mealOptions: string[]; maxPlusOnes: number; closed: boolean }) {
  const [state, action, pending] = useActionState(submitRsvp.bind(null, slug), { ok: false } as RsvpState);
  const [status, setStatus] = useState<"accepted" | "declined">("accepted");

  if (closed) return <p className="rounded-xl bg-champagne-soft p-4 text-center text-sm">RSVPs for this event have closed.</p>;
  if (state.ok) {
    return (
      <div role="status" className="rounded-2xl bg-emerald-50 p-6 text-center">
        <p className="font-serif text-3xl">{state.status === "accepted" ? "See you there!" : "We'll miss you"}</p>
        <p className="mt-1 text-sm text-muted">Thank you, {state.name}. Your reply has been sent to the host.</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="name" className="label">Your name</label>
        <input id="name" name="name" required maxLength={120} autoComplete="name" className="input" />
      </div>
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="sr-only">Will you attend?</legend>
        {(["accepted", "declined"] as const).map((s) => (
          <label key={s} className={`cursor-pointer rounded-xl border-2 p-3 text-center text-sm font-medium ${status === s ? "border-champagne bg-champagne-soft" : "border-line"}`}>
            <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} className="sr-only" />
            {s === "accepted" ? "Joyfully accept" : "Regretfully decline"}
          </label>
        ))}
      </fieldset>
      {status === "accepted" && (
        <>
          <div>
            <label htmlFor="party_size" className="label">Number of guests (including you)</label>
            <select id="party_size" name="party_size" className="input" defaultValue="1">
              {Array.from({ length: maxPlusOnes + 1 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {mealOptions.length > 0 && (
            <div>
              <label htmlFor="meal" className="label">Meal choice</label>
              <select id="meal" name="meal" className="input" defaultValue={mealOptions[0]}>
                {mealOptions.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          )}
        </>
      )}
      <div>
        <label htmlFor="note" className="label">Note for the host (optional)</label>
        <textarea id="note" name="note" rows={2} maxLength={500} className="input" />
      </div>
      <div>
        <label htmlFor="email" className="label">Email (optional)</label>
        <input id="email" name="email" type="email" autoComplete="email" className="input" />
      </div>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Sending…" : "Send reply"}</button>
    </form>
  );
}
