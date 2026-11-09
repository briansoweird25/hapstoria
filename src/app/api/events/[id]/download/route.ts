import { Zip, ZipPassThrough } from "fflate";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signPaths } from "@/lib/media";

export const maxDuration = 300;

type Upload = { kind: string; uploader_name: string; greeting_text: string | null; storage_path: string | null };

/**
 * Streams every upload of an event as a zip, for anyone with access to the event (RLS decides). Always free.
 * Pull-driven: one network chunk is read per pull, so memory stays bounded and a slow client slows the download
 * instead of buffering the archive.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/events/[id]/download">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: event } = await supabase.from("events").select("id,slug").eq("id", id).maybeSingle();
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: uploads } = await supabase.from("uploads").select("kind,uploader_name,greeting_text,storage_path").eq("event_id", id).order("created_at");
  const items = (uploads ?? []) as Upload[];
  const urls = await signPaths(items.map((u) => u.storage_path).filter((p): p is string => Boolean(p)), 3600);

  const files = items.filter((u) => u.kind !== "greeting" && u.storage_path && urls[u.storage_path]);
  const greetings = items.filter((u) => u.kind === "greeting").map((u) => `${u.uploader_name}: ${u.greeting_text}`);

  const out: Uint8Array[] = [];
  let finished = false;
  let failure: unknown = null;
  const zip = new Zip((err, chunk, final) => {
    if (err) { failure = err; return; }
    out.push(chunk);
    if (final) finished = true;
  });

  let index = 0; // next file to start
  let current: { file: ZipPassThrough; reader: ReadableStreamDefaultReader<Uint8Array> } | null = null;
  let greetingsAdded = false;

  async function step() {
    if (current) {
      const { done, value } = await current.reader.read();
      if (done) { current.file.push(new Uint8Array(0), true); current = null; }
      else current.file.push(value);
      return;
    }
    if (index < files.length) {
      const u = files[index++];
      const res = await fetch(urls[u.storage_path!]);
      if (!res.ok || !res.body) return; // skip unreadable files
      const ext = u.storage_path!.split(".").pop();
      const file = new ZipPassThrough(`${String(index).padStart(4, "0")}-${u.uploader_name.replace(/[^\w-]+/g, "_")}.${ext}`);
      zip.add(file);
      current = { file, reader: res.body.getReader() };
      return;
    }
    if (!greetingsAdded && greetings.length) {
      greetingsAdded = true;
      const g = new ZipPassThrough("greetings.txt");
      zip.add(g);
      g.push(new TextEncoder().encode(greetings.join("\n\n")), true);
      return;
    }
    zip.end();
  }

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (out.length === 0 && !finished && !failure) await step();
        if (failure) throw failure;
        while (out.length) controller.enqueue(out.shift()!);
        if (finished) controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
    cancel() { current?.reader.cancel().catch(() => undefined); },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${event.slug}-memories.zip"` },
  });
}
