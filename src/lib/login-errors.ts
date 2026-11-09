export interface AuthErrorLike {
  code?: string;
  message?: string;
  status?: number;
}

/** Turns a Supabase auth error into something a person can act on. The code is kept for unknown errors. */
export function loginErrorMessage(e: AuthErrorLike): string {
  const code = e.code ?? "";
  const text = (e.message ?? "").toLowerCase();
  if (code === "over_email_send_rate_limit" || e.status === 429 || text.includes("rate limit")) {
    return "Too many sign-in emails were requested. Please wait a few minutes and try again.";
  }
  if (code === "invalid_credentials") return "Wrong email or password. Try again, or use “Forgot password”.";
  if (code === "email_not_confirmed") return "Please confirm your email first: open the message we sent you and click the link, then log in.";
  if (code === "user_already_exists" || code === "email_exists") return "An account with this email already exists. Log in instead.";
  if (code === "weak_password") return "That password is too easy to guess. Try a longer one with a mix of letters and numbers.";
  if (code === "email_address_not_authorized" || text.includes("not authorized")) {
    return "The email service isn't set up to send to this address yet. The site owner needs to connect a custom email sender in Supabase.";
  }
  if (code === "signup_disabled" || text.includes("signups not allowed")) {
    return "New sign-ups are turned off for this site.";
  }
  if (code === "email_address_invalid") return "Please enter a valid email address.";
  return code
    ? `We couldn't send the link (${code}). Please try again shortly.`
    : "We couldn't send the link. Please try again shortly.";
}
