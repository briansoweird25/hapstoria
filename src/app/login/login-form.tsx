"use client";

import { useActionState } from "react";
import { sendMagicLink, signInWithGoogle, type LoginState } from "./actions";

const initial: LoginState = { ok: false, message: "" };

export function LoginForm({ next, showGoogle }: { next: string; showGoogle: boolean }) {
  const [state, action, pending] = useActionState(sendMagicLink, initial);
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" placeholder="you@example.com" />
        </div>
        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "Sending…" : "Email me a sign-in link"}
        </button>
        {state.message && (
          <p role="status" className={`text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>
        )}
      </form>
      {showGoogle && (
        <>
          <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <button className="btn-ghost w-full">Continue with Google</button>
          </form>
        </>
      )}
    </div>
  );
}
