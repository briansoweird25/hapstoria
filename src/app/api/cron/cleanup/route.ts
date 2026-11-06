import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MEDIA_BUCKET } from "@/lib/media-config";
import { ORPHAN_AGE_MS } from "@/lib/upload-api";

/**
 * Daily job (scheduled by netlify/functions/cron-cleanup.mts). Deletes files that were signed for upload but
 * never completed, then prunes old attempt rows. Protected by CRON_SECRET,
 * which the scheduled function sends as `Authorization: Bearer <secret>`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - ORPHAN_AGE_MS).toISOString();

  const { data: orphans } = await admin
    .from("upload_attempts").select("id,storage_path")
    .eq("completed", false).not("storage_path", "is", null).lt("created_at", cutoff).limit(1000);
  const paths = (orphans ?? []).map((o) => o.storage_path as string);
  if (paths.length) await admin.storage.from(MEDIA_BUCKET).remove(paths);
  if (orphans?.length) await admin.from("upload_attempts").delete().in("id", orphans.map((o) => o.id));

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await admin.from("upload_attempts").delete().eq("completed", true).lt("created_at", dayAgo);

  return NextResponse.json({ removedOrphans: paths.length });
}
