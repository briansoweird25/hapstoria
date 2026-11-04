-- Billing: per-event premium, subscriptions, orders, Stripe webhook idempotency.

alter table public.events
  add column premium boolean not null default false,
  add column premium_at timestamptz;

-- Owners must never be able to grant themselves premium: only the service role
-- (auth.uid() is null) may change these columns.
create or replace function public.events_protect_billing() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.premium := false; new.premium_at := null;
  elsif new.premium is distinct from old.premium or new.premium_at is distinct from old.premium_at then
    raise exception 'billing_columns_protected';
  end if;
  return new;
end $$;
create trigger events_billing_guard before insert or update on public.events
  for each row execute function public.events_protect_billing();

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  tier text not null check (tier in ('keeper','keeper_plus','planner')),
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions(user_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('event_premium','print','template')),
  event_id uuid references public.events(id) on delete set null,
  amount_cents int not null check (amount_cents >= 0),
  currency text not null default 'usd',
  stripe_session_id text not null unique,
  status text not null default 'pending' check (status in ('pending','paid','refunded')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index orders_user_idx on public.orders(user_id);

create table public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
alter table public.orders enable row level security;
alter table public.stripe_events enable row level security; -- no policies: service role only

create policy subscriptions_owner_read on public.subscriptions for select using (user_id = auth.uid());
create policy orders_owner_read on public.orders for select using (user_id = auth.uid());

-- Free events cap guests at 30 (premium: unlimited). Enforced where guests are created.
create or replace function public.enforce_guest_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare prem boolean; n int;
begin
  select premium into prem from public.events where id = new.event_id;
  if not prem then
    select count(*) into n from public.guests where event_id = new.event_id;
    if n >= 30 then raise exception 'guest_limit'; end if;
  end if;
  return new;
end $$;
create trigger guests_limit before insert on public.guests
  for each row execute function public.enforce_guest_limit();
