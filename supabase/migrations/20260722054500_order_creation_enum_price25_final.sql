-- DAY NIGHT DELIVERY SERVICES
-- Final production repair for:
--   * PostgreSQL order_status ENUM safety on order insert/update triggers.
--   * Real admin/merchant order creation and merchant linkage.
--   * Merchant-paid delivery mode enforcement.
--   * Official 25 AED main-route delivery fee.
--   * Zero-value merchant orders deferred until Accounts closes them at 25 AED.

begin;

create extension if not exists pgcrypto;

-- The official local price is final: 25 AED on main routes and 50 AED on
-- Al Ain/Western Region routes. It is independent from COD and goods value.
create or replace function public.daynight_official_local_delivery_fee(
  p_from_city text,
  p_to_city text
)
returns numeric
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when lower(coalesce(p_from_city, '') || ' ' || coalesce(p_to_city, ''))
      ~ '(al[ _-]?ain|western|al[ _-]?dhafra|dhafra|liwa|ruwais|العين|الظفرة|الغربية|ليوا|الرويس)'
      then 50::numeric
    else 25::numeric
  end;
$$;

revoke all on function public.daynight_official_local_delivery_fee(text, text) from public;
grant execute on function public.daynight_official_local_delivery_fee(text, text) to anon, authenticated;

-- ENUM-safe lifecycle trigger. Reading status through to_jsonb avoids calling
-- lower(order_status), which is the exact SQLSTATE 42883 production failure.
create or replace function public.portal_notify_order_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_order jsonb := to_jsonb(new);
  v_old_order jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_merchant_user uuid;
  v_driver_user uuid;
  v_reference text;
  v_status text;
  v_old_status text;
  v_metadata jsonb;
  v_merchant_id uuid;
  v_driver_id uuid;
begin
  v_reference := coalesce(
    nullif(v_order->>'tracking_number', ''),
    nullif(v_order->>'tracking_code', ''),
    nullif(v_order->>'invoice_number', ''),
    nullif(v_order->>'coupon_number', ''),
    v_order->>'id'
  );
  v_status := lower(coalesce(v_order->>'status', 'pending'));
  v_old_status := case
    when tg_op = 'UPDATE' then lower(coalesce(v_old_order->>'status', ''))
    else ''
  end;

  begin
    v_merchant_id := nullif(v_order->>'merchant_id', '')::uuid;
  exception when others then
    v_merchant_id := null;
  end;

  begin
    v_driver_id := nullif(coalesce(v_order->>'assigned_driver_id', v_order->>'driver_id'), '')::uuid;
  exception when others then
    v_driver_id := null;
  end;

  if v_merchant_id is not null then
    select m.user_id into v_merchant_user
    from public.merchants m
    where m.id = v_merchant_id
    limit 1;
  end if;

  if v_driver_id is not null then
    select d.user_id into v_driver_user
    from public.driver_profiles d
    where d.id = v_driver_id
    limit 1;
  end if;

  v_metadata := jsonb_build_object(
    'order_id', v_order->>'id',
    'tracking_reference', v_reference,
    'status', v_status,
    'merchant_id', v_merchant_id,
    'driver_id', v_driver_id,
    'title_ar', case when tg_op = 'INSERT' then 'تم إنشاء طلب جديد' else 'تم تحديث حالة الطلب' end,
    'message_ar', case
      when tg_op = 'INSERT' then 'تم تسجيل الطلب ' || coalesce(v_reference, '')
      else 'الطلب ' || coalesce(v_reference, '') || ' أصبح بالحالة: ' || v_status
    end
  );

  if tg_op = 'INSERT' then
    perform public.portal_insert_notification(
      v_merchant_user,
      'New order created',
      'Order ' || coalesce(v_reference, '') || ' was created successfully.',
      'order_created',
      v_metadata
    );

    if v_driver_user is not null then
      perform public.portal_insert_notification(
        v_driver_user,
        'New assigned order',
        'Order ' || coalesce(v_reference, '') || ' is assigned to you.',
        'driver_assignment',
        v_metadata
      );
    end if;
  elsif v_status is distinct from v_old_status then
    perform public.portal_insert_notification(
      v_merchant_user,
      'Order status updated',
      'Order ' || coalesce(v_reference, '') || ' is now ' || v_status || '.',
      'order_status',
      v_metadata
    );

    if v_driver_user is not null then
      perform public.portal_insert_notification(
        v_driver_user,
        'Order status updated',
        'Order ' || coalesce(v_reference, '') || ' is now ' || v_status || '.',
        'order_status',
        v_metadata
      );
    end if;
  elsif tg_op = 'UPDATE'
    and coalesce(v_order->>'assigned_driver_id', v_order->>'driver_id', '')
      is distinct from coalesce(v_old_order->>'assigned_driver_id', v_old_order->>'driver_id', '')
    and v_driver_user is not null then
    perform public.portal_insert_notification(
      v_driver_user,
      'New assigned order',
      'Order ' || coalesce(v_reference, '') || ' is assigned to you.',
      'driver_assignment',
      v_metadata
    );
  end if;

  return new;
