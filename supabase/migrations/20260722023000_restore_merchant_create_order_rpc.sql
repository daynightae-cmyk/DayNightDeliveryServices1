-- DAY NIGHT DELIVERY SERVICES
-- Restore the authenticated merchant order creation RPC required by the live portal.
-- Production-safe: creates no orders during migration and uses server-side merchant linkage/pricing.

begin;

create extension if not exists pgcrypto;

create or replace function public.merchant_create_order(p_order jsonb)
returns public.orders
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_merchant_id uuid := public.merchant_session_id();
  v_merchant public.merchants%rowtype;
  v_order public.orders%rowtype;
  v_price_json jsonb;
  v_total numeric;
  v_weight numeric := greatest(coalesce(public.dn_numeric_or_null(p_order->>'weight'), 1), 0.01);
  v_tracking text := 'DN-' || to_char(clock_timestamp(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  v_payment text := lower(coalesce(nullif(btrim(p_order->>'payment_method'), ''), 'sender_pays'));
  v_payload jsonb;
  v_columns text;
  v_values text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if v_merchant_id is null then
    raise exception 'merchant_profile_not_found';
  end if;

  select * into v_merchant
  from public.merchants
  where id = v_merchant_id
  limit 1;

  if v_merchant.id is null then
    raise exception 'merchant_profile_not_found';
  end if;

  if lower(coalesce(v_merchant.status::text, 'active')) in ('blocked','suspended','deleted','archived') then
    raise exception 'merchant_account_not_active';
  end if;

  if nullif(btrim(p_order->>'receiver_name'), '') is null then
    raise exception 'recipient_name_required';
  end if;

  if nullif(regexp_replace(coalesce(p_order->>'receiver_phone',''), '\D', '', 'g'), '') is null then
    raise exception 'recipient_phone_required';
  end if;

  if nullif(btrim(p_order->>'receiver_city'), '') is null then
    raise exception 'delivery_city_required';
  end if;

  if nullif(btrim(p_order->>'receiver_address'), '') is null then
    raise exception 'delivery_address_required';
  end if;

  if v_payment not in ('sender_pays','receiver_pays','cod','prepaid') then
    raise exception 'invalid_payment_method';
  end if;

  begin
    execute 'select to_jsonb(x) from public.calculate_delivery_price($1,$2,$3) x limit 1'
      into v_price_json
      using coalesce(nullif(p_order->>'sender_city',''), v_merchant.city, v_merchant.emirate),
            p_order->>'receiver_city',
            v_weight;
  exception
    when undefined_function then
      raise exception 'merchant_pricing_service_unavailable';
    when others then
      raise exception 'merchant_pricing_failed: %', sqlerrm;
  end;

  if jsonb_typeof(v_price_json) = 'number' then
    v_total := (v_price_json #>> '{}')::numeric;
  else
    v_total := coalesce(
      public.dn_numeric_or_null(v_price_json->>'total'),
      public.dn_numeric_or_null(v_price_json->>'total_price'),
      public.dn_numeric_or_null(v_price_json->>'price'),
      public.dn_numeric_or_null(v_price_json->>'delivery_price')
    );
  end if;

  if v_total is null or v_total < 0 then
    raise exception 'merchant_pricing_unconfirmed';
  end if;

  v_payload := jsonb_strip_nulls(p_order || jsonb_build_object(
    'tracking_number', v_tracking,
    'tracking_code', v_tracking,
    'invoice_number', coalesce(nullif(btrim(p_order->>'invoice_number'), ''), v_tracking),
    'merchant_id', v_merchant.id::text,
    'merchant_name', v_merchant.trade_name,
    'merchant_code', v_merchant.merchant_code,
    'sender_name', coalesce(nullif(btrim(p_order->>'sender_name'), ''), v_merchant.trade_name),
    'sender_phone', coalesce(nullif(btrim(p_order->>'sender_phone'), ''), v_merchant.phone),
    'sender_city', coalesce(nullif(btrim(p_order->>'sender_city'), ''), v_merchant.city, v_merchant.emirate, 'Abu Dhabi'),
    'sender_address', coalesce(nullif(btrim(p_order->>'sender_address'), ''), v_merchant.pickup_address, v_merchant.address, 'Abu Dhabi'),
    'package_type', coalesce(nullif(btrim(p_order->>'package_type'), ''), 'Shipment'),
    'package_description', coalesce(nullif(btrim(p_order->>'package_description'), ''), nullif(btrim(p_order->>'package_type'), ''), 'Shipment'),
    'weight', v_weight,
    'pieces', greatest(coalesce(public.dn_numeric_or_null(p_order->>'pieces')::integer, 1), 1),
    'order_count', greatest(coalesce(public.dn_numeric_or_null(p_order->>'pieces')::integer, 1), 1),
    'service_type', coalesce(nullif(btrim(p_order->>'service_type'), ''), 'standard'),
    'payment_method', v_payment,
    'cod_amount', case when v_payment = 'cod' then greatest(coalesce(public.dn_numeric_or_null(p_order->>'cod_amount'), 0), 0) else 0 end,
    'delivery_price', v_total,
    'subtotal', v_total,
    'base_price', coalesce(public.dn_numeric_or_null(v_price_json->>'base_fee'), public.dn_numeric_or_null(v_price_json->>'base_price'), v_total),
    'total', v_total,
    'total_price', v_total,
    'amount', v_total,
    'price', v_total,
    'currency', 'AED',
    'source_channel', coalesce(nullif(btrim(p_order->>'source_channel'), ''), 'merchant_portal'),
    'source_domain', 'daynightae.com',
    'status', 'pending',
    'status_history', jsonb_build_array(jsonb_build_object('status','pending','created_at',now(),'note','Created by authenticated merchant portal')),
    'created_by', auth.uid()::text,
    'created_at', now(),
    'updated_at', now()
  ));

  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
         string_agg(format('(jsonb_populate_record(null::public.orders, $1)).%I', c.column_name), ', ' order by c.ordinal_position)
    into v_columns, v_values
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'orders'
    and v_payload ? c.column_name
    and coalesce(c.is_generated, 'NEVER') = 'NEVER'
    and coalesce(c.identity_generation, '') <> 'ALWAYS';

  if nullif(v_columns, '') is null or nullif(v_values, '') is null then
    raise exception 'merchant_order_schema_mapping_failed';
  end if;

  execute format('insert into public.orders (%s) select %s returning *', v_columns, v_values)
    using v_payload
    into v_order;

  if to_jsonb(v_order)->>'merchant_id' is distinct from v_merchant_id::text then
    raise exception 'merchant_order_link_verification_failed';
  end if;

  return v_order;
end;
$$;

revoke all on function public.merchant_create_order(jsonb) from public, anon;
grant execute on function public.merchant_create_order(jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;

select
  to_regprocedure('public.merchant_create_order(jsonb)') is not null as merchant_create_order_ready,
  has_function_privilege('authenticated', 'public.merchant_create_order(jsonb)', 'EXECUTE') as authenticated_execute_ready,
  to_regprocedure('public.calculate_delivery_price(text,text,numeric)') is not null
    or exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'calculate_delivery_price'
        and p.pronargs = 3
    ) as merchant_pricing_ready;
