-- DAY NIGHT DELIVERY SERVICES
-- Direct, idempotent P1 finance backfill for legacy delivered orders.
-- Runs inside the migration transaction and aborts atomically if any authority
-- invariant remains incomplete or out of balance.

begin;

insert into public.order_financial_settlements (
  order_id,
  order_reference,
  merchant_id,
  coupon_number,
  goods_value,
  delivery_fee,
  discount_amount,
  delivery_fee_mode,
  customer_total,
  collected_amount,
  merchant_due,
  company_revenue,
  currency,
  posted_at,
  posted_by,
  source_status,
  snapshot
)
select
  o.id::text,
  coalesce(
    nullif(to_jsonb(o)->>'tracking_number', ''),
    nullif(to_jsonb(o)->>'invoice_number', ''),
    nullif(to_jsonb(o)->>'coupon_number', ''),
    o.id::text
  ),
  o.merchant_id,
  nullif(to_jsonb(o)->>'coupon_number', ''),
  coalesce(o.goods_value, 0),
  coalesce(o.delivery_fee, 0),
  coalesce(o.discount_amount, 0),
  coalesce(nullif(o.delivery_fee_mode, ''), 'customer_pays'),
  coalesce(o.customer_total, 0),
  coalesce(o.collected_amount, 0),
  coalesce(o.merchant_due, 0),
  coalesce(o.company_revenue, 0),
  'AED',
  coalesce(o.financial_posted_at, o.delivered_at, o.updated_at, o.created_at, now()),
  null,
  lower(replace(replace(coalesce(o.status::text, 'delivered'), '-', '_'), ' ', '_')),
  to_jsonb(o)
from public.orders o
where lower(replace(replace(coalesce(o.status::text, ''), '-', '_'), ' ', '_'))
    in ('delivered', 'completed', 'complete')
  and not exists (
    select 1 from public.order_financial_settlements s where s.order_id = o.id::text
  )
on conflict (order_id) do nothing;

insert into public.financial_account_entries (
  order_id,
  order_reference,
  merchant_id,
  account_type,
  entry_type,
  direction,
  amount,
  currency,
  notes,
  posted_at
)
select
  s.order_id,
  s.order_reference,
  s.merchant_id,
  'merchant',
  'delivered_order_settlement',
  case when s.merchant_due < 0 then 'debit' else 'credit' end,
  abs(s.merchant_due),
  s.currency,
  'Authoritative merchant settlement reconciled from delivered-order snapshot',
  s.posted_at
from public.order_financial_settlements s
where s.merchant_id is not null
  and not exists (
    select 1
    from public.financial_account_entries e
    where e.order_id = s.order_id
      and e.account_type = 'merchant'
      and e.entry_type = 'delivered_order_settlement'
  )
on conflict (order_id, account_type, entry_type) do nothing;

insert into public.financial_account_entries (
  order_id,
  order_reference,
  merchant_id,
  account_type,
  entry_type,
  direction,
  amount,
  currency,
  notes,
  posted_at
)
select
  s.order_id,
  s.order_reference,
  s.merchant_id,
  'company',
  'delivered_order_settlement',
  'credit',
  greatest(s.company_revenue, 0),
  s.currency,
  'Authoritative DAY NIGHT revenue reconciled from delivered-order snapshot',
  s.posted_at
from public.order_financial_settlements s
where not exists (
  select 1
  from public.financial_account_entries e
  where e.order_id = s.order_id
    and e.account_type = 'company'
    and e.entry_type = 'delivered_order_settlement'
)
on conflict (order_id, account_type, entry_type) do nothing;

