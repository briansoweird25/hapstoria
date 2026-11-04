import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MEDIA_BUCKET } from "@/lib/media-config";
import { extensionFor, validateUpload } from "@/lib/upload-rules";
import { guestFolder, MAX_UPLOADS_PER_EVENT, uploadRequestSchema } from "@/lib/upload-api";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Anonymous guest uploads. Files go straight to Supabase Storage via a signed
 * upload URL (Vercel functions can't accept large bodies); rows are created
 * only after the file is verified to exist, and always start as "pending".
 */
export async function POST(request: Request) {
  const body = uploadRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail(body.error.issues[0]?.message ?? "Invalid request.");
  const req = body.data;

  const admin = createAdminClient();
  const { data: event } = await admin
    .from("events")
    .select("id,owner_id,uploads_enabled,published")
    .eq("slug", req.slug)
    .maybeSingle();
  if (!event || !event.published || !event.uploads_enabled) return fail("Uploads are not available for this event.", 404);

  const { count } = await admin.from("uploads").select("id", { count: "exact", head: true }).eq("event_id", event.id);
  if ((count ?? 0) >= MAX_UPLOADS_PER_EVENT) return fail("This album is full.", 429);

  const folder = guestFolder(event.owner_id, event.id);

  if (req.action === "greeting") {
    const { error } = await admin.from("uploads").insert({
      event_id: event.id, uploader_name: req.name, kind: "greeting", greeting_text: req.text,
    });
    return error ? fail("Could not save your greeting.", 500) : NextResponse.json({ ok: true });
  }

  if (req.action === "sign") {
    const check = validateUpload({ type: req.type, size: req.size });
    if (!check.ok) return fail(check.error);
    const path = `${folder}/${crypto.randomUUID()}.${extensionFor(req.type)}`;
    const { data, error } = await admin.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
    if (error || !data) return fail("Could not start the upload.", 500);
    return NextResponse.json({ path, token: data.token });
  }

  // action === "complete"
  if (!req.path.startsWith(`${folder}/`) || req.path.slice(folder.length + 1).includes("/")) return fail("Invalid file.");
  const fileName = req.path.slice(folder.length + 1);
  const { data: files } = await admin.storage.from(MEDIA_BUCKET).list(folder, { search: fileName, limit: 1 });
  const file = files?.find((f) => f.name === fileName);
  if (!file) return fail("The file was not uploaded.");
  const mime = String(file.metadata?.mimetype ?? "");
  const size = Number(file.metadata?.size ?? 0);
  const check = validateUpload({ type: mime, size });
  if (!check.ok) {
    await admin.storage.from(MEDIA_BUCKET).remove([req.path]);
    return fail(check.error);
  }
  const { error } = await admin.from("uploads").insert({
    event_id: event.id, uploader_name: req.name || "Guest", kind: check.kind, storage_path: req.path, size_bytes: size,
  });
  return error ? fail("Could not save your upload.", 500) : NextResponse.json({ ok: true });
}
