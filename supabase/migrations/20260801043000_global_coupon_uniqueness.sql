-- DAY NIGHT DELIVERY SERVICES
-- Global order coupon integrity.
--
-- This migration deliberately preserves historical duplicate rows so no existing
-- shipment is silently changed or deleted. From the moment it is applied, every
-- new/changed coupon is serialized and checked globally across all merchants and
-- all order creation routes.

begin;

create or replace function public.canonical_order_coupon(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select nullif(
    regexp_replace(
      translate(
        btrim(coalesce(p_value, '')),
        '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
        '01234567890123456789'
      ),
      '[[:space:]]+',
      '',
      'g'
    ),
    ''
  );
$$;

create or replace function public.normalized_order_coupon(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select lower(public.canonical_order_coupon(p_value));
$$;

create index if not exists idx_orders_coupon_global_lookup
  on public.orders (public.normalized_order_coupon(coupon_number))
  where public.normalized_order_coupon(coupon_number) is not null;

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
  v_source text := lower(coalesce(to_jsonb(new) ->> 'source_channel', ''));
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

  -- Historical/public rows may remain coupon-less, but every real merchant/admin
  -- order creation and every identity/core edit must carry a coupon.
  if v_policy_write and v_core_changed and v_coupon is null then
    raise exception using
      errcode = '23502',
      message = 'رقم الكوبون مطلوب ولا يمكن حفظ الطلب بدونه.',
      detail = jsonb_build_object(
        'code', 'coupon_number_required_for_order',
        'source_channel', v_source
      )::text,
      hint = 'أدخل رقم الكوبون ثم أعد الحفظ.';
  end if;

  -- Serialize the same normalized coupon key. This closes the race condition
  -- where two simultaneous requests could both pass a normal EXISTS check.
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

drop trigger if exists trg_admin_enforce_order_coupon_policy on public.orders;
create trigger trg_admin_enforce_order_coupon_policy
before insert or update
on public.orders
for each row
execute function public.admin_enforce_order_coupon_policy();

revoke all on function public.admin_enforce_order_coupon_policy()
  from public, anon;
grant execute on function public.admin_enforce_order_coupon_policy()
  to authenticated;

create or replace function public.admin_find_coupon_conflict(
  p_coupon text,
  p_exclude_order_id text default null
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth, pg_temp
as $$
declare
  v_key text := public.normalized_order_coupon(p_coupon);
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_support() then
    raise exception 'not_authorized';
  end if;

  if v_key is null then
    return null;
  end if;

  select jsonb_build_object(
    'coupon_number', public.canonical_order_coupon(o.coupon_number),
    'order_id', o.id::text,
    'tracking_number', coalesce(
      nullif(btrim(o.tracking_number), ''),
      nullif(btrim(o.invoice_number), ''),
      o.id::text
    ),
    'merchant_name', coalesce(
      nullif(btrim(o.merchant_name), ''),
      nullif(btrim(o.sender_name), ''),
      'غير محدد'
    ),
    'receiver_name', coalesce(nullif(btrim(o.receiver_name), ''), 'غير محدد'),
    'receiver_phone', coalesce(nullif(btrim(o.receiver_phone), ''), '')
  )
  into v_result
  from public.orders o
  where public.normalized_order_coupon(o.coupon_number) = v_key
    and (p_exclude_order_id is null or o.id::text <> p_exclude_order_id)
  order by o.created_at asc nulls last, o.id::text asc
  limit 1;

  return v_result;
end;
$$;

revoke all on function public.admin_find_coupon_conflict(text, text)
  from public, anon;
grant execute on function public.admin_find_coupon_conflict(text, text)
  to authenticated;

create or replace function public.admin_coupon_integrity_health()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth, pg_temp
as $$
declare
  v_duplicate_groups bigint := 0;
  v_duplicate_orders bigint := 0;
begin
  if auth.uid() is null or not public.is_admin_or_support() then
    raise exception 'not_authorized';
  end if;

  select
    count(*),
    coalesce(sum(group_count), 0)
  into v_duplicate_groups, v_duplicate_orders
  from (
    select count(*)::bigint as group_count
    from public.orders
    where public.normalized_order_coupon(coupon_number) is not null
    group by public.normalized_order_coupon(coupon_number)
    having count(*) > 1
  ) duplicates;

  return jsonb_build_object(
    'ok',
      to_regprocedure('public.admin_enforce_order_coupon_policy()') is not null
      and to_regprocedure('public.admin_find_coupon_conflict(text,text)') is not null,
    'scope', 'global_all_orders',
    'race_protection', 'transaction_advisory_lock',
    'coupon_trigger', exists (
      select 1
      from pg_trigger
      where tgname = 'trg_admin_enforce_order_coupon_policy'
        and not tgisinternal
    ),
    'global_lookup_index', to_regclass('public.idx_orders_coupon_global_lookup')::text,
    'historical_duplicate_groups', v_duplicate_groups,
    'historical_orders_in_duplicate_groups', v_duplicate_orders,
    'historical_rows_preserved', true
  );
end;
$$;

revoke all on function public.admin_coupon_integrity_health()
  from public, anon;
grant execute on function public.admin_coupon_integrity_health()
  to authenticated;

notify pgrst, 'reload schema';

commit;
