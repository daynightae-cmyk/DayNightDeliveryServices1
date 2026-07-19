-- DAY NIGHT DELIVERY SERVICES
-- Production finance hardening: authoritative expenses, adjustments, budgets,
-- daily closing, finance snapshots, health checks, RLS, audit, and account posting.
-- Idempotent. Does not delete business data and does not create demo rows.

begin;

create extension if not exists pgcrypto;

create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text,
  action text not null,
  actor_id uuid references auth.users(id),
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null default 'other',
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null default 'cash',
  reference_number text,
  notes text,
  attachment_url text,
  status text not null default 'draft' check (status in ('draft','approved','void')),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_adjustments (
  id uuid primary key default gen_random_uuid(),
  adjustment_type text not null default 'manual',
  direction text not null check (direction in ('positive','negative')),
  amount numeric(14,2) not null check (amount > 0),
  reference_number text,
  order_id text,
  merchant_id uuid,
  driver_id uuid,
  reason text not null,
  notes text,
  status text not null default 'draft' check (status in ('draft','approved','void')),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_finance_budgets (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  category text not null default 'operations',
  allocated_amount numeric(14,2) not null default 0 check (allocated_amount >= 0),
  notes text,
  status text not null default 'active' check (status in ('active','closed','void')),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_finance_budgets_period_valid check (period_end >= period_start),
  constraint admin_finance_budgets_unique unique (period_start, period_end, category)
);

create table if not exists public.admin_daily_closings (
  id uuid primary key default gen_random_uuid(),
  closing_date date not null unique,
  total_orders integer not null default 0,
  delivered_orders integer not null default 0,
  cancelled_orders integer not null default 0,
  returned_orders integer not null default 0,
  goods_value numeric(14,2) not null default 0,
  delivery_income numeric(14,2) not null default 0,
  discounts_total numeric(14,2) not null default 0,
  customer_total numeric(14,2) not null default 0,
  merchant_due numeric(14,2) not null default 0,
  cod_total numeric(14,2) not null default 0,
  cod_collected numeric(14,2) not null default 0,
  cod_pending numeric(14,2) not null default 0,
  cod_reconciled numeric(14,2) not null default 0,
  expenses_total numeric(14,2) not null default 0,
  adjustments_net numeric(14,2) not null default 0,
  net_total numeric(14,2) not null default 0,
  budget_allocated numeric(14,2) not null default 0,
  budget_remaining numeric(14,2) not null default 0,
  unassigned_orders integer not null default 0,
  pending_review_orders integer not null default 0,
  unreconciled_cod numeric(14,2) not null default 0,
  unposted_delivered_orders integer not null default 0,
  print_jobs_pending integer not null default 0,
  status text not null default 'draft' check (status in ('draft','needs_review','closed','reopened')),
  source text not null default 'rpc',
  notes text,
  snapshot jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibility columns for databases where older versions of these tables already exist.
alter table public.admin_expenses add column if not exists expense_date date default current_date;
alter table public.admin_expenses add column if not exists category text default 'other';
alter table public.admin_expenses add column if not exists amount numeric(14,2) default 0;
alter table public.admin_expenses add column if not exists payment_method text default 'cash';
alter table public.admin_expenses add column if not exists reference_number text;
alter table public.admin_expenses add column if not exists notes text;
alter table public.admin_expenses add column if not exists attachment_url text;
alter table public.admin_expenses add column if not exists status text default 'draft';
alter table public.admin_expenses add column if not exists approved_at timestamptz;
alter table public.admin_expenses add column if not exists approved_by uuid references auth.users(id);
alter table public.admin_expenses add column if not exists voided_at timestamptz;
alter table public.admin_expenses add column if not exists voided_by uuid references auth.users(id);
alter table public.admin_expenses add column if not exists void_reason text;
alter table public.admin_expenses add column if not exists created_by uuid references auth.users(id);
alter table public.admin_expenses add column if not exists created_at timestamptz default now();
alter table public.admin_expenses add column if not exists updated_at timestamptz default now();

alter table public.admin_adjustments add column if not exists adjustment_type text default 'manual';
alter table public.admin_adjustments add column if not exists direction text default 'positive';
alter table public.admin_adjustments add column if not exists amount numeric(14,2) default 0;
alter table public.admin_adjustments add column if not exists reference_number text;
alter table public.admin_adjustments add column if not exists order_id text;
alter table public.admin_adjustments add column if not exists merchant_id uuid;
alter table public.admin_adjustments add column if not exists driver_id uuid;
alter table public.admin_adjustments add column if not exists reason text;
alter table public.admin_adjustments add column if not exists notes text;
alter table public.admin_adjustments add column if not exists status text default 'draft';
alter table public.admin_adjustments add column if not exists approved_at timestamptz;
alter table public.admin_adjustments add column if not exists approved_by uuid references auth.users(id);
alter table public.admin_adjustments add column if not exists voided_at timestamptz;
alter table public.admin_adjustments add column if not exists voided_by uuid references auth.users(id);
alter table public.admin_adjustments add column if not exists void_reason text;
alter table public.admin_adjustments add column if not exists created_by uuid references auth.users(id);
alter table public.admin_adjustments add column if not exists created_at timestamptz default now();
alter table public.admin_adjustments add column if not exists updated_at timestamptz default now();

alter table public.admin_daily_closings add column if not exists goods_value numeric(14,2) default 0;
alter table public.admin_daily_closings add column if not exists discounts_total numeric(14,2) default 0;
alter table public.admin_daily_closings add column if not exists customer_total numeric(14,2) default 0;
alter table public.admin_daily_closings add column if not exists merchant_due numeric(14,2) default 0;
alter table public.admin_daily_closings add column if not exists budget_allocated numeric(14,2) default 0;
alter table public.admin_daily_closings add column if not exists budget_remaining numeric(14,2) default 0;
alter table public.admin_daily_closings add column if not exists unposted_delivered_orders integer default 0;
alter table public.admin_daily_closings add column if not exists reviewed_at timestamptz;
alter table public.admin_daily_closings add column if not exists reviewed_by uuid references auth.users(id);

create index if not exists idx_admin_expenses_date_status on public.admin_expenses(expense_date desc, status);
create index if not exists idx_admin_expenses_category on public.admin_expenses(category, expense_date desc);
create index if not exists idx_admin_adjustments_status_created on public.admin_adjustments(status, created_at desc);
create index if not exists idx_admin_budgets_period on public.admin_finance_budgets(period_start, period_end, category);
create index if not exists idx_admin_daily_closings_date on public.admin_daily_closings(closing_date desc);
create index if not exists idx_admin_audit_events_created on public.admin_audit_events(created_at desc);
create index if not exists idx_admin_audit_events_entity on public.admin_audit_events(entity_type, entity_id);

alter table public.admin_expenses enable row level security;
alter table public.admin_adjustments enable row level security;
alter table public.admin_finance_budgets enable row level security;
alter table public.admin_daily_closings enable row level security;
alter table public.admin_audit_events enable row level security;

-- Admin/support only: finance operations are never writable by anon or merchant sessions.
do $$
declare
  t text;
begin
  foreach t in array array['admin_expenses','admin_adjustments','admin_finance_budgets','admin_daily_closings','admin_audit_events'] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_admin_or_support())', t || '_admin_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_admin_or_support())', t || '_admin_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_admin_or_support()) with check (public.is_admin_or_support())', t || '_admin_update', t);
  end loop;
