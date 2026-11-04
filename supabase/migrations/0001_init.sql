-- Hapstoria core schema: events, guests/RSVPs, guest uploads.
-- Run via `supabase db push` or paste into the Supabase SQL editor.

create extension if not exists pgcrypto;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,60}$'),
  title text not null check (char_length(title) between 1 and 120),
  kind text not null default 'birthday',
  template_id text not null default 'classic-gold',
  theme jsonb not null default '{}'::jsonb,
  host_names text not null default '',
  starts_at timestamptz,
  venue_name text not null default '',
  venue_address text not null default '',
  message text not null default '',
  dress_code text not null default '',
  cover_path text,
  cover_kind text check (cover_kind in ('image','gif','video')),
  meal_options text[] not null default '{}',
  rsvp_deadline timestamptz,
  max_plus_ones int not null default 4 check (max_plus_ones between 0 and 20),
  uploads_enabled boolean not null default true,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_owner_idx on public.events(owner_id);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  email text,
  phone text,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  party_size int not null default 1 check (party_size between 0 and 25),
  meal text,
  note text,
  responded_at timestamptz,
  reminded_at timestamptz,
  created_at timestamptz not null default now()
);
create index guests_event_idx on public.guests(event_id);
create unique index guests_event_name_uidx on public.guests(event_id, lower(name));

create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  uploader_name text not null default 'Guest',
  kind text not null check (kind in ('photo','video','greeting')),
  storage_path text,
  greeting_text text,
  size_bytes bigint not null default 0,
  status text not null default 'pending' check (status in ('pending','approved','hidden')),
  created_at timestamptz not null default now(),
  check (
    (kind = 'greeting' and greeting_text is not null)
    or (kind <> 'greeting' and storage_path is not null)
  )
);
create index uploads_event_idx on public.uploads(event_id, status);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

-- Row level security: owners manage their own data. Guests never touch
-- tables directly; they go through the RPCs below or server routes.
alter table public.events enable row level security;
alter table public.guests enable row level security;
alter table public.uploads enable row level security;

create policy events_owner_all on public.events
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy guests_owner_all on public.guests
  for all using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()));

create policy uploads_owner_all on public.uploads
  for all using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()));

-- Public read of a published event (no owner id, no private fields).
create or replace function public.get_public_event(p_slug text)
returns table (
  id uuid, slug text, title text, kind text, template_id text, theme jsonb,
  host_names text, starts_at timestamptz, venue_name text, venue_address text,
  message text, dress_code text, cover_path text, cover_kind text,
  meal_options text[], rsvp_deadline timestamptz, max_plus_ones int,
  uploads_enabled boolean
)
language sql security definer set search_path = public as $$
  select e.id, e.slug, e.title, e.kind, e.template_id, e.theme, e.host_names,
         e.starts_at, e.venue_name, e.venue_address, e.message, e.dress_code,
         e.cover_path, e.cover_kind, e.meal_options, e.rsvp_deadline,
         e.max_plus_ones, e.uploads_enabled
  from public.events e where e.slug = p_slug and e.published
$$;

-- Guest RSVP: upserts by (event, name). Validates deadline and limits.
create or replace function public.submit_rsvp(
  p_slug text, p_name text, p_status text, p_party_size int,
  p_meal text, p_note text, p_email text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare ev public.events; gid uuid; n text := btrim(p_name);
begin
  select * into ev from public.events where slug = p_slug and published;
  if not found then raise exception 'event_not_found'; end if;
  if ev.rsvp_deadline is not null and now() > ev.rsvp_deadline then
    raise exception 'rsvp_closed';
  end if;
  if n is null or char_length(n) = 0 or char_length(n) > 120 then
    raise exception 'invalid_name';
  end if;
  if p_status not in ('accepted','declined') then raise exception 'invalid_status'; end if;
  if p_status = 'accepted' and (p_party_size < 1 or p_party_size > ev.max_plus_ones + 1) then
    raise exception 'invalid_party_size';
  end if;
  insert into public.guests (event_id, name, email, status, party_size, meal, note, responded_at)
  values (ev.id, n, nullif(btrim(p_email), ''), p_status,
          case when p_status = 'accepted' then p_party_size else 0 end,
          nullif(btrim(p_meal), ''), left(nullif(btrim(p_note), ''), 500), now())
  on conflict (event_id, lower(name)) do update set
    status = excluded.status, party_size = excluded.party_size,
    meal = excluded.meal, note = excluded.note,
    email = coalesce(excluded.email, public.guests.email),
    responded_at = now()
  returning id into gid;
  return gid;
end $$;

revoke all on function public.get_public_event(text) from public;
revoke all on function public.submit_rsvp(text,text,text,int,text,text,text) from public;
grant execute on function public.get_public_event(text) to anon, authenticated;
grant execute on function public.submit_rsvp(text,text,text,int,text,text,text) to anon, authenticated;

-- Storage: private bucket. Owners upload covers under "<uid>/..."; guest
-- uploads are written by the server route with the service role.
insert into storage.buckets (id, name, public, file_size_limit)
values ('event-media', 'event-media', false, 104857600)
on conflict (id) do nothing;

create policy media_owner_write on storage.objects for insert to authenticated
  with check (bucket_id = 'event-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy media_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'event-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy media_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'event-media' and (storage.foldername(name))[1] = auth.uid()::text);