insert into public.cod_collections (
  order_id,
  tracking_number,
  merchant_id,
  driver_id,
  cod_amount,
  collected_amount,
  reconciled_amount,
  collection_date,
  status,
  payment_method,
  notes,
  created_by,
  created_at,
  updated_at
)
select
  o.id,
  coalesce(
    nullif(to_jsonb(o)->>'tracking_number', ''),
    nullif(to_jsonb(o)->>'invoice_number', ''),
    nullif(to_jsonb(o)->>'coupon_number', ''),
    o.id::text
  ),
  o.merchant_id,
  public.dn_safe_uuid(coalesce(
    nullif(to_jsonb(o)->>'assigned_driver_id', ''),
    nullif(to_jsonb(o)->>'driver_id', '')
  )),
  greatest(coalesce(o.customer_total, 0), 0),
  greatest(coalesce(nullif(o.collected_amount, 0), o.customer_total, 0), 0),
  0,
  coalesce(o.delivered_at, o.updated_at, o.created_at, now())::date,
  'collected',
  'cash',
  'Authoritative COD collection reconciled from delivered-order snapshot',
  null,
  now(),
  now()
from public.orders o
where lower(replace(replace(coalesce(o.status::text, ''), '-', '_'), ' ', '_'))
    in ('delivered', 'completed', 'complete')
  and lower(coalesce(o.payment_method::text, '')) = 'cod'
  and coalesce(o.customer_total, 0) > 0
  and not exists (
    select 1 from public.cod_collections c where c.order_id = o.id
  )
on conflict do nothing;

insert into public.merchant_statement_entries (
  merchant_id,
  order_id,
  tracking_number,
  entry_date,
  entry_type,
  debit,
  credit,
  balance,
  status,
  notes,
  created_by,
  created_at,
  updated_at
)
select
  o.merchant_id,
  o.id,
  coalesce(
    nullif(to_jsonb(o)->>'tracking_number', ''),
    nullif(to_jsonb(o)->>'invoice_number', ''),
    nullif(to_jsonb(o)->>'coupon_number', ''),
    o.id::text
  ),
  coalesce(o.delivered_at, o.updated_at, o.created_at, now())::date,
  'order_cod',
  case when coalesce(o.merchant_due, 0) < 0 then abs(o.merchant_due) else 0 end,
  case when coalesce(o.merchant_due, 0) >= 0 then o.merchant_due else 0 end,
  coalesce(o.merchant_due, 0),
  'posted',
  'Authoritative merchant statement reconciled from delivered-order snapshot',
  null,
  now(),
  now()
from public.orders o
where lower(replace(replace(coalesce(o.status::text, ''), '-', '_'), ' ', '_'))
    in ('delivered', 'completed', 'complete')
  and o.merchant_id is not null
  and not exists (
    select 1 from public.merchant_statement_entries m where m.order_id = o.id
  )
on conflict do nothing;

insert into public.driver_statement_entries (
  driver_id,
  order_id,
  tracking_number,
  entry_date,
  entry_type,
  debit,
  credit,
  balance,
  status,
  notes,
  created_by,
  created_at,
  updated_at
)
select
  public.dn_safe_uuid(coalesce(
    nullif(to_jsonb(o)->>'assigned_driver_id', ''),
    nullif(to_jsonb(o)->>'driver_id', '')
  )),
  o.id,
  coalesce(
    nullif(to_jsonb(o)->>'tracking_number', ''),
    nullif(to_jsonb(o)->>'invoice_number', ''),
    nullif(to_jsonb(o)->>'coupon_number', ''),
    o.id::text
  ),
  coalesce(o.delivered_at, o.updated_at, o.created_at, now())::date,
  'delivery_earning',
  0,
  greatest(public.dn_safe_numeric(to_jsonb(o)->>'driver_earning', 0), 0),
  greatest(public.dn_safe_numeric(to_jsonb(o)->>'driver_earning', 0), 0),
  'posted',
  'Authoritative driver statement reconciled from delivered-order snapshot',
  null,
  now(),
  now()
