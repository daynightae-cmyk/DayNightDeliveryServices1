-- DAY NIGHT DELIVERY SERVICES
-- Authoritative merchant-order financial separation and delivery posting.
--
-- Financial values are calculated when an order is created or edited:
--   customer_pays:
--     customer_total = goods_value + delivery_fee - discount_amount
--     merchant_due   = goods_value - discount_amount
--   deduct_from_merchant:
--     customer_total = goods_value - discount_amount
--     merchant_due   = goods_value - discount_amount - delivery_fee
--   company_revenue = delivery_fee
--
-- Moving an order to delivered only confirms collection and posts the already-calculated
-- snapshot once. It never asks the operator to enter the values again.

begin;

create extension if not exists pgcrypto;

alter table public.orders add column if not exists goods_value numeric(14,2) not null default 0;
alter table public.orders add column if not exists delivery_fee numeric(14,2) not null default 0;
alter table public.orders add column if not exists discount_amount numeric(14,2) not null default 0;
alter table public.orders add column if not exists delivery_fee_mode text not null default 'customer_pays';
alter table public.orders add column if not exists customer_total numeric(14,2) not null default 0;
alter table public.orders add column if not exists collected_amount numeric(14,2) not null default 0;
alter table public.orders add column if not exists merchant_due numeric(14,2) not null default 0;
alter table public.orders add column if not exists company_revenue numeric(14,2) not null default 0;
alter table public.orders add column if not exists financial_posted_at timestamptz;
alter table public.orders add column if not exists financial_version integer not null default 1;

alter table public.orders drop constraint if exists orders_goods_value_nonnegative;
alter table public.orders add constraint orders_goods_value_nonnegative check (goods_value >= 0) not valid;
alter table public.orders drop constraint if exists orders_delivery_fee_nonnegative;
alter table public.orders add constraint orders_delivery_fee_nonnegative check (delivery_fee >= 0) not valid;
alter table public.orders drop constraint if exists orders_discount_amount_nonnegative;
alter table public.orders add constraint orders_discount_amount_nonnegative check (discount_amount >= 0) not valid;
alter table public.orders drop constraint if exists orders_customer_total_nonnegative;
alter table public.orders add constraint orders_customer_total_nonnegative check (customer_total >= 0) not valid;
alter table public.orders drop constraint if exists orders_delivery_fee_mode_valid;
alter table public.orders add constraint orders_delivery_fee_mode_valid
  check (delivery_fee_mode in ('customer_pays', 'deduct_from_merchant')) not valid;

create index if not exists idx_orders_financial_posted_at on public.orders(financial_posted_at);
create index if not exists idx_orders_merchant_financial on public.orders(merchant_id, financial_posted_at);

create or replace function public.daynight_financial_number(p_value text, p_default numeric default 0)
returns numeric
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v numeric;
begin
  if p_value is null or btrim(p_value) = '' then
    return coalesce(p_default, 0);
  end if;
  v := p_value::numeric;
  if not isfinite(v) then
    return coalesce(p_default, 0);
  end if;
  return round(v, 2);
exception when others then
  return coalesce(p_default, 0);
end;
$$;

create or replace function public.daynight_calculate_order_financials(
  p_goods_value numeric,
  p_delivery_fee numeric,
  p_discount_amount numeric default 0,
  p_delivery_fee_mode text default 'customer_pays'
)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_goods numeric(14,2) := round(greatest(coalesce(p_goods_value, 0), 0), 2);
  v_fee numeric(14,2) := round(greatest(coalesce(p_delivery_fee, 0), 0), 2);
  v_discount numeric(14,2) := round(greatest(coalesce(p_discount_amount, 0), 0), 2);
  v_mode text := lower(replace(coalesce(nullif(btrim(p_delivery_fee_mode), ''), 'customer_pays'), '-', '_'));
  v_customer_total numeric(14,2);
  v_merchant_due numeric(14,2);
