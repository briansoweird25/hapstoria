"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { fundSchema, giftMethodSchema, itemSchema, toCents } from "@/lib/gifts";

const back = (id: string, notice?: string) => redirect(`/dashboard/events/${id}/gifts${notice ? `?notice=${notice}` : ""}`);

export async function saveGiftSettings(eventId: string, formData: FormData) {
  const { supabase } = await requireUser();
  const on = (k: string) => formData.get(k) === "on";
  await supabase.from("events").update({
    gifts_enabled: on("gifts_enabled"), gift_allow_anonymous: on("gift_allow_anonymous"),
    gift_show_amounts: on("gift_show_amounts"), gift_public_wall: on("gift_public_wall"),
  }).eq("id", eventId);
  revalidatePath(`/dashboard/events/${eventId}/gifts`);
}

export async function addMethod(eventId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = giftMethodSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return back(eventId, "invalid");
  const qr = String(formData.get("qr_path") ?? "");
  if (qr && !qr.startsWith(`${user.id}/`)) return back(eventId, "invalid");
  const { error } = await supabase.from("gift_methods").insert({ ...parsed.data, event_id: eventId, qr_path: qr || null });
  if (error) return back(eventId, "invalid");
  revalidatePath(`/dashboard/events/${eventId}/gifts`);
}

export async function toggleMethod(eventId: string, methodId: string, enabled: boolean) {
  const { supabase } = await requireUser();
  await supabase.from("gift_methods").update({ enabled }).eq("id", methodId).eq("event_id", eventId);
  revalidatePath(`/dashboard/events/${eventId}/gifts`);
}

export async function deleteMethod(eventId: string, methodId: string) {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("gift_methods").delete().eq("id", methodId).eq("event_id", eventId).select("qr_path").maybeSingle();
  if (data?.qr_path) await supabase.storage.from("event-media").remove([data.qr_path]);
  revalidatePath(`/dashboard/events/${eventId}/gifts`);
}

export async function addFund(eventId: string, formData: FormData) {
  const { supabase } = await requireUser();
  const parsed = fundSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return back(eventId, "invalid");
  const goal = parsed.data.goal ? toCents(parsed.data.goal) : null;
  if (parsed.data.goal && (goal === null || goal <= 0)) return back(eventId, "invalid");
  await supabase.from("gift_funds").insert({ event_id: eventId, title: parsed.data.title, goal_cents: goal });
  revalidatePath(`/dashboard/events/${eventId}/gifts`);
}

export async function deleteFund(eventId: string, fundId: string) {
  const { supabase } = await requireUser();
  await supabase.from("gift_funds").delete().eq("id", fundId).eq("event_id", eventId);
  revalidatePath(`/dashboard/events/${eventId}/gifts`);
}

export async function addItem(eventId: string, formData: FormData) {
  const { supabase } = await requireUser();
  const parsed = itemSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return back(eventId, "invalid");
  await supabase.from("gift_items").insert({ event_id: eventId, ...parsed.data });
  revalidatePath(`/dashboard/events/${eventId}/gifts`);
}

export async function deleteItem(eventId: string, itemId: string) {
  const { supabase } = await requireUser();
  await supabase.from("gift_items").delete().eq("id", itemId).eq("event_id", eventId);
  revalidatePath(`/dashboard/events/${eventId}/gifts`);
}

export async function updateGift(eventId: string, giftId: string, patch: { status?: "pledged" | "received"; thanked?: boolean }) {
  const { supabase } = await requireUser();
  await supabase.from("gifts").update(patch).eq("id", giftId).eq("event_id", eventId);
  revalidatePath(`/dashboard/events/${eventId}/gifts`);
}
