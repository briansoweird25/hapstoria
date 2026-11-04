-- De-duplicates lifecycle emails and tracks album purges.
create table public.notifications (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now(),
  unique (event_id, kind)
);
alter table public.notifications enable row level security; -- service role only

alter table public.events add column purged_at timestamptz;
