-- Gift registry. Money never passes through Hapstoria: guests pay the host directly
-- (QR, PayPal, bank...) and record a pledge here so the host can track thank-yous.

alter table public.events
  add column gifts_enabled boolean not null default false,
  add column gift_allow_anonymous boolean not null default true,
  add column gift_show_amounts boolean not null default false,
  add column gift_public_wall boolean not null default false;

create table public.gift_methods (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  kind text not null check (kind in ('qr','paypal','venmo','wise','bank','gcash','maya','other')),
  label text not null check (char_length(label) between 1 and 60),
  url text check (url is null or url like 'https://%'),
  details text check (details is null or char_length(details) <= 300),
  qr_path text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.gift_funds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  goal_cents int check (goal_cents is null or goal_cents > 0),
  created_at timestamptz not null default now()
);
create table public.gift_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  url text check (url is null or url like 'https://%'),
  reserved_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  fund_id uuid references public.gift_funds(id) on delete set null,
  item_id uuid references public.gift_items(id) on delete set null,
  giver_name text,             -- null when anonymous: the name is never stored
  anonymous boolean not null default false,
  amount_cents int not null default 0 check (amount_cents >= 0),
  currency text not null default 'USD',
  message text check (message is null or char_length(message) <= 500),
  status text not null default 'pledged' check (status in ('pledged','received')),
  thanked boolean not null default false,
  created_at timestamptz not null default now(),
  check (anonymous = false or giver_name is null)
);
create index gifts_event_idx on public.gifts(event_id);

create or replace function public.gift_methods_check_path() returns trigger
language plpgsql as $$
declare owner uuid;
begin
  if new.qr_path is not null then
    select owner_id into owner from public.events where id = new.event_id;
    if new.qr_path not like owner::text || '/%' then raise exception 'invalid_storage_path'; end if;
  end if;
  return new;
end $$;
create trigger gift_methods_path_chk before insert or update of qr_path, event_id on public.gift_methods
  for each row execute function public.gift_methods_check_path();

alter table public.gift_methods enable row level security;
alter table public.gift_funds enable row level security;
alter table public.gift_items enable row level security;
alter table public.gifts enable row level security;

do $$ declare t text; begin
  foreach t in array array['gift_methods','gift_funds','gift_items','gifts'] loop
    execute format($f$create policy %I on public.%I for all
      using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()))
      with check (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()))$f$,
      t || '_owner_all', t);
  end loop;
end $$;

-- Everything a guest may see on the public gift page, in one call.
create or replace function public.get_public_gifts(p_slug text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ev public.events;
begin
  select * into ev from public.events where slug = p_slug and published and gifts_enabled;
  if not found then return null; end if;
  return jsonb_build_object(
    'allow_anonymous', ev.gift_allow_anonymous,
    'methods', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'label', m.label, 'url', m.url, 'details', m.details, 'qr_path', m.qr_path) order by m.created_at)
                         from public.gift_methods m where m.event_id = ev.id and m.enabled), '[]'::jsonb),
    'funds', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'title', f.title, 'goal_cents', f.goal_cents,
                         'raised_cents', coalesce((select sum(g.amount_cents) from public.gifts g where g.fund_id = f.id), 0)) order by f.created_at)
                       from public.gift_funds f where f.event_id = ev.id), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'title', i.title, 'url', i.url, 'reserved', i.reserved_at is not null) order by i.created_at)
                       from public.gift_items i where i.event_id = ev.id), '[]'::jsonb),
    'wall', case when ev.gift_public_wall then coalesce((
              select jsonb_agg(jsonb_build_object('giver', case when g.anonymous then 'Anonymous' else coalesce(g.giver_name, 'A guest') end,
                       'amount_cents', case when ev.gift_show_amounts then g.amount_cents else null end,
                       'currency', g.currency, 'message', g.message) order by g.created_at desc)
              from public.gifts g where g.event_id = ev.id), '[]'::jsonb) else null end
  );
end $$;

-- A guest records that they sent a gift (or reserved a wishlist item).
create or replace function public.pledge_gift(
  p_slug text, p_target text, p_target_id uuid, p_amount_cents int, p_currency text,
  p_anonymous boolean, p_giver_name text, p_message text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare ev public.events; gid uuid; v_fund uuid; v_item uuid; name_val text;
begin
  select * into ev from public.events where slug = p_slug and published and gifts_enabled;
  if not found then raise exception 'gifts_unavailable'; end if;
  if p_anonymous and not ev.gift_allow_anonymous then raise exception 'anonymous_not_allowed'; end if;
  if p_amount_cents < 0 or p_amount_cents > 10000000 then raise exception 'invalid_amount'; end if;
  if char_length(coalesce(p_message,'')) > 500 or char_length(coalesce(p_giver_name,'')) > 120 then raise exception 'invalid_input'; end if;
  name_val := case when p_anonymous then null else nullif(btrim(p_giver_name), '') end;
  if not p_anonymous and name_val is null then raise exception 'name_required'; end if;

  if p_target = 'fund' then
    select id into v_fund from public.gift_funds where id = p_target_id and event_id = ev.id;
    if v_fund is null then raise exception 'invalid_target'; end if;
    if p_amount_cents <= 0 then raise exception 'invalid_amount'; end if;
  elsif p_target = 'item' then
    update public.gift_items set reserved_at = now()
      where id = p_target_id and event_id = ev.id and reserved_at is null returning id into v_item;
    if v_item is null then raise exception 'item_unavailable'; end if;
  elsif p_target = 'general' then
    if p_amount_cents <= 0 then raise exception 'invalid_amount'; end if;
  else
    raise exception 'invalid_target';
  end if;

  insert into public.gifts (event_id, fund_id, item_id, giver_name, anonymous, amount_cents, currency, message)
  values (ev.id, v_fund, v_item, name_val, p_anonymous, p_amount_cents, upper(left(p_currency, 3)), left(nullif(btrim(p_message), ''), 500))
  returning id into gid;
  return gid;
end $$;

revoke all on function public.get_public_gifts(text) from public;
revoke all on function public.pledge_gift(text,text,uuid,int,text,boolean,text,text) from public;
grant execute on function public.get_public_gifts(text) to anon, authenticated;
grant execute on function public.pledge_gift(text,text,uuid,int,text,boolean,text,text) to anon, authenticated;
