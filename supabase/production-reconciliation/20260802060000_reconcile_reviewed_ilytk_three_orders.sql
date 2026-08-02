-- DAY NIGHT DELIVERY SERVICES
-- One-time reviewed production reconciliation for the three orders explicitly
-- confirmed by the owner as belonging to merchant DN-MER-SHOP-ILYTK.
--
-- This file intentionally lives outside supabase/migrations. It must only be
-- executed against the linked production project through the guarded one-time
-- workflow. It never creates or deletes an order and it explicitly excludes
-- coupon 010504.

begin;

set local statement_timeout = '10min';
set local lock_timeout = '60s';
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $reconcile$
declare
  v_ilytk_id constant uuid := '325bb302-75c3-48cc-84ba-e58817d6d148';
  v_g3bxg_id constant uuid := 'b0da2d6d-2fc9-43b3-9e38-260ff2dbd68e';
  v_excluded_order_id constant uuid := '5fa6bc07-a7d6-4b43-a4c4-70dad6af160a';
  v_target_ids constant uuid[] := array[
    '248fa498-0c06-4aa4-8766-6c2ee3e19f9e'::uuid,
    '488f8a33-17b4-490a-a96a-0f7c975f08a7'::uuid,
    'adfc2d20-5c6b-403f-a107-d9aa13dd929b'::uuid
  ];
  v_ilytk public.merchants%rowtype;
  v_g3bxg public.merchants%rowtype;
  v_target_count integer;
  v_updated integer;
  v_dependency_conflicts integer;
  v_dependency_mismatches integer;
  v_total_before bigint;
  v_total_after bigint;
  v_audit_before integer;
  v_audit_after integer;
  v_before jsonb;
  v_after jsonb;
  v_excluded_before jsonb;
  v_excluded_after jsonb;
