create table public.seating_tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  capacity int not null check (capacity between 1 and 30),
  created_at timestamptz not null default now()
);
alter table public.guests add column table_id uuid references public.seating_tables(id) on delete set null;

-- A guest can only sit at a table of their own event.
create or replace function public.guests_check_table() returns trigger
language plpgsql as $$
begin
  if new.table_id is not null and not exists (
    select 1 from public.seating_tables t where t.id = new.table_id and t.event_id = new.event_id
  ) then raise exception 'invalid_table'; end if;
  return new;
end $$;
create trigger guests_table_chk before insert or update of table_id on public.guests
  for each row execute function public.guests_check_table();

alter table public.events add column budget_cents int not null default 0 check (budget_cents >= 0);

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  category text not null check (char_length(category) between 1 and 60),
  estimated_cents int not null check (estimated_cents >= 0),
  actual_cents int check (actual_cents is null or actual_cents >= 0),
  paid boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.seating_tables enable row level security;
alter table public.budget_items enable row level security;
create policy seating_owner_all on public.seating_tables for all
  using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()));
create policy budget_owner_all on public.budget_items for all
  using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()));
