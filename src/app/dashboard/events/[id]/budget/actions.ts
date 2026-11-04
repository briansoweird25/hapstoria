"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { budgetItemSchema } from "@/lib/budget";
import { toCents } from "@/lib/gifts";

const path = (id: string) => `/dashboard/events/${id}/budget`;

export async function setTotalBudget(eventId: string, formData: FormData) {
  const { supabase } = await requireUser();
  const cents = toCents(String(formData.get("budget") ?? "0") || "0");
  if (cents === null) redirect(`${path(eventId)}?notice=invalid`);
  await supabase.from("events").update({ budget_cents: cents }).eq("id", eventId);
  revalidatePath(path(eventId));
}

export async function addBudgetItem(eventId: string, formData: FormData) {
  const { supabase } = await requireUser();
  const parsed = budgetItemSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect(`${path(eventId)}?notice=invalid`);
  const { title, category, estimated, actual } = parsed.data;
  await supabase.from("budget_items").insert({ event_id: eventId, title, category, estimated_cents: estimated, actual_cents: actual });
  revalidatePath(path(eventId));
}

export async function togglePaid(eventId: string, itemId: string, paid: boolean) {
  const { supabase } = await requireUser();
  await supabase.from("budget_items").update({ paid }).eq("id", itemId).eq("event_id", eventId);
  revalidatePath(path(eventId));
}

export async function deleteBudgetItem(eventId: string, itemId: string) {
  const { supabase } = await requireUser();
  await supabase.from("budget_items").delete().eq("id", itemId).eq("event_id", eventId);
  revalidatePath(path(eventId));
}