end $$;

create or replace function public.daynight_admin_finance_audit(
  p_entity_type text,
  p_entity_id text,
  p_action text,
  p_before jsonb default null,
  p_after jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;
  insert into public.admin_audit_events(entity_type, entity_id, action, actor_id, before_data, after_data, metadata)
  values (p_entity_type, p_entity_id, p_action, auth.uid(), p_before, p_after, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

drop function if exists public.admin_create_expense(jsonb);
create function public.admin_create_expense(p_expense jsonb)
returns public.admin_expenses
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  r public.admin_expenses;
  v_amount numeric := public.daynight_financial_number(p_expense ->> 'amount', 0);
begin
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;
  if coalesce((p_expense ->> '_health_check')::boolean, false) then return null; end if;
  if v_amount <= 0 then raise exception 'expense_amount_required'; end if;

  insert into public.admin_expenses(
    expense_date, category, amount, payment_method, reference_number,
    notes, attachment_url, status, created_by, created_at, updated_at
  ) values (
    coalesce(nullif(p_expense ->> 'expense_date','')::date, current_date),
    coalesce(nullif(btrim(p_expense ->> 'category'),''), 'other'),
    round(v_amount, 2),
    coalesce(nullif(btrim(p_expense ->> 'payment_method'),''), 'cash'),
    nullif(btrim(p_expense ->> 'reference_number'),''),
    nullif(btrim(p_expense ->> 'notes'),''),
    coalesce(nullif(btrim(p_expense ->> 'attachment_url'),''), nullif(btrim(p_expense ->> 'receipt_url'),'')),
    'draft', auth.uid(), now(), now()
  ) returning * into r;

  perform public.daynight_admin_finance_audit('admin_expense', r.id::text, 'create', null, to_jsonb(r));
  return r;
end;
$$;

create or replace function public.admin_set_expense_status(p_expense_id uuid, p_status text, p_reason text default null)
returns public.admin_expenses
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  r public.admin_expenses;
  before_row public.admin_expenses;
  v_status text := lower(btrim(coalesce(p_status,'')));
begin
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;
  if v_status not in ('approved','void') then raise exception 'invalid_expense_status'; end if;

  select * into before_row from public.admin_expenses where id = p_expense_id for update;
  if before_row.id is null then raise exception 'expense_not_found'; end if;

  update public.admin_expenses
  set status = v_status,
      approved_at = case when v_status = 'approved' then coalesce(approved_at, now()) else approved_at end,
      approved_by = case when v_status = 'approved' then coalesce(approved_by, auth.uid()) else approved_by end,
      voided_at = case when v_status = 'void' then coalesce(voided_at, now()) else null end,
      voided_by = case when v_status = 'void' then auth.uid() else null end,
      void_reason = case when v_status = 'void' then coalesce(nullif(btrim(p_reason),''), 'Voided by admin') else null end,
      updated_at = now()
  where id = p_expense_id
  returning * into r;

  if v_status = 'approved' then
    insert into public.financial_account_entries(
      order_id, order_reference, merchant_id, account_type, entry_type,
      direction, amount, currency, notes, posted_at
    ) values (
      'expense:' || r.id::text,
      coalesce(nullif(r.reference_number,''), 'EXP-' || upper(substr(r.id::text,1,8))),
      null, 'company', 'approved_expense', 'debit', r.amount, 'AED',
      coalesce(r.notes, 'Approved operating expense'), coalesce(r.approved_at, now())
    ) on conflict (order_id, account_type, entry_type)
      do update set amount = excluded.amount, notes = excluded.notes, posted_at = excluded.posted_at;
  elsif before_row.status = 'approved' then
    insert into public.financial_account_entries(
      order_id, order_reference, merchant_id, account_type, entry_type,
      direction, amount, currency, notes, posted_at
    ) values (
      'expense:' || r.id::text,
      coalesce(nullif(r.reference_number,''), 'EXP-' || upper(substr(r.id::text,1,8))),
      null, 'company', 'void_expense_reversal', 'credit', r.amount, 'AED',
      coalesce(r.void_reason, 'Voided approved expense'), now()
    ) on conflict (order_id, account_type, entry_type) do nothing;
  end if;

  perform public.daynight_admin_finance_audit('admin_expense', r.id::text, v_status, to_jsonb(before_row), to_jsonb(r), jsonb_build_object('reason', p_reason));
  return r;
end;
$$;

drop function if exists public.admin_create_adjustment(jsonb);
create function public.admin_create_adjustment(p_adjustment jsonb)
returns public.admin_adjustments
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  r public.admin_adjustments;
  v_amount numeric := public.daynight_financial_number(p_adjustment ->> 'amount', 0);
  v_direction text := lower(coalesce(nullif(btrim(p_adjustment ->> 'direction'),''), 'positive'));
begin
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;
  if coalesce((p_adjustment ->> '_health_check')::boolean, false) then return null; end if;
  if v_amount <= 0 then raise exception 'adjustment_amount_required'; end if;
  if v_direction not in ('positive','negative') then raise exception 'invalid_adjustment_direction'; end if;
  if nullif(btrim(p_adjustment ->> 'reason'),'') is null then raise exception 'adjustment_reason_required'; end if;

  insert into public.admin_adjustments(
    adjustment_type, direction, amount, reference_number, order_id,
    merchant_id, driver_id, reason, notes, status, created_by, created_at, updated_at
  ) values (
    coalesce(nullif(btrim(p_adjustment ->> 'adjustment_type'),''), 'manual'),
    v_direction, round(v_amount,2), nullif(btrim(p_adjustment ->> 'reference_number'),''),
    nullif(btrim(p_adjustment ->> 'order_id'),''),
    public.admin_safe_uuid(p_adjustment ->> 'merchant_id'),
    public.admin_safe_uuid(p_adjustment ->> 'driver_id'),
    btrim(p_adjustment ->> 'reason'), nullif(btrim(p_adjustment ->> 'notes'),''),
    'draft', auth.uid(), now(), now()
  ) returning * into r;

  perform public.daynight_admin_finance_audit('admin_adjustment', r.id::text, 'create', null, to_jsonb(r));
  return r;
end;
$$;

create or replace function public.admin_set_adjustment_status(p_adjustment_id uuid, p_status text, p_reason text default null)
returns public.admin_adjustments
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  r public.admin_adjustments;
  before_row public.admin_adjustments;
  v_status text := lower(btrim(coalesce(p_status,'')));
  v_direction text;
begin
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;
  if v_status not in ('approved','void') then raise exception 'invalid_adjustment_status'; end if;

  select * into before_row from public.admin_adjustments where id = p_adjustment_id for update;
  if before_row.id is null then raise exception 'adjustment_not_found'; end if;

  update public.admin_adjustments
  set status = v_status,
      approved_at = case when v_status = 'approved' then coalesce(approved_at, now()) else approved_at end,
      approved_by = case when v_status = 'approved' then coalesce(approved_by, auth.uid()) else approved_by end,
      voided_at = case when v_status = 'void' then coalesce(voided_at, now()) else null end,
      voided_by = case when v_status = 'void' then auth.uid() else null end,
      void_reason = case when v_status = 'void' then coalesce(nullif(btrim(p_reason),''), 'Voided by admin') else null end,
      updated_at = now()
  where id = p_adjustment_id
  returning * into r;

  if v_status = 'approved' then
    v_direction := case when r.direction = 'negative' then 'debit' else 'credit' end;
    insert into public.financial_account_entries(
      order_id, order_reference, merchant_id, account_type, entry_type,
      direction, amount, currency, notes, posted_at
    ) values (
      'adjustment:' || r.id::text,
      coalesce(nullif(r.reference_number,''), 'ADJ-' || upper(substr(r.id::text,1,8))),
      r.merchant_id, 'company', 'approved_adjustment', v_direction, r.amount, 'AED',
      coalesce(r.reason, 'Approved financial adjustment'), coalesce(r.approved_at, now())
    ) on conflict (order_id, account_type, entry_type)
      do update set direction = excluded.direction, amount = excluded.amount, notes = excluded.notes, posted_at = excluded.posted_at;
  elsif before_row.status = 'approved' then
    v_direction := case when before_row.direction = 'negative' then 'credit' else 'debit' end;
    insert into public.financial_account_entries(
      order_id, order_reference, merchant_id, account_type, entry_type,
      direction, amount, currency, notes, posted_at
    ) values (
      'adjustment:' || r.id::text,
      coalesce(nullif(r.reference_number,''), 'ADJ-' || upper(substr(r.id::text,1,8))),
      r.merchant_id, 'company', 'void_adjustment_reversal', v_direction, r.amount, 'AED',
      coalesce(r.void_reason, 'Voided approved adjustment'), now()
    ) on conflict (order_id, account_type, entry_type) do nothing;
  end if;

  perform public.daynight_admin_finance_audit('admin_adjustment', r.id::text, v_status, to_jsonb(before_row), to_jsonb(r), jsonb_build_object('reason', p_reason));
  return r;
end;
$$;

create or replace function public.admin_upsert_finance_budget(p_budget jsonb)
returns public.admin_finance_budgets
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  r public.admin_finance_budgets;
  v_start date := nullif(p_budget ->> 'period_start','')::date;
  v_end date := nullif(p_budget ->> 'period_end','')::date;
  v_category text := coalesce(nullif(btrim(p_budget ->> 'category'),''), 'operations');
  v_amount numeric := public.daynight_financial_number(p_budget ->> 'allocated_amount', 0);
begin
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;
  if v_start is null or v_end is null or v_end < v_start then raise exception 'invalid_budget_period'; end if;
  if v_amount < 0 then raise exception 'invalid_budget_amount'; end if;

  insert into public.admin_finance_budgets(period_start, period_end, category, allocated_amount, notes, status, created_by, updated_by)
  values (v_start, v_end, v_category, round(v_amount,2), nullif(btrim(p_budget ->> 'notes'),''), 'active', auth.uid(), auth.uid())
  on conflict (period_start, period_end, category)
  do update set allocated_amount = excluded.allocated_amount, notes = excluded.notes, status = 'active', updated_by = auth.uid(), updated_at = now()
  returning * into r;

  perform public.daynight_admin_finance_audit('admin_finance_budget', r.id::text, 'upsert', null, to_jsonb(r));
  return r;
end;
$$;

create or replace view public.admin_finance_budget_status
with (security_invoker = true)
as
select
  b.*,
  coalesce(x.spent_amount, 0)::numeric(14,2) as spent_amount,
  (b.allocated_amount - coalesce(x.spent_amount, 0))::numeric(14,2) as remaining_amount,
  case when b.allocated_amount > 0 then round((coalesce(x.spent_amount,0) / b.allocated_amount) * 100, 2) else 0 end as utilization_percent
from public.admin_finance_budgets b
left join lateral (
  select sum(e.amount) as spent_amount
  from public.admin_expenses e
  where e.status = 'approved'
    and e.expense_date between b.period_start and b.period_end
    and (b.category = 'operations' or e.category = b.category)
) x on true
where b.status <> 'void';

grant select on public.admin_finance_budget_status to authenticated;

create or replace function public.admin_finance_operations_snapshot(p_date_from date default date_trunc('month', current_date)::date, p_date_to date default current_date)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth, pg_temp
as $$
declare
  v_from date := coalesce(p_date_from, date_trunc('month', current_date)::date);
  v_to date := coalesce(p_date_to, current_date);
  v_settlements jsonb := '[]'::jsonb;
  v_accounts jsonb := '[]'::jsonb;
  v_expenses jsonb := '[]'::jsonb;
  v_adjustments jsonb := '[]'::jsonb;
  v_budgets jsonb := '[]'::jsonb;
  v_audit jsonb := '[]'::jsonb;
  v_summary jsonb;
begin
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;
  if v_to < v_from then raise exception 'invalid_date_range'; end if;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.posted_at desc), '[]'::jsonb)
    into v_settlements
  from public.order_financial_settlements s
  where s.posted_at::date between v_from and v_to;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.posted_at desc), '[]'::jsonb)
    into v_accounts
  from public.financial_account_entries a
  where a.posted_at::date between v_from and v_to;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.expense_date desc, e.created_at desc), '[]'::jsonb)
    into v_expenses
  from public.admin_expenses e
  where e.expense_date between v_from and v_to;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb)
    into v_adjustments
  from public.admin_adjustments a
  where a.created_at::date between v_from and v_to;

  select coalesce(jsonb_agg(to_jsonb(b) order by b.period_start desc, b.category), '[]'::jsonb)
    into v_budgets
  from public.admin_finance_budget_status b
  where b.period_start <= v_to and b.period_end >= v_from;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb)
    into v_audit
  from (
    select * from public.admin_audit_events
    where created_at::date between v_from and v_to
    order by created_at desc
    limit 500
  ) a;

  select jsonb_build_object(
    'orders_total', (select count(*) from public.orders o where o.created_at::date between v_from and v_to),
    'delivered_orders', (select count(*) from public.orders o where lower(replace(coalesce(o.status::text,''),'-','_')) in ('delivered','completed','complete') and coalesce(o.financial_posted_at,o.updated_at,o.created_at)::date between v_from and v_to),
    'financially_posted_orders', (select count(*) from public.order_financial_settlements s where s.posted_at::date between v_from and v_to),
    'unposted_delivered_orders', (select count(*) from public.orders o where lower(replace(coalesce(o.status::text,''),'-','_')) in ('delivered','completed','complete') and o.financial_posted_at is null),
    'goods_value', coalesce((select sum(s.goods_value) from public.order_financial_settlements s where s.posted_at::date between v_from and v_to),0),
    'delivery_revenue', coalesce((select sum(s.company_revenue) from public.order_financial_settlements s where s.posted_at::date between v_from and v_to),0),
    'discounts', coalesce((select sum(s.discount_amount) from public.order_financial_settlements s where s.posted_at::date between v_from and v_to),0),
    'customer_total', coalesce((select sum(s.customer_total) from public.order_financial_settlements s where s.posted_at::date between v_from and v_to),0),
    'collected_amount', coalesce((select sum(s.collected_amount) from public.order_financial_settlements s where s.posted_at::date between v_from and v_to),0),
    'pending_collection', greatest(coalesce((select sum(s.customer_total - s.collected_amount) from public.order_financial_settlements s where s.posted_at::date between v_from and v_to),0),0),
    'merchant_due', coalesce((select sum(s.merchant_due) from public.order_financial_settlements s where s.posted_at::date between v_from and v_to),0),
    'approved_expenses', coalesce((select sum(e.amount) from public.admin_expenses e where e.status='approved' and e.expense_date between v_from and v_to),0),
    'draft_expenses', coalesce((select sum(e.amount) from public.admin_expenses e where e.status='draft' and e.expense_date between v_from and v_to),0),
    'adjustments_net', coalesce((select sum(case when a.direction='negative' then -a.amount else a.amount end) from public.admin_adjustments a where a.status='approved' and a.created_at::date between v_from and v_to),0),
    'operating_net',
      coalesce((select sum(s.company_revenue) from public.order_financial_settlements s where s.posted_at::date between v_from and v_to),0)
      - coalesce((select sum(e.amount) from public.admin_expenses e where e.status='approved' and e.expense_date between v_from and v_to),0)
      + coalesce((select sum(case when a.direction='negative' then -a.amount else a.amount end) from public.admin_adjustments a where a.status='approved' and a.created_at::date between v_from and v_to),0),
    'budget_allocated', coalesce((select sum(b.allocated_amount) from public.admin_finance_budget_status b where b.period_start <= v_to and b.period_end >= v_from),0),
    'budget_spent', coalesce((select sum(b.spent_amount) from public.admin_finance_budget_status b where b.period_start <= v_to and b.period_end >= v_from),0),
    'budget_remaining', coalesce((select sum(b.remaining_amount) from public.admin_finance_budget_status b where b.period_start <= v_to and b.period_end >= v_from),0)
  ) into v_summary;

  return jsonb_build_object(
    'ok', true,
    'source', 'rpc',
    'generated_at', now(),
    'period', jsonb_build_object('from', v_from, 'to', v_to),
    'summary', v_summary,
    'settlements', v_settlements,
    'account_entries', v_accounts,
    'expenses', v_expenses,
    'adjustments', v_adjustments,
    'budgets', v_budgets,
    'driver_entries', '[]'::jsonb,
    'audit_events', v_audit
  );
