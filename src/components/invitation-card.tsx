import { FONT_STACKS, resolveTemplate } from "@/lib/templates";
import { formatEventDate } from "@/lib/format";

export interface InvitationData {
  title: string;
  template_id: string;
  /** Snapshot of a marketplace template definition (ignored for built-in templates). */
  theme?: unknown;
  host_names?: string;
  starts_at?: string | null;
  timezone?: string | null;
  venue_name?: string;
  venue_address?: string;
  message?: string;
  dress_code?: string;
  coverUrl?: string | null;
  cover_kind?: "image" | "gif" | "video" | null;
}

/** Pure presentational invitation, shared by the editor preview, template gallery and public page. */
export function InvitationCard({ data, compact = false }: { data: InvitationData; compact?: boolean }) {
  const t = resolveTemplate(data.template_id, data.theme);
  const heading = { fontFamily: FONT_STACKS[t.font] };
  const when = formatEventDate(data.starts_at, data.timezone);
  return (
    <article
      className="overflow-hidden rounded-3xl border shadow-sm"
      style={{ background: t.palette.surface, color: t.palette.text, borderColor: t.palette.accentSoft }}
    >
      {data.coverUrl && !compact && (
        <div className="aspect-[4/3] w-full overflow-hidden" style={{ background: t.palette.accentSoft }}>
          {data.cover_kind === "video" ? (
            <video src={data.coverUrl} className="size-full object-cover" controls playsInline muted loop />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.coverUrl} alt="" className="size-full object-cover" />
          )}
        </div>
      )}
      <div className={`text-center ${compact ? "px-5 py-8" : "px-6 py-10"}`} style={{ background: t.palette.bg }}>
        <p className="text-[11px] uppercase tracking-[0.3em]" style={{ color: t.palette.accent }}>
          You&apos;re invited
        </p>
        <h2 className={`mt-3 leading-tight ${compact ? "text-3xl" : "text-4xl sm:text-5xl"}`} style={heading}>
          {data.title || "Your event title"}
        </h2>
        {data.host_names && <p className="mt-2 text-sm opacity-80">Hosted by {data.host_names}</p>}
        <div className="mx-auto my-5 h-px w-16" style={{ background: t.palette.accent }} />
        {when && <p className="text-base font-medium">{when}</p>}
        {data.venue_name && <p className="mt-1 text-sm">{data.venue_name}</p>}
        {data.venue_address && <p className="text-xs opacity-70">{data.venue_address}</p>}
        {data.message && !compact && <p className="mx-auto mt-5 max-w-md whitespace-pre-line text-sm leading-relaxed opacity-90">{data.message}</p>}
        {data.dress_code && !compact && (
          <p className="mt-4 text-xs uppercase tracking-widest" style={{ color: t.palette.accent }}>Dress code · {data.dress_code}</p>
        )}
      </div>
    </article>
  );
}