begin
  if session_user not in ('postgres', 'supabase_admin') then
    raise exception 'ilytk_reconciliation_privileged_session_required_%', session_user;
  end if;

  lock table public.merchants in share mode;
  lock table public.merchant_user_links in share mode;

  select * into v_ilytk
  from public.merchants
  where id = v_ilytk_id
  for share;

  if v_ilytk.id is null
     or public.dn_normalized_merchant_identity(v_ilytk.merchant_code)
        <> public.dn_normalized_merchant_identity('DN-MER-SHOP-ILYTK')
     or public.dn_merchant_phone_digits(v_ilytk.phone) <> '971501050516'
     or lower(coalesce(v_ilytk.status, 'active')) in ('deleted','archived','blocked','suspended')
     or public.dn_merchant_portal_link_count(v_ilytk.id) < 1 then
    raise exception 'ilytk_canonical_identity_or_portal_link_rejected_%', to_jsonb(v_ilytk);
  end if;

  select * into v_g3bxg
  from public.merchants
  where id = v_g3bxg_id
  for share;

  if v_g3bxg.id is null
     or public.dn_normalized_merchant_identity(v_g3bxg.merchant_code)
        <> public.dn_normalized_merchant_identity('DN-MER-SHOP-G3BXG') then
    raise exception 'g3bxg_expected_current_owner_rejected_%', to_jsonb(v_g3bxg);
  end if;

  select count(*)::integer into v_target_count
  from (
    values
      ('248fa498-0c06-4aa4-8766-6c2ee3e19f9e'::uuid, '003860'::text),
      ('488f8a33-17b4-490a-a96a-0f7c975f08a7'::uuid, '010503'::text),
      ('adfc2d20-5c6b-403f-a107-d9aa13dd929b'::uuid, '010505'::text)
  ) expected(order_id, coupon_number)
  join public.orders o
    on o.id = expected.order_id
   and btrim(coalesce(o.coupon_number, '')) = expected.coupon_number
  where o.merchant_id in (v_g3bxg_id, v_ilytk_id)
    and public.dn_merchant_phone_digits(o.sender_phone) = '971501050516'
    and (
      (o.merchant_id = v_g3bxg_id
       and public.dn_normalized_merchant_identity(o.merchant_code)
           = public.dn_normalized_merchant_identity('DN-MER-SHOP-G3BXG'))
      or
      (o.merchant_id = v_ilytk_id
       and public.dn_normalized_merchant_identity(o.merchant_code)
           = public.dn_normalized_merchant_identity('DN-MER-SHOP-ILYTK'))
    );

  if v_target_count <> 3 then
    raise exception 'ilytk_exact_target_set_rejected_%_expected_3', v_target_count;
  end if;

  select to_jsonb(o) into v_excluded_before
  from public.orders o
  where o.id = v_excluded_order_id
    and btrim(coalesce(o.coupon_number, '')) = '010504'
    and o.merchant_id = v_g3bxg_id
  for update;

  if v_excluded_before is null then
    raise exception 'excluded_coupon_010504_state_rejected';
  end if;

  -- Lock the exact target rows first. PostgreSQL does not allow FOR UPDATE on
  -- the aggregate snapshot query itself.
  perform 1
  from public.orders o
  where o.id = any(v_target_ids)
  order by o.id
  for update;

  select count(*) into v_total_before from public.orders;

  select jsonb_object_agg(
    o.id::text,
    to_jsonb(o) - 'merchant_id' - 'merchant_code' - 'merchant_name' - 'updated_at'
    order by o.id
  ) into v_before
  from public.orders o
  where o.id = any(v_target_ids);

  select count(*)::integer into v_dependency_conflicts
  from public.orders o
  where o.id = any(v_target_ids)
    and o.merchant_id = v_g3bxg_id
    and coalesce((
      public.dn_order_dependency_ownership_snapshot(o.id, v_g3bxg_id, v_ilytk_id)
      ->> 'total_conflicts'
    )::integer, 0) <> 0;

  if v_dependency_conflicts <> 0 then
    raise exception 'ilytk_dependency_security_conflicts_%', v_dependency_conflicts;
  end if;

  select count(*)::integer into v_audit_before
  from public.order_merchant_repair_audit
  where order_id = any(v_target_ids)
    and new_merchant_id = v_ilytk_id;

  update public.orders
  set merchant_id = v_ilytk_id
  where id = any(v_target_ids)
    and merchant_id = v_g3bxg_id;
  get diagnostics v_updated = row_count;

  if v_updated < 0 or v_updated > 3 then
    raise exception 'ilytk_updated_row_count_rejected_%', v_updated;
  end if;

  if (
    select count(*)
    from public.orders o
    where o.id = any(v_target_ids)
      and o.merchant_id = v_ilytk_id
      and public.dn_normalized_merchant_identity(o.merchant_code)
          = public.dn_normalized_merchant_identity(v_ilytk.merchant_code)
      and btrim(coalesce(o.merchant_name, '')) = btrim(coalesce(v_ilytk.trade_name, ''))
  ) <> 3 then
    raise exception 'ilytk_post_update_canonical_owner_verification_failed';
  end if;

  select jsonb_object_agg(
    o.id::text,
    to_jsonb(o) - 'merchant_id' - 'merchant_code' - 'merchant_name' - 'updated_at'
    order by o.id
  ) into v_after
  from public.orders o
  where o.id = any(v_target_ids);

  if v_before is distinct from v_after then
    raise exception 'ilytk_non_identity_order_fields_changed';
  end if;

  select count(*) into v_total_after from public.orders;
  if v_total_after <> v_total_before then
    raise exception 'ilytk_order_count_changed_%_to_%', v_total_before, v_total_after;
  end if;

  select to_jsonb(o) into v_excluded_after
  from public.orders o
  where o.id = v_excluded_order_id;

  if v_excluded_before is distinct from v_excluded_after then
    raise exception 'excluded_coupon_010504_was_modified';
  end if;

  -- Reuse the production compatibility function. It normalizes order_id to
  -- text for legacy finance tables and skips dependency tables/columns that do
  -- not exist in the live schema.
  select count(*)::integer into v_dependency_mismatches
  from public.orders o
  where o.id = any(v_target_ids)
    and (
      coalesce((
        public.dn_order_dependency_ownership_snapshot(o.id, v_g3bxg_id, v_ilytk_id)
        ->> 'total_conflicts'
      )::integer, 0) <> 0
      or coalesce((
        public.dn_order_dependency_ownership_snapshot(o.id, v_g3bxg_id, v_ilytk_id)
        ->> 'total_repairable'
      )::integer, 0) <> 0
    );

  if v_dependency_mismatches <> 0 then
    raise exception 'ilytk_post_update_dependency_owner_mismatches_%', v_dependency_mismatches;
  end if;

  select count(*)::integer into v_audit_after
  from public.order_merchant_repair_audit
  where order_id = any(v_target_ids)
    and new_merchant_id = v_ilytk_id;

  if v_audit_after - v_audit_before <> v_updated then
    raise exception 'ilytk_audit_delta_%_expected_%', v_audit_after - v_audit_before, v_updated;
  end if;

  raise notice 'ILYTK reviewed reconciliation complete: % rows updated, three canonical orders verified, coupon 010504 unchanged', v_updated;
end;
$reconcile$;

commit;
