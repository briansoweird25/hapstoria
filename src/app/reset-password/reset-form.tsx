"use client";

import { useActionState } from "react";
import { setNewPassword, type LoginState } from "@/app/login/actions";
import { MIN_PASSWORD } from "@/lib/auth-forms";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(setNewPassword, { ok: false, message: "" } as LoginState);
  return (
    <form action={action} className="space-y-3">
      <div><label htmlFor="password" className="label">New password</label>
        <input id="password" name="password" type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" className="input" /></div>
      <div><label htmlFor="confirm" className="label">Confirm password</label>
        <input id="confirm" name="confirm" type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" className="input" /></div>
      <p className="text-xs text-muted">At least {MIN_PASSWORD} characters.</p>
      {state.message && <p role="alert" className="text-sm text-red-700">{state.message}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Save password"}</button>
    </form>
  );
}
