# Setup: Supabase + Netlify

About 30–45 minutes, no coding. You need free accounts on [GitHub](https://github.com), [Supabase](https://supabase.com) and [Netlify](https://netlify.com).

## 1. Supabase

1. Create a new project (choose a region near your guests). Save the database password.
2. **Database:** open *SQL Editor → New query* and run each file in `supabase/migrations/` **in order**
   (`0001_init.sql`, `0002_billing.sql`, … `0009_review_fixes.sql`), one at a time. Each should say "Success".
3. **Storage:** *Storage* should now list a private bucket named `event-media`.
4. **Keys:** *Project Settings → API*. Copy the Project URL, the `anon` public key, and the `service_role` key.
   The `service_role` key is secret: it goes only into Netlify's environment variables.
5. **Auth URLs:** *Authentication → URL Configuration*. Set *Site URL* to your Netlify URL
   (for example `https://your-site.netlify.app`) and add `https://YOUR-DOMAIN/auth/callback` and
   `http://localhost:3000/auth/callback` under *Redirect URLs*.
6. *(Optional)* Google sign-in: *Authentication → Providers → Google*, following Supabase's on-screen steps.
   Email sign-in links work without it.

## 2. Netlify

1. Push this repository to GitHub, then in Netlify choose *Add new site → Import an existing project* and pick it.
   Netlify detects Next.js automatically; `netlify.toml` sets the build command and Node 22.
2. Under *Site configuration → Environment variables* add (all scopes). **The right-hand column says where to find each value; paste the actual value itself, never that wording.**

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from Supabase → Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from the same page ("anon public") |
   | `SUPABASE_SERVICE_ROLE_KEY` | from the same page ("service role"), a long string starting with `eyJ` |
   | `NEXT_PUBLIC_SITE_URL` | your production URL, no trailing slash (needed at build time; Netlify's `URL` is only a fallback) |
   | `CRON_SECRET` | generate one, e.g. run `openssl rand -hex 32` and paste the result |

3. Deploy. Then set Supabase's Site URL (step 1.5) to the Netlify URL or your custom domain.
4. **Scheduled jobs:** `netlify/functions/cron-*.mts` run daily and monthly *on the published production deploy only*
   and call the `/api/cron/*` routes with `CRON_SECRET`. Check *Logs → Functions* after the first day.
   Netlify limits how long functions may run, so very large albums may need the jobs split up; see README.

## 3. Stripe (payments)

1. Create a Stripe account, then *Developers → API keys*: copy the secret key into `STRIPE_SECRET_KEY`.
2. *Developers → Webhooks → Add endpoint*: URL `https://YOUR-DOMAIN/api/stripe/webhook`, events
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
3. Enable the *Customer portal* (Settings → Billing → Customer portal) so "Manage billing" works.
4. For creator payouts, enable *Connect* (Express accounts) in your Stripe dashboard.
5. Use Stripe test mode and card `4242 4242 4242 4242` until you are ready to go live.

## 4. Email (Resend)

Create a Resend account, verify your sending domain, then set `RESEND_API_KEY` and
`EMAIL_FROM` (for example `Hapstoria <hello@yourdomain.com>`). Without them the app works but sends no email.

## 5. Other environment variables

| Name | Purpose |
|---|---|
| `CRON_SECRET` | Protects the nightly/monthly jobs in `netlify/functions/` |
| `ADMIN_EMAILS` | Comma-separated emails allowed to open `/admin` (creator/template review) |
| `PRINT_NOTIFY_EMAIL` | Where paid print orders are announced |

Three scheduled jobs run automatically: orphan-upload cleanup (daily), album lifecycle emails and purges (daily),
creator payouts (monthly).

## 6. Test like a customer

1. Open the site, click *Create invitation*, and sign in with your email.
2. Create an event, **Publish** it, and open the share link on your phone.
3. RSVP as a guest; watch the headcount update on the dashboard.
4. Open the upload QR link, upload a photo and a greeting, then approve them under *Memories*.
5. Open the album link and confirm only approved items show; try the collage and slideshow.
6. In Stripe test mode, upgrade the event to Premium and subscribe to Memory Keeper; confirm the dashboard updates.
7. Add a gift method and fund, then give a gift as a guest (named and anonymous).
8. Create a creator profile, approve it from `/admin` (with your email in `ADMIN_EMAILS`), submit a template, approve it, buy it with a second account and apply it to an event.

## Local development

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev
```

Large videos: Supabase's free plan limits individual files to 50 MB. The app allows 100 MB, so either
upgrade the project or lower `MAX_VIDEO_BYTES` in `src/lib/upload-rules.ts` (and the bucket limit in the migration).
