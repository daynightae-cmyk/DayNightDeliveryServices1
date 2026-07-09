-- DAY NIGHT DELIVERY SERVICES
-- Database-backed admin finance/accounting foundation.
-- Apply in Supabase SQL Editor. Safe to re-run.

begin;

create extension if not exists pgcrypto;

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  account_type text not null default 'cash',
  currency text not null default 'AED',
  opening_balance numeric not null default 0,
  current_balance numeric not null default 0,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.expense_categories(id),
  account_id uuid references public.finance_accounts(id),
  amount numeric not null check (amount >= 0),
  vat_amount numeric not null default 0 check (vat_amount >= 0),
  payment_method text not null default 'cash',
  paid_at timestamptz,
  receipt_url text,
  notes text,
  status text not null default 'draft',
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  approved_by uuid references auth.users(id)
);

create table if not exists public.income_entries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  account_id uuid references public.finance_accounts(id),
  merchant_id uuid references public.merchants(id) on delete set null,
  amount numeric not null check (amount >= 0),
  income_type text not null default 'delivery_income',
  payment_method text not null default 'sender_pays',
  received_at timestamptz,
  notes text,
  status text not null default 'posted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists public.cod_collections (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  merchant_id uuid references public.merchants(id) on delete set null,
  driver_id uuid references auth.users(id),
  amount numeric not null check (amount >= 0),
  collected_at timestamptz,
  settled_at timestamptz,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists public.merchant_settlements (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id) on delete set null,
  account_id uuid references public.finance_accounts(id),
  period_start date,
  period_end date,
  cod_total numeric not null default 0,
  delivery_fees numeric not null default 0,
  adjustments numeric not null default 0,
  amount_paid numeric not null default 0,
  status text not null default 'draft',
  statement_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  approved_by uuid references auth.users(id)
);

create table if not exists public.driver_settlements (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references auth.users(id),
  account_id uuid references public.finance_accounts(id),
  period_start date,
  period_end date,
  delivered_orders integer not null default 0,
  collections numeric not null default 0,
  earnings numeric not null default 0,
  adjustments numeric not null default 0,
  amount_paid numeric not null default 0,
  status text not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  approved_by uuid references auth.users(id)
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null,
  source_table text,
  source_id uuid,
  account_id uuid references public.finance_accounts(id),
  debit numeric not null default 0 check (debit >= 0),
  credit numeric not null default 0 check (credit >= 0),
  currency text not null default 'AED',
  description text,
  status text not null default 'posted',
  reversal_of uuid references public.ledger_entries(id),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.finance_adjustments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.finance_accounts(id),
  merchant_id uuid references public.merchants(id) on delete set null,
  driver_id uuid references auth.users(id),
  amount numeric not null,
  reason text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  approved_by uuid references auth.users(id)
);

create table if not exists public.finance_audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create or replace function public.daynight_finance_touch_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(new.updated_by, auth.uid());
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['finance_accounts','expense_categories','expenses','income_entries','cod_collections','merchant_settlements','driver_settlements','finance_adjustments'] loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', t, t);
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.daynight_finance_touch_updated_at()', t, t);
  end loop;
end $$;

create or replace view public.finance_summary as
select
  coalesce((select sum(amount) from public.income_entries where status in ('posted','received')),0) as total_income,
  coalesce((select sum(amount + vat_amount) from public.expenses where status = 'approved'),0) as total_expenses,
  coalesce((select sum(amount) from public.cod_collections where status in ('collected','settled')),0) as cod_collected,
  coalesce((select sum(amount) from public.cod_collections where status = 'pending'),0) as cod_pending,
  coalesce((select sum(cod_total - delivery_fees + adjustments - amount_paid) from public.merchant_settlements where status <> 'void'),0) as merchant_payable,
  coalesce((select sum(earnings + adjustments - amount_paid) from public.driver_settlements where status <> 'void'),0) as driver_payable;

create or replace view public.monthly_profit_loss as
select date_trunc('month', created_at)::date as month,
       sum(case when source_table = 'income_entries' then credit - debit else 0 end) as income,
       sum(case when source_table = 'expenses' then debit - credit else 0 end) as expenses,
       sum(credit - debit) as net
from public.ledger_entries
where status = 'posted'
group by 1;

create or replace view public.cod_aging as
select c.*, now() - coalesce(c.collected_at, c.created_at) as age
from public.cod_collections c
where c.status in ('pending','collected');

alter table public.finance_accounts enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.income_entries enable row level security;
alter table public.cod_collections enable row level security;
alter table public.merchant_settlements enable row level security;
alter table public.driver_settlements enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.finance_adjustments enable row level security;
alter table public.finance_audit_log enable row level security;

do $$
declare t text;
begin
  foreach t in array array['finance_accounts','expense_categories','expenses','income_entries','cod_collections','merchant_settlements','driver_settlements','ledger_entries','finance_adjustments','finance_audit_log'] loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname=t || '_admin_all') then
      execute format('create policy %I on public.%I for all to authenticated using (public.daynight_admin_allowed()) with check (public.daynight_admin_allowed())', t || '_admin_all', t);
    end if;
  end loop;
end $$;

commit;
