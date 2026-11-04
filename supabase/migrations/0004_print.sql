-- Printed invitation orders. Created/updated by the server (service role); owners can read.
create table public.print_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  quantity int not null check (quantity between 10 and 1000),
  mode text not null check (mode in ('host','guests')),
  address jsonb not null,
  amount_cents int not null check (amount_cents > 0),
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment','paid','in_production','shipped','delivered','cancelled')),
  tracking text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index print_orders_event_idx on public.print_orders(event_id);
alter table public.print_orders enable row level security;
create policy print_orders_owner_read on public.print_orders for select using (user_id = auth.uid());
