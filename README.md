# Hapstoria

*Every celebration has a story.* Digital invitations, RSVPs, and a shared guest album.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres, Auth, Storage) · Vercel

## What works today

| Area | Status |
|---|---|
| Landing page, 20 multicultural templates (stored as structured data) | Done |
| Passwordless login (email link, Google) | Done |
| Event editor with live preview, cover photo/GIF/video | Done |
| Public invitation page + guest RSVP (no account) | Done |
| Host dashboard: live headcount, meals, guest list, CSV/paste import, share link, QR | Done |
| Guest photo/video/greeting upload (no account, direct-to-storage) | Done |
| Host moderation (approve / hide / delete / download) + public album of approved items | Done |

**Not built yet** (see Roadmap): payments and subscriptions (Stripe), storage expiry and reminders,
collage/slideshow rendering, printed invitations, gift registry, seating/budget, planner workspace,
creator marketplace. Email sending (RSVP confirmations, reminders) is also not wired up.

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
