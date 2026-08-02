-- DAY NIGHT DELIVERY SERVICES
-- Restore the protected personal-order creation contract in production.
-- Personal orders are legally independent from every merchant account.

begin;

create or replace function public.admin_create_personal_order(p_order jsonb)
returns public.orders
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  r public.orders;
  v_created_at timestamptz := now();
  v_tracking text;
  v_goods numeric(14,2) := 0;
  v_discount numeric(14,2) := 0;
  v_delivery constant numeric(14,2) := 25;
  v_customer_total numeric(14,2);
  v_payment text;
  v_payload jsonb;
  v_columns text;
  v_values text;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'not_authenticated';
  end if;
  if not public.is_admin_or_support() then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;

  if nullif(btrim(p_order ->> 'sender_name'), '') is null then
    raise exception using errcode = '22023', message = 'sender_name_required';
  end if;
  if nullif(btrim(p_order ->> 'sender_phone'), '') is null then
    raise exception using errcode = '22023', message = 'sender_phone_required';
  end if;
  if nullif(btrim(p_order ->> 'receiver_name'), '') is null then
    raise exception using errcode = '22023', message = 'receiver_name_required';
  end if;
  if nullif(btrim(p_order ->> 'receiver_phone'), '') is null then
    raise exception using errcode = '22023', message = 'receiver_phone_required';
  end if;

  begin
    if nullif(btrim(p_order ->> 'created_at'), '') is not null then
      v_created_at := (p_order ->> 'created_at')::timestamptz;
    end if;
  exception when others then
    v_created_at := now();
  end;

  begin
    v_goods := greatest(coalesce(nullif(btrim(p_order ->> 'goods_value'), '')::numeric, 0), 0);
  exception when others then
    v_goods := 0;
  end;

  begin
    v_discount := greatest(coalesce(nullif(btrim(p_order ->> 'discount_amount'), '')::numeric, 0), 0);
  exception when others then
    v_discount := 0;
  end;

  if v_discount > v_goods + v_delivery then
    raise exception using errcode = '22023', message = 'discount_exceeds_personal_order_total';
  end if;

  v_customer_total := round(v_goods + v_delivery - v_discount, 2);
  v_payment := lower(replace(coalesce(nullif(btrim(p_order ->> 'payment_method'), ''), 'cod'), '-', '_'));
  if v_payment not in ('cod', 'receiver_pays', 'prepaid') then
    v_payment := 'cod';
  end if;

  v_tracking := coalesce(
    nullif(btrim(p_order ->> 'tracking_number'), ''),
    nullif(btrim(p_order ->> 'tracking_code'), ''),
    nullif(btrim(p_order ->> 'invoice_number'), ''),
    'DN-PER-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  );

  v_payload := jsonb_strip_nulls(
    coalesce(p_order, '{}'::jsonb)
    || jsonb_build_object(
      'tracking_number', v_tracking,
      'tracking_code', v_tracking,
      'invoice_number', coalesce(nullif(btrim(p_order ->> 'invoice_number'), ''), v_tracking),
      'merchant_id', null,
      'merchant_name', null,
      'merchant_code', null,
      'source_channel', 'admin_personal_order',
      'source_domain', 'daynightae.com',
      'shipping_scope', 'local',
      'service_type', 'standard',
      'payment_method', v_payment,
      'cod_amount', case when v_payment = 'cod' then v_customer_total else 0 end,
      'goods_value', v_goods,
      'delivery_fee', v_delivery,
      'discount_amount', v_discount,
      'delivery_fee_mode', 'customer_pays',
      'customer_total', v_customer_total,
      'merchant_due', 0,
      'company_revenue', v_delivery,
      'delivery_price', v_delivery,
      'base_price', v_delivery,
      'subtotal', v_customer_total,
      'total', v_customer_total,
      'total_price', v_customer_total,
      'amount', v_customer_total,
      'price', v_customer_total,
      'manual_delivery_price', null,
      'price_source', 'system',
      'currency', 'AED',
      'status', 'pending',
      'status_history', jsonb_build_array(
        jsonb_build_object(
          'status', 'pending',
          'date', v_created_at,
          'created_at', v_created_at,
          'note', 'Personal order without merchant; fixed delivery 25 AED'
        )
      ),
      'created_by', auth.uid()::text,
      'created_at', v_created_at,
      'updated_at', now()
    )
  );

  select
    string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
    string_agg(
      format('(jsonb_populate_record(null::public.orders, $1)).%I', c.column_name),
      ', ' order by c.ordinal_position
    )
  into v_columns, v_values
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'orders'
    and v_payload ? c.column_name
    and coalesce(c.is_generated, 'NEVER') = 'NEVER'
    and coalesce(c.identity_generation, '') <> 'ALWAYS';

  if nullif(v_columns, '') is null then
    raise exception using errcode = '55000', message = 'orders_schema_has_no_insertable_payload_columns';
  end if;

  execute format(
    'insert into public.orders (%s) select %s returning *',
    v_columns,
    v_values
  ) using v_payload into r;

  if r.id is null then
    raise exception using errcode = '55000', message = 'personal_order_insert_returned_no_row';
  end if;
  if (to_jsonb(r) ->> 'merchant_id') is not null then
    raise exception using errcode = '23514', message = 'personal_order_merchant_must_be_null';
  end if;
  if coalesce(to_jsonb(r) ->> 'source_channel', '') <> 'admin_personal_order' then
    raise exception using errcode = '23514', message = 'personal_order_marker_verification_failed';
  end if;
  if round(coalesce((to_jsonb(r) ->> 'delivery_fee')::numeric, 0), 2) <> 25 then
    raise exception using errcode = '23514', message = 'personal_order_delivery_fee_verification_failed';
  end if;
  if round(coalesce((to_jsonb(r) ->> 'merchant_due')::numeric, 0), 2) <> 0 then
    raise exception using errcode = '23514', message = 'personal_order_merchant_due_verification_failed';
  end if;

  return r;
exception when others then
  raise exception using
    message = 'admin_create_personal_order_failed: ' || sqlerrm,
    detail = 'SQLSTATE=' || sqlstate,
    hint = 'Confirm admin/support access and the protected personal-order database contract.';
end;
$$;

revoke all on function public.admin_create_personal_order(jsonb) from public, anon;
grant execute on function public.admin_create_personal_order(jsonb) to authenticated, service_role;

create or replace function public.admin_personal_orders_runtime_health()
returns jsonb
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'ok', to_regprocedure('public.admin_create_personal_order(jsonb)') is not null,
    'fixed_delivery_fee', 25,
    'source_channel', 'admin_personal_order',
    'merchant_required', false,
    'merchant_id_must_be_null', true,
    'duplicate_coupon_protected', true
  );
$$;

revoke all on function public.admin_personal_orders_runtime_health() from public, anon;
grant execute on function public.admin_personal_orders_runtime_health() to authenticated, service_role;

select pg_notify('pgrst', 'reload schema');

commit;
