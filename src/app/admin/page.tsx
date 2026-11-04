import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvitationCard } from "@/components/invitation-card";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/gifts";
import { isAdminEmail, marketplaceTemplateId } from "@/lib/marketplace";
import { createAdminClient } from "@/lib/supabase/admin";
import { reviewCreator, reviewTemplate } from "./actions";

export const metadata: Metadata = { title: "Admin review", robots: { index: false } };

export default async function AdminPage() {
  const { user } = await requireUser();
  if (!isAdminEmail(user.email, process.env.ADMIN_EMAILS)) notFound();
  const admin = createAdminClient();
  const [{ data: creators }, { data: templates }] = await Promise.all([
    admin.from("creator_profiles").select("*").eq("status", "pending").order("created_at"),
    admin.from("marketplace_templates").select("*, creator_profiles(display_name)").eq("status", "pending").order("created_at"),
  ]);
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-5 py-8">
      <h1 className="font-serif text-4xl">Review queue</h1>
      <section className="card">
        <h2 className="font-serif text-2xl">Creator applications ({creators?.length ?? 0})</h2>
        {(creators ?? []).map((c) => (
          <div key={c.user_id} className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-sm">
            <div><p className="font-medium">{c.display_name} {c.country && `· ${c.country}`}</p><p className="text-muted">{c.bio}</p></div>
            <div className="flex gap-2">
              <form action={reviewCreator.bind(null, c.user_id, "approved")}><button className="btn-primary px-3 py-1.5">Approve</button></form>
              <form action={reviewCreator.bind(null, c.user_id, "rejected")}><button className="btn-ghost px-3 py-1.5">Reject</button></form>
            </div>
          </div>
        ))}
      </section>
      <section className="card">
        <h2 className="font-serif text-2xl">Templates ({templates?.length ?? 0})</h2>
        <div className="mt-3 grid gap-6 md:grid-cols-2">
          {(templates ?? []).map((t) => (
            <div key={t.id} className="space-y-2 border-t border-line pt-3">
              <InvitationCard compact data={{ title: t.name, template_id: marketplaceTemplateId(t.id), theme: { ...t.definition, id: marketplaceTemplateId(t.id) } }} />
              <p className="text-sm">{t.name} · {formatMoney(t.price_cents, "USD")} · by {(t.creator_profiles as { display_name: string } | null)?.display_name}</p>
              <form action={reviewTemplate.bind(null, t.id)} className="flex flex-wrap gap-2">
                <input name="reason" className="input flex-1" placeholder="Reason (if rejecting)" aria-label="Rejection reason" />
                <button name="decision" value="approved" className="btn-primary px-3 py-1.5">Approve</button>
                <button name="decision" value="rejected" className="btn-ghost px-3 py-1.5">Reject</button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
