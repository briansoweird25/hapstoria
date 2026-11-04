-- Planner workspace: per-event collaborators (editor/viewer), invites, planner profiles + white-label.

create table public.event_members (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create table public.event_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null check (role in ('editor','viewer')),
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  created_at timestamptz not null default now(),
  unique (event_id, email)
);

-- Single source of truth for "may the current user touch this event?"
create or replace function public.can_access_event(eid uuid, need_write boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events e where e.id = eid and e.owner_id = auth.uid())
      or exists (select 1 from public.event_members m
                 where m.event_id = eid and m.user_id = auth.uid() and (not need_write or m.role = 'editor'))
$$;
create or replace function public.is_event_owner(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events e where e.id = eid and e.owner_id = auth.uid())
$$;

-- Ownership can never be transferred through the API.
create or replace function public.events_lock_owner() returns trigger
language plpgsql as $$
begin
  if new.owner_id is distinct from old.owner_id then raise exception 'owner_locked'; end if;
  return new;
end $$;
create trigger events_owner_lock before update on public.events
  for each row execute function public.events_lock_owner();

-- events: members read; editors update; only the owner inserts/deletes.
drop policy events_owner_all on public.events;
create policy events_select on public.events for select using (can_access_event(id, false));
create policy events_insert on public.events for insert with check (owner_id = auth.uid());
create policy events_update on public.events for update using (can_access_event(id, true)) with check (can_access_event(id, true));
create policy events_delete on public.events for delete using (owner_id = auth.uid());

-- Child tables: editors full access, viewers read.
do $$ declare t text; begin
  foreach t in array array['guests','uploads','gift_methods','gift_funds','gift_items','gifts','seating_tables','budget_items'] loop
    execute format('drop policy if exists %I on public.%I', case t
      when 'guests' then 'guests_owner_all' when 'uploads' then 'uploads_owner_all'
      when 'seating_tables' then 'seating_owner_all' when 'budget_items' then 'budget_owner_all'
      else t || '_owner_all' end, t);
    execute format('create policy %I on public.%I for all using (can_access_event(event_id, true)) with check (can_access_event(event_id, true))', t || '_write', t);
    execute format('create policy %I on public.%I for select using (can_access_event(event_id, false))', t || '_read', t);
  end loop;
end $$;

alter table public.event_members enable row level security;
alter table public.event_invites enable row level security;
create policy members_read on public.event_members for select using (user_id = auth.uid() or is_event_owner(event_id));
create policy members_owner_delete on public.event_members for delete using (is_event_owner(event_id));
create policy invites_owner_all on public.event_invites for all using (is_event_owner(event_id)) with check (is_event_owner(event_id));

create table public.planner_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,60}$'),
  tagline text check (tagline is null or char_length(tagline) <= 160),
  brand_color text not null default '#b8934a' check (brand_color ~* '^#[0-9a-f]{6}$'),
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.planner_profiles enable row level security;
create policy planner_profiles_owner_all on public.planner_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Public: a planner's profile page (only when public and still subscribed).
create or replace function public.get_planner_profile(p_slug text)
returns table (business_name text, slug text, tagline text, brand_color text)
language sql security definer set search_path = public as $$
  select p.business_name, p.slug, p.tagline, p.brand_color from public.planner_profiles p
  where p.slug = p_slug and p.is_public and exists (
    select 1 from public.subscriptions s where s.user_id = p.user_id and s.tier = 'planner' and s.status in ('active','trialing'))
$$;

-- White-label: branding to show instead of Hapstoria on a planner's event pages.
create or replace function public.get_event_branding(p_slug text)
returns table (business_name text, brand_color text)
language sql security definer set search_path = public as $$
  select p.business_name, p.brand_color
  from public.events e join public.planner_profiles p on p.user_id = e.owner_id
  where e.slug = p_slug and e.published and exists (
    select 1 from public.subscriptions s where s.user_id = p.user_id and s.tier = 'planner' and s.status in ('active','trialing'))
$$;
revoke all on function public.get_planner_profile(text) from public;
revoke all on function public.get_event_branding(text) from public;
grant execute on function public.get_planner_profile(text) to anon, authenticated;
grant execute on function public.get_event_branding(text) to anon, authenticated;
