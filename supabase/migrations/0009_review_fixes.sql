-- Fixes from the security review of 0001-0008. Safe to run on top of them.

-- 1. INSERT ... RETURNING must see the new row: the SELECT policy can't rely on a lookup in the same snapshot.
drop policy events_select on public.events;
create policy events_select on public.events for select using (owner_id = auth.uid() or can_access_event(id, false));

-- 2. Subscriptions: record when entitlement ended, and ignore out-of-order Stripe events.
alter table public.subscriptions
  add column ended_at timestamptz,
  add column last_event_at bigint not null default 0;

create or replace function public.upsert_subscription(
  p_user_id uuid, p_customer text, p_subscription text, p_tier text, p_status text,
  p_period_end timestamptz, p_cancel_at_period_end boolean, p_ended_at timestamptz, p_event_created bigint
) returns void
language sql security definer set search_path = public as $$
  insert into public.subscriptions (user_id, stripe_customer_id, stripe_subscription_id, tier, status,
                                    current_period_end, cancel_at_period_end, ended_at, last_event_at, updated_at)
  values (p_user_id, p_customer, p_subscription, p_tier, p_status, p_period_end, p_cancel_at_period_end, p_ended_at, p_event_created, now())
  on conflict (stripe_subscription_id) do update set
    tier = excluded.tier, status = excluded.status, current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end, ended_at = excluded.ended_at,
    last_event_at = excluded.last_event_at, updated_at = now()
  where public.subscriptions.last_event_at <= excluded.last_event_at
$$;

-- 3. Stripe event claims: processing / done / failed, so a crash never loses a paid event.
alter table public.stripe_events
  add column status text not null default 'done' check (status in ('processing','done','failed')),
  add column updated_at timestamptz not null default now();

create or replace function public.claim_stripe_event(p_id text, p_type text) returns text
language plpgsql security definer set search_path = public as $$
declare got text;
begin
  insert into public.stripe_events (id, type, status) values (p_id, p_type, 'processing')
  on conflict (id) do update set status = 'processing', updated_at = now()
    where public.stripe_events.status = 'failed'
       or (public.stripe_events.status = 'processing' and public.stripe_events.updated_at < now() - interval '5 minutes')
  returning id into got;
  if got is not null then return 'claimed'; end if;
  select case when status = 'done' then 'done' else 'busy' end into got from public.stripe_events where id = p_id;
  return got;
end $$;

revoke all on function public.upsert_subscription(uuid,text,text,text,text,timestamptz,boolean,timestamptz,bigint) from public, anon, authenticated;
revoke all on function public.claim_stripe_event(text,text) from public, anon, authenticated;

-- 4. Marketplace: the theme snapshot is always copied from the template table (never client-supplied), and the
-- ownership check runs with definer rights so editors can save events that use the owner's template.
drop trigger events_marketplace_chk on public.events;
drop function public.events_check_marketplace_template();
create or replace function public.events_apply_marketplace_template() returns trigger
language plpgsql security definer set search_path = public as $$
declare tid uuid; def jsonb;
begin
  if auth.uid() is null then return new; end if;
  if new.template_id not like 'mkt:%' then new.theme := '{}'::jsonb; return new; end if;
  begin tid := substr(new.template_id, 5)::uuid; exception when others then raise exception 'invalid_template'; end;
  select t.definition into def from public.marketplace_templates t
   where t.id = tid and (t.creator_id = new.owner_id
         or (t.status = 'approved' and exists (select 1 from public.template_purchases p where p.template_id = tid and p.buyer_id = new.owner_id)));
  if def is null then raise exception 'template_not_owned'; end if;
  new.theme := def || jsonb_build_object('id', new.template_id);
  return new;
end $$;
create trigger events_marketplace_apply before insert or update of template_id, theme on public.events
  for each row execute function public.events_apply_marketplace_template();

-- 5. Plan limits enforced in the database (the API can't bypass them).
create or replace function public.user_is_planner(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.subscriptions s where s.user_id = uid and s.tier = 'planner' and s.status in ('active','trialing','past_due'))
$$;

create or replace function public.events_enforce_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare owned int; free_n int;
begin
  if auth.uid() is null then return new; end if;
  select count(*), count(*) filter (where not premium) into owned, free_n from public.events where owner_id = new.owner_id;
  if public.user_is_planner(new.owner_id) then
    if owned >= 15 then raise exception 'event_limit'; end if;
  elsif free_n >= 1 then
    raise exception 'free_event_limit';
  end if;
  return new;
end $$;
create trigger events_limit_trg before insert on public.events for each row execute function public.events_enforce_limit();

create or replace function public.invites_require_planner() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if auth.uid() is null then return new; end if;
  select owner_id into owner from public.events where id = new.event_id;
  if not public.user_is_planner(owner) then raise exception 'planner_required'; end if;
  return new;
end $$;
create trigger invites_planner_trg before insert on public.event_invites for each row execute function public.invites_require_planner();

-- 6. Guest limit: existing guests can always update their reply; count race closed with a row lock.
create or replace function public.enforce_guest_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare prem boolean; n int;
begin
  select premium into prem from public.events where id = new.event_id for update;
  if not prem then
    if exists (select 1 from public.guests g where g.event_id = new.event_id and g.name_key = lower(new.name)) then
      return new; -- an existing guest (upsert path); the ON CONFLICT clause handles it
    end if;
    select count(*) into n from public.guests where event_id = new.event_id;
    if n >= 30 then raise exception 'guest_limit'; end if;
  end if;
  return new;
end $$;

-- 7. Throttle confirmation emails sent on behalf of strangers (per event and per recipient).
create table public.email_log (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  recipient text not null,
  created_at timestamptz not null default now()
);
create index email_log_event_time_idx on public.email_log(event_id, created_at desc);
alter table public.email_log enable row level security; -- service role only
