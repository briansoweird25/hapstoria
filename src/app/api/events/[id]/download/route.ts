import { Zip, ZipPassThrough } from "fflate";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signPaths } from "@/lib/media";

export const maxDuration = 300;

/** Streams every upload (approved or not) of an event as a zip. Always free for the owner. */
export async function GET(_req: Request, ctx: RouteContext<"/api/events/[id]/download">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: event } = await supabase.from("events").select("id,slug").eq("id", id).maybeSingle();
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: uploads } = await supabase.from("uploads").select("*").eq("event_id", id).order("created_at");
  const items = uploads ?? [];
  const urls = await signPaths(items.map((u) => u.storage_path).filter((p): p is string => Boolean(p)), 3600);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) return controller.error(err);
        controller.enqueue(chunk);
        if (final) controller.close();
      });
      try {
        let n = 0;
        const greetings: string[] = [];
        for (const u of items) {
          n++;
          if (u.kind === "greeting") {
            greetings.push(`${u.uploader_name}: ${u.greeting_text}`);
            continue;
          }
          const url = u.storage_path ? urls[u.storage_path] : undefined;
          if (!url) continue;
          const res = await fetch(url);
          if (!res.ok || !res.body) continue;
          const ext = u.storage_path!.split(".").pop();
          const file = new ZipPassThrough(`${String(n).padStart(4, "0")}-${u.uploader_name.replace(/[^\w-]+/g, "_")}.${ext}`);
          zip.add(file);
          const reader = res.body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            file.push(value);
          }
          file.push(new Uint8Array(0), true);
        }
        if (greetings.length) {
          const g = new ZipPassThrough("greetings.txt");
          zip.add(g);
          g.push(new TextEncoder().encode(greetings.join("\n\n")), true);
        }
        zip.end();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${event.slug}-memories.zip"`,
    },
  });
}
