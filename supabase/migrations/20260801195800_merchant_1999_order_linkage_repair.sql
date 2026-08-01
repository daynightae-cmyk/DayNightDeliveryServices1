-- DAY NIGHT DELIVERY SERVICES
-- Repair three confirmed coupon orders that were stored against an unlinked duplicate
-- merchant row instead of the authenticated Merchant 1999 row.
--
-- Safety:
-- - no order or merchant is deleted;
-- - receiver, status, driver, and financial fields are untouched;
-- - the transaction aborts if Merchant 1999 is missing/ambiguous or if any target
--   coupon is missing/duplicated;
-- - merchant portal isolation remains merchant_id-only.

begin;

create or replace function public.dn_normalized_merchant_identity(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select nullif(
    lower(
      regexp_replace(
        translate(
          btrim(coalesce(p_value, '')),
          '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
          '01234567890123456789'
        ),
        '[^[:alnum:]]+',
        '',
        'g'
      )
    ),
    ''
  );
$$;

create or replace function public.dn_merchant_phone_digits(p_value text)
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
      '[^0-9]+',
      '',
      'g'
    ),
    ''
  );
$$;

-- Canonicalize a newly selected duplicate merchant row only when exactly one active,
-- authenticated merchant has the same exact merchant code. If the code is absent,
-- exact trade name + exact phone is required. This keeps UUID isolation strict.
create or replace function public.dn_enforce_canonical_order_merchant_link()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_selected public.merchants%rowtype;
  v_canonical public.merchants%rowtype;
  v_candidates uuid[] := '{}'::uuid[];
  v_code text;
  v_name text;
  v_phone text;
begin
  if new.merchant_id is null then
    return new;
  end if;

  select *
  into v_selected
  from public.merchants m
  where m.id = new.merchant_id
  limit 1;

  if v_selected.id is null then
    raise exception using
      errcode = '23503',
      message = 'merchant_not_found_for_order',
      detail = jsonb_build_object('merchant_id', new.merchant_id)::text;
  end if;

  if lower(coalesce(v_selected.status, 'active')) in ('deleted', 'archived', 'blocked', 'suspended') then
    raise exception using
      errcode = '23514',
      message = 'merchant_inactive_for_order',
      detail = jsonb_build_object('merchant_id', v_selected.id, 'status', v_selected.status)::text;
  end if;

  -- An already authenticated merchant row is authoritative.
  if v_selected.user_id is not null then
    new.merchant_name := v_selected.trade_name;
    new.merchant_code := v_selected.merchant_code;
    return new;
  end if;

  v_code := public.dn_normalized_merchant_identity(v_selected.merchant_code);
  v_name := public.dn_normalized_merchant_identity(v_selected.trade_name);
  v_phone := public.dn_merchant_phone_digits(v_selected.phone);

  if v_code is not null then
    select coalesce(
      array_agg(m.id order by m.updated_at desc nulls last, m.created_at desc nulls last, m.id),
      '{}'::uuid[]
    )
    into v_candidates
    from public.merchants m
    where m.id <> v_selected.id
      and m.user_id is not null
      and lower(coalesce(m.status, 'active')) not in ('deleted', 'archived', 'blocked', 'suspended')
      and public.dn_normalized_merchant_identity(m.merchant_code) = v_code;
  elsif v_name is not null and v_phone is not null then
    select coalesce(
      array_agg(m.id order by m.updated_at desc nulls last, m.created_at desc nulls last, m.id),
      '{}'::uuid[]
    )
    into v_candidates
    from public.merchants m
    where m.id <> v_selected.id
      and m.user_id is not null
      and lower(coalesce(m.status, 'active')) not in ('deleted', 'archived', 'blocked', 'suspended')
      and public.dn_normalized_merchant_identity(m.trade_name) = v_name
      and public.dn_merchant_phone_digits(m.phone) = v_phone;
  end if;

  if cardinality(v_candidates) > 1 then
    raise exception using
      errcode = '23514',
      message = 'merchant_canonical_link_ambiguous',
      detail = jsonb_build_object(
        'selected_merchant_id', v_selected.id,
        'candidate_count', cardinality(v_candidates)
      )::text,
      hint = 'راجع دليل التجار واربط حسابًا واحدًا فقط قبل إنشاء الطلب.';
  end if;

  if cardinality(v_candidates) = 1 then
    select * into v_canonical
    from public.merchants
    where id = v_candidates[1];

    new.merchant_id := v_canonical.id;
    new.merchant_name := v_canonical.trade_name;
    new.merchant_code := v_canonical.merchant_code;
  else
    -- No safe canonical replacement exists yet. Keep the exact selected row.
    new.merchant_name := v_selected.trade_name;
    new.merchant_code := v_selected.merchant_code;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_canonical_merchant_link on public.orders;
create trigger trg_orders_canonical_merchant_link
before insert or update of merchant_id, merchant_code, merchant_name
on public.orders
for each row
execute function public.dn_enforce_canonical_order_merchant_link();

revoke all on function public.dn_enforce_canonical_order_merchant_link() from public, anon;
grant execute on function public.dn_enforce_canonical_order_merchant_link() to authenticated, service_role;

