# Setup: Supabase + Netlify

About 30–45 minutes, no coding. You need free accounts on [GitHub](https://github.com), [Supabase](https://supabase.com) and [Netlify](https://netlify.com).

## 1. Supabase

1. Create a new project (choose a region near your guests). Save the database password.
2. **Database:** open *SQL Editor → New query* and run each file in `supabase/migrations/` **in order**
   (`0001_init.sql`, `0002_billing.sql`, … `0010_payments_ph.sql`), one at a time. Each should say "Success". If you already ran up to 0009, run only the new ones.
3. **Storage:** *Storage* should now list a private bucket named `event-media`.
4. **Keys:** *Project Settings → API*. Copy the Project URL, the `anon` public key, and the `service_role` key.
   The `service_role` key is secret: it goes only into Netlify's environment variables.
5. **Auth URLs:** *Authentication → URL Configuration*. Set *Site URL* to your Netlify URL
   (for example `https://your-site.netlify.app`) and add `https://YOUR-DOMAIN/auth/callback` and
   `http://localhost:3000/auth/callback` under *Redirect URLs*.
6. *(Optional)* Google sign-in: enable *Authentication → Providers → Google* (you need a Google Cloud OAuth client whose
   redirect URI is `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`), then set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`
   in Netlify and redeploy. The button stays hidden until you do. Email sign-in links work without it.

### Log in, create account, and passwords

The login page has **Log in** and **Create account** tabs (email + password), plus "Forgot password" and an
"Email me a link instead" option. In Supabase, under *Authentication → Providers → Email*, make sure Email is enabled.

- **Confirm email** (same page): when on, new accounts must click a confirmation link before they can log in. That is
  safer, and it needs a working email sender (below). When off, people are logged in immediately after creating an account.
- Password rules (8+ characters) are enforced by the app; you can also raise Supabase's minimum under
  *Authentication → Sign In / Providers → Email → Minimum password length*.
- Password reset and confirmation links go to `https://YOUR-SITE/auth/callback`, so that address must be in
  *Authentication → URL Configuration → Redirect URLs* (see step 1.5).

### Sign-in emails (important)

Supabase's built-in email sender is only for trying things out: it sends a handful of emails per hour and, on
current projects, **only to addresses that belong to your Supabase organization's team**. Anyone else gets an error
and no email. Before real users sign in, connect your own sender under *Authentication → SMTP Settings*:

- With Resend (create an API key and verify your domain first): host `smtp.resend.com`, port `465`,
  username `resend`, password = your Resend API key, sender = an address on your verified domain.
- Then check *Authentication → Emails* for the "Magic Link" template and send yourself a test.

If the login page shows an error, its text now says what's wrong (rate limit, sender not set up, sign-ups off).
The same details are in Supabase under *Logs → Auth*.

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

## 3. Payments: PayMongo (GCash, Maya, cards) and PayPal

All prices are in Philippine pesos and live in `src/lib/billing.ts` (change them there). You can turn on one provider or
both; a payment button only appears for a provider whose keys are set.

**PayMongo** (GCash, Maya, cards):
1. Create a PayMongo account and finish their business verification (needed to accept live payments).
2. *Developers → API keys*: copy the **secret key** into `PAYMONGO_SECRET_KEY`. Start with the test (`sk_test_`) key.
3. *Developers → Webhooks → Create*: URL `https://YOUR-SITE/api/paymongo/webhook`, event
   `checkout_session.payment.paid`. Copy the webhook's **secret** into `PAYMONGO_WEBHOOK_SECRET`.
4. Make sure GCash and Maya are enabled for your account in the PayMongo dashboard.

**PayPal**:
1. At developer.paypal.com, *Apps & Credentials*, create an app (sandbox first). Copy its Client ID and Secret into
   `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`, and leave `PAYPAL_ENV=sandbox`.
2. When you are ready for real money, create a **live** app, use its keys, and set `PAYPAL_ENV=live`.
3. No webhook is needed: the money is captured when the customer returns to the site.

**How memberships work:** Memory Keeper, Keeper Plus and Planner are *prepaid* (1 month or 12 months). Each payment adds
time to the plan, and we email the owner 7 days and 1 day before it ends. GCash cannot charge a customer automatically each
month, which is why the plans are not auto-renewing.

**Creator payouts** are manual: creators enter a GCash number or PayPal email, and under `/admin` you start a payout,
send the money yourself, and record the reference.

## 4. Email (Resend)

Create a Resend account, verify your sending domain, then set `RESEND_API_KEY` and
`EMAIL_FROM` (for example `Hapstoria <hello@yourdomain.com>`). Without them the app works but sends no email.

## 5. Other environment variables

| Name | Purpose |
|---|---|
| `CRON_SECRET` | Protects the nightly/monthly jobs in `netlify/functions/` |
| `ADMIN_EMAILS` | Comma-separated emails allowed to open `/admin` (creator/template review) |
| `PRINT_NOTIFY_EMAIL` | Where paid print orders are announced |

Two scheduled jobs run automatically: orphan-upload cleanup (daily), and album lifecycle plus membership-ending
emails and purges (daily).

## 6. Test like a customer

1. Open the site, click *Create invitation*, and sign in with your email.
2. Create an event, **Publish** it, and open the share link on your phone.
3. RSVP as a guest; watch the headcount update on the dashboard.
4. Open the upload QR link, upload a photo and a greeting, then approve them under *Memories*.
5. Open the album link and confirm only approved items show; try the collage and slideshow.
6. In PayMongo test mode (and PayPal sandbox), upgrade the event to Premium and buy a Memory Keeper month; confirm the dashboard updates.
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

## Speed

Most of the time a page takes is network round trips between Netlify's servers and Supabase, so where they are matters.

- **Put them in the same part of the world.** Your Supabase project region is fixed when you create it (see *Project Settings → General*). In Netlify, *Site configuration → Functions → Function region* chooses where the server code runs, if your plan offers it. Pick the region closest to your Supabase project and to most of your users. A server in the US talking to a database in Asia adds a quarter of a second or more to every database call.
- **Asymmetric JWT signing keys.** In Supabase, *Project Settings → JWT Keys*: if your project still uses the legacy shared secret, migrating to signing keys lets the app verify logins locally instead of asking Supabase on every page.
- The first request after a quiet period is slower (a "cold start"); later requests are faster.
