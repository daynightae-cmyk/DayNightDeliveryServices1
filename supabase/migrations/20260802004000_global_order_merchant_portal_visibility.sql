-- DAY NIGHT DELIVERY SERVICES
-- Global order -> merchant portal visibility contract.
-- Every order carrying merchant_id must resolve to one active merchant row that is
-- linked to an authenticated portal account. This prevents successfully saved
-- orders from disappearing from the merchant portal because of UUID mismatch.
--
-- Safety:
-- - no orders, merchants, users, COD rows, statements, or financial values are deleted;
-- - existing historical rows are not reassigned automatically by this migration;
-- - ambiguous or unlinked merchant selections fail before a new order is written;
-- - merchant portal RLS remains strict exact UUID ownership.

begin;

create or replace function public.dn_merchant_portal_link_count(p_merchant_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    (case when m.user_id is not null then 1 else 0 end)
    + (
      select count(*)::integer
      from public.merchant_user_links l
      where l.merchant_id = m.id
        and l.active
        and l.user_id is distinct from m.user_id
    )
  from public.merchants m
  where m.id = p_merchant_id
    and lower(coalesce(m.status, 'active')) not in ('deleted','archived','blocked','suspended');
$$;

create or replace function public.dn_resolve_portal_merchant_uuid(p_merchant_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_selected public.merchants%rowtype;
  v_candidates uuid[] := '{}'::uuid[];
  v_code text;
  v_name text;
  v_phone text;
begin
  if p_merchant_id is null then
    raise exception using errcode = '23502', message = 'merchant_required';
  end if;

  select * into v_selected
  from public.merchants m
  where m.id = p_merchant_id
  limit 1;

  if v_selected.id is null then
    raise exception using
      errcode = '23503',
      message = 'merchant_not_found_for_order',
      detail = jsonb_build_object('merchant_id', p_merchant_id)::text;
  end if;

  if lower(coalesce(v_selected.status, 'active')) in ('deleted','archived','blocked','suspended') then
    raise exception using
      errcode = '23514',
      message = 'merchant_inactive_for_order',
      detail = jsonb_build_object('merchant_id', v_selected.id, 'status', v_selected.status)::text;
  end if;

  if coalesce(public.dn_merchant_portal_link_count(v_selected.id), 0) > 0 then
    return v_selected.id;
  end if;

  v_code := public.dn_normalized_merchant_identity(v_selected.merchant_code);
  v_name := public.dn_normalized_merchant_identity(v_selected.trade_name);
  v_phone := public.dn_merchant_phone_digits(v_selected.phone);

  select coalesce(
    array_agg(m.id order by m.updated_at desc nulls last, m.created_at desc nulls last, m.id),
    '{}'::uuid[]
  )
  into v_candidates
  from public.merchants m
  where m.id <> v_selected.id
    and lower(coalesce(m.status, 'active')) not in ('deleted','archived','blocked','suspended')
    and coalesce(public.dn_merchant_portal_link_count(m.id), 0) > 0
    and (
      (v_code is not null and public.dn_normalized_merchant_identity(m.merchant_code) = v_code)
      or (
        v_name is not null
        and v_phone is not null
        and public.dn_normalized_merchant_identity(m.trade_name) = v_name
        and public.dn_merchant_phone_digits(m.phone) = v_phone
      )
    );

  if cardinality(v_candidates) = 1 then
    return v_candidates[1];
  end if;

  if cardinality(v_candidates) > 1 then
    raise exception using
      errcode = '23514',
      message = 'merchant_portal_link_ambiguous',
      detail = jsonb_build_object(
        'selected_merchant_id', v_selected.id,
        'candidate_ids', v_candidates
      )::text,
      hint = 'يوجد أكثر من حساب بوابة مطابق. وحّد سجل التاجر واربط مستخدمًا واحدًا قبل حفظ الطلب.';
  end if;

  raise exception using
    errcode = '23514',
    message = 'merchant_portal_account_not_linked',
    detail = jsonb_build_object(
      'merchant_id', v_selected.id,
      'merchant_code', v_selected.merchant_code,
      'merchant_name', v_selected.trade_name
    )::text,
    hint = 'اربط حساب دخول التاجر بهذا السجل أولًا. لم يتم حفظ الطلب حتى لا يختفي من بوابة التاجر.';
end;
$$;

create or replace function public.admin_resolve_order_merchant(p_merchant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_resolved_id uuid;
  v_merchant public.merchants%rowtype;
  v_link_count integer;
begin
  if auth.role() <> 'service_role'
     and (auth.uid() is null or not public.is_admin_or_support()) then
    raise exception 'not_authorized';
  end if;

  v_resolved_id := public.dn_resolve_portal_merchant_uuid(p_merchant_id);

  select * into v_merchant
  from public.merchants
  where id = v_resolved_id;

  v_link_count := coalesce(public.dn_merchant_portal_link_count(v_resolved_id), 0);

  return jsonb_build_object(
    'ok', true,
    'selected_merchant_id', p_merchant_id,
    'canonical_merchant_id', v_resolved_id,
    'canonicalized', v_resolved_id is distinct from p_merchant_id,
    'portal_link_count', v_link_count,
    'merchant', to_jsonb(v_merchant),
    'ownership_rule', 'orders.merchant_id = merchant_session_id() exact UUID'
  );
end;
$$;

-- Replace the earlier permissive trigger with the strict global contract.
create or replace function public.dn_enforce_canonical_order_merchant_link()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_resolved_id uuid;
  v_merchant public.merchants%rowtype;
begin
  if new.merchant_id is null then
    return new;
  end if;

  v_resolved_id := public.dn_resolve_portal_merchant_uuid(new.merchant_id);

  select * into v_merchant
  from public.merchants
  where id = v_resolved_id;

  new.merchant_id := v_merchant.id;
  new.merchant_name := v_merchant.trade_name;
  new.merchant_code := v_merchant.merchant_code;
  return new;
end;
$$;

drop trigger if exists trg_orders_canonical_merchant_link on public.orders;
create trigger trg_orders_canonical_merchant_link
before insert or update of merchant_id, merchant_code, merchant_name
on public.orders
for each row
execute function public.dn_enforce_canonical_order_merchant_link();

create or replace function public.admin_order_merchant_visibility_health()
returns jsonb
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'ok',
      to_regprocedure('public.admin_resolve_order_merchant(uuid)') is not null
      and to_regprocedure('public.dn_resolve_portal_merchant_uuid(uuid)') is not null
      and exists (
        select 1
        from pg_trigger
        where tgrelid = 'public.orders'::regclass
          and tgname = 'trg_orders_canonical_merchant_link'
          and not tgisinternal
          and tgenabled <> 'D'
      ),
    'resolver_ready', to_regprocedure('public.admin_resolve_order_merchant(uuid)') is not null,
    'trigger_ready', exists (
      select 1
      from pg_trigger
      where tgrelid = 'public.orders'::regclass
        and tgname = 'trg_orders_canonical_merchant_link'
        and not tgisinternal
        and tgenabled <> 'D'
    ),
    'existing_orders_without_active_portal_link', (
      select count(*)
      from public.orders o
      where o.merchant_id is not null
        and coalesce(public.dn_merchant_portal_link_count(o.merchant_id), 0) = 0
    ),
    'checked_at', now()
  );
$$;

revoke all on function public.dn_merchant_portal_link_count(uuid) from public, anon, authenticated;
revoke all on function public.dn_resolve_portal_merchant_uuid(uuid) from public, anon, authenticated;
revoke all on function public.admin_resolve_order_merchant(uuid) from public, anon;
revoke all on function public.admin_order_merchant_visibility_health() from public, anon;

grant execute on function public.dn_merchant_portal_link_count(uuid) to service_role;
grant execute on function public.dn_resolve_portal_merchant_uuid(uuid) to service_role;
grant execute on function public.admin_resolve_order_merchant(uuid) to authenticated, service_role;
grant execute on function public.admin_order_merchant_visibility_health() to authenticated, service_role;

grant execute on function public.dn_enforce_canonical_order_merchant_link() to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
