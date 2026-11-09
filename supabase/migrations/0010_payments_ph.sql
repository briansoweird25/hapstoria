-- Philippine payments: PayMongo (GCash/Maya/cards) and PayPal, prepaid memberships, manual creator payouts. Prices in PHP.

-- 1. Memberships are prepaid periods, not card subscriptions: access lasts until valid_until.
alter table public.subscriptions
  alter column stripe_customer_id drop not null,
  alter column stripe_subscription_id drop not null,
  add column valid_until timestamptz,
  add column provider text not null default 'prepaid';
create unique index subscriptions_prepaid_uidx on public.subscriptions (user_id, tier) where stripe_subscription_id is null;

drop function if exists public.upsert_subscription(uuid,text,text,text,text,timestamptz,boolean,timestamptz,bigint);

-- Paying again extends from the later of "now" and the current end date.
create or replace function public.extend_membership(p_user uuid, p_tier text, p_days int) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare ends timestamptz;
begin
  if p_tier not in ('keeper','keeper_plus','planner') or p_days <= 0 or p_days > 400 then raise exception 'invalid_membership'; end if;
  insert into public.subscriptions (user_id, stripe_customer_id, stripe_subscription_id, tier, status, provider, valid_until, updated_at)
  values (p_user, null, null, p_tier, 'active', 'prepaid', now() + make_interval(days => p_days), now())
  on conflict (user_id, tier) where stripe_subscription_id is null do update set
    valid_until = greatest(now(), coalesce(public.subscriptions.valid_until, now())) + make_interval(days => p_days),
    status = 'active', ended_at = null, updated_at = now()
  returning valid_until into ends;
  return ends;
end $$;
revoke all on function public.extend_membership(uuid,text,int) from public, anon, authenticated;

-- Everything that asks "is this user subscribed?" now also checks the prepaid end date.
create or replace function public.user_is_planner(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.subscriptions s
                 where s.user_id = uid and s.tier = 'planner' and s.status in ('active','trialing','past_due')
                   and (s.valid_until is null or s.valid_until > now()))
$$;

create or replace function public.get_planner_profile(p_slug text)
returns table (business_name text, slug text, tagline text, brand_color text)
language sql security definer set search_path = public as $$
  select p.business_name, p.slug, p.tagline, p.brand_color from public.planner_profiles p
  where p.slug = p_slug and p.is_public and public.user_is_planner(p.user_id)
$$;

create or replace function public.get_event_branding(p_slug text)
returns table (business_name text, brand_color text)
language sql security definer set search_path = public as $$
  select p.business_name, p.brand_color
  from public.events e join public.planner_profiles p on p.user_id = e.owner_id
  where e.slug = p_slug and e.published and public.user_is_planner(p.user_id)
$$;

-- 2. Orders: provider-neutral reference, new kind, peso default.
alter table public.orders rename column stripe_session_id to provider_ref;
alter table public.orders
  add column provider text not null default 'paymongo' check (provider in ('paymongo','paypal'));
alter table public.orders alter column currency set default 'php';
alter table public.orders drop constraint orders_kind_check;
alter table public.orders add constraint orders_kind_check check (kind in ('event_premium','print','template','membership'));

-- 3. Payment event claims (webhooks and PayPal returns), renamed from the Stripe-era table.
alter table public.stripe_events rename to payment_events;
drop function public.claim_stripe_event(text, text);
create or replace function public.claim_payment_event(p_id text, p_type text) returns text
language plpgsql security definer set search_path = public as $$
declare got text;
begin
  insert into public.payment_events (id, type, status) values (p_id, p_type, 'processing')
  on conflict (id) do update set status = 'processing', updated_at = now()
    where public.payment_events.status = 'failed'
       or (public.payment_events.status = 'processing' and public.payment_events.updated_at < now() - interval '5 minutes')
  returning id into got;
  if got is not null then return 'claimed'; end if;
  select case when status = 'done' then 'done' else 'busy' end into got from public.payment_events where id = p_id;
  return got;
end $$;
revoke all on function public.claim_payment_event(text, text) from public, anon, authenticated;

-- 4. Marketplace prices in pesos (₱150 to ₱5,000); gifts default to pesos.
alter table public.marketplace_templates drop constraint marketplace_templates_price_cents_check;
alter table public.marketplace_templates add constraint marketplace_templates_price_cents_check check (price_cents between 15000 and 500000);
alter table public.gifts alter column currency set default 'PHP';

-- 5. Creator payouts are paid by hand (GCash or PayPal); creators say where.
alter table public.creator_profiles
  add column payout_method text check (payout_method is null or payout_method in ('gcash','paypal')),
  add column payout_details text check (payout_details is null or char_length(payout_details) <= 200);
alter table public.payouts rename column stripe_transfer_id to reference;
alter table public.payouts add column paid_at timestamptz;

-- 6. Membership expiry reminder emails, once per (user, tier, end date, kind).
create table public.membership_notices (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tier text not null,
  valid_until timestamptz not null,
  kind text not null,
  created_at timestamptz not null default now(),
  unique (user_id, tier, valid_until, kind)
);
alter table public.membership_notices enable row level security; -- service role only
