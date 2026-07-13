-- DAY NIGHT — merchant-paid delivery fee accounting
-- Purpose:
-- When a merchant shipment has customer collection = 0 and delivery fee > 0,
-- the merchant statement must show a negative net balance, e.g. 0 - 30 = -30 AED.
-- This migration does not delete or rewrite existing order data.

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
    coalesce(sum(collection_amount), 0),
    coalesce(sum(case when status_text ~ '(deliver|complete)' then collection_amount else 0 end), 0),
    coalesce(sum(case when status_text !~ '(deliver|complete|cancel|fail|return)' then collection_amount else 0 end), 0)
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
        public.dn_numeric_or_null(to_jsonb(o)->>'base_price'),
        0
      ) as delivery_income,
      coalesce(public.dn_numeric_or_null(to_jsonb(o)->>'cod_amount'), 0) as collection_amount
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

  -- Important: no greatest(..., 0) here.
  -- A negative merchant balance is valid when DAY NIGHT must collect delivery fees from the merchant.
  if v_merchant_payable = 0 then
    v_merchant_payable := coalesce(v_cod_collected, 0) + coalesce(v_cod_pending, 0) - coalesce(v_income, 0) + coalesce(v_adjustments, 0);
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
