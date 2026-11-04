import Link from "next/link";
import { Logo } from "@/components/brand";
import { requireUser } from "@/lib/auth";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const { user } = await requireUser();
  return (
    <>
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Logo href="/dashboard" />
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/dashboard/events/new" className="btn-soft">New event</Link>
            <span className="hidden text-muted sm:block">{user.email}</span>
            <form action="/auth/signout" method="post"><button className="text-muted hover:text-ink">Log out</button></form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">{children}</main>
    </>
  );
}
