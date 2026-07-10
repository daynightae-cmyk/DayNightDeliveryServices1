create table if not exists public.admin_daily_closings (
  id uuid primary key default gen_random_uuid(),
  closing_date date not null unique,
  total_orders integer default 0,
  delivered_orders integer default 0,
  cancelled_orders integer default 0,
  returned_orders integer default 0,
  delivery_income numeric default 0,
  cod_total numeric default 0,
  cod_collected numeric default 0,
  cod_pending numeric default 0,
  cod_reconciled numeric default 0,
  expenses_total numeric default 0,
  adjustments_net numeric default 0,
  net_total numeric default 0,
  unassigned_orders integer default 0,
  pending_review_orders integer default 0,
  unreconciled_cod numeric default 0,
  print_jobs_pending integer default 0,
  status text default 'draft' check (status in ('draft','needs_review','closed','reopened')),
  reviewed_by uuid nullable,
  reviewed_at timestamptz nullable,
  notes text nullable,
  source text default 'derived',
  snapshot jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists admin_daily_closings_closing_date_idx on public.admin_daily_closings (closing_date);
create index if not exists admin_daily_closings_status_idx on public.admin_daily_closings (status);
create index if not exists admin_daily_closings_reviewed_by_idx on public.admin_daily_closings (reviewed_by);
create index if not exists admin_daily_closings_created_at_idx on public.admin_daily_closings (created_at);

alter table public.admin_daily_closings enable row level security;

drop policy if exists "admin_daily_closings_admin_support_select" on public.admin_daily_closings;
drop policy if exists "admin_daily_closings_admin_support_write" on public.admin_daily_closings;

create policy "admin_daily_closings_admin_support_select"
  on public.admin_daily_closings for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.role, '') in ('admin', 'support')
    )
  );

create policy "admin_daily_closings_admin_support_write"
  on public.admin_daily_closings for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.role, '') in ('admin', 'support')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.role, '') in ('admin', 'support')
    )
  );
