# Hapstoria

*Every celebration has a story.* Digital invitations, RSVPs, and a shared guest album.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres, Auth, Storage) · Netlify

## What works today

| Area | Status |
|---|---|
| Landing page, 20 multicultural templates (structured data) | Done |
| Passwordless login (email link, Google) | Done |
| Event editor with live preview, cover photo/GIF/video, event time zone | Done |
| Public invitation + guest RSVP (no account); confirmation email | Done (email needs Resend keys) |
| Host dashboard: headcount, meals, guest list, CSV/paste import, share link, QR, RSVP reminders | Done |
| Guest photo/video/greeting upload; host moderation; public album; free zip download | Done |
| **Billing (Stripe):** free plan (30 guests, 1 event), $36 Premium per event, Memory Keeper $9.99 / Plus $19.99, Planner $49 (monthly or yearly) | Done (needs Stripe keys) |
| **Album lifecycle:** 30-day (free) / 90-day (premium) albums, expiry emails at 30/7/1 days, grace period, purge; subscribers keep everything | Done (daily cron) |
| **Collage maker** (grid, mosaic, filmstrip, PNG download) and full-screen **slideshow** | Done |
| **Printed invitations:** pricing, 21-day lead-time rule, Stripe checkout, order tracking | Done; fulfilment is manual (see below) |
| **Gift registry:** payment methods with QR/links, cash funds, wishlist with reservations, anonymous giving, gift wall, thank-you tracker | Done |
| **Seating plan** (capacity rules, auto-seat) and **budget tracker** | Done |
| **Planner workspace:** all-events overview, team roles (editor/viewer) with invites, business profile, white-label invitation pages | Done |
| **Creator marketplace:** apply, template studio with contrast check, admin review, per-template purchase, revenue split, Stripe Connect payouts | Done (payouts untested against live Stripe) |

Not built: video highlight reels (needs a render API such as Shotstack), direct mailing of print orders to
each guest (the order is recorded and we email to collect addresses), automatic print-partner API
fulfilment, AI captions, multi-currency pricing display, translations.

## Quick start

1. Follow [SETUP.md](SETUP.md) to create the Supabase project and run the migration.
2. `cp .env.example .env.local` and fill in the values.
3. `npm install && npm run dev`

Scripts: `npm run dev` · `npm run build` · `npm test` · `npm run lint` · `npm run typecheck`

## Architecture

```
src/app            Routes (App Router). Server actions live next to their routes (actions.ts).
src/components     Presentational + form components.
src/lib            Pure, unit-tested logic (validation, slugs, templates, stats, import, upload rules)
src/lib/supabase   server / browser / admin clients and the auth proxy.
supabase/migrations  Schema, RLS policies, RPCs, storage policies.
tests              Vitest unit tests for src/lib.
```

Security model
- Owners access tables through RLS (`owner_id = auth.uid()`).
- Guests never touch tables. They use two `security definer` RPCs: `get_public_event` (published events only,
  no owner id) and `submit_rsvp` (validates deadline, party size, and upserts by name).
- Guest uploads go through `/api/upload` using the service role *only on the server*: it checks the event is
  published with uploads enabled, signs a one-time upload URL, verifies the stored file's real type/size,
  and inserts the row as `pending`. Nothing is public until the host approves it.
- The storage bucket is private; files are shown through short-lived signed URLs.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only (`import "server-only"`). Never prefix it with `NEXT_PUBLIC_`.

## Roadmap

1. Stripe: Event Pass, Memory Keeper subscriptions, 3-month expiry with reminder emails (Resend).
2. Collage and slideshow templates (render via a video API such as Shotstack/Creatomate).
3. Gift registry (bank/GCash QR, PayPal links, anonymous giving), seating plan, budget.
4. Printed invitations (Gelato API), planner workspace, creator marketplace.

## Known limitations (deliberate, documented)

- **RSVP identity is by name.** A guest typing another guest's name updates that reply. Per-guest personal links are the planned upgrade.
- **No per-IP rate limiting.** Anonymous uploads are throttled per event (400 attempts/hour, 2,000 items) and abandoned signed uploads are deleted nightly. Add an IP limiter (for example Upstash Redis) before a public launch.
- **Placeholder business numbers** you must set: print prices (`src/lib/print.ts`), creator revenue share (`CREATOR_SHARE_BPS` in `src/lib/marketplace.ts`, currently 70%), minimum payout, plan prices (`src/lib/billing.ts`).
- **Print fulfilment is manual.** A paid order emails `PRINT_NOTIFY_EMAIL`; you place the print job with your printer or a print API and update `print_orders.status`/`tracking` in Supabase.
- **Marketplace "DRM":** templates are colors/fonts/sections stored as data, so a template's look is visible in the public storefront. Purchase is enforced in the app and by a database trigger, but the design itself can't be hidden.
- **Netlify function time limits.** The zip download, the lifecycle job and the payouts job run as ordinary Next.js
  route handlers, so they are bound by Netlify's function timeout for your plan. Very large albums may need the zip
  built in a background job (Netlify background functions) or direct per-file downloads, and the lifecycle job may need
  batching if you have thousands of events.
- **Netlify deployment is untested.** I could not reach Netlify's docs or deploy from this environment. Confirm that the
  `proxy.ts` auth redirect (Next.js 16's replacement for middleware) works on your Netlify site by opening `/dashboard`
  while signed out: it must redirect to `/login`. If it doesn't, check the Netlify Next.js runtime version supports Next.js 16.
- Editors on a shared event can't change the cover image (storage folders belong to the owner).
- HEIC uploads rely on the browser reporting a MIME type; some browsers report none.
- Old cover images are not deleted when replaced (cleaned up when the event is deleted).
