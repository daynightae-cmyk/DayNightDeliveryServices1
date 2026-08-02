-- DAY NIGHT DELIVERY SERVICES
-- Personal orders: coupon required; sender phone, detailed addresses and notes optional.

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
  v_coupon text;
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

  v_coupon := public.canonical_order_coupon(p_order ->> 'coupon_number');
  if v_coupon is null then
    raise exception using
      errcode = '23502',
      message = 'رقم الكوبون مطلوب للطلب الشخصي.',
      detail = jsonb_build_object('code', 'coupon_number_required_for_personal_order')::text,
      hint = 'أدخل رقم الكوبون ثم أعد الحفظ.';
  end if;
  if nullif(btrim(p_order ->> 'sender_name'), '') is null then
    raise exception using errcode = '22023', message = 'sender_name_required';
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
      'coupon_number', v_coupon,
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
    string_agg(format('(jsonb_populate_record(null::public.orders, $1)).%I', c.column_name), ', ' order by c.ordinal_position)
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

  execute format('insert into public.orders (%s) select %s returning *', v_columns, v_values)
    using v_payload into r;

  if r.id is null then
    raise exception using errcode = '55000', message = 'personal_order_insert_returned_no_row';
  end if;
  if public.canonical_order_coupon(to_jsonb(r) ->> 'coupon_number') is null then
    raise exception using errcode = '23514', message = 'personal_order_coupon_verification_failed';
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

create or replace function public.admin_enforce_order_coupon_policy()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_coupon text := public.canonical_order_coupon(to_jsonb(new) ->> 'coupon_number');
  v_coupon_key text := public.normalized_order_coupon(to_jsonb(new) ->> 'coupon_number');
  v_old_coupon_key text := case
    when tg_op = 'UPDATE' then public.normalized_order_coupon(to_jsonb(old) ->> 'coupon_number')
    else null
  end;
  v_source text := lower(btrim(coalesce(to_jsonb(new) ->> 'source_channel', '')));
  v_admin_write boolean := false;
  v_policy_write boolean := false;
  v_core_changed boolean := false;
  v_identity_changed boolean := false;
  v_conflict_id text;
  v_conflict_tracking text;
  v_conflict_merchant text;
  v_conflict_receiver text;
begin
  if auth.uid() is not null then
    begin
      v_admin_write := public.is_admin_or_support();
    exception when others then
      v_admin_write := false;
    end;
  end if;

  v_policy_write :=
    v_admin_write
    or v_source in (
      'admin_operations',
      'admin_panel',
      'admin',
      'admin_coupon_photo',
      'admin_personal_order',
      'merchant_portal',
      'merchant_app',
      'shipment_import',
      'import'
    )
    or (tg_op = 'INSERT' and new.merchant_id is not null);

  if tg_op = 'INSERT' then
    v_core_changed := true;
    v_identity_changed := true;
  else
    v_identity_changed :=
      new.merchant_id is distinct from old.merchant_id
      or v_coupon_key is distinct from v_old_coupon_key;

    v_core_changed :=
      v_identity_changed
      or coalesce(to_jsonb(new) ->> 'receiver_name', '') is distinct from coalesce(to_jsonb(old) ->> 'receiver_name', '')
      or coalesce(to_jsonb(new) ->> 'receiver_phone', '') is distinct from coalesce(to_jsonb(old) ->> 'receiver_phone', '');
  end if;

  if v_policy_write and v_core_changed and v_coupon is null then
    raise exception using
      errcode = '23502',
      message = 'رقم الكوبون مطلوب ولا يمكن حفظ الطلب بدونه.',
      detail = jsonb_build_object(
        'code', case when v_source = 'admin_personal_order'
          then 'coupon_number_required_for_personal_order'
          else 'coupon_number_required_for_order'
        end,
        'source_channel', v_source
      )::text,
      hint = 'أدخل رقم الكوبون ثم أعد الحفظ.';
  end if;

  if v_identity_changed and v_coupon_key is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_coupon_key, 20260801043000));

    select
      o.id::text,
      coalesce(nullif(btrim(o.tracking_number), ''), nullif(btrim(o.invoice_number), ''), o.id::text),
      coalesce(nullif(btrim(o.merchant_name), ''), nullif(btrim(o.sender_name), ''), 'غير محدد'),
      coalesce(nullif(btrim(o.receiver_name), ''), 'غير محدد')
    into v_conflict_id, v_conflict_tracking, v_conflict_merchant, v_conflict_receiver
    from public.orders o
    where public.normalized_order_coupon(o.coupon_number) = v_coupon_key
      and o.id::text is distinct from new.id::text
    order by o.created_at asc nulls last, o.id::text asc
    limit 1;

    if v_conflict_id is not null then
      raise exception using
        errcode = '23505',
        message = format(
          'رقم الكوبون «%s» مسجل بالفعل على الطلب %s للتاجر %s. لا يمكن تكرار رقم الكوبون.',
          v_coupon,
          v_conflict_tracking,
          v_conflict_merchant
        ),
        detail = jsonb_build_object(
          'code', 'coupon_number_already_exists',
          'coupon_number', v_coupon,
          'existing_order_id', v_conflict_id,
          'existing_tracking_number', v_conflict_tracking,
          'existing_merchant', v_conflict_merchant,
          'existing_receiver', v_conflict_receiver
        )::text,
        hint = 'استخدم رقم كوبون جديداً أو افتح الطلب الموجود من صفحة كافة الطلبات.';
    end if;
  end if;

  new.coupon_number := v_coupon;
  return new;
end;
$$;

revoke all on function public.admin_enforce_order_coupon_policy() from public, anon;
grant execute on function public.admin_enforce_order_coupon_policy() to authenticated;

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
    'coupon_required', true,
    'sender_phone_required', false,
    'detailed_addresses_required', false,
    'notes_required', false,
    'duplicate_coupon_protected', true
  );
$$;

revoke all on function public.admin_personal_orders_runtime_health() from public, anon;
grant execute on function public.admin_personal_orders_runtime_health() to authenticated, service_role;

select pg_notify('pgrst', 'reload schema');

commit;
