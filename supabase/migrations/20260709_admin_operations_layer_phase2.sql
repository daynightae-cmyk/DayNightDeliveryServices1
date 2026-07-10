-- DAY NIGHT DELIVERY SERVICES - Admin operations layer phase 2.
-- Safe to re-run. Keeps Supabase as source of truth and restricts access to admins/support.

begin;
create extension if not exists pgcrypto;

create or replace function public.daynight_admin_allowed()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and lower(coalesce(p.role::text,'')) in ('admin','support'))
  or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role','')) in ('admin','support');
$$;

create table if not exists public.admin_expenses (
  id uuid primary key default gen_random_uuid(), expense_date date not null default current_date,
  category text not null check (category in ('fuel','driver','maintenance','tolls','office','software','marketing','other')),
  amount numeric not null check (amount > 0), payment_method text not null default 'cash', status text not null default 'draft',
  notes text, reference_number text, attachment_url text, created_by uuid references auth.users(id), approved_by uuid references auth.users(id),
  approved_at timestamptz, voided_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.admin_adjustments (
  id uuid primary key default gen_random_uuid(), adjustment_type text not null check (adjustment_type in ('cod_correction','merchant_correction','driver_deduction','refund','manual_finance_adjustment')),
  amount numeric not null check (amount > 0), direction text not null check (direction in ('positive','negative')), order_id uuid, merchant_id uuid, driver_id uuid,
  reason text not null, notes text, status text not null default 'draft', created_by uuid references auth.users(id), approved_by uuid references auth.users(id),
  approved_at timestamptz, voided_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.cod_collections (
  id uuid primary key default gen_random_uuid(), order_id uuid, driver_id uuid, merchant_id uuid, tracking_number text, cod_amount numeric not null default 0,
  collected_amount numeric not null default 0, status text not null default 'pending' check (status in ('pending','collected','reconciled','disputed','void')),
  collection_date date, reconciled_at timestamptz, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.merchant_statement_entries (
  id uuid primary key default gen_random_uuid(), merchant_id uuid not null, order_id uuid, tracking_number text, entry_date date not null default current_date,
  entry_type text not null check (entry_type in ('order_cod','delivery_fee','return_fee','payout','adjustment','refund')),
  debit numeric not null default 0, credit numeric not null default 0, balance numeric not null default 0, notes text, created_at timestamptz not null default now()
);
create table if not exists public.driver_statement_entries (
  id uuid primary key default gen_random_uuid(), driver_id uuid not null, order_id uuid, tracking_number text, entry_date date not null default current_date,
  entry_type text not null check (entry_type in ('delivery_earning','cod_collected','cod_reconciled','deduction','adjustment','payout')),
  debit numeric not null default 0, credit numeric not null default 0, balance numeric not null default 0, notes text, created_at timestamptz not null default now()
);
create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(), merchant_id uuid, file_name text not null, import_mode text not null default 'preview', status text not null default 'preview',
  total_rows integer not null default 0, valid_rows integer not null default 0, invalid_rows integer not null default 0, created_by uuid references auth.users(id),
  created_at timestamptz not null default now(), completed_at timestamptz
);
create table if not exists public.import_batch_rows (
  id uuid primary key default gen_random_uuid(), batch_id uuid not null references public.import_batches(id) on delete cascade, row_index integer not null,
  raw_payload jsonb not null default '{}'::jsonb, normalized_payload jsonb not null default '{}'::jsonb, validation_errors jsonb not null default '[]'::jsonb,
  status text not null default 'pending', created_order_id uuid, created_at timestamptz not null default now()
);
create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(), job_type text not null check (job_type in ('invoice','shipping_label','merchant_statement','driver_statement','pickup_manifest','report_pack')),
  language text not null default 'ar', status text not null default 'queued', order_ids jsonb not null default '[]'::jsonb, merchant_id uuid, filters jsonb not null default '{}'::jsonb,
  pdf_payload jsonb not null default '{}'::jsonb, created_by uuid references auth.users(id), printed_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id), actor_email text, entity_type text not null, entity_id text,
  action text not null, before_data jsonb, after_data jsonb, metadata jsonb, created_at timestamptz not null default now()
);

create index if not exists admin_expenses_date_idx on public.admin_expenses(expense_date desc); create index if not exists admin_expenses_status_idx on public.admin_expenses(status); create index if not exists admin_expenses_category_idx on public.admin_expenses(category);
create index if not exists admin_adjustments_status_idx on public.admin_adjustments(status); create index if not exists admin_adjustments_order_idx on public.admin_adjustments(order_id); create index if not exists admin_adjustments_merchant_idx on public.admin_adjustments(merchant_id); create index if not exists admin_adjustments_driver_idx on public.admin_adjustments(driver_id); create index if not exists admin_adjustments_created_idx on public.admin_adjustments(created_at desc);
create index if not exists cod_collections_status_idx on public.cod_collections(status); create index if not exists cod_collections_order_idx on public.cod_collections(order_id); create index if not exists cod_collections_driver_idx on public.cod_collections(driver_id); create index if not exists cod_collections_merchant_idx on public.cod_collections(merchant_id); create index if not exists cod_collections_date_idx on public.cod_collections(collection_date desc);
create index if not exists merchant_statement_entries_merchant_idx on public.merchant_statement_entries(merchant_id); create index if not exists merchant_statement_entries_order_idx on public.merchant_statement_entries(order_id); create index if not exists merchant_statement_entries_date_idx on public.merchant_statement_entries(entry_date desc);
create index if not exists driver_statement_entries_driver_idx on public.driver_statement_entries(driver_id); create index if not exists driver_statement_entries_order_idx on public.driver_statement_entries(order_id); create index if not exists driver_statement_entries_date_idx on public.driver_statement_entries(entry_date desc);
create index if not exists import_batches_merchant_idx on public.import_batches(merchant_id); create index if not exists import_batches_status_idx on public.import_batches(status); create index if not exists import_batches_created_idx on public.import_batches(created_at desc); create index if not exists import_batch_rows_batch_idx on public.import_batch_rows(batch_id);
create index if not exists print_jobs_status_idx on public.print_jobs(status); create index if not exists print_jobs_merchant_idx on public.print_jobs(merchant_id); create index if not exists print_jobs_created_idx on public.print_jobs(created_at desc); create index if not exists admin_audit_events_created_idx on public.admin_audit_events(created_at desc); create index if not exists admin_audit_events_entity_idx on public.admin_audit_events(entity_type, entity_id); create index if not exists admin_audit_events_action_idx on public.admin_audit_events(action);

alter table public.admin_expenses enable row level security; alter table public.admin_adjustments enable row level security; alter table public.cod_collections enable row level security; alter table public.merchant_statement_entries enable row level security; alter table public.driver_statement_entries enable row level security; alter table public.import_batches enable row level security; alter table public.import_batch_rows enable row level security; alter table public.print_jobs enable row level security; alter table public.admin_audit_events enable row level security;

do $$ declare t text; begin
  foreach t in array array['admin_expenses','admin_adjustments','cod_collections','merchant_statement_entries','driver_statement_entries','import_batches','import_batch_rows','print_jobs','admin_audit_events'] loop
    execute format('drop policy if exists %I on public.%I', 'admin full access ' || t, t);
    execute format('create policy %I on public.%I for all to authenticated using (public.daynight_admin_allowed()) with check (public.daynight_admin_allowed())', 'admin full access ' || t, t);
  end loop;
end $$;
commit;
