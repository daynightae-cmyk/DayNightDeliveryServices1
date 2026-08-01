-- DAY NIGHT DELIVERY SERVICES
-- Registered-merchant orders remain coupon-protected. A genuine admin personal
-- order may omit its optional coupon reference and still has no merchant owner.

begin;

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
  v_personal_order boolean := false;
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

  -- Narrow exemption: the official personal marker and no ownership identity.
  v_personal_order :=
    v_source = 'admin_personal_order'
    and new.merchant_id is null
    and nullif(btrim(coalesce(to_jsonb(new) ->> 'merchant_code', '')), '') is null
    and nullif(btrim(coalesce(to_jsonb(new) ->> 'merchant_name', '')), '') is null;

  v_policy_write :=
    v_admin_write
    or v_source in (
      'admin_operations',
      'admin_panel',
      'admin',
      'admin_coupon_photo',
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
      or coalesce(to_jsonb(new) ->> 'receiver_name', '')
        is distinct from coalesce(to_jsonb(old) ->> 'receiver_name', '')
      or coalesce(to_jsonb(new) ->> 'receiver_phone', '')
        is distinct from coalesce(to_jsonb(old) ->> 'receiver_phone', '');
  end if;

  if v_policy_write and v_core_changed and v_coupon is null and not v_personal_order then
    raise exception using
      errcode = '23502',
      message = 'رقم الكوبون مطلوب ولا يمكن حفظ الطلب بدونه.',
      detail = jsonb_build_object(
        'code', 'coupon_number_required_for_order',
        'source_channel', v_source
      )::text,
      hint = 'أدخل رقم الكوبون ثم أعد الحفظ.';
  end if;

  -- A supplied personal coupon remains serialized and globally unique.
  if v_identity_changed and v_coupon_key is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_coupon_key, 20260801043000));

    select
      o.id::text,
      coalesce(
        nullif(btrim(o.tracking_number), ''),
        nullif(btrim(o.invoice_number), ''),
        o.id::text
      ),
      coalesce(
        nullif(btrim(o.merchant_name), ''),
        nullif(btrim(o.sender_name), ''),
        'غير محدد'
      ),
      coalesce(nullif(btrim(o.receiver_name), ''), 'غير محدد')
    into
      v_conflict_id,
      v_conflict_tracking,
      v_conflict_merchant,
      v_conflict_receiver
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

revoke all on function public.admin_enforce_order_coupon_policy()
  from public, anon;
grant execute on function public.admin_enforce_order_coupon_policy()
  to authenticated;

do $$
begin
  if to_regprocedure('public.admin_enforce_order_coupon_policy()') is null then
    raise exception 'personal_order_optional_coupon_policy_function_missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.orders'::regclass
      and tgname = 'trg_admin_enforce_order_coupon_policy'
      and not tgisinternal
  ) then
    raise exception 'personal_order_optional_coupon_policy_trigger_missing';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
