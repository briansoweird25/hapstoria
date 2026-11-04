import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { templateDefSchema } from "@/lib/templates/schema";
import { marketplaceTemplateId } from "@/lib/marketplace";
import type { TemplateDef } from "@/lib/templates";

export interface StoreTemplate {
  id: string; name: string; kind: string; culture: string; description: string;
  price_cents: number; creator_name: string; def: TemplateDef;
}

/** Approved templates for the storefront, with validated definitions (invalid ones are dropped). */
export const listMarketplace = cache(async (): Promise<StoreTemplate[]> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_marketplace");
  const out: StoreTemplate[] = [];
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const id = marketplaceTemplateId(String(row.id));
    const def = templateDefSchema.safeParse({ ...(row.definition as object), id });
    if (!def.success) continue;
    out.push({
      id: String(row.id), name: String(row.name), kind: String(row.kind), culture: String(row.culture ?? ""),
      description: String(row.description ?? ""), price_cents: Number(row.price_cents), creator_name: String(row.creator_name), def: def.data,
    });
  }
  return out;
});

/** Marketplace templates a user may apply to events: ones they bought plus ones they created. */
export async function getOwnedTemplates(userId: string): Promise<StoreTemplate[]> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const [{ data: bought }, { data: made }] = await Promise.all([
    admin.from("template_purchases").select("template_id").eq("buyer_id", userId),
    admin.from("marketplace_templates").select("id").eq("creator_id", userId),
  ]);
  const ids = [...new Set([...(bought ?? []).map((p) => p.template_id), ...(made ?? []).map((t) => t.id)])];
  if (!ids.length) return [];
  const { data } = await admin.from("marketplace_templates").select("id,name,kind,culture,description,definition,price_cents,creator_id").in("id", ids);
  const out: StoreTemplate[] = [];
  for (const row of data ?? []) {
    const id = marketplaceTemplateId(row.id);
    const def = templateDefSchema.safeParse({ ...(row.definition as object), id });
    if (def.success) out.push({ id: row.id, name: row.name, kind: row.kind, culture: row.culture, description: row.description, price_cents: row.price_cents, creator_name: "", def: def.data });
  }
  return out;
}
