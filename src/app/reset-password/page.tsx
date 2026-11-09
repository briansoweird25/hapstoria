import type { Metadata } from "next";
import { Logo } from "@/components/brand";
import { requireUser } from "@/lib/auth";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage() {
  await requireUser(); // the reset email signs you in first; no session means the link expired
  return (
    <main className="grid flex-1 place-items-center px-5 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center"><Logo /></div>
        <div className="card space-y-4">
          <h1 className="font-serif text-3xl">Choose a new password</h1>
          <ResetPasswordForm />
        </div>
      </div>
    </main>
  );
}
