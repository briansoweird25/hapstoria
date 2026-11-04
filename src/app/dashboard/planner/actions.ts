"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { profileSchema } from "@/lib/team";

export async function saveProfile(formData: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect("/dashboard/planner?notice=invalid");
  const { error } = await supabase.from("planner_profiles").upsert({ user_id: user.id, ...parsed.data, updated_at: new Date().toISOString() });
  if (error) redirect(`/dashboard/planner?notice=${error.code === "23505" ? "slug_taken" : "failed"}`);
  revalidatePath("/dashboard/planner");
  redirect("/dashboard/planner?notice=saved");
}
