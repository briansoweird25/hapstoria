import { z } from "zod";

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 72; // bcrypt ignores everything past 72 bytes

const email = z.string().trim().toLowerCase().email("Enter a valid email address.").max(200);
const newPassword = z
  .string()
  .min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters for your password.`)
  .max(MAX_PASSWORD, `Passwords can be at most ${MAX_PASSWORD} characters.`);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

export const signupSchema = z
  .object({ email, password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The two passwords don't match." });

export const newPasswordSchema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The two passwords don't match." });

export const resetRequestSchema = z.object({ email });

export type AuthMode = "login" | "signup" | "forgot" | "link";
const MODES: AuthMode[] = ["login", "signup", "forgot", "link"];

/** Reads the ?mode= query value safely; anything unknown means the normal log-in form. */
export function authMode(value: string | string[] | undefined): AuthMode {
  return typeof value === "string" && (MODES as string[]).includes(value) ? (value as AuthMode) : "login";
}