from public.orders o
where lower(replace(replace(coalesce(o.status::text, ''), '-', '_'), ' ', '_'))
    in ('delivered', 'completed', 'complete')
  and public.dn_safe_uuid(coalesce(
    nullif(to_jsonb(o)->>'assigned_driver_id', ''),
    nullif(to_jsonb(o)->>'driver_id', '')
  )) is not null
  and not exists (
    select 1 from public.driver_statement_entries d where d.order_id = o.id
  )
on conflict do nothing;

do $$
declare
  v_missing_settlements bigint;
  v_missing_cod bigint;
  v_missing_merchants bigint;
  v_missing_drivers bigint;
  v_customer_variance numeric;
  v_company_variance numeric;
  v_merchant_variance numeric;
  v_collected_variance numeric;
begin
  select count(*) into v_missing_settlements
  from public.orders o
  where lower(replace(replace(coalesce(o.status::text, ''), '-', '_'), ' ', '_'))
      in ('delivered', 'completed', 'complete')
    and not exists (
      select 1 from public.order_financial_settlements s where s.order_id = o.id::text
    );

  select count(*) into v_missing_cod
  from public.orders o
  where lower(replace(replace(coalesce(o.status::text, ''), '-', '_'), ' ', '_'))
      in ('delivered', 'completed', 'complete')
    and lower(coalesce(o.payment_method::text, '')) = 'cod'
    and coalesce(o.customer_total, 0) > 0
    and not exists (
      select 1 from public.cod_collections c where c.order_id = o.id
    );

  select count(*) into v_missing_merchants
  from public.orders o
  where lower(replace(replace(coalesce(o.status::text, ''), '-', '_'), ' ', '_'))
      in ('delivered', 'completed', 'complete')
    and o.merchant_id is not null
    and not exists (
      select 1 from public.merchant_statement_entries m where m.order_id = o.id
    );

  select count(*) into v_missing_drivers
  from public.orders o
  where lower(replace(replace(coalesce(o.status::text, ''), '-', '_'), ' ', '_'))
      in ('delivered', 'completed', 'complete')
    and public.dn_safe_uuid(coalesce(
      nullif(to_jsonb(o)->>'assigned_driver_id', ''),
      nullif(to_jsonb(o)->>'driver_id', '')
    )) is not null
    and not exists (
      select 1 from public.driver_statement_entries d where d.order_id = o.id
    );

  select
    coalesce(sum(abs(coalesce(o.customer_total, 0) - coalesce(s.customer_total, 0))), 0),
    coalesce(sum(abs(coalesce(o.company_revenue, 0) - coalesce(s.company_revenue, 0))), 0),
    coalesce(sum(abs(coalesce(o.merchant_due, 0) - coalesce(s.merchant_due, 0))), 0),
    coalesce(sum(abs(coalesce(o.collected_amount, 0) - coalesce(s.collected_amount, 0))), 0)
  into v_customer_variance, v_company_variance, v_merchant_variance, v_collected_variance
  from public.orders o
  join public.order_financial_settlements s on s.order_id = o.id::text
  where lower(replace(replace(coalesce(o.status::text, ''), '-', '_'), ' ', '_'))
      in ('delivered', 'completed', 'complete');

  if v_missing_settlements <> 0
     or v_missing_cod <> 0
     or v_missing_merchants <> 0
     or v_missing_drivers <> 0
     or round(v_customer_variance, 2) <> 0
     or round(v_company_variance, 2) <> 0
     or round(v_merchant_variance, 2) <> 0
     or round(v_collected_variance, 2) <> 0 then
    raise exception using
      errcode = '23514',
      message = 'p1_finance_backfill_incomplete',
      detail = jsonb_build_object(
        'missing_settlements', v_missing_settlements,
        'missing_cod', v_missing_cod,
        'missing_merchant_statements', v_missing_merchants,
        'missing_driver_statements', v_missing_drivers,
        'customer_variance', round(v_customer_variance, 2),
        'company_variance', round(v_company_variance, 2),
        'merchant_variance', round(v_merchant_variance, 2),
        'collected_variance', round(v_collected_variance, 2)
      )::text;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
