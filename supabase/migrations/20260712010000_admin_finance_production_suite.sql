-- DAY NIGHT Admin Finance Production Suite
-- Idempotent migration for the admin finance sections:
-- Finance Dashboard, Driver Statements, Merchant Statements, Income, COD, Expenses, Accounts, Adjustments, Audit Log.
-- Safe rules: no destructive drops, no fake rows, no anon/public access, status values handled as text.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_profile_role()
returns text
language sql
security definer
set search_path = public, auth
stable
as $$
  select p.role::text from public.profiles p where p.id = auth.uid() limit 1;
$$;

create or replace function public.is_admin_or_support()
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select coalesce(public.current_profile_role() in ('admin','support'), false);
$$;

create table if not exists public.admin_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null default 'other',
  amount numeric(12,2) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  payment_method text not null default 'cash',
  status text not null default 'draft',
  reference_number text,
  receipt_url text,
  notes text,
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_adjustments (
  id uuid primary key default gen_random_uuid(),
  adjustment_type text not null default 'manual',
  direction text not null default 'positive' check (direction in ('positive','negative')),
  amount numeric(12,2) not null default 0,
  order_id uuid,
  merchant_id uuid,
  driver_id uuid,
  reason text not null default 'Manual adjustment',
  notes text,
  status text not null default 'draft',
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cod_collections (
  id uuid primary key default gen_random_uuid(),
  order_id uuid,
  tracking_number text,
  merchant_id uuid,
  driver_id uuid,
  cod_amount numeric(12,2) not null default 0,
  collected_amount numeric(12,2) not null default 0,
  reconciled_amount numeric(12,2) not null default 0,
  collection_date date not null default current_date,
  status text not null default 'pending',
  payment_method text default 'cash',
  reference_number text,
  notes text,
  created_by uuid references auth.users(id),
  reconciled_by uuid references auth.users(id),
  reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.merchant_statement_entries (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid,
  order_id uuid,
  tracking_number text,
  entry_date date not null default current_date,
  entry_type text not null,
  debit numeric(12,2) not null default 0,
  credit numeric(12,2) not null default 0,
  balance numeric(12,2) not null default 0,
  status text not null default 'posted',
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.driver_statement_entries (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid,
  order_id uuid,
  tracking_number text,
  entry_date date not null default current_date,
  entry_type text not null,
  debit numeric(12,2) not null default 0,
  credit numeric(12,2) not null default 0,
  balance numeric(12,2) not null default 0,
  status text not null default 'posted',
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists admin_expenses_expense_date_idx on public.admin_expenses(expense_date);
create index if not exists admin_expenses_status_idx on public.admin_expenses(status);
create index if not exists admin_adjustments_status_idx on public.admin_adjustments(status);
create index if not exists cod_collections_status_idx on public.cod_collections(status);
create index if not exists cod_collections_tracking_number_idx on public.cod_collections(tracking_number);
create unique index if not exists cod_collections_order_id_uq on public.cod_collections(order_id) where order_id is not null;
create unique index if not exists merchant_statement_entries_order_fee_uq on public.merchant_statement_entries(order_id, entry_type) where order_id is not null;
create unique index if not exists driver_statement_entries_order_fee_uq on public.driver_statement_entries(order_id, entry_type) where order_id is not null;
create index if not exists admin_audit_events_created_at_idx on public.admin_audit_events(created_at);

create or replace trigger admin_expenses_set_updated_at before update on public.admin_expenses for each row execute function public.set_updated_at();
create or replace trigger admin_adjustments_set_updated_at before update on public.admin_adjustments for each row execute function public.set_updated_at();
create or replace trigger cod_collections_set_updated_at before update on public.cod_collections for each row execute function public.set_updated_at();
create or replace trigger merchant_statement_entries_set_updated_at before update on public.merchant_statement_entries for each row execute function public.set_updated_at();
create or replace trigger driver_statement_entries_set_updated_at before update on public.driver_statement_entries for each row execute function public.set_updated_at();

alter table public.admin_expenses enable row level security;
alter table public.admin_adjustments enable row level security;
alter table public.cod_collections enable row level security;
alter table public.merchant_statement_entries enable row level security;
alter table public.driver_statement_entries enable row level security;
alter table public.admin_audit_events enable row level security;

do $$
declare t text;
begin
  foreach t in array array['admin_expenses','admin_adjustments','cod_collections','merchant_statement_entries','driver_statement_entries','admin_audit_events'] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_support_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_admin_or_support())', t || '_admin_support_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_support_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_admin_or_support())', t || '_admin_support_insert', t);
    if t <> 'admin_audit_events' then
      execute format('drop policy if exists %I on public.%I', t || '_admin_support_update', t);
      execute format('create policy %I on public.%I for update to authenticated using (public.is_admin_or_support()) with check (public.is_admin_or_support())', t || '_admin_support_update', t);
    end if;
  end loop;
end $$;

create or replace view public.finance_summary
with (security_invoker = true)
as
with order_stats as (
  select
    coalesce(sum(coalesce(delivery_price, base_price, price, 0)),0)::numeric(12,2) as total_income,
    coalesce(sum(coalesce(cod_amount,0)),0)::numeric(12,2) as cod_total,
    count(*)::integer as total_orders,
    count(*) filter (where lower(coalesce(status::text,'')) not in ('delivered','completed','cancelled','canceled','failed','returned','return'))::integer as active_orders,
    count(*) filter (where lower(coalesce(status::text,'')) in ('delivered','completed'))::integer as delivered_orders,
    count(*) filter (where lower(coalesce(status::text,'')) in ('cancelled','canceled','failed'))::integer as cancelled_orders,
    count(*) filter (where lower(coalesce(status::text,'')) in ('returned','return'))::integer as returned_orders
  from public.orders
), expense_stats as (
  select coalesce(sum(amount + coalesce(vat_amount,0)) filter (where lower(coalesce(status,'')) <> 'void'),0)::numeric(12,2) as total_expenses
  from public.admin_expenses
), cod_stats as (
  select
    coalesce(sum(collected_amount),0)::numeric(12,2) as cod_collected,
    coalesce(sum(case when lower(coalesce(status,'')) in ('reconciled','closed') then greatest(reconciled_amount, collected_amount) else reconciled_amount end),0)::numeric(12,2) as cod_reconciled
  from public.cod_collections
), adjustment_stats as (
  select coalesce(sum(case when direction = 'negative' then -amount else amount end) filter (where lower(coalesce(status,'')) in ('approved','posted')),0)::numeric(12,2) as adjustments_net
  from public.admin_adjustments
), merchant_stats as (
  select coalesce(sum(credit - debit) filter (where lower(coalesce(status,'')) <> 'void'),0)::numeric(12,2) as merchant_payable
  from public.merchant_statement_entries
), driver_stats as (
  select coalesce(sum(credit - debit) filter (where lower(coalesce(status,'')) <> 'void'),0)::numeric(12,2) as driver_payable
  from public.driver_statement_entries
)
select
  o.total_income,
  e.total_expenses,
  c.cod_collected,
  greatest(o.cod_total - c.cod_collected, 0)::numeric(12,2) as cod_pending,
  c.cod_reconciled,
  o.cod_total,
  m.merchant_payable,
  d.driver_payable,
  (o.total_income - e.total_expenses + a.adjustments_net)::numeric(12,2) as net_estimate,
  case when o.total_orders > 0 then round(o.total_income / o.total_orders, 2) else 0 end::numeric(12,2) as average_order_revenue,
  o.total_orders,
  o.active_orders,
  o.delivered_orders,
  o.cancelled_orders,
  o.returned_orders
from order_stats o
cross join expense_stats e
cross join cod_stats c
cross join adjustment_stats a
cross join merchant_stats m
cross join driver_stats d;

create or replace function public.get_finance_summary()
returns setof public.finance_summary
language sql
security definer
set search_path = public
stable
as $$
  select * from public.finance_summary where public.is_admin_or_support();
$$;

create or replace function public.admin_create_expense(p_expense jsonb)
returns public.admin_expenses
language plpgsql
security definer
set search_path = public
as $$
declare r public.admin_expenses;
begin
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;
  insert into public.admin_expenses(expense_date, category, amount, vat_amount, payment_method, status, reference_number, receipt_url, notes, created_by)
  values (
    coalesce((p_expense->>'expense_date')::date, current_date),
    coalesce(nullif(p_expense->>'category',''), 'other'),
    coalesce((p_expense->>'amount')::numeric, 0),
    coalesce((p_expense->>'vat_amount')::numeric, 0),
    coalesce(nullif(p_expense->>'payment_method',''), 'cash'),
    coalesce(nullif(p_expense->>'status',''), 'draft'),
    nullif(p_expense->>'reference_number',''),
    coalesce(nullif(p_expense->>'receipt_url',''), nullif(p_expense->>'attachment_url','')),
    nullif(p_expense->>'notes',''),
    auth.uid()
  ) returning * into r;
  insert into public.admin_audit_events(entity_type, entity_id, action, after_data, actor_id)
  values ('admin_expense', r.id::text, 'create', to_jsonb(r), auth.uid());
  return r;
end;
$$;

create or replace function public.admin_create_adjustment(p_adjustment jsonb)
returns public.admin_adjustments
language plpgsql
security definer
set search_path = public
as $$
declare r public.admin_adjustments;
begin
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;
  insert into public.admin_adjustments(adjustment_type, direction, amount, order_id, merchant_id, driver_id, reason, notes, status, created_by)
  values (
    coalesce(nullif(p_adjustment->>'adjustment_type',''), 'manual'),
    coalesce(nullif(p_adjustment->>'direction',''), 'positive'),
    coalesce((p_adjustment->>'amount')::numeric, 0),
    nullif(p_adjustment->>'order_id','')::uuid,
    nullif(p_adjustment->>'merchant_id','')::uuid,
    nullif(p_adjustment->>'driver_id','')::uuid,
    coalesce(nullif(p_adjustment->>'reason',''), 'Manual adjustment'),
    nullif(p_adjustment->>'notes',''),
    coalesce(nullif(p_adjustment->>'status',''), 'draft'),
    auth.uid()
  ) returning * into r;
  insert into public.admin_audit_events(entity_type, entity_id, action, after_data, actor_id)
  values ('admin_adjustment', r.id::text, 'create', to_jsonb(r), auth.uid());
  return r;
end;
$$;

create or replace function public.admin_create_audit_event(p_event jsonb)
returns public.admin_audit_events
language plpgsql
security definer
set search_path = public
as $$
declare r public.admin_audit_events;
begin
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;
  insert into public.admin_audit_events(entity_type, entity_id, action, before_data, after_data, metadata, actor_id)
  values (
    coalesce(nullif(p_event->>'entity_type',''), 'admin'),
    nullif(p_event->>'entity_id',''),
    coalesce(nullif(p_event->>'action',''), 'event'),
    p_event->'before_data',
    p_event->'after_data',
    p_event->'metadata',
    auth.uid()
  ) returning * into r;
  return r;
end;
$$;

create or replace function public.admin_sync_order_operation_rows()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare synced_cod integer := 0; synced_merchants integer := 0; synced_drivers integer := 0;
begin
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;

  insert into public.cod_collections(order_id, tracking_number, merchant_id, driver_id, cod_amount, collected_amount, collection_date, status, notes, created_by)
  select o.id, coalesce(o.tracking_number, o.invoice_number, o.coupon_number), o.merchant_id, nullif(coalesce((o::jsonb->>'driver_id'), (o::jsonb->>'assigned_driver_id')), '')::uuid,
         coalesce(o.cod_amount,0), case when lower(coalesce(o.status::text,'')) in ('delivered','completed') then coalesce(o.cod_amount,0) else 0 end,
         coalesce(o.created_at::date, current_date), case when lower(coalesce(o.status::text,'')) in ('delivered','completed') then 'collected' else 'pending' end,
         'Synced from production orders', auth.uid()
  from public.orders o
  where coalesce(o.cod_amount,0) > 0
  on conflict (order_id) where order_id is not null do update set
    tracking_number = excluded.tracking_number,
    merchant_id = excluded.merchant_id,
    driver_id = excluded.driver_id,
    cod_amount = excluded.cod_amount,
    collected_amount = greatest(public.cod_collections.collected_amount, excluded.collected_amount),
    updated_at = now();
  get diagnostics synced_cod = row_count;

  insert into public.merchant_statement_entries(merchant_id, order_id, tracking_number, entry_date, entry_type, debit, credit, balance, status, notes, created_by)
  select o.merchant_id, o.id, coalesce(o.tracking_number, o.invoice_number, o.coupon_number), coalesce(o.created_at::date, current_date), 'delivery_fee',
         coalesce(o.delivery_price, o.base_price, o.price, 0), coalesce(o.cod_amount,0), coalesce(o.cod_amount,0) - coalesce(o.delivery_price, o.base_price, o.price, 0),
         'posted', 'Synced from production orders', auth.uid()
  from public.orders o
  where o.merchant_id is not null
  on conflict (order_id, entry_type) where order_id is not null do update set
    debit = excluded.debit,
    credit = excluded.credit,
    balance = excluded.balance,
    updated_at = now();
  get diagnostics synced_merchants = row_count;

  insert into public.driver_statement_entries(driver_id, order_id, tracking_number, entry_date, entry_type, debit, credit, balance, status, notes, created_by)
  select nullif(coalesce((o::jsonb->>'driver_id'), (o::jsonb->>'assigned_driver_id')), '')::uuid, o.id, coalesce(o.tracking_number, o.invoice_number, o.coupon_number), coalesce(o.created_at::date, current_date), 'driver_delivery',
         case when coalesce(o.cod_amount,0) > 0 then coalesce(o.cod_amount,0) else 0 end,
         case when lower(coalesce(o.status::text,'')) in ('delivered','completed') then least(coalesce(o.delivery_price, o.base_price, o.price, 0), 10) else 0 end,
         case when lower(coalesce(o.status::text,'')) in ('delivered','completed') then least(coalesce(o.delivery_price, o.base_price, o.price, 0), 10) - coalesce(o.cod_amount,0) else -coalesce(o.cod_amount,0) end,
         'posted', 'Synced from production orders', auth.uid()
  from public.orders o
  where nullif(coalesce((o::jsonb->>'driver_id'), (o::jsonb->>'assigned_driver_id')), '') is not null
  on conflict (order_id, entry_type) where order_id is not null do update set
    debit = excluded.debit,
    credit = excluded.credit,
    balance = excluded.balance,
    updated_at = now();
  get diagnostics synced_drivers = row_count;

  insert into public.admin_audit_events(entity_type, action, metadata, actor_id)
  values ('finance_sync', 'admin_sync_order_operation_rows', jsonb_build_object('cod', synced_cod, 'merchant_entries', synced_merchants, 'driver_entries', synced_drivers), auth.uid());

  return jsonb_build_object('ok', true, 'cod', synced_cod, 'merchant_entries', synced_merchants, 'driver_entries', synced_drivers);
end;
$$;

revoke all on public.finance_summary from anon;
grant select on public.finance_summary to authenticated;
grant execute on function public.get_finance_summary() to authenticated;
grant execute on function public.admin_create_expense(jsonb) to authenticated;
grant execute on function public.admin_create_adjustment(jsonb) to authenticated;
grant execute on function public.admin_create_audit_event(jsonb) to authenticated;
grant execute on function public.admin_sync_order_operation_rows() to authenticated;
grant select, insert, update on public.admin_expenses, public.admin_adjustments, public.cod_collections, public.merchant_statement_entries, public.driver_statement_entries to authenticated;
grant select, insert on public.admin_audit_events to authenticated;
