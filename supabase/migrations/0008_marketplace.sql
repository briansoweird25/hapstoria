-- Creator marketplace: creators apply, submit structured templates, admins review,
-- customers buy per template, creators earn a share (payouts via Stripe Connect transfers).

create table public.creator_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  bio text check (bio is null or char_length(bio) <= 500),
  country text check (country is null or char_length(country) = 2),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  stripe_account_id text,
  created_at timestamptz not null default now()
);

create table public.marketplace_templates (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(user_id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  kind text not null,
  culture text not null default '',
  description text not null default '',
  definition jsonb not null,
  price_cents int not null check (price_cents between 300 and 9900),
  status text not null default 'pending' check (status in ('draft','pending','approved','rejected')),
  rejection_reason text,
  created_at timestamptz not null default now()
);
create index marketplace_templates_status_idx on public.marketplace_templates(status);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(user_id) on delete cascade,
  amount_cents int not null check (amount_cents > 0),
  stripe_transfer_id text,
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  created_at timestamptz not null default now()
);

create table public.template_purchases (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.marketplace_templates(id) on delete restrict,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  price_cents int not null,
  creator_share_cents int not null,
  platform_fee_cents int not null,
  payout_id uuid references public.payouts(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, buyer_id),
  check (creator_share_cents + platform_fee_cents = price_cents)
);

-- Creators may not self-approve or touch payout identifiers: only the service role (auth.uid() is null) can.
create or replace function public.creator_profiles_guard() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'pending'; new.stripe_account_id := null;
  elsif new.status is distinct from old.status or new.stripe_account_id is distinct from old.stripe_account_id then
    raise exception 'creator_columns_protected';
  end if;
  return new;
end $$;
create trigger creator_profiles_guard_trg before insert or update on public.creator_profiles
  for each row execute function public.creator_profiles_guard();

create or replace function public.marketplace_templates_guard() returns trigger
language plpgsql as $$
declare cstatus text;
begin
  if auth.uid() is null then return new; end if;
  select status into cstatus from public.creator_profiles where user_id = new.creator_id;
  if cstatus is distinct from 'approved' then raise exception 'creator_not_approved'; end if;
  if tg_op = 'INSERT' then
    new.status := 'pending'; new.rejection_reason := null;
  else
    -- creators can edit content, but any edit sends it back to review; they can never set the status themselves
    if new.status is distinct from old.status then raise exception 'status_protected'; end if;
    if new.definition is distinct from old.definition or new.price_cents is distinct from old.price_cents or new.name is distinct from old.name then
      new.status := 'pending'; new.rejection_reason := null;
    end if;
  end if;
  return new;
end $$;
create trigger marketplace_templates_guard_trg before insert or update on public.marketplace_templates
  for each row execute function public.marketplace_templates_guard();

-- An event may only use a marketplace template its owner bought (or created).
create or replace function public.events_check_marketplace_template() returns trigger
language plpgsql as $$
declare tid uuid;
begin
  if auth.uid() is null or new.template_id not like 'mkt:%' then return new; end if;
  begin tid := substr(new.template_id, 5)::uuid; exception when others then raise exception 'invalid_template'; end;
  if not exists (select 1 from public.template_purchases p where p.template_id = tid and p.buyer_id = new.owner_id)
     and not exists (select 1 from public.marketplace_templates t where t.id = tid and t.creator_id = new.owner_id) then
    raise exception 'template_not_owned';
  end if;
  return new;
end $$;
create trigger events_marketplace_chk before insert or update of template_id on public.events
  for each row execute function public.events_check_marketplace_template();

alter table public.creator_profiles enable row level security;
alter table public.marketplace_templates enable row level security;
alter table public.payouts enable row level security;
alter table public.template_purchases enable row level security;

create policy creator_profiles_owner on public.creator_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy marketplace_templates_creator on public.marketplace_templates for all using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy payouts_creator_read on public.payouts for select using (creator_id = auth.uid());
create policy purchases_buyer_read on public.template_purchases for select using (buyer_id = auth.uid());
create policy purchases_creator_read on public.template_purchases for select
  using (exists (select 1 from public.marketplace_templates t where t.id = template_id and t.creator_id = auth.uid()));

-- Public storefront: approved templates by approved creators.
create or replace function public.list_marketplace()
returns table (id uuid, name text, kind text, culture text, description text, definition jsonb, price_cents int, creator_name text)
language sql security definer set search_path = public as $$
  select t.id, t.name, t.kind, t.culture, t.description, t.definition, t.price_cents, c.display_name
  from public.marketplace_templates t join public.creator_profiles c on c.user_id = t.creator_id
  where t.status = 'approved' and c.status = 'approved'
  order by t.created_at desc
$$;
revoke all on function public.list_marketplace() from public;
grant execute on function public.list_marketplace() to anon, authenticated;