end;
$$;

create or replace function public.admin_daily_closing_snapshot(p_date date default current_date)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth, pg_temp
as $$
declare
  d date := coalesce(p_date, current_date);
  r jsonb;
begin
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;

  select jsonb_build_object(
    'closing_date', d,
    'total_orders', (select count(*) from public.orders o where o.created_at::date = d),
    'delivered_orders', (select count(*) from public.order_financial_settlements s where s.posted_at::date = d),
    'cancelled_orders', (select count(*) from public.orders o where o.created_at::date = d and lower(replace(coalesce(o.status::text,''),'-','_')) in ('cancelled','canceled','failed')),
    'returned_orders', (select count(*) from public.orders o where o.created_at::date = d and lower(replace(coalesce(o.status::text,''),'-','_')) = 'returned'),
    'goods_value', coalesce((select sum(s.goods_value) from public.order_financial_settlements s where s.posted_at::date = d),0),
    'delivery_income', coalesce((select sum(s.company_revenue) from public.order_financial_settlements s where s.posted_at::date = d),0),
    'discounts_total', coalesce((select sum(s.discount_amount) from public.order_financial_settlements s where s.posted_at::date = d),0),
    'customer_total', coalesce((select sum(s.customer_total) from public.order_financial_settlements s where s.posted_at::date = d),0),
    'merchant_due', coalesce((select sum(s.merchant_due) from public.order_financial_settlements s where s.posted_at::date = d),0),
    'cod_total', coalesce((select sum(s.customer_total) from public.order_financial_settlements s where s.posted_at::date = d),0),
    'cod_collected', coalesce((select sum(s.collected_amount) from public.order_financial_settlements s where s.posted_at::date = d),0),
    'cod_pending', greatest(coalesce((select sum(s.customer_total - s.collected_amount) from public.order_financial_settlements s where s.posted_at::date = d),0),0),
    'cod_reconciled', coalesce((select sum(s.collected_amount) from public.order_financial_settlements s where s.posted_at::date = d),0),
    'expenses_total', coalesce((select sum(e.amount) from public.admin_expenses e where e.status='approved' and e.expense_date = d),0),
    'adjustments_net', coalesce((select sum(case when a.direction='negative' then -a.amount else a.amount end) from public.admin_adjustments a where a.status='approved' and a.created_at::date = d),0),
    'net_total',
      coalesce((select sum(s.company_revenue) from public.order_financial_settlements s where s.posted_at::date = d),0)
      - coalesce((select sum(e.amount) from public.admin_expenses e where e.status='approved' and e.expense_date = d),0)
      + coalesce((select sum(case when a.direction='negative' then -a.amount else a.amount end) from public.admin_adjustments a where a.status='approved' and a.created_at::date = d),0),
    'budget_allocated', coalesce((select sum(b.allocated_amount) from public.admin_finance_budget_status b where d between b.period_start and b.period_end),0),
    'budget_remaining', coalesce((select sum(b.remaining_amount) from public.admin_finance_budget_status b where d between b.period_start and b.period_end),0),
    'unassigned_orders', (select count(*) from public.orders o where o.created_at::date = d and coalesce(o.driver_name,'')='' and coalesce((to_jsonb(o)->>'driver_id'),'')='' and coalesce((to_jsonb(o)->>'assigned_driver_id'),'')=''),
    'pending_review_orders', (select count(*) from public.orders o where o.created_at::date = d and lower(replace(coalesce(o.status::text,''),'-','_')) in ('pending','review','under_review','confirmed')),
    'unreconciled_cod', greatest(coalesce((select sum(s.customer_total - s.collected_amount) from public.order_financial_settlements s where s.posted_at::date = d),0),0),
    'unposted_delivered_orders', (select count(*) from public.orders o where lower(replace(coalesce(o.status::text,''),'-','_')) in ('delivered','completed','complete') and o.financial_posted_at is null),
    'print_jobs_pending', case when to_regclass('public.print_jobs') is null then 0 else 0 end,
    'status', case
      when (select count(*) from public.orders o where lower(replace(coalesce(o.status::text,''),'-','_')) in ('delivered','completed','complete') and o.financial_posted_at is null) > 0 then 'needs_review'
      when greatest(coalesce((select sum(s.customer_total - s.collected_amount) from public.order_financial_settlements s where s.posted_at::date = d),0),0) > 0 then 'needs_review'
      else 'draft'
    end,
    'source', 'rpc',
    'generated_at', now()
  ) into r;
  return r;
