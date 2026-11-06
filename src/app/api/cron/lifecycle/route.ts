import { NextResponse, type NextRequest } from "next/server";
import { getEntitlements } from "@/lib/album";
import { albumStatus, type Tier } from "@/lib/billing";
import { sendEmail } from "@/lib/email/send";
import { expiryEmail } from "@/lib/email/templates";
import { env } from "@/lib/env";
import { MEDIA_BUCKET } from "@/lib/media-config";
import { expiryReminderKind } from "@/lib/reminders";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

/**
 * Daily job: (1) email hosts before/after album expiry, once per threshold;
 * (2) purge files and rows of albums past expiry + grace (subscribers are never purged).
 * Protected by CRON_SECRET (the Netlify scheduled function sends `Authorization: Bearer <secret>`).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const entitlementCache = new Map<string, { tier: Tier | null; endedAt: string | null }>();
  const result = { checked: 0, emailed: 0, purged: 0 };

  for (let from = 0; ; from += 500) {
    const { data: events } = await admin
      .from("events")
      .select("id,owner_id,title,premium,premium_at,created_at,purged_at")
      .is("purged_at", null)
      .order("created_at")
      .range(from, from + 499);
    if (!events?.length) break;

    for (const e of events) {
      result.checked++;
      if (!entitlementCache.has(e.owner_id)) entitlementCache.set(e.owner_id, await getEntitlements(admin, e.owner_id));
      const ent = entitlementCache.get(e.owner_id)!;
      const status = albumStatus({ premium: e.premium, premiumAt: e.premium_at, createdAt: e.created_at, tier: ent.tier, entitlementEndedAt: ent.endedAt });

      if (status.state === "deleted") {
        // Never destroy files the host hasn't been warned about: the grace notice must have been sent first.
        const { data: warned } = await admin.from("notifications").select("id").eq("event_id", e.id).eq("kind", "grace").maybeSingle();
        if (warned) {
          await purgeEvent(admin, e.owner_id, e.id);
          result.purged++;
          continue;
        }
        status.state = "grace"; // still send the notice (below); purge happens on a later run
      }
      const kind = expiryReminderKind(status);
      if (!kind) continue;
      // Claim the notification first (unique constraint) so retries never double-send.
      const { error: claimed } = await admin.from("notifications").insert({ event_id: e.id, kind });
      if (claimed) continue;
      const { data: owner } = await admin.auth.admin.getUserById(e.owner_id);
      if (!owner.user?.email) continue;
      const sent = await sendEmail(owner.user.email, expiryEmail({
        eventTitle: e.title, kind, daysLeft: status.daysLeft ?? 0, dashboardUrl: `${env.siteUrl}/dashboard/events/${e.id}/memories`,
      }));
      if (sent.sent) result.emailed++;
      else await admin.from("notifications").delete().eq("event_id", e.id).eq("kind", kind); // retry tomorrow
    }
    if (events.length < 500) break;
  }
  return NextResponse.json(result);
}

async function purgeEvent(admin: ReturnType<typeof createAdminClient>, ownerId: string, eventId: string) {
  const folder = `${ownerId}/${eventId}`;
  for (;;) {
    const { data: files } = await admin.storage.from(MEDIA_BUCKET).list(folder, { limit: 500 });
    if (!files?.length) break;
    await admin.storage.from(MEDIA_BUCKET).remove(files.map((f) => `${folder}/${f.name}`));
    if (files.length < 500) break;
  }
  await admin.from("uploads").delete().eq("event_id", eventId);
  await admin.from("events").update({ purged_at: new Date().toISOString() }).eq("id", eventId);
}
