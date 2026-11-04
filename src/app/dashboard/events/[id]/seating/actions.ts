"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { autoSeat, canAssign } from "@/lib/seating";

const path = (id: string) => `/dashboard/events/${id}/seating`;
const tableSchema = z.object({ name: z.string().trim().min(1).max(60), capacity: z.coerce.number().int().min(1).max(30) });

export async function addTable(eventId: string, formData: FormData) {
  const { supabase } = await requireUser();
  const parsed = tableSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect(`${path(eventId)}?notice=invalid`);
  await supabase.from("seating_tables").insert({ event_id: eventId, ...parsed.data });
  revalidatePath(path(eventId));
}

export async function deleteTable(eventId: string, tableId: string) {
  const { supabase } = await requireUser();
  await supabase.from("seating_tables").delete().eq("id", tableId).eq("event_id", eventId);
  revalidatePath(path(eventId));
}

export async function assignGuest(eventId: string, guestId: string, formData: FormData) {
  const { supabase } = await requireUser();
  const tableId = String(formData.get("table_id") ?? "");
  const [{ data: guests }, { data: tables }] = await Promise.all([
    supabase.from("guests").select("id,name,party_size,status,table_id").eq("event_id", eventId),
    supabase.from("seating_tables").select("id,name,capacity").eq("event_id", eventId),
  ]);
  const guest = guests?.find((g) => g.id === guestId);
  if (!guest) return;
  if (tableId) {
    const table = tables?.find((t) => t.id === tableId);
    if (!table) return;
    const check = canAssign(table, guest, guests ?? []);
    if (!check.ok) redirect(`${path(eventId)}?notice=${encodeURIComponent(check.reason)}`);
  }
  await supabase.from("guests").update({ table_id: tableId || null }).eq("id", guestId).eq("event_id", eventId);
  revalidatePath(path(eventId));
}

export async function runAutoSeat(eventId: string) {
  const { supabase } = await requireUser();
  const [{ data: guests }, { data: tables }] = await Promise.all([
    supabase.from("guests").select("id,name,party_size,status,table_id").eq("event_id", eventId),
    supabase.from("seating_tables").select("id,name,capacity").eq("event_id", eventId),
  ]);
  const { assignments, unseated } = autoSeat(guests ?? [], tables ?? []);
  await Promise.all(Object.entries(assignments).map(([gid, tid]) => supabase.from("guests").update({ table_id: tid }).eq("id", gid).eq("event_id", eventId)));
  revalidatePath(path(eventId));
  if (unseated.length) redirect(`${path(eventId)}?notice=${encodeURIComponent(`${unseated.length} guest(s) didn't fit. Add a table or raise a capacity.`)}`);
}
