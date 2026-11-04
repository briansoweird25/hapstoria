import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label="Hapstoria home">
      <span className="grid size-8 place-items-center rounded-full border border-champagne font-serif text-lg text-champagne">
        H
      </span>
      <span className="font-brand text-sm tracking-[0.28em]">HAPSTORIA</span>
    </Link>
  );
}

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
      <Logo />
      <nav className="flex items-center gap-2 text-sm">
        <Link href="/templates" className="hidden px-3 py-2 text-muted hover:text-ink sm:block">Templates</Link>
        <Link href="/marketplace" className="hidden px-3 py-2 text-muted hover:text-ink sm:block">Marketplace</Link>
        {signedIn ? (
          <Link href="/dashboard" className="btn-primary">My events</Link>
        ) : (
          <>
            <Link href="/login" className="px-3 py-2 text-muted hover:text-ink">Log in</Link>
            <Link href="/login?next=/dashboard/events/new" className="btn-primary">Create invitation</Link>
          </>
        )}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line px-5 py-8 text-center text-xs text-muted">
      <p className="font-brand tracking-[0.25em]">HAPSTORIA</p>
      <p className="mt-1">Every celebration has a story.</p>
    </footer>
  );
}