begin
  if v_mode in ('merchant_pays', 'sender_pays') then
    v_mode := 'deduct_from_merchant';
  end if;
  if v_mode not in ('customer_pays', 'deduct_from_merchant') then
    v_mode := 'customer_pays';
  end if;

  if v_mode = 'customer_pays' then
    if v_discount > v_goods + v_fee then
      raise exception 'discount_exceeds_customer_total';
    end if;
    v_customer_total := round(v_goods + v_fee - v_discount, 2);
    v_merchant_due := round(v_goods - v_discount, 2);
  else
    if v_discount > v_goods then
      raise exception 'discount_exceeds_goods_value';
    end if;
    v_customer_total := round(v_goods - v_discount, 2);
    v_merchant_due := round(v_goods - v_discount - v_fee, 2);
  end if;

  return jsonb_build_object(
    'goods_value', v_goods,
    'delivery_fee', v_fee,
    'discount_amount', v_discount,
    'delivery_fee_mode', v_mode,
    'customer_total', v_customer_total,
    'merchant_due', v_merchant_due,
    'company_revenue', v_fee
  );
end;
$$;

create or replace function public.daynight_normalize_financial_order()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_status text;
  v_old_status text;
  v_breakdown jsonb;
  v_financial_changed boolean := false;
begin
  if tg_op = 'UPDATE' then
    v_financial_changed :=
      new.goods_value is distinct from old.goods_value
      or new.delivery_fee is distinct from old.delivery_fee
      or new.discount_amount is distinct from old.discount_amount
      or new.delivery_fee_mode is distinct from old.delivery_fee_mode
      or new.customer_total is distinct from old.customer_total
      or new.merchant_due is distinct from old.merchant_due
      or new.company_revenue is distinct from old.company_revenue;

    if old.financial_posted_at is not null and v_financial_changed then
      raise exception 'financials_locked_after_delivery';
    end if;
  end if;

  if coalesce(new.delivery_fee, 0) = 0 and coalesce(new.delivery_price, 0) > 0 then
    new.delivery_fee := round(new.delivery_price::numeric, 2);
  end if;

  v_breakdown := public.daynight_calculate_order_financials(
    new.goods_value,
    new.delivery_fee,
    new.discount_amount,
    new.delivery_fee_mode
  );

  new.goods_value := (v_breakdown ->> 'goods_value')::numeric;
  new.delivery_fee := (v_breakdown ->> 'delivery_fee')::numeric;
  new.discount_amount := (v_breakdown ->> 'discount_amount')::numeric;
  new.delivery_fee_mode := v_breakdown ->> 'delivery_fee_mode';
  new.customer_total := (v_breakdown ->> 'customer_total')::numeric;
  new.merchant_due := (v_breakdown ->> 'merchant_due')::numeric;
  new.company_revenue := (v_breakdown ->> 'company_revenue')::numeric;
  new.financial_version := 1;

  -- Keep legacy amount columns compatible while making the new fields authoritative.
  new.delivery_price := new.delivery_fee;
  new.base_price := new.delivery_fee;
  new.subtotal := new.customer_total;
  new.total := new.customer_total;
  new.total_price := new.customer_total;
  new.amount := new.customer_total;
  new.price := new.customer_total;

  if lower(coalesce(new.payment_method::text, '')) = 'cod' then
    new.cod_amount := new.customer_total;
  end if;

  v_status := lower(replace(coalesce(new.status::text, 'pending'), '-', '_'));
  v_old_status := case when tg_op = 'UPDATE' then lower(replace(coalesce(old.status::text, ''), '-', '_')) else '' end;

  if v_status in ('delivered', 'completed', 'complete') and v_old_status not in ('delivered', 'completed', 'complete') then
    new.collected_amount := new.customer_total;
    new.financial_posted_at := coalesce(new.financial_posted_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_daynight_normalize_financial_order on public.orders;
create trigger trg_daynight_normalize_financial_order
before insert or update on public.orders
for each row execute function public.daynight_normalize_financial_order();

create table if not exists public.order_financial_settlements (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  order_reference text not null,
  merchant_id uuid,
  coupon_number text,
  goods_value numeric(14,2) not null,
  delivery_fee numeric(14,2) not null,
  discount_amount numeric(14,2) not null,
  delivery_fee_mode text not null,
  customer_total numeric(14,2) not null,
  collected_amount numeric(14,2) not null,
  merchant_due numeric(14,2) not null,
  company_revenue numeric(14,2) not null,
  currency text not null default 'AED',
  posted_at timestamptz not null default now(),
  posted_by uuid references auth.users(id),
  source_status text not null default 'delivered',
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_account_entries (
  id uuid primary key default gen_random_uuid(),
  order_id text not null,
  order_reference text not null,
  merchant_id uuid,
  account_type text not null check (account_type in ('merchant', 'company')),
  entry_type text not null default 'delivered_order_settlement',
  direction text not null check (direction in ('debit', 'credit')),
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'AED',
  notes text,
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(order_id, account_type, entry_type)
);

create index if not exists idx_order_financial_settlements_merchant on public.order_financial_settlements(merchant_id, posted_at desc);
create index if not exists idx_financial_account_entries_merchant on public.financial_account_entries(merchant_id, posted_at desc);
create index if not exists idx_financial_account_entries_account on public.financial_account_entries(account_type, posted_at desc);

alter table public.order_financial_settlements enable row level security;
alter table public.financial_account_entries enable row level security;

drop policy if exists order_financial_settlements_admin_read on public.order_financial_settlements;
create policy order_financial_settlements_admin_read
on public.order_financial_settlements for select to authenticated
using (public.is_admin_or_support());

drop policy if exists order_financial_settlements_merchant_read on public.order_financial_settlements;
create policy order_financial_settlements_merchant_read
on public.order_financial_settlements for select to authenticated
using (merchant_id = public.merchant_session_id());

drop policy if exists financial_account_entries_admin_read on public.financial_account_entries;
create policy financial_account_entries_admin_read
on public.financial_account_entries for select to authenticated
using (public.is_admin_or_support());

drop policy if exists financial_account_entries_merchant_read on public.financial_account_entries;
create policy financial_account_entries_merchant_read
on public.financial_account_entries for select to authenticated
using (account_type = 'merchant' and merchant_id = public.merchant_session_id());

revoke all on public.order_financial_settlements from anon;
revoke all on public.financial_account_entries from anon;
grant select on public.order_financial_settlements to authenticated;
grant select on public.financial_account_entries to authenticated;

create or replace function public.daynight_post_delivered_financials()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_status text := lower(replace(coalesce(new.status::text, ''), '-', '_'));
  v_reference text := coalesce(
    nullif(new.tracking_number, ''),
    nullif(new.invoice_number, ''),
    nullif(new.coupon_number, ''),
    new.id::text
  );
  v_merchant_direction text;
  v_merchant_amount numeric(14,2);
begin
  if v_status not in ('delivered', 'completed', 'complete') or new.financial_posted_at is null then
    return new;
  end if;

  insert into public.order_financial_settlements (
    order_id, order_reference, merchant_id, coupon_number,
    goods_value, delivery_fee, discount_amount, delivery_fee_mode,
    customer_total, collected_amount, merchant_due, company_revenue,
    currency, posted_at, posted_by, source_status, snapshot
  ) values (
    new.id::text, v_reference, new.merchant_id, new.coupon_number,
    new.goods_value, new.delivery_fee, new.discount_amount, new.delivery_fee_mode,
    new.customer_total, new.collected_amount, new.merchant_due, new.company_revenue,
    coalesce(new.currency, 'AED'), new.financial_posted_at, auth.uid(), v_status, to_jsonb(new)
  ) on conflict (order_id) do nothing;

  v_merchant_direction := case when new.merchant_due < 0 then 'debit' else 'credit' end;
  v_merchant_amount := abs(new.merchant_due);

  insert into public.financial_account_entries (
    order_id, order_reference, merchant_id, account_type, entry_type,
    direction, amount, currency, notes, posted_at
  ) values (
    new.id::text, v_reference, new.merchant_id, 'merchant', 'delivered_order_settlement',
    v_merchant_direction, v_merchant_amount, coalesce(new.currency, 'AED'),
    'Merchant due from delivered order after delivery fee and discount', new.financial_posted_at
  ) on conflict (order_id, account_type, entry_type) do nothing;

  insert into public.financial_account_entries (
    order_id, order_reference, merchant_id, account_type, entry_type,
    direction, amount, currency, notes, posted_at
  ) values (
    new.id::text, v_reference, new.merchant_id, 'company', 'delivered_order_settlement',
    'credit', new.company_revenue, coalesce(new.currency, 'AED'),
    'DAY NIGHT delivery revenue from delivered order', new.financial_posted_at
  ) on conflict (order_id, account_type, entry_type) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_daynight_post_delivered_financials on public.orders;
create trigger trg_daynight_post_delivered_financials
after insert or update on public.orders
for each row execute function public.daynight_post_delivered_financials();

create or replace function public.admin_update_order_with_financials(p_payload jsonb)
returns public.orders
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  r public.orders;
  v_reference text := nullif(btrim(p_payload ->> 'reference'), '');
  v_financials jsonb := coalesce(p_payload -> 'financials', '{}'::jsonb);
  v_goods numeric := public.daynight_financial_number(v_financials ->> 'goods_value', 0);
  v_fee numeric := public.daynight_financial_number(v_financials ->> 'delivery_fee', 0);
  v_discount numeric := public.daynight_financial_number(v_financials ->> 'discount_amount', 0);
  v_mode text := coalesce(nullif(v_financials ->> 'delivery_fee_mode', ''), 'customer_pays');
  v_breakdown jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;

  -- Existing runtime updates merchant, receiver, route, package and delivery pricing in
  -- the same database transaction. Any financial error below rolls the whole call back.
  r := public.admin_update_order_runtime(
    jsonb_build_object(
      'reference', v_reference,
      'patch', coalesce(p_payload -> 'patch', '{}'::jsonb),
      'reason', coalesce(nullif(p_payload ->> 'reason', ''), 'Updated with financial breakdown')
    )
  );

  if r.financial_posted_at is not null then
    raise exception 'financials_locked_after_delivery';
  end if;

  v_breakdown := public.daynight_calculate_order_financials(v_goods, v_fee, v_discount, v_mode);

  update public.orders o
  set goods_value = (v_breakdown ->> 'goods_value')::numeric,
      delivery_fee = (v_breakdown ->> 'delivery_fee')::numeric,
      discount_amount = (v_breakdown ->> 'discount_amount')::numeric,
      delivery_fee_mode = v_breakdown ->> 'delivery_fee_mode',
      customer_total = (v_breakdown ->> 'customer_total')::numeric,
      merchant_due = (v_breakdown ->> 'merchant_due')::numeric,
      company_revenue = (v_breakdown ->> 'company_revenue')::numeric,
      delivery_price = (v_breakdown ->> 'delivery_fee')::numeric,
      base_price = (v_breakdown ->> 'delivery_fee')::numeric,
      subtotal = (v_breakdown ->> 'customer_total')::numeric,
      total = (v_breakdown ->> 'customer_total')::numeric,
      total_price = (v_breakdown ->> 'customer_total')::numeric,
      amount = (v_breakdown ->> 'customer_total')::numeric,
      price = (v_breakdown ->> 'customer_total')::numeric,
      cod_amount = case
        when lower(coalesce(o.payment_method::text, '')) = 'cod'
          then (v_breakdown ->> 'customer_total')::numeric
        else coalesce(o.cod_amount, 0)
      end,
      financial_version = 1,
      updated_at = now()
  where o.id = r.id
  returning o.* into r;

  return r;
exception when others then
  raise exception using
    message = 'admin_update_order_with_financials_failed: ' || sqlerrm,
    detail = 'SQLSTATE=' || sqlstate,
    hint = 'Apply the financial-ledger migration and edit only orders that have not been financially posted.';
end;
$$;

create or replace function public.merchant_financial_statement(p_limit integer default 250)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth, pg_temp
as $$
declare
  v_merchant_id uuid := public.merchant_session_id();
  v_limit integer := least(greatest(coalesce(p_limit, 250), 1), 500);
  v_rows jsonb := '[]'::jsonb;
  v_summary jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_merchant_id is null then raise exception 'merchant_profile_not_found'; end if;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.posted_at desc), '[]'::jsonb)
  into v_rows
  from (
    select *
    from public.order_financial_settlements
    where merchant_id = v_merchant_id
    order by posted_at desc
    limit v_limit
  ) s;

  select jsonb_build_object(
    'orders', count(*),
    'goods_value', coalesce(sum(goods_value), 0),
    'delivery_fee', coalesce(sum(delivery_fee), 0),
    'discount_amount', coalesce(sum(discount_amount), 0),
    'customer_total', coalesce(sum(customer_total), 0),
    'collected_amount', coalesce(sum(collected_amount), 0),
    'merchant_due', coalesce(sum(merchant_due), 0),
    'company_revenue', coalesce(sum(company_revenue), 0)
  ) into v_summary
  from public.order_financial_settlements
  where merchant_id = v_merchant_id;

  return jsonb_build_object(
    'ok', true,
    'merchant_id', v_merchant_id,
    'generated_at', now(),
    'summary', v_summary,
    'rows', v_rows
  );
