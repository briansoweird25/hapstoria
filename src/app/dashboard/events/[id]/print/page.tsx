import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintForm } from "@/components/print-form";
import { requireUser } from "@/lib/auth";
import { formatEventDate } from "@/lib/format";
import { canOrderPrint, PRINT_LEAD_DAYS } from "@/lib/print";

export const metadata: Metadata = { title: "Printed invitations" };

const STATUS: Record<string, string> = {
  awaiting_payment: "Awaiting payment", paid: "Paid, preparing", in_production: "Printing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled",
};

export default async function PrintPage({ params, searchParams }: PageProps<"/dashboard/events/[id]/print">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const { data: event } = await supabase.from("events").select("id,title,starts_at,timezone").eq("id", id).maybeSingle();
  if (!event) notFound();
  const { data: orders } = await supabase.from("print_orders").select("*").eq("event_id", id).order("created_at", { ascending: false });
  const timing = canOrderPrint(event.starts_at);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href={`/dashboard/events/${id}`} className="text-sm text-muted hover:text-ink">← {event.title}</Link>
        <h1 className="font-serif text-4xl">Printed invitations</h1>
        <p className="text-sm text-muted">Cards match your online design and include a QR code to your RSVP page. Allow at least {PRINT_LEAD_DAYS} days before the event.</p>
      </div>
      {sp.paid && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Payment received. We&apos;ll update the status here as your cards are printed and shipped.</p>}
      {timing.ok ? (
        <>
          <p className="text-sm">Order by <strong>{formatEventDate(timing.orderBy.toISOString(), event.timezone).split(" · ")[0]}</strong> to arrive in time.</p>
          <PrintForm eventId={id} />
        </>
      ) : (
        <p role="alert" className="rounded-xl bg-lavender-soft p-4 text-sm">{timing.reason}</p>
      )}
      {!!orders?.length && (
        <section className="card">
          <h2 className="font-serif text-2xl">Your orders</h2>
          <ul className="mt-2 divide-y divide-line text-sm">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{o.quantity} cards · {o.mode === "host" ? "shipped to you" : "mailed to guests"}</span>
                <span>{STATUS[o.status] ?? o.status}{o.tracking ? ` · ${o.tracking}` : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