end;
$$;

drop function if exists public.admin_save_daily_closing(jsonb);
create function public.admin_save_daily_closing(p_snapshot jsonb)
returns public.admin_daily_closings
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  r public.admin_daily_closings;
  d date := coalesce(nullif(p_snapshot ->> 'closing_date','')::date, current_date);
  live jsonb;
begin
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;
  if coalesce((p_snapshot ->> '_health_check')::boolean, false) then return null; end if;
  live := public.admin_daily_closing_snapshot(d);

  insert into public.admin_daily_closings(
    closing_date, total_orders, delivered_orders, cancelled_orders, returned_orders,
    goods_value, delivery_income, discounts_total, customer_total, merchant_due,
    cod_total, cod_collected, cod_pending, cod_reconciled, expenses_total,
    adjustments_net, net_total, budget_allocated, budget_remaining,
    unassigned_orders, pending_review_orders, unreconciled_cod,
    unposted_delivered_orders, print_jobs_pending, status, source, notes,
    snapshot, reviewed_at, reviewed_by, created_by, updated_at
  ) values (
    d,
    (live->>'total_orders')::integer, (live->>'delivered_orders')::integer,
    (live->>'cancelled_orders')::integer, (live->>'returned_orders')::integer,
    (live->>'goods_value')::numeric, (live->>'delivery_income')::numeric,
    (live->>'discounts_total')::numeric, (live->>'customer_total')::numeric,
    (live->>'merchant_due')::numeric, (live->>'cod_total')::numeric,
    (live->>'cod_collected')::numeric, (live->>'cod_pending')::numeric,
    (live->>'cod_reconciled')::numeric, (live->>'expenses_total')::numeric,
    (live->>'adjustments_net')::numeric, (live->>'net_total')::numeric,
    (live->>'budget_allocated')::numeric, (live->>'budget_remaining')::numeric,
    (live->>'unassigned_orders')::integer, (live->>'pending_review_orders')::integer,
    (live->>'unreconciled_cod')::numeric, (live->>'unposted_delivered_orders')::integer,
    (live->>'print_jobs_pending')::integer,
    coalesce(nullif(p_snapshot->>'status',''), live->>'status'), 'rpc',
    nullif(btrim(p_snapshot->>'notes'),''), live,
    case when coalesce(nullif(p_snapshot->>'status',''),'')='closed' then now() else null end,
    case when coalesce(nullif(p_snapshot->>'status',''),'')='closed' then auth.uid() else null end,
    auth.uid(), now()
  )
  on conflict (closing_date) do update set
    total_orders=excluded.total_orders, delivered_orders=excluded.delivered_orders,
    cancelled_orders=excluded.cancelled_orders, returned_orders=excluded.returned_orders,
    goods_value=excluded.goods_value, delivery_income=excluded.delivery_income,
    discounts_total=excluded.discounts_total, customer_total=excluded.customer_total,
    merchant_due=excluded.merchant_due, cod_total=excluded.cod_total,
    cod_collected=excluded.cod_collected, cod_pending=excluded.cod_pending,
    cod_reconciled=excluded.cod_reconciled, expenses_total=excluded.expenses_total,
    adjustments_net=excluded.adjustments_net, net_total=excluded.net_total,
    budget_allocated=excluded.budget_allocated, budget_remaining=excluded.budget_remaining,
    unassigned_orders=excluded.unassigned_orders, pending_review_orders=excluded.pending_review_orders,
    unreconciled_cod=excluded.unreconciled_cod, unposted_delivered_orders=excluded.unposted_delivered_orders,
    print_jobs_pending=excluded.print_jobs_pending, status=excluded.status, source='rpc',
    notes=excluded.notes, snapshot=excluded.snapshot,
    reviewed_at=excluded.reviewed_at, reviewed_by=excluded.reviewed_by, updated_at=now()
  returning * into r;

  perform public.daynight_admin_finance_audit('admin_daily_closing', r.id::text, 'save', null, to_jsonb(r));
  return r;
