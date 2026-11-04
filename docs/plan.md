# Hapstoria build plan (Phases 1–4)

Spec: product conversation + brand (Hapstoria, champagne/lavender/blush/ivory).
Stack: Next.js 16 (App Router), Supabase (Postgres, Auth, Storage), Vercel.

Tasks
1. Core libs with tests: slug, guest import, stats, upload rules, validation, templates.
2. Database migration with RLS and RPCs (guests never touch tables directly).
3. Supabase clients, auth (magic link + callback), route protection via proxy.ts.
4. Landing, template gallery, event editor (create/update, cover upload).
5. Public invitation page + RSVP server action.
6. Celebrant dashboard: headcount, guest list, import, share/QR, reminders list.
7. Guest upload page + upload route + greetings; memories page with moderation.
8. Docs (README, SETUP), build/lint/typecheck, final review.

Not in scope (documented as roadmap): payments, subscriptions, print orders,
collage rendering, gift registry, seating/budget, creator marketplace.
