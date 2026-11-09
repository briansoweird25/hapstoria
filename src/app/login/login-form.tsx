"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { AuthMode } from "@/lib/auth-forms";
import { MIN_PASSWORD } from "@/lib/auth-forms";
import { logIn, requestPasswordReset, sendMagicLink, signInWithGoogle, signUp, type LoginState } from "./actions";

const initial: LoginState = { ok: false, message: "" };

function Message({ state }: { state: LoginState }) {
  if (!state.message) return null;
  return <p role={state.ok ? "status" : "alert"} className={`text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>;
}

function Field({ id, label, ...props }: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} name={id} className="input" {...props} />
    </div>
  );
}

/** Email stays filled in after a failed attempt (React clears uncontrolled fields after a form action). */
function EmailField() {
  const [email, setEmail] = useState("");
  return <Field id="email" label="Email" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />;
}

const href = (mode: AuthMode, next: string) => `/login?mode=${mode}&next=${encodeURIComponent(next)}`;

function LogInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(logIn, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <EmailField />
      <Field id="password" label="Password" type="password" required autoComplete="current-password" />
      <Message state={state} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Logging in…" : "Log in"}</button>
      <p className="flex justify-between text-sm">
        <Link href={href("forgot", next)} className="text-muted underline">Forgot password?</Link>
        <Link href={href("link", next)} className="text-muted underline">Email me a link instead</Link>
      </p>
    </form>
  );
}

function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUp, initial);
  if (state.ok) return <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{state.message}</p>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <EmailField />
      <Field id="password" label="Choose a password" type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" />
      <Field id="confirm" label="Confirm password" type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" />
      <p className="text-xs text-muted">At least {MIN_PASSWORD} characters.</p>
      <Message state={state} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Creating account…" : "Create account"}</button>
    </form>
  );
}

function ForgotForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(requestPasswordReset, initial);
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-muted">Enter your email and we&apos;ll send you a link to choose a new password.</p>
      <EmailField />
      <Message state={state} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</button>
      <p className="text-sm"><Link href={href("login", next)} className="text-muted underline">Back to log in</Link></p>
    </form>
  );
}

function MagicLinkForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(sendMagicLink, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <p className="text-sm text-muted">No password needed. We&apos;ll email you a one-time link.</p>
      <EmailField />
      <Message state={state} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Sending…" : "Email me a sign-in link"}</button>
      <p className="text-sm"><Link href={href("login", next)} className="text-muted underline">Use a password instead</Link></p>
    </form>
  );
}

export function LoginForm({ next, mode, showGoogle }: { next: string; mode: AuthMode; showGoogle: boolean }) {
  return (
    <div className="space-y-4">
      {mode === "login" && <LogInForm next={next} />}
      {mode === "signup" && <SignUpForm next={next} />}
      {mode === "forgot" && <ForgotForm next={next} />}
      {mode === "link" && <MagicLinkForm next={next} />}
      {showGoogle && (mode === "login" || mode === "signup") && (
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