end;
$$;

create or replace function public.admin_finance_hardening_health()
returns jsonb
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'ok',
      public.is_admin_or_support()
      and to_regclass('public.order_financial_settlements') is not null
      and to_regclass('public.financial_account_entries') is not null
      and to_regclass('public.admin_expenses') is not null
      and to_regclass('public.admin_adjustments') is not null
      and to_regclass('public.admin_finance_budgets') is not null
      and to_regclass('public.admin_daily_closings') is not null
      and to_regprocedure('public.admin_finance_operations_snapshot(date,date)') is not null
      and to_regprocedure('public.admin_daily_closing_snapshot(date)') is not null,
    'financial_ledger', public.order_financial_ledger_health(),
    'expenses_total', (select count(*) from public.admin_expenses),
    'expenses_approved', (select count(*) from public.admin_expenses where status='approved'),
    'adjustments_total', (select count(*) from public.admin_adjustments),
    'budgets_total', (select count(*) from public.admin_finance_budgets where status <> 'void'),
    'daily_closings_total', (select count(*) from public.admin_daily_closings),
    'unposted_delivered_orders', (select count(*) from public.orders where lower(replace(coalesce(status::text,''),'-','_')) in ('delivered','completed','complete') and financial_posted_at is null),
    'duplicate_settlements', (select count(*) from (select order_id from public.order_financial_settlements group by order_id having count(*) > 1) x),
    'generated_at', now()
  );
