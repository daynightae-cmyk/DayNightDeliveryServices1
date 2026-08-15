-- DAY NIGHT DELIVERY SERVICES
-- Authoritative daily financial closing v3.
-- Real database snapshot, immutable closed-day view, direct audit, date-scoped risk checks.
-- Idempotent and safe for production; no demo rows and no historical mutation.

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
  amount numeric(14,2) not null default 0,
  payment_method text not null default 'cash',
  reference_number text,
  notes text,
  status text not null default 'draft',
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_adjustments (
  id uuid primary key default gen_random_uuid(),
  adjustment_type text not null default 'manual',
  direction text not null default 'positive',
  amount numeric(14,2) not null default 0,
  reference_number text,
  order_id text,
  merchant_id uuid,
  driver_id uuid,
  reason text,
  notes text,
  status text not null default 'draft',
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_finance_budgets (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  category text not null default 'operations',
  allocated_amount numeric(14,2) not null default 0,
  notes text,
  status text not null default 'active',
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_finance_budgets_period_valid_v3 check (period_end >= period_start)
);

create unique index if not exists admin_finance_budgets_period_category_v3
  on public.admin_finance_budgets(period_start, period_end, category);

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
  status text not null default 'draft',
  source text not null default 'rpc',
  notes text,
  snapshot jsonb not null default '{}'::jsonb,
  snapshot_version text not null default 'daily-closing-v3',
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibility for older production copies.
alter table public.admin_expenses add column if not exists expense_date date default current_date;
alter table public.admin_expenses add column if not exists category text default 'other';
alter table public.admin_expenses add column if not exists amount numeric(14,2) default 0;
alter table public.admin_expenses add column if not exists status text default 'draft';
alter table public.admin_expenses add column if not exists approved_at timestamptz;
alter table public.admin_expenses add column if not exists approved_by uuid references auth.users(id);
alter table public.admin_expenses add column if not exists created_at timestamptz default now();
alter table public.admin_expenses add column if not exists updated_at timestamptz default now();

alter table public.admin_adjustments add column if not exists direction text default 'positive';
alter table public.admin_adjustments add column if not exists amount numeric(14,2) default 0;
alter table public.admin_adjustments add column if not exists status text default 'draft';
alter table public.admin_adjustments add column if not exists created_at timestamptz default now();
alter table public.admin_adjustments add column if not exists updated_at timestamptz default now();

alter table public.admin_finance_budgets add column if not exists period_start date;
alter table public.admin_finance_budgets add column if not exists period_end date;
alter table public.admin_finance_budgets add column if not exists category text default 'operations';
alter table public.admin_finance_budgets add column if not exists allocated_amount numeric(14,2) default 0;
alter table public.admin_finance_budgets add column if not exists status text default 'active';
alter table public.admin_finance_budgets add column if not exists updated_at timestamptz default now();

alter table public.admin_daily_closings add column if not exists total_orders integer default 0;
alter table public.admin_daily_closings add column if not exists delivered_orders integer default 0;
alter table public.admin_daily_closings add column if not exists cancelled_orders integer default 0;
alter table public.admin_daily_closings add column if not exists returned_orders integer default 0;
alter table public.admin_daily_closings add column if not exists goods_value numeric(14,2) default 0;
alter table public.admin_daily_closings add column if not exists delivery_income numeric(14,2) default 0;
alter table public.admin_daily_closings add column if not exists discounts_total numeric(14,2) default 0;
alter table public.admin_daily_closings add column if not exists customer_total numeric(14,2) default 0;
alter table public.admin_daily_closings add column if not exists merchant_due numeric(14,2) default 0;
alter table public.admin_daily_closings add column if not exists cod_total numeric(14,2) default 0;
alter table public.admin_daily_closings add column if not exists cod_collected numeric(14,2) default 0;
alter table public.admin_daily_closings add column if not exists cod_pending numeric(14,2) default 0;
alter table public.admin_daily_closings add column if not exists cod_reconciled numeric(14,2) default 0;
alter table public.admin_daily_closings add column if not exists expenses_total numeric(14,2) default 0;
alter table public.admin_daily_closings add column if not exists adjustments_net numeric(14,2) default 0;
alter table public.admin_daily_closings add column if not exists net_total numeric(14,2) default 0;
alter table public.admin_daily_closings add column if not exists budget_allocated numeric(14,2) default 0;
alter table public.admin_daily_closings add column if not exists budget_remaining numeric(14,2) default 0;
alter table public.admin_daily_closings add column if not exists unassigned_orders integer default 0;
alter table public.admin_daily_closings add column if not exists pending_review_orders integer default 0;
alter table public.admin_daily_closings add column if not exists unreconciled_cod numeric(14,2) default 0;
alter table public.admin_daily_closings add column if not exists unposted_delivered_orders integer default 0;
alter table public.admin_daily_closings add column if not exists print_jobs_pending integer default 0;
alter table public.admin_daily_closings add column if not exists status text default 'draft';
alter table public.admin_daily_closings add column if not exists source text default 'rpc';
alter table public.admin_daily_closings add column if not exists notes text;
alter table public.admin_daily_closings add column if not exists snapshot jsonb default '{}'::jsonb;
alter table public.admin_daily_closings add column if not exists snapshot_version text default 'daily-closing-v3';
alter table public.admin_daily_closings add column if not exists reviewed_at timestamptz;
alter table public.admin_daily_closings add column if not exists reviewed_by uuid references auth.users(id);
alter table public.admin_daily_closings add column if not exists created_by uuid references auth.users(id);
alter table public.admin_daily_closings add column if not exists created_at timestamptz default now();
alter table public.admin_daily_closings add column if not exists updated_at timestamptz default now();

create index if not exists idx_admin_daily_closings_date_v3 on public.admin_daily_closings(closing_date desc);
create index if not exists idx_admin_daily_closings_status_v3 on public.admin_daily_closings(status, closing_date desc);

create or replace view public.admin_finance_budget_status
with (security_invoker = true)
as
select
  b.*,
  coalesce(x.spent_amount, 0)::numeric(14,2) as spent_amount,
  (coalesce(b.allocated_amount,0) - coalesce(x.spent_amount,0))::numeric(14,2) as remaining_amount,
  case when coalesce(b.allocated_amount,0) > 0
    then round((coalesce(x.spent_amount,0) / b.allocated_amount) * 100, 2)
    else 0
  end as utilization_percent
from public.admin_finance_budgets b
left join lateral (
  select sum(e.amount) as spent_amount
  from public.admin_expenses e
  where e.status = 'approved'
    and e.expense_date between b.period_start and b.period_end
    and (b.category = 'operations' or e.category = b.category)
) x on true
where coalesce(b.status,'active') <> 'void';

alter table public.admin_daily_closings enable row level security;
alter table public.admin_audit_events enable row level security;

-- Reinstall explicit finance closing policies.
drop policy if exists admin_daily_closings_admin_select on public.admin_daily_closings;
create policy admin_daily_closings_admin_select
  on public.admin_daily_closings for select to authenticated
  using (public.is_admin_or_support());

drop policy if exists admin_daily_closings_admin_insert on public.admin_daily_closings;
create policy admin_daily_closings_admin_insert
  on public.admin_daily_closings for insert to authenticated
  with check (public.is_admin_or_support());

drop policy if exists admin_daily_closings_admin_update on public.admin_daily_closings;
create policy admin_daily_closings_admin_update
  on public.admin_daily_closings for update to authenticated
  using (public.is_admin_or_support()) with check (public.is_admin_or_support());

drop policy if exists admin_audit_events_admin_select_v3 on public.admin_audit_events;
create policy admin_audit_events_admin_select_v3
  on public.admin_audit_events for select to authenticated
  using (public.is_admin_or_support());

drop policy if exists admin_audit_events_admin_insert_v3 on public.admin_audit_events;
create policy admin_audit_events_admin_insert_v3
  on public.admin_audit_events for insert to authenticated
  with check (public.is_admin_or_support());

create or replace function public.admin_daily_closing_live_snapshot(p_date date default current_date)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth, pg_temp
as $$
declare
  d date := coalesce(p_date, current_date);
  v_unposted bigint := 0;
  v_live jsonb;
begin
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;

  if to_regclass('public.orders') is null
     or to_regclass('public.order_financial_settlements') is null
     or to_regclass('public.admin_expenses') is null
     or to_regclass('public.admin_adjustments') is null
     or to_regclass('public.admin_finance_budgets') is null then
    return jsonb_build_object(
      'ok', false,
      'authoritative', false,
      'source', 'unavailable',
      'reason', 'finance_migration_required',
      'closing_date', d,
      'data_version', 'daily-closing-v3',
      'generated_at', now()
    );
  end if;

  select count(*) into v_unposted
  from public.orders o
  where lower(replace(replace(coalesce(o.status::text,''),'-','_'),' ','_')) in ('delivered','completed','complete')
    and o.financial_posted_at is null
    and coalesce(o.updated_at,o.created_at)::date = d;

  select jsonb_build_object(
    'ok', true,
    'authoritative', true,
    'closing_date', d,
    'total_orders', (select count(*) from public.orders o where o.created_at::date = d),
    'delivered_orders', (select count(*) from public.order_financial_settlements s where s.posted_at::date = d),
    'cancelled_orders', (
      select count(*) from public.orders o
      where o.created_at::date = d
        and lower(replace(replace(coalesce(o.status::text,''),'-','_'),' ','_')) in ('cancelled','canceled','failed')
    ),
    'returned_orders', (
      select count(*) from public.orders o
      where o.created_at::date = d
        and lower(replace(replace(coalesce(o.status::text,''),'-','_'),' ','_')) = 'returned'
    ),
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
    'unassigned_orders', (
      select count(*) from public.orders o
      where o.created_at::date = d
        and lower(replace(replace(coalesce(o.status::text,''),'-','_'),' ','_')) not in ('cancelled','canceled','failed','returned')
        and coalesce(o.driver_name,'')=''
        and coalesce(to_jsonb(o)->>'driver_id','')=''
        and coalesce(to_jsonb(o)->>'assigned_driver_id','')=''
    ),
    'pending_review_orders', (
      select count(*) from public.orders o
      where o.created_at::date = d
        and lower(replace(replace(coalesce(o.status::text,''),'-','_'),' ','_')) in ('pending','review','under_review','confirmed')
    ),
    'unreconciled_cod', greatest(coalesce((select sum(s.customer_total - s.collected_amount) from public.order_financial_settlements s where s.posted_at::date = d),0),0),
    'unposted_delivered_orders', v_unposted,
    'print_jobs_pending', 0,
    'status', case
      when v_unposted > 0 then 'needs_review'
      else 'draft'
    end,
    'source', 'rpc',
    'data_version', 'daily-closing-v3',
    'generated_at', now()
  ) into v_live;

  return v_live;
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
  live jsonb;
  saved public.admin_daily_closings;
  frozen jsonb;
begin
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;

  live := public.admin_daily_closing_live_snapshot(d);
  if coalesce((live->>'ok')::boolean,false) is not true then return live; end if;

  select * into saved from public.admin_daily_closings where closing_date = d;

  if saved.id is not null and saved.status = 'closed' and coalesce(saved.snapshot,'{}'::jsonb) <> '{}'::jsonb then
    frozen := saved.snapshot || jsonb_build_object(
      'closing_date', d,
      'status', 'closed',
      'source', 'persisted',
      'authoritative', true,
      'notes', saved.notes,
      'reviewed_at', saved.reviewed_at,
      'reviewed_by', saved.reviewed_by,
      'updated_at', saved.updated_at,
      'data_version', coalesce(saved.snapshot_version,'daily-closing-v3'),
      'live_drift', jsonb_build_object(
        'net_total', round(coalesce((live->>'net_total')::numeric,0) - coalesce((saved.snapshot->>'net_total')::numeric,0),2),
        'customer_total', round(coalesce((live->>'customer_total')::numeric,0) - coalesce((saved.snapshot->>'customer_total')::numeric,0),2),
        'merchant_due', round(coalesce((live->>'merchant_due')::numeric,0) - coalesce((saved.snapshot->>'merchant_due')::numeric,0),2),
        'unposted_delivered_orders', coalesce((live->>'unposted_delivered_orders')::integer,0)
      )
    );
    return frozen;
  end if;

  if saved.id is not null then
    live := live || jsonb_build_object(
      'status', case when saved.status = 'reopened' then 'reopened' else live->>'status' end,
      'notes', saved.notes,
      'reviewed_at', saved.reviewed_at,
      'reviewed_by', saved.reviewed_by,
      'updated_at', saved.updated_at
    );
  end if;

  return live;
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
  before_row public.admin_daily_closings;
  d date := coalesce(nullif(p_snapshot->>'closing_date','')::date,current_date);
  requested_status text := lower(btrim(coalesce(nullif(p_snapshot->>'status',''),'draft')));
  live jsonb;
  v_notes text := nullif(btrim(p_snapshot->>'notes'),'');
begin
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;
  if coalesce((p_snapshot->>'_health_check')::boolean,false) then return null; end if;
  if requested_status not in ('draft','needs_review','closed','reopened') then raise exception 'invalid_daily_closing_status'; end if;

  live := public.admin_daily_closing_live_snapshot(d);
  if coalesce((live->>'ok')::boolean,false) is not true then
    raise exception using errcode='55000', message='authoritative_daily_closing_required', detail=live::text;
  end if;

  if requested_status = 'closed' and coalesce((live->>'unposted_delivered_orders')::integer,0) > 0 then
    raise exception using
      errcode='55000',
      message='daily_closing_has_unposted_delivered_orders',
      detail=jsonb_build_object('closing_date',d,'unposted_delivered_orders',(live->>'unposted_delivered_orders')::integer)::text;
  end if;

  select * into before_row from public.admin_daily_closings where closing_date=d for update;

  insert into public.admin_daily_closings(
    closing_date,total_orders,delivered_orders,cancelled_orders,returned_orders,
    goods_value,delivery_income,discounts_total,customer_total,merchant_due,
    cod_total,cod_collected,cod_pending,cod_reconciled,expenses_total,
    adjustments_net,net_total,budget_allocated,budget_remaining,
    unassigned_orders,pending_review_orders,unreconciled_cod,
    unposted_delivered_orders,print_jobs_pending,status,source,notes,
    snapshot,snapshot_version,reviewed_at,reviewed_by,created_by,updated_at
  ) values (
    d,
    (live->>'total_orders')::integer,(live->>'delivered_orders')::integer,
    (live->>'cancelled_orders')::integer,(live->>'returned_orders')::integer,
    (live->>'goods_value')::numeric,(live->>'delivery_income')::numeric,
    (live->>'discounts_total')::numeric,(live->>'customer_total')::numeric,
    (live->>'merchant_due')::numeric,(live->>'cod_total')::numeric,
    (live->>'cod_collected')::numeric,(live->>'cod_pending')::numeric,
    (live->>'cod_reconciled')::numeric,(live->>'expenses_total')::numeric,
    (live->>'adjustments_net')::numeric,(live->>'net_total')::numeric,
    (live->>'budget_allocated')::numeric,(live->>'budget_remaining')::numeric,
    (live->>'unassigned_orders')::integer,(live->>'pending_review_orders')::integer,
    (live->>'unreconciled_cod')::numeric,(live->>'unposted_delivered_orders')::integer,
    (live->>'print_jobs_pending')::integer,requested_status,'rpc',v_notes,
    live || jsonb_build_object('status',requested_status,'notes',v_notes),
    'daily-closing-v3',
    case when requested_status='closed' then now() else null end,
    case when requested_status='closed' then auth.uid() else null end,
    auth.uid(),now()
  )
  on conflict (closing_date) do update set
    total_orders=excluded.total_orders,
    delivered_orders=excluded.delivered_orders,
    cancelled_orders=excluded.cancelled_orders,
    returned_orders=excluded.returned_orders,
    goods_value=excluded.goods_value,
    delivery_income=excluded.delivery_income,
    discounts_total=excluded.discounts_total,
    customer_total=excluded.customer_total,
    merchant_due=excluded.merchant_due,
    cod_total=excluded.cod_total,
    cod_collected=excluded.cod_collected,
    cod_pending=excluded.cod_pending,
    cod_reconciled=excluded.cod_reconciled,
    expenses_total=excluded.expenses_total,
    adjustments_net=excluded.adjustments_net,
    net_total=excluded.net_total,
    budget_allocated=excluded.budget_allocated,
    budget_remaining=excluded.budget_remaining,
    unassigned_orders=excluded.unassigned_orders,
    pending_review_orders=excluded.pending_review_orders,
    unreconciled_cod=excluded.unreconciled_cod,
    unposted_delivered_orders=excluded.unposted_delivered_orders,
    print_jobs_pending=excluded.print_jobs_pending,
    status=excluded.status,
    source='rpc',
    notes=excluded.notes,
    snapshot=excluded.snapshot,
    snapshot_version='daily-closing-v3',
    reviewed_at=excluded.reviewed_at,
    reviewed_by=excluded.reviewed_by,
    updated_at=now()
  returning * into r;

  insert into public.admin_audit_events(entity_type,entity_id,action,actor_id,before_data,after_data,metadata)
  values (
    'admin_daily_closing',r.id::text,requested_status,auth.uid(),
    case when before_row.id is null then null else to_jsonb(before_row) end,
    to_jsonb(r),
    jsonb_build_object('closing_date',d,'source','db_ledger','data_version','daily-closing-v3')
  );

  return r;
end;
$$;

create or replace function public.admin_daily_closing_health()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth, pg_temp
as $$
declare
  sample jsonb;
begin
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;
  sample := public.admin_daily_closing_live_snapshot(current_date);
  return jsonb_build_object(
    'ok', coalesce((sample->>'ok')::boolean,false),
    'authoritative', coalesce((sample->>'authoritative')::boolean,false),
    'source', sample->>'source',
    'data_version', 'daily-closing-v3',
    'daily_closing_table', to_regclass('public.admin_daily_closings') is not null,
    'settlements_table', to_regclass('public.order_financial_settlements') is not null,
    'expenses_table', to_regclass('public.admin_expenses') is not null,
    'adjustments_table', to_regclass('public.admin_adjustments') is not null,
    'budgets_table', to_regclass('public.admin_finance_budgets') is not null,
    'snapshot_rpc', to_regprocedure('public.admin_daily_closing_snapshot(date)') is not null,
    'save_rpc', to_regprocedure('public.admin_save_daily_closing(jsonb)') is not null,
    'checked_at', now()
  );
end;
$$;

revoke all on public.admin_daily_closings from anon;
grant select,insert,update on public.admin_daily_closings to authenticated;
grant select,insert on public.admin_audit_events to authenticated;
grant select on public.admin_finance_budget_status to authenticated;

revoke all on function public.admin_daily_closing_live_snapshot(date) from public,anon;
revoke all on function public.admin_daily_closing_snapshot(date) from public,anon;
revoke all on function public.admin_save_daily_closing(jsonb) from public,anon;
revoke all on function public.admin_daily_closing_health() from public,anon;
grant execute on function public.admin_daily_closing_live_snapshot(date) to authenticated;
grant execute on function public.admin_daily_closing_snapshot(date) to authenticated;
grant execute on function public.admin_save_daily_closing(jsonb) to authenticated;
grant execute on function public.admin_daily_closing_health() to authenticated;

commit;
