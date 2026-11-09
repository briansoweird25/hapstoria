import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { InvitationCard } from "@/components/invitation-card";

const STEPS = [
  ["Create", "Pick a template, add the details, a cover photo or video, and your RSVP options."],
  ["Share", "One link or QR code. Guests open it on their phone, no app or account."],
  ["RSVP", "Guests confirm in two taps. You see a live headcount and meal totals."],
  ["Capture", "Guests upload photos, videos and greetings to a shared album."],
  ["Keep", "Approve what goes public, then relive it all in one place."],
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 md:grid-cols-2 md:py-20">
          <div>
            <p className="rise font-brand text-xs tracking-[0.3em] text-champagne">HAPPY + STORY</p>
            <h1 className="rise-2 mt-4 font-serif text-5xl leading-[1.05] sm:text-6xl">Every celebration has a story.</h1>
            <p className="rise-3 mt-5 max-w-md text-lg text-muted">
              Beautiful digital invitations, effortless RSVPs, and one shared album for everyone&apos;s photos, videos and greetings.
            </p>
            <div className="rise-3 mt-8 flex flex-wrap gap-3">
              <Link href="/login?next=/dashboard/events/new" className="btn-primary">Create your invitation</Link>
              <Link href="/templates" className="btn-ghost">Browse templates</Link>
            </div>
          </div>
          <div className="rise-2 mx-auto w-full max-w-sm rotate-1">
            <InvitationCard
              data={{ title: "Sofia at Eighteen", template_id: "debut-blush", host_names: "The Reyes Family", starts_at: "2026-12-12T18:00:00", venue_name: "The Garden Pavilion", message: "Join us for an evening of roses, candles and dancing." }}
            />
          </div>
        </section>

        <section className="border-y border-line bg-paper">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <h2 className="font-serif text-3xl">From invite to keepsake</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {STEPS.map(([title, body], i) => (
                <li key={title} className="card">
                  <span className="font-brand text-xs tracking-widest text-champagne">0{i + 1}</span>
                  <h3 className="mt-2 font-serif text-xl">{title}</h3>
                  <p className="mt-1 text-sm text-muted">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-14 text-center">
          <h2 className="font-serif text-3xl">Made for every culture&apos;s celebrations</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            Debuts, quinceañeras, weddings, christenings, Diwali, Eid, Lunar New Year and more.
          </p>
          <Link href="/templates" className="btn-soft mt-6">See all templates</Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
