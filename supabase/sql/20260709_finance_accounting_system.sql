-- DAY NIGHT DELIVERY SERVICES
-- Database-backed admin finance/accounting foundation.
-- Apply in Supabase SQL Editor. Safe to re-run.

begin;

create extension if not exists pgcrypto;


-- Clean-project prerequisites used by finance foreign keys and admin policies.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.daynight_admin_allowed()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role::text, '')) in ('admin', 'support')
  )
  or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')) in ('admin', 'support');
$$;

create table if not exists public.merchants (
  id uuid primary key default gen_random_uuid(),
  merchant_code text unique,
  trade_name text not null,
  owner_name text,
  phone text not null,
  alt_phone text,
  email text,
  emirate text,
  city text,
  address text,
  pickup_address text,
  license_number text,
  trn text,
  tax_number text,
  logo_url text,
  bank_name text,
  iban text,
  settlement_cycle text default 'weekly',
  commission_type text default 'fixed_delivery_fee',
  default_payment_method text default 'sender_pays',
  notes text,
  status text default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  invoice_number text,
  tracking_number text,
  coupon_number text,
  merchant_id uuid references public.merchants(id) on delete set null,
  merchant_name text,
  merchant_code text,
  sender_name text,
  sender_phone text,
  sender_city text,
  sender_address text,
  receiver_name text,
  receiver_phone text,
  receiver_city text,
  receiver_address text,
  package_type text,
  package_description text,
  order_count integer default 1,
  shipping_scope text default 'local',
  destination_country text,
  weight numeric default 1,
  pieces integer default 1,
  service_type text default 'standard',
  payment_method text default 'sender_pays',
  cod_amount numeric default 0,
  delivery_price numeric default 0,
  price numeric default 0,
  status text default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists merchants_status_idx on public.merchants(status);
create index if not exists merchants_trade_name_idx on public.merchants(trade_name);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_merchant_id_idx on public.orders(merchant_id);

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


create index if not exists finance_accounts_status_idx on public.finance_accounts(status);
create index if not exists expenses_status_created_at_idx on public.expenses(status, created_at desc);
create index if not exists income_entries_status_created_at_idx on public.income_entries(status, created_at desc);
create index if not exists cod_collections_status_created_at_idx on public.cod_collections(status, created_at desc);
create index if not exists merchant_settlements_merchant_id_idx on public.merchant_settlements(merchant_id);
create index if not exists driver_settlements_driver_id_idx on public.driver_settlements(driver_id);
create index if not exists ledger_entries_source_idx on public.ledger_entries(source_table, source_id);
create index if not exists finance_audit_log_table_record_idx on public.finance_audit_log(table_name, record_id);

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


-- Audit and ledger automation for finance movements.
create or replace function public.daynight_finance_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.finance_audit_log(table_name, record_id, action, old_values, new_values, created_by)
  values (tg_table_name, coalesce(new.id, old.id), tg_op, case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end, case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end, auth.uid());
  return coalesce(new, old);
end;
$$;

create or replace function public.daynight_post_expense_ledger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or coalesce(old.status, '') <> 'approved') then
    insert into public.ledger_entries(entry_type, source_table, source_id, account_id, debit, credit, description, created_by)
    values ('expense', 'expenses', new.id, new.account_id, coalesce(new.amount, 0) + coalesce(new.vat_amount, 0), 0, coalesce(new.notes, 'Approved expense'), auth.uid());
  elsif new.status = 'void' and tg_op = 'UPDATE' and coalesce(old.status, '') <> 'void' then
    insert into public.ledger_entries(entry_type, source_table, source_id, account_id, debit, credit, description, status, created_by)
    values ('expense_reversal', 'expenses', new.id, new.account_id, 0, coalesce(old.amount, 0) + coalesce(old.vat_amount, 0), coalesce(new.void_reason, 'Expense void reversal'), 'posted', auth.uid());
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['finance_accounts','expense_categories','expenses','income_entries','cod_collections','merchant_settlements','driver_settlements','ledger_entries','finance_adjustments'] loop
    execute format('drop trigger if exists trg_%I_finance_audit on public.%I', t, t);
    execute format('create trigger trg_%I_finance_audit after insert or update or delete on public.%I for each row execute function public.daynight_finance_audit_trigger()', t, t);
  end loop;
end $$;

drop trigger if exists trg_expenses_ledger on public.expenses;
create trigger trg_expenses_ledger
after insert or update on public.expenses
for each row execute function public.daynight_post_expense_ledger();


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
