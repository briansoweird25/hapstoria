import type { ExpiryKind } from "@/lib/reminders";

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function layout(heading: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  const button = cta
    ? `<p style="margin:28px 0"><a href="${escapeHtml(cta.url)}" style="background:#2b2418;color:#faf6ee;padding:12px 22px;border-radius:999px;text-decoration:none;font-size:14px">${escapeHtml(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#faf6ee;font-family:Georgia,serif;color:#2b2418">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<p style="letter-spacing:.3em;font-size:12px;color:#b8934a;margin:0 0 24px">HAPSTORIA</p>
<h1 style="font-weight:500;font-size:28px;margin:0 0 12px">${heading}</h1>
<div style="font-size:16px;line-height:1.6">${bodyHtml}</div>${button}
<p style="font-size:12px;color:#7a6f5d;margin-top:32px">Every celebration has a story.</p>
</div></body></html>`;
}

export function rsvpConfirmationEmail(i: { guestName: string; eventTitle: string; status: "accepted" | "declined"; partySize: number; inviteUrl: string }): EmailContent {
  const accepted = i.status === "accepted";
  const line = accepted
    ? `You're confirmed for ${escapeHtml(i.eventTitle)} with ${i.partySize} ${i.partySize === 1 ? "guest" : "guests"}.`
    : `We've noted that you can't make it to ${escapeHtml(i.eventTitle)}. You will be missed.`;
  return {
    subject: accepted ? `You're in! ${i.eventTitle}` : `Your reply to ${i.eventTitle}`,
    html: layout(`Thank you, ${escapeHtml(i.guestName)}`, `<p>${line}</p><p>Need to change your reply? Open the invitation and reply again.</p>`, { label: "View invitation", url: i.inviteUrl }),
    text: `Thank you, ${i.guestName}. ${accepted ? `You're confirmed for ${i.eventTitle} (${i.partySize}).` : `We've noted that you can't make it to ${i.eventTitle}.`}\n${i.inviteUrl}`,
  };
}

export function rsvpReminderEmail(i: { guestName: string; eventTitle: string; inviteUrl: string }): EmailContent {
  return {
    subject: `Reminder: please RSVP to ${i.eventTitle}`,
    html: layout(`Hi ${escapeHtml(i.guestName)}, will you join us?`, `<p>The hosts of <strong>${escapeHtml(i.eventTitle)}</strong> are still waiting for your reply. It takes two taps.</p>`, { label: "RSVP now", url: i.inviteUrl }),
    text: `Hi ${i.guestName}, please RSVP to ${i.eventTitle}: ${i.inviteUrl}`,
  };
}

export function expiryEmail(i: { eventTitle: string; kind: ExpiryKind; daysLeft: number; dashboardUrl: string }): EmailContent {
  const expired = i.kind === "grace";
  const subject = expired
    ? `Your ${i.eventTitle} album has expired`
    : `Your ${i.eventTitle} album expires in ${i.daysLeft} ${i.daysLeft === 1 ? "day" : "days"}`;
  const body = expired
    ? `<p>The album for <strong>${escapeHtml(i.eventTitle)}</strong> is no longer visible to guests. Your photos and videos will be deleted soon.</p><p>Download everything for free, or subscribe to Memory Keeper to keep them forever.</p>`
    : `<p>The album for <strong>${escapeHtml(i.eventTitle)}</strong> expires in ${i.daysLeft} ${i.daysLeft === 1 ? "day" : "days"}.</p><p>Downloading everything is always free. To keep every photo, video and greeting in one place, subscribe to Memory Keeper.</p>`;
  return {
    subject,
    html: layout(expired ? "Your album has expired" : "Your album is expiring soon", body, { label: "Download or keep my memories", url: i.dashboardUrl }),
    text: `${subject}\nDownload for free or keep with Memory Keeper: ${i.dashboardUrl}`,
  };
}
