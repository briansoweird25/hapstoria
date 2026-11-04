import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand";
import { getOptionalUser } from "@/lib/auth";
import { emailsMatch } from "@/lib/team";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Accept invitation", robots: { index: false } };

/** Accepting is a GET-safe, idempotent operation bound to the signed-in email, so no extra confirm step is needed. */
export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const user = await getOptionalUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  const admin = createAdminClient();
  const { data: invite } = await admin.from("event_invites").select("*").eq("token", token).maybeSingle();
  let message = "This invitation is no longer valid.";
  if (invite) {
    if (!emailsMatch(user.email, invite.email)) {
      message = `This invitation was sent to ${invite.email}. Please sign in with that email address.`;
    } else {
      await admin.from("event_members").upsert({ event_id: invite.event_id, user_id: user.id, role: invite.role }, { onConflict: "event_id,user_id" });
      await admin.from("event_invites").delete().eq("id", invite.id);
      redirect(`/dashboard/events/${invite.event_id}`);
    }
  }
  return (
    <main className="grid flex-1 place-items-center px-5 py-12">
      <div className="card max-w-sm space-y-4 text-center"><div className="flex justify-center"><Logo /></div><p role="alert">{message}</p></div>
    </main>
  );
}
