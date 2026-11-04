"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/marketplace";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const { user } = await requireUser();
  if (!isAdminEmail(user.email, process.env.ADMIN_EMAILS)) notFound();
}

const decision = z.enum(["approved", "rejected"]);

export async function reviewCreator(userId: string, status: "approved" | "rejected") {
  await requireAdmin();
  const s = decision.parse(status);
  await createAdminClient().from("creator_profiles").update({ status: s }).eq("user_id", z.string().uuid().parse(userId));
  revalidatePath("/admin");
}

export async function reviewTemplate(templateId: string, formData: FormData) {
  await requireAdmin();
  const s = decision.parse(formData.get("decision"));
  const reason = s === "rejected" ? String(formData.get("reason") ?? "").slice(0, 300) || "Needs changes" : null;
  await createAdminClient().from("marketplace_templates").update({ status: s, rejection_reason: reason }).eq("id", z.string().uuid().parse(templateId));
  revalidatePath("/admin");
}
