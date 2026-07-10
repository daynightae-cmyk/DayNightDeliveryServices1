-- DAY NIGHT Admin Finance Summary
-- Creates a real finance_summary view plus get_finance_summary() RPC for the admin dashboard.
-- The implementation is intentionally defensive: it uses JSON field extraction for orders so
-- older/newer order schemas can still contribute to finance totals without migration failures.

create table if not exists public.admin_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date default current_date,
  category text default 'other',
  amount numeric default 0,
  payment_method text default 'cash',
  status text default 'draft',
  notes text,
  reference_number text,
  attachment_url text,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.admin_adjustments (
  id uuid primary key default gen_random_uuid(),
  adjustment_type text default 'manual_finance_adjustment',
  direction text default 'positive',
  amount numeric default 0,
  order_id uuid,
  merchant_id uuid,
  driver_id uuid,
  reason text,
  notes text,
  status text default 'draft',
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.cod_collections (
  id uuid primary key default gen_random_uuid(),
  order_id uuid,
  driver_id uuid,
  merchant_id uuid,
  tracking_number text,
  cod_amount numeric default 0,
  collected_amount numeric default 0,
  status text default 'pending',
  collection_date date,
  reconciled_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.driver_statement_entries (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid,
  order_id uuid,
  tracking_number text,
  entry_date date default current_date,
  entry_type text default 'delivery_earning',
  debit numeric default 0,
  credit numeric default 0,
  balance numeric default 0,
  status text default 'draft',
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.merchant_statement_entries (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid,
  order_id uuid,
  tracking_number text,
  entry_date date default current_date,
  entry_type text default 'order_cod',
  debit numeric default 0,
  credit numeric default 0,
  balance numeric default 0,
  status text default 'draft',
  notes text,
  created_at timestamptz default now()
);

alter table if exists public.admin_expenses enable row level security;
alter table if exists public.admin_adjustments enable row level security;
alter table if exists public.cod_collections enable row level security;
alter table if exists public.driver_statement_entries enable row level security;
alter table if exists public.merchant_statement_entries enable row level security;

create index if not exists idx_admin_expenses_date_status on public.admin_expenses (expense_date, status);
create index if not exists idx_admin_adjustments_status_date on public.admin_adjustments (status, created_at);
create index if not exists idx_cod_collections_status_date on public.cod_collections (status, created_at);
create index if not exists idx_cod_collections_order on public.cod_collections (order_id);
create index if not exists idx_driver_statement_entries_driver_date on public.driver_statement_entries (driver_id, entry_date);
create index if not exists idx_merchant_statement_entries_merchant_date on public.merchant_statement_entries (merchant_id, entry_date);

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'admin_expenses' and policyname = 'admin_expenses_admin_support_all') then
    create policy admin_expenses_admin_support_all on public.admin_expenses
      for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','support')))
      with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','support')));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'admin_adjustments' and policyname = 'admin_adjustments_admin_support_all') then
    create policy admin_adjustments_admin_support_all on public.admin_adjustments
      for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','support')))
      with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','support')));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cod_collections' and policyname = 'cod_collections_admin_support_all') then
    create policy cod_collections_admin_support_all on public.cod_collections
      for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','support')))
      with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','support')));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'driver_statement_entries' and policyname = 'driver_statement_entries_admin_support_all') then
    create policy driver_statement_entries_admin_support_all on public.driver_statement_entries
      for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','support')))
      with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','support')));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'merchant_statement_entries' and policyname = 'merchant_statement_entries_admin_support_all') then
    create policy merchant_statement_entries_admin_support_all on public.merchant_statement_entries
      for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','support')))
      with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','support')));
  end if;
end $$;

create or replace function public.dn_numeric_or_null(value text)
returns numeric
language plpgsql
immutable
as $$
declare
  cleaned text;
begin
  cleaned := nullif(regexp_replace(coalesce(value, ''), '[^0-9\.\-]', '', 'g'), '');
  if cleaned is null then
    return null;
  end if;
  return cleaned::numeric;
exception when others then
  return null;
end;
$$;

create or replace function public.get_finance_summary()
returns table (
  total_income numeric,
  total_expenses numeric,
  cod_collected numeric,
  cod_pending numeric,
  merchant_payable numeric,
  driver_payable numeric,
  gross_delivery_revenue numeric,
  cod_total numeric,
  cod_reconciled numeric,
  adjustments_net numeric,
  net_operational_estimate numeric,
  average_order_revenue numeric,
  total_orders bigint,
  active_orders bigint,
  delivered_orders bigint,
  cancelled_orders bigint,
  returned_orders bigint,
  generated_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_total_orders bigint := 0;
  v_active_orders bigint := 0;
  v_delivered_orders bigint := 0;
  v_cancelled_orders bigint := 0;
  v_returned_orders bigint := 0;
  v_income numeric := 0;
  v_cod_total numeric := 0;
  v_cod_fallback_collected numeric := 0;
  v_cod_fallback_pending numeric := 0;
  v_expenses numeric := 0;
  v_adjustments numeric := 0;
  v_cod_rows bigint := 0;
  v_cod_collected numeric := 0;
  v_cod_pending numeric := 0;
  v_cod_reconciled numeric := 0;
  v_driver_payable numeric := 0;
  v_merchant_payable numeric := 0;
begin
  select
    count(*)::bigint,
    count(*) filter (where status_text !~ '(deliver|complete|cancel|fail|return)')::bigint,
    count(*) filter (where status_text ~ '(deliver|complete)')::bigint,
    count(*) filter (where status_text ~ '(cancel|fail)')::bigint,
    count(*) filter (where status_text ~ 'return')::bigint,
    coalesce(sum(delivery_income), 0),
    coalesce(sum(cod_amount), 0),
    coalesce(sum(case when status_text ~ '(deliver|complete)' then cod_amount else 0 end), 0),
    coalesce(sum(case when status_text !~ '(deliver|complete|cancel|fail|return)' then cod_amount else 0 end), 0)
  into
    v_total_orders,
    v_active_orders,
    v_delivered_orders,
    v_cancelled_orders,
    v_returned_orders,
    v_income,
    v_cod_total,
    v_cod_fallback_collected,
    v_cod_fallback_pending
  from (
    select
      lower(coalesce(to_jsonb(o)->>'status', '')) as status_text,
      coalesce(
        public.dn_numeric_or_null(to_jsonb(o)->>'delivery_price'),
        public.dn_numeric_or_null(to_jsonb(o)->>'service_fee'),
        public.dn_numeric_or_null(to_jsonb(o)->>'price'),
        public.dn_numeric_or_null(to_jsonb(o)->>'base_price'),
        public.dn_numeric_or_null(to_jsonb(o)->>'total_price'),
        public.dn_numeric_or_null(to_jsonb(o)->>'total'),
        public.dn_numeric_or_null(to_jsonb(o)->>'amount'),
        0
      ) as delivery_income,
      coalesce(public.dn_numeric_or_null(to_jsonb(o)->>'cod_amount'), 0) as cod_amount
    from public.orders o
  ) order_money;

  select coalesce(sum(amount), 0)
  into v_expenses
  from public.admin_expenses
  where lower(coalesce(status, '')) not in ('void', 'voided', 'cancelled');

  select coalesce(sum(case when direction = 'negative' then -amount else amount end), 0)
  into v_adjustments
  from public.admin_adjustments
  where lower(coalesce(status, '')) in ('approved', 'posted', 'reconciled');

  select
    count(*)::bigint,
    coalesce(sum(case when lower(coalesce(status, '')) in ('collected', 'reconciled') then coalesce(collected_amount, cod_amount, 0) else 0 end), 0),
    coalesce(sum(case when lower(coalesce(status, '')) = 'reconciled' then coalesce(collected_amount, cod_amount, 0) else 0 end), 0),
    coalesce(sum(case when lower(coalesce(status, '')) not in ('reconciled', 'void', 'voided', 'cancelled') then greatest(coalesce(cod_amount, 0) - coalesce(collected_amount, 0), 0) else 0 end), 0)
  into v_cod_rows, v_cod_collected, v_cod_reconciled, v_cod_pending
  from public.cod_collections;

  if v_cod_rows = 0 then
    v_cod_collected := v_cod_fallback_collected;
    v_cod_pending := v_cod_fallback_pending;
    v_cod_reconciled := 0;
  end if;

  select coalesce(sum(credit) - sum(debit), 0)
  into v_driver_payable
  from public.driver_statement_entries
  where lower(coalesce(status, '')) not in ('void', 'voided', 'cancelled');

  select coalesce(sum(credit) - sum(debit), 0)
  into v_merchant_payable
  from public.merchant_statement_entries
  where lower(coalesce(status, '')) not in ('void', 'voided', 'cancelled');

  if v_merchant_payable = 0 then
    v_merchant_payable := greatest(v_cod_collected + v_cod_pending - v_income + v_adjustments, 0);
  end if;

  return query select
    coalesce(v_income, 0) as total_income,
    coalesce(v_expenses, 0) as total_expenses,
    coalesce(v_cod_collected, 0) as cod_collected,
    coalesce(v_cod_pending, 0) as cod_pending,
    coalesce(v_merchant_payable, 0) as merchant_payable,
    coalesce(v_driver_payable, 0) as driver_payable,
    coalesce(v_income, 0) as gross_delivery_revenue,
    coalesce(v_cod_total, 0) as cod_total,
    coalesce(v_cod_reconciled, 0) as cod_reconciled,
    coalesce(v_adjustments, 0) as adjustments_net,
    coalesce(v_income, 0) - coalesce(v_expenses, 0) + coalesce(v_adjustments, 0) as net_operational_estimate,
    case when v_total_orders > 0 then round(coalesce(v_income, 0) / v_total_orders, 2) else 0 end as average_order_revenue,
    v_total_orders,
    v_active_orders,
    v_delivered_orders,
    v_cancelled_orders,
    v_returned_orders,
    now() as generated_at;
end;
$$;

drop view if exists public.finance_summary;
create view public.finance_summary
with (security_invoker = true)
as
select * from public.get_finance_summary();

grant execute on function public.get_finance_summary() to authenticated;
grant select on public.finance_summary to authenticated;

comment on view public.finance_summary is 'DAY NIGHT admin finance summary view used by the admin dashboard. Aggregates orders, COD, expenses, adjustments, and statement rows safely.';
comment on function public.get_finance_summary() is 'RPC-compatible finance summary for DAY NIGHT admin dashboard.';
