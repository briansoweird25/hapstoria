import "server-only";
import type { EmailContent } from "./templates";

export type SendResult = { sent: true } | { sent: false; reason: string };

/** Sends via Resend's REST API. Without RESEND_API_KEY it no-ops (so local dev and previews work). */
export async function sendEmail(to: string, content: EmailContent): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { sent: false, reason: "email_not_configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: content.subject, html: content.html, text: content.text }),
    });
    return res.ok ? { sent: true } : { sent: false, reason: `resend_${res.status}` };
  } catch {
    return { sent: false, reason: "network_error" };
  }
}