end;
$$;

-- Admin order creation keeps zero financial values valid, always links the
-- real selected merchant, and enforces merchant deduction when merchant pays.
create or replace function public.admin_create_coupon_order(p_order jsonb)
returns public.orders
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  r public.orders;
  v_merchant public.merchants%rowtype;
  v_merchant_id uuid := public.admin_safe_uuid(p_order ->> 'merchant_id');
  v_created_at timestamptz := coalesce(public.admin_safe_timestamptz(p_order ->> 'created_at'), now());
  v_tracking text := coalesce(
    nullif(btrim(p_order ->> 'tracking_number'), ''),
    nullif(btrim(p_order ->> 'tracking_code'), ''),
    nullif(btrim(p_order ->> 'invoice_number'), ''),
    'DN-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  );
  v_requested_payment text := lower(coalesce(nullif(btrim(p_order ->> 'payment_method'), ''), 'sender_pays'));
  v_payment_method text;
  v_fee_mode text := lower(replace(coalesce(nullif(btrim(p_order ->> 'delivery_fee_mode'), ''), 'customer_pays'), '-', '_'));
  v_payload jsonb;
  v_columns text;
  v_values text;
  v_saved_merchant_id text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;
  if v_merchant_id is null then raise exception 'merchant_required'; end if;

  select * into v_merchant
  from public.merchants
  where id = v_merchant_id
    and lower(coalesce(status::text, 'active')) not in ('deleted', 'archived', 'blocked', 'suspended')
  limit 1;

  if v_merchant.id is null then raise exception 'merchant_not_found_or_inactive'; end if;

  v_payment_method := case when v_requested_payment = 'merchant_pays' then 'sender_pays' else v_requested_payment end;
  if v_payment_method not in ('sender_pays', 'receiver_pays', 'cod', 'prepaid') then
    v_payment_method := 'sender_pays';
  end if;

  if v_requested_payment in ('merchant_pays', 'sender_pays') then
    v_fee_mode := 'deduct_from_merchant';
  elsif v_fee_mode not in ('customer_pays', 'deduct_from_merchant') then
    v_fee_mode := 'customer_pays';
  end if;

  v_payload := jsonb_strip_nulls(
    coalesce(p_order, '{}'::jsonb)
    || jsonb_build_object(
      'tracking_number', v_tracking,
      'tracking_code', v_tracking,
      'invoice_number', coalesce(nullif(btrim(p_order ->> 'invoice_number'), ''), v_tracking),
      'merchant_id', v_merchant.id::text,
      'merchant_name', v_merchant.trade_name,
      'merchant_code', v_merchant.merchant_code,
      'sender_name', v_merchant.trade_name,
      'sender_phone', coalesce(nullif(v_merchant.phone, ''), nullif(p_order ->> 'sender_phone', ''), '971568757331'),
      'sender_city', coalesce(nullif(p_order ->> 'sender_city', ''), nullif(v_merchant.emirate, ''), 'Abu Dhabi'),
      'sender_address', coalesce(nullif(p_order ->> 'sender_address', ''), nullif(v_merchant.pickup_address, ''), nullif(v_merchant.address, ''), 'Abu Dhabi'),
      'receiver_name', nullif(p_order ->> 'receiver_name', ''),
      'receiver_phone', nullif(p_order ->> 'receiver_phone', ''),
      'receiver_city', coalesce(nullif(p_order ->> 'receiver_city', ''), 'Dubai'),
      'receiver_address', nullif(p_order ->> 'receiver_address', ''),
      'package_type', coalesce(nullif(p_order ->> 'package_type', ''), nullif(p_order ->> 'package_description', ''), 'Shipment'),
      'package_description', coalesce(nullif(p_order ->> 'package_description', ''), nullif(p_order ->> 'package_type', ''), 'Shipment'),
      'weight', coalesce(p_order -> 'weight', '1'::jsonb),
      'pieces', coalesce(p_order -> 'pieces', p_order -> 'order_count', '1'::jsonb),
      'order_count', coalesce(p_order -> 'order_count', p_order -> 'pieces', '1'::jsonb),
      'shipping_scope', coalesce(nullif(p_order ->> 'shipping_scope', ''), 'local'),
      'destination_country', nullif(p_order ->> 'destination_country', ''),
      'service_type', coalesce(nullif(p_order ->> 'service_type', ''), 'standard'),
      'payment_method', v_payment_method,
      'delivery_fee_mode', v_fee_mode,
      'status', 'pending',
      'status_history', jsonb_build_array(jsonb_build_object(
        'status', 'pending',
        'date', v_created_at,
        'created_at', v_created_at,
        'note', 'Created from authenticated admin for merchant ' || v_merchant.trade_name
      )),
      'created_by', auth.uid()::text,
      'created_at', v_created_at,
      'updated_at', now()
    )
  );

  select
    string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
    string_agg(format('(jsonb_populate_record(null::public.orders, $1)).%I', c.column_name), ', ' order by c.ordinal_position)
  into v_columns, v_values
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'orders'
    and v_payload ? c.column_name
    and coalesce(c.is_generated, 'NEVER') = 'NEVER'
    and coalesce(c.identity_generation, '') <> 'ALWAYS';

  if nullif(v_columns, '') is null or nullif(v_values, '') is null then
    raise exception 'orders_schema_has_no_insertable_payload_columns';
  end if;

  execute format('insert into public.orders (%s) select %s returning *', v_columns, v_values)
    using v_payload into r;

  v_saved_merchant_id := to_jsonb(r) ->> 'merchant_id';
  if v_saved_merchant_id is distinct from v_merchant.id::text then
    raise exception 'merchant_link_verification_failed';
  end if;

  return r;
exception when others then
  raise exception using
    message = 'admin_create_coupon_order_failed: ' || sqlerrm,
    detail = 'SQLSTATE=' || sqlstate,
    hint = 'Confirm admin/support access, apply the final ENUM-safe migration, and select an active merchant.';
end;
$$;

revoke all on function public.admin_create_coupon_order(jsonb) from public, anon;
grant execute on function public.admin_create_coupon_order(jsonb) to authenticated;

-- Merchant creation uses the same official 25/50 local fee and persists the
-- complete financial split so admin, merchant and driver see one real order.
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
  v_base_fee numeric(14,2);
  v_service_fee numeric(14,2) := 0;
  v_total numeric(14,2);
  v_weight numeric := greatest(coalesce(public.dn_numeric_or_null(p_order->>'weight'), 1), 0.01);
  v_tracking text := 'DN-' || to_char(clock_timestamp(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  v_payment text := lower(coalesce(nullif(btrim(p_order->>'payment_method'), ''), 'sender_pays'));
  v_service text := lower(coalesce(nullif(btrim(p_order->>'service_type'), ''), 'standard'));
  v_fee_mode text := lower(replace(coalesce(nullif(btrim(p_order->>'delivery_fee_mode'), ''), 'customer_pays'), '-', '_'));
  v_goods numeric(14,2) := greatest(coalesce(public.dn_numeric_or_null(p_order->>'goods_value'), 0), 0);
  v_requested_cod numeric(14,2) := greatest(coalesce(public.dn_numeric_or_null(p_order->>'cod_amount'), 0), 0);
  v_financials jsonb;
  v_payload jsonb;
  v_columns text;
  v_values text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_merchant_id is null then raise exception 'merchant_profile_not_found'; end if;

  select * into v_merchant
  from public.merchants
  where id = v_merchant_id
  limit 1;

  if v_merchant.id is null then raise exception 'merchant_profile_not_found'; end if;
  if lower(coalesce(v_merchant.status::text, 'active')) in ('blocked','suspended','deleted','archived') then
    raise exception 'merchant_account_not_active';
  end if;

  if nullif(btrim(p_order->>'receiver_name'), '') is null then raise exception 'recipient_name_required'; end if;
  if nullif(regexp_replace(coalesce(p_order->>'receiver_phone',''), '\D', '', 'g'), '') is null then raise exception 'recipient_phone_required'; end if;
  if nullif(btrim(p_order->>'receiver_city'), '') is null then raise exception 'delivery_city_required'; end if;
  if nullif(btrim(p_order->>'receiver_address'), '') is null then raise exception 'delivery_address_required'; end if;
  if v_payment not in ('sender_pays','receiver_pays','cod','prepaid') then raise exception 'invalid_payment_method'; end if;

  if v_service = 'international' then
    begin
      execute 'select to_jsonb(x) from public.calculate_delivery_price($1,$2,$3) x limit 1'
        into v_price_json
        using coalesce(nullif(p_order->>'sender_city',''), v_merchant.city, v_merchant.emirate),
              p_order->>'receiver_city',
              v_weight;
      v_total := coalesce(
        public.dn_numeric_or_null(v_price_json->>'total'),
        public.dn_numeric_or_null(v_price_json->>'total_price'),
        public.dn_numeric_or_null(v_price_json->>'price'),
        public.dn_numeric_or_null(v_price_json->>'delivery_price')
      );
      v_base_fee := coalesce(
        public.dn_numeric_or_null(v_price_json->>'base_fee'),
        public.dn_numeric_or_null(v_price_json->>'base_price'),
        v_total
      );
    exception when others then
      raise exception 'merchant_international_pricing_failed: %', sqlerrm;
    end;
  else
    v_base_fee := public.daynight_official_local_delivery_fee(
      coalesce(nullif(p_order->>'sender_city',''), v_merchant.city, v_merchant.emirate),
      p_order->>'receiver_city'
    );
    v_service_fee := case when v_service = 'express' then 15 else 0 end;
    v_total := v_base_fee + v_service_fee;
  end if;

  if v_total is null or v_total < 0 then raise exception 'merchant_pricing_unconfirmed'; end if;

  if v_payment = 'sender_pays' or v_fee_mode in ('sender_pays', 'merchant_pays', 'deduct_from_merchant') then
    v_fee_mode := 'deduct_from_merchant';
  else
    v_fee_mode := 'customer_pays';
  end if;

  if v_payment = 'cod' and v_goods = 0 and v_requested_cod > 0 then
    v_goods := case
      when v_fee_mode = 'customer_pays' then greatest(v_requested_cod - v_total, 0)
      else v_requested_cod
    end;
  end if;

  v_financials := public.daynight_calculate_order_financials(v_goods, v_total, 0, v_fee_mode);

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
    'service_type', v_service,
    'payment_method', v_payment,
    'cod_amount', case when v_payment = 'cod' then (v_financials->>'customer_total')::numeric else 0 end,
    'goods_value', (v_financials->>'goods_value')::numeric,
    'delivery_fee', (v_financials->>'delivery_fee')::numeric,
    'discount_amount', (v_financials->>'discount_amount')::numeric,
    'delivery_fee_mode', v_financials->>'delivery_fee_mode',
    'customer_total', (v_financials->>'customer_total')::numeric,
    'merchant_due', (v_financials->>'merchant_due')::numeric,
    'company_revenue', (v_financials->>'company_revenue')::numeric,
    'collected_amount', 0,
    'delivery_price', v_total,
    'subtotal', (v_financials->>'customer_total')::numeric,
    'base_price', v_base_fee,
    'total', (v_financials->>'customer_total')::numeric,
    'total_price', (v_financials->>'customer_total')::numeric,
    'amount', (v_financials->>'customer_total')::numeric,
    'price', (v_financials->>'customer_total')::numeric,
    'currency', 'AED',
    'source_channel', coalesce(nullif(btrim(p_order->>'source_channel'), ''), 'merchant_portal'),
    'source_domain', 'daynightae.com',
    'status', 'pending',
    'status_history', jsonb_build_array(jsonb_build_object(
      'status','pending',
      'created_at',now(),
      'note','Created by authenticated merchant portal at official delivery fee ' || v_total || ' AED'
    )),
    'created_by', auth.uid()::text,
    'created_at', now(),
    'updated_at', now()
  ));

  select
    string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
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
    using v_payload into v_order;

  if to_jsonb(v_order)->>'merchant_id' is distinct from v_merchant_id::text then
    raise exception 'merchant_order_link_verification_failed';
  end if;

  return v_order;
end;
$$;

revoke all on function public.merchant_create_order(jsonb) from public, anon;
grant execute on function public.merchant_create_order(jsonb) to authenticated;

-- Keep zero-value merchant-paid orders unposted after delivery so Accounts can
-- close them deliberately. All status and payment ENUM values are cast to text.
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
  v_payment text;
  v_fee_mode text;
  v_deferred_zero_merchant boolean := false;
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
  v_old_status := case
    when tg_op = 'UPDATE' then lower(replace(coalesce(old.status::text, ''), '-', '_'))
    else ''
  end;
  v_payment := lower(replace(coalesce(new.payment_method::text, ''), '-', '_'));
  v_fee_mode := lower(replace(coalesce(new.delivery_fee_mode, ''), '-', '_'));

  v_deferred_zero_merchant :=
    v_status in ('delivered', 'completed', 'complete')
    and v_old_status not in ('delivered', 'completed', 'complete')
    and new.financial_posted_at is null
    and (v_fee_mode = 'deduct_from_merchant' or v_payment in ('sender_pays', 'merchant_pays'))
    and coalesce(new.goods_value, 0) = 0
    and coalesce(new.delivery_fee, 0) = 0
    and coalesce(new.discount_amount, 0) = 0
    and coalesce(new.customer_total, 0) = 0;

  if v_status in ('delivered', 'completed', 'complete')
     and v_old_status not in ('delivered', 'completed', 'complete') then
    if v_deferred_zero_merchant then
      new.collected_amount := 0;
      new.financial_posted_at := null;
    else
      new.collected_amount := new.customer_total;
      new.financial_posted_at := coalesce(new.financial_posted_at, now());
    end if;
  end if;

  return new;
end;
$$;

-- Explicit Accounts action. A true zero order becomes a 25 AED merchant debit
-- only when delivered and closed, and the ledger remains idempotent.
create or replace function public.admin_close_merchant_order_accounting(
  p_order_id uuid,
  p_delivery_fee numeric default 25
)
returns public.orders
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  r public.orders;
  v_status text;
  v_fee numeric(14,2) := case
    when coalesce(p_delivery_fee, 0) <= 0 then 25
    else round(p_delivery_fee, 2)
  end;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;

  select * into r from public.orders where id = p_order_id for update;
  if r.id is null then raise exception 'order_not_found'; end if;
  if r.merchant_id is null then raise exception 'merchant_required'; end if;

  v_status := lower(replace(coalesce(r.status::text, ''), '-', '_'));
  if v_status not in ('delivered', 'completed', 'complete') then
    raise exception 'order_must_be_delivered_before_accounting_close';
  end if;

  if r.financial_posted_at is not null
     and (coalesce(r.delivery_fee, 0) <> 0
       or coalesce(r.merchant_due, 0) <> 0
       or coalesce(r.company_revenue, 0) <> 0) then
    return r;
  end if;

  if r.financial_posted_at is not null then
    delete from public.order_financial_settlements where order_id = r.id::text;
    delete from public.financial_account_entries
      where order_id = r.id::text and entry_type = 'delivered_order_settlement';
    delete from public.merchant_statement_entries
      where order_id = r.id and entry_type = 'delivered_order_settlement';
    update public.orders
      set financial_posted_at = null, updated_at = now()
      where id = r.id
      returning * into r;
  end if;

  update public.orders
  set delivery_fee = v_fee,
      delivery_price = v_fee,
      base_price = v_fee,
      delivery_fee_mode = 'deduct_from_merchant',
      collected_amount = 0,
      financial_posted_at = now(),
      updated_at = now()
  where id = r.id
  returning * into r;

  return r;
exception when others then
  raise exception using
    message = 'admin_close_merchant_order_accounting_failed: ' || sqlerrm,
    detail = 'SQLSTATE=' || sqlstate,
    hint = 'The order must be delivered and linked to a real merchant. The default merchant charge is 25 AED.';
end;
$$;

revoke all on function public.admin_close_merchant_order_accounting(uuid, numeric) from public, anon;
grant execute on function public.admin_close_merchant_order_accounting(uuid, numeric) to authenticated;

create or replace function public.zero_order_accounting_hotfix_health()
returns jsonb
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'ok',
      to_regprocedure('public.admin_create_coupon_order(jsonb)') is not null
      and to_regprocedure('public.merchant_create_order(jsonb)') is not null
      and to_regprocedure('public.admin_close_merchant_order_accounting(uuid,numeric)') is not null
      and to_regprocedure('public.portal_notify_order_lifecycle()') is not null
      and to_regprocedure('public.admin_dispatch_order_runtime(jsonb)') is not null
      and to_regprocedure('public.driver_update_order_status(text,text,text)') is not null,
    'enum_safe_order_trigger', to_regprocedure('public.portal_notify_order_lifecycle()') is not null,
    'admin_create_order_ready', to_regprocedure('public.admin_create_coupon_order(jsonb)') is not null,
    'merchant_create_order_ready', to_regprocedure('public.merchant_create_order(jsonb)') is not null,
    'merchant_accounting_close_ready', to_regprocedure('public.admin_close_merchant_order_accounting(uuid,numeric)') is not null,
    'driver_dispatch_ready', to_regprocedure('public.admin_dispatch_order_runtime(jsonb)') is not null,
    'driver_status_ready', to_regprocedure('public.driver_update_order_status(text,text,text)') is not null,
    'official_main_delivery_fee', 25,
    'official_extended_delivery_fee', 50,
    'default_merchant_delivery_fee', 25,
    'zero_orders_wait_for_accounts_close', true
  );
$$;

revoke all on function public.zero_order_accounting_hotfix_health() from public, anon;
grant execute on function public.zero_order_accounting_hotfix_health() to authenticated;

notify pgrst, 'reload schema';

commit;
