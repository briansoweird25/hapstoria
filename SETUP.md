# Setup: Supabase + Vercel

About 30–45 minutes, no coding. You need free accounts on [GitHub](https://github.com), [Supabase](https://supabase.com) and [Vercel](https://vercel.com).

## 1. Supabase

1. Create a new project (choose a region near your guests). Save the database password.
2. **Database:** open *SQL Editor → New query*, paste the whole contents of
   `supabase/migrations/0001_init.sql`, and run it. It should say "Success".
3. **Storage:** *Storage* should now list a private bucket named `event-media`.
4. **Keys:** *Project Settings → API*. Copy the Project URL, the `anon` public key, and the `service_role` key.
   The `service_role` key is secret: it goes only into Vercel's environment settings.
5. **Auth URLs:** *Authentication → URL Configuration*. Set *Site URL* to your Vercel URL
   (for example `https://hapstoria.vercel.app`) and add `https://YOUR-DOMAIN/auth/callback` and
   `http://localhost:3000/auth/callback` under *Redirect URLs*.
6. *(Optional)* Google sign-in: *Authentication → Providers → Google*, following Supabase's on-screen steps.
   Email sign-in links work without it.

## 2. Vercel

1. Push this repository to GitHub, then in Vercel choose *Add New → Project* and import it.
2. Add these Environment Variables (Production and Preview):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
   | `NEXT_PUBLIC_SITE_URL` | your Vercel/production URL, no trailing slash |

3. Deploy. Then update Supabase's Site URL (step 1.5) if the URL changed.

## 3. Test like a customer

1. Open the site, click *Create invitation*, and sign in with your email.
2. Create an event, **Publish** it, and open the share link on your phone.
3. RSVP as a guest; watch the headcount update on the dashboard.
4. Open the upload QR link, upload a photo and a greeting, then approve them under *Memories*.
5. Open the album link and confirm only approved items show.

## Local development

```bash
cp .env.example .env.local   # fill in the four values
npm install
npm run dev
```

Large videos: Supabase's free plan limits individual files to 50 MB. The app allows 100 MB, so either
upgrade the project or lower `MAX_VIDEO_BYTES` in `src/lib/upload-rules.ts` (and the bucket limit in the migration).