end;
$$;

create or replace view public.merchant_order_financial_statement
with (security_invoker = true)
as
select
  s.order_id,
  s.order_reference,
  s.merchant_id,
  s.coupon_number,
  s.goods_value,
  s.delivery_fee,
  s.discount_amount,
  s.delivery_fee_mode,
  s.customer_total,
  s.collected_amount,
  s.merchant_due,
  s.company_revenue,
  s.currency,
  s.posted_at
from public.order_financial_settlements s;

create or replace view public.daynight_company_financial_statement
with (security_invoker = true)
as
select
  s.order_id,
  s.order_reference,
  s.merchant_id,
  s.coupon_number,
  s.customer_total,
  s.collected_amount,
  s.company_revenue,
  s.currency,
  s.posted_at
from public.order_financial_settlements s;

grant select on public.merchant_order_financial_statement to authenticated;
grant select on public.daynight_company_financial_statement to authenticated;

revoke all on function public.daynight_financial_number(text, numeric) from public, anon;
revoke all on function public.daynight_calculate_order_financials(numeric, numeric, numeric, text) from public, anon;
revoke all on function public.admin_update_order_with_financials(jsonb) from public, anon;
revoke all on function public.merchant_financial_statement(integer) from public, anon;
grant execute on function public.daynight_financial_number(text, numeric) to authenticated;
grant execute on function public.daynight_calculate_order_financials(numeric, numeric, numeric, text) to authenticated;
grant execute on function public.admin_update_order_with_financials(jsonb) to authenticated;
grant execute on function public.merchant_financial_statement(integer) to authenticated;

