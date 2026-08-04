-- DAY NIGHT DELIVERY SERVICES
-- Restore the canonical settlement rule removed from the Admin CRUD v3 save path.
--
-- Business invariant:
--   manual_delivery_price = 0 is an explicit operator instruction, not free delivery.
--   The stored effective delivery fee is 25 AED and is deducted from the merchant.
--   Example: goods 0, discount 0 => customer 0, merchant -25, company revenue 25.
--
-- This trigger intentionally remains active during the short Admin CRUD v3 override
-- window so every caller, including the non-blocking v3 RPC, persists the same result.

begin;

alter table public.orders
  add column if not exists manual_delivery_price numeric(14,2),
  add column if not exists price_source text default 'system';

create or replace function public.dn_enforce_manual_zero_merchant_charge()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_goods numeric(14,2) := round(greatest(coalesce(new.goods_value, 0), 0)::numeric, 2);
  v_discount numeric(14,2) := round(greatest(coalesce(new.discount_amount, 0), 0)::numeric, 2);
  v_customer_total numeric(14,2);
  v_merchant_due numeric(14,2);
  v_payment text := lower(replace(replace(coalesce(new.payment_method::text, ''), '-', '_'), ' ', '_'));
begin
  if lower(btrim(coalesce(new.price_source, ''))) = 'manual'
     and new.manual_delivery_price is not null
     and round(new.manual_delivery_price::numeric, 2) = 0
     and new.merchant_id is not null then

    v_customer_total := round(greatest(v_goods - v_discount, 0)::numeric, 2);
    v_merchant_due := round((v_goods - v_discount - 25)::numeric, 2);

    -- Keep zero as the operator-entered marker, while storing the effective fee.
    new.manual_delivery_price := 0;
    new.price_source := 'manual';
    new.goods_value := v_goods;
    new.discount_amount := v_discount;
    new.delivery_fee := 25;
    new.delivery_fee_mode := 'deduct_from_merchant';
    new.customer_total := v_customer_total;
    new.merchant_due := v_merchant_due;
    new.company_revenue := 25;

    -- Synchronize every legacy amount alias consumed by Admin, merchant and reports.
    new.delivery_price := 25;
    new.base_price := 25;
    new.subtotal := v_customer_total;
    new.total := v_customer_total;
    new.total_price := v_customer_total;
    new.amount := v_customer_total;
    new.price := v_customer_total;

    if v_payment in ('cod', 'cash', 'receiver_pays') then
      new.cod_amount := v_customer_total;
    else
      new.cod_amount := 0;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.dn_enforce_manual_zero_merchant_charge() from public, anon;
grant execute on function public.dn_enforce_manual_zero_merchant_charge() to authenticated, service_role;

-- Alphabetical aa_ ordering makes the invariant available to the canonical finance
-- normalizer. Unlike strict compatibility triggers, this trigger is never disabled by
-- daynight.admin_order_override, because the v3 core writer must also obey it.
drop trigger if exists aa_dn_manual_zero_merchant_charge on public.orders;
create trigger aa_dn_manual_zero_merchant_charge
before insert or update of
  merchant_id,
  goods_value,
  delivery_fee,
  discount_amount,
  delivery_fee_mode,
  customer_total,
  merchant_due,
  company_revenue,
  payment_method,
  manual_delivery_price,
  price_source
on public.orders
for each row
execute function public.dn_enforce_manual_zero_merchant_charge();

create or replace function public.admin_manual_zero_merchant_charge_health()
returns jsonb
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'ok',
      to_regprocedure('public.dn_enforce_manual_zero_merchant_charge()') is not null
      and exists (
        select 1
        from pg_trigger
        where tgrelid = 'public.orders'::regclass
          and tgname = 'aa_dn_manual_zero_merchant_charge'
          and not tgisinternal
      ),
    'trigger_present', exists (
      select 1
      from pg_trigger
      where tgrelid = 'public.orders'::regclass
        and tgname = 'aa_dn_manual_zero_merchant_charge'
        and not tgisinternal
    ),
    'manual_entered_fee', 0,
    'effective_delivery_fee', 25,
    'expected_zero_goods_customer_total', 0,
    'expected_zero_goods_merchant_due', -25,
    'expected_company_revenue', 25,
    'statement_direction', 'debit',
    'checked_at', now()
  );
$$;

revoke all on function public.admin_manual_zero_merchant_charge_health() from public, anon;
grant execute on function public.admin_manual_zero_merchant_charge_health() to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
