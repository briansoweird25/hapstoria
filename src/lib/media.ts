import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

import { MEDIA_BUCKET } from "@/lib/media-config";

/** Signs private storage paths for display. Returns a map path -> URL (missing paths omitted). */
export async function signPaths(paths: string[], expiresIn = 3600): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return {};
  const admin = createAdminClient();
  const { data } = await admin.storage.from(MEDIA_BUCKET).createSignedUrls(unique, expiresIn);
  const out: Record<string, string> = {};
  for (const row of data ?? []) if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  return out;
}