$$;

revoke all on public.admin_expenses, public.admin_adjustments, public.admin_finance_budgets, public.admin_daily_closings, public.admin_audit_events from anon;
grant select, insert, update on public.admin_expenses, public.admin_adjustments, public.admin_finance_budgets, public.admin_daily_closings, public.admin_audit_events to authenticated;

revoke all on function public.daynight_admin_finance_audit(text,text,text,jsonb,jsonb,jsonb) from public, anon;
revoke all on function public.admin_create_expense(jsonb) from public, anon;
revoke all on function public.admin_set_expense_status(uuid,text,text) from public, anon;
revoke all on function public.admin_create_adjustment(jsonb) from public, anon;
revoke all on function public.admin_set_adjustment_status(uuid,text,text) from public, anon;
revoke all on function public.admin_upsert_finance_budget(jsonb) from public, anon;
revoke all on function public.admin_finance_operations_snapshot(date,date) from public, anon;
revoke all on function public.admin_daily_closing_snapshot(date) from public, anon;
revoke all on function public.admin_save_daily_closing(jsonb) from public, anon;
revoke all on function public.admin_finance_hardening_health() from public, anon;

grant execute on function public.admin_create_expense(jsonb) to authenticated;
grant execute on function public.admin_set_expense_status(uuid,text,text) to authenticated;
grant execute on function public.admin_create_adjustment(jsonb) to authenticated;
grant execute on function public.admin_set_adjustment_status(uuid,text,text) to authenticated;
grant execute on function public.admin_upsert_finance_budget(jsonb) to authenticated;
grant execute on function public.admin_finance_operations_snapshot(date,date) to authenticated;
grant execute on function public.admin_daily_closing_snapshot(date) to authenticated;
grant execute on function public.admin_save_daily_closing(jsonb) to authenticated;
grant execute on function public.admin_finance_hardening_health() to authenticated;

notify pgrst, 'reload schema';

commit;