-- Backfill legacy orders. Existing COD is interpreted as the customer amount and existing
-- delivery_price as the company fee. Delivered legacy rows are posted by the trigger once.
update public.orders o
set delivery_fee = greatest(coalesce(nullif(o.delivery_fee, 0), o.delivery_price, 0), 0),
    goods_value = case
      when coalesce(o.goods_value, 0) > 0 then o.goods_value
      when coalesce(o.cod_amount, 0) > 0 then greatest(coalesce(o.cod_amount, 0) - greatest(coalesce(nullif(o.delivery_fee, 0), o.delivery_price, 0), 0), 0)
      else 0
    end,
    discount_amount = greatest(coalesce(o.discount_amount, 0), 0),
    delivery_fee_mode = case
      when lower(coalesce(o.delivery_fee_mode, '')) in ('deduct_from_merchant', 'merchant_pays', 'sender_pays') then 'deduct_from_merchant'
      when lower(coalesce(o.payment_method::text, '')) = 'sender_pays' then 'deduct_from_merchant'
      else 'customer_pays'
    end,
    updated_at = coalesce(o.updated_at, now());

alter table public.orders validate constraint orders_goods_value_nonnegative;
alter table public.orders validate constraint orders_delivery_fee_nonnegative;
alter table public.orders validate constraint orders_discount_amount_nonnegative;
alter table public.orders validate constraint orders_customer_total_nonnegative;
alter table public.orders validate constraint orders_delivery_fee_mode_valid;

create or replace function public.order_financial_ledger_health()
returns jsonb
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'ok',
      to_regprocedure('public.admin_update_order_with_financials(jsonb)') is not null
      and to_regprocedure('public.merchant_financial_statement(integer)') is not null
      and to_regclass('public.order_financial_settlements') is not null
      and to_regclass('public.financial_account_entries') is not null,
    'orders_total', (select count(*) from public.orders),
    'orders_with_financial_breakdown', (select count(*) from public.orders where financial_version = 1),
    'delivered_financially_posted', (select count(*) from public.orders where financial_posted_at is not null),
    'settlement_rows', (select count(*) from public.order_financial_settlements),
    'account_entries', (select count(*) from public.financial_account_entries),
    'duplicate_settlements', (
      select count(*) from (
        select order_id from public.order_financial_settlements group by order_id having count(*) > 1
      ) d
    ),
    'formula', 'customer_total and merchant_due are calculated at order entry; delivery only posts the snapshot',
    'delivery_modes', jsonb_build_array('customer_pays', 'deduct_from_merchant')
  );
$$;

revoke all on function public.order_financial_ledger_health() from public, anon;
grant execute on function public.order_financial_ledger_health() to authenticated;

notify pgrst, 'reload schema';
commit;