-- Targeted, atomic repair for the three photographed coupons assigned to Merchant 1999.
do $repair$
declare
  v_target_coupons text[] := array['010505', '010503', '003860'];
  v_coupon text;
  v_candidate_ids uuid[] := '{}'::uuid[];
  v_canonical public.merchants%rowtype;
  v_order_count integer;
  v_order_id text;
  v_updated integer := 0;
begin
  select coalesce(
    array_agg(m.id order by m.updated_at desc nulls last, m.created_at desc nulls last, m.id),
    '{}'::uuid[]
  )
  into v_candidate_ids
  from public.merchants m
  where m.user_id is not null
    and lower(coalesce(m.status, 'active')) not in ('deleted', 'archived', 'blocked', 'suspended')
    and (
      public.dn_normalized_merchant_identity(m.merchant_code) = '1999'
      or public.dn_normalized_merchant_identity(m.trade_name) = '1999'
      or public.dn_normalized_merchant_identity(m.owner_name) = '1999'
    );

  if cardinality(v_candidate_ids) <> 1 then
    raise exception using
      errcode = '23514',
      message = 'merchant_1999_canonical_account_not_unique',
      detail = jsonb_build_object(
        'candidate_count', cardinality(v_candidate_ids),
        'candidate_ids', v_candidate_ids
      )::text,
      hint = 'لم يتم تعديل أي طلب. يجب أن يوجد حساب تاجر نشط واحد فقط مرتبط بمستخدم ويحمل هوية 1999.';
  end if;

  select * into v_canonical
  from public.merchants
  where id = v_candidate_ids[1];

  foreach v_coupon in array v_target_coupons
  loop
    select count(*), min(o.id::text)
    into v_order_count, v_order_id
    from public.orders o
    where public.normalized_order_coupon(o.coupon_number)
      = public.normalized_order_coupon(v_coupon);

    if v_order_count <> 1 then
      raise exception using
        errcode = '23514',
        message = 'target_coupon_order_not_unique',
        detail = jsonb_build_object(
          'coupon_number', v_coupon,
          'matching_orders', v_order_count
        )::text,
        hint = 'لم يتم تعديل أي طلب. راجع رقم الكوبون وتكراراته أولًا.';
    end if;

    update public.orders o
    set merchant_id = v_canonical.id,
        merchant_name = v_canonical.trade_name,
        merchant_code = v_canonical.merchant_code,
        updated_at = now()
    where o.id::text = v_order_id
      and (
        o.merchant_id is distinct from v_canonical.id
        or o.merchant_name is distinct from v_canonical.trade_name
        or o.merchant_code is distinct from v_canonical.merchant_code
      );

    get diagnostics v_order_count = row_count;
    v_updated := v_updated + v_order_count;
  end loop;

  raise notice 'Merchant 1999 linkage repair completed. Rows updated: %', v_updated;
end
$repair$;

create or replace function public.admin_merchant_coupon_link_health(
  p_coupons text[] default array['010505', '010503', '003860']
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth, pg_temp
as $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_requested integer := coalesce(cardinality(p_coupons), 0);
  v_found integer := 0;
  v_linked integer := 0;
begin
  if auth.role() <> 'service_role'
     and (auth.uid() is null or not public.is_admin_or_support()) then
    raise exception 'not_authorized';
  end if;

  with requested as (
    select public.normalized_order_coupon(value) as coupon_key
    from unnest(coalesce(p_coupons, '{}'::text[])) value
    where public.normalized_order_coupon(value) is not null
  ), matched as (
    select
      public.canonical_order_coupon(o.coupon_number) as coupon_number,
      o.id::text as order_id,
      coalesce(nullif(btrim(o.tracking_number), ''), nullif(btrim(o.invoice_number), ''), o.id::text) as tracking_number,
      o.merchant_id,
      o.merchant_name,
      o.merchant_code,
      m.user_id as merchant_user_id,
      (m.id is not null and m.user_id is not null and o.merchant_id = m.id) as portal_visible_by_exact_uuid
    from requested r
    join public.orders o
      on public.normalized_order_coupon(o.coupon_number) = r.coupon_key
    left join public.merchants m on m.id = o.merchant_id
  )
  select
    coalesce(jsonb_agg(to_jsonb(matched) order by coupon_number), '[]'::jsonb),
    count(*),
    count(*) filter (where portal_visible_by_exact_uuid)
  into v_rows, v_found, v_linked
  from matched;

  return jsonb_build_object(
    'ok', v_requested > 0 and v_found = v_requested and v_linked = v_requested,
    'requested_coupons', v_requested,
    'orders_found', v_found,
    'orders_linked_to_authenticated_merchant', v_linked,
    'ownership_rule', 'orders.merchant_id = merchants.id and merchants.user_id is not null',
    'orders', v_rows,
    'checked_at', now()
  );
end;
$$;

revoke all on function public.admin_merchant_coupon_link_health(text[]) from public, anon;
grant execute on function public.admin_merchant_coupon_link_health(text[]) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
