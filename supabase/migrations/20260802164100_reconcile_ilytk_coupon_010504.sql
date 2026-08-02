-- DAY NIGHT DELIVERY SERVICES
-- Owner-confirmed production correction for coupon 010504.
--
-- On 2026-08-02 the company owner explicitly confirmed that this exact order
-- belongs to merchant DN-MER-SHOP-ILYTK and must appear in the merchant portal,
-- admin merchant file, accounting ledgers and statement history.
--
-- The transaction is idempotent and fail-closed. It changes only canonical
-- merchant identity fields and dependent merchant ownership. It does not alter
-- the coupon, tracking number, status, customer data or any financial amount.

begin;

set local statement_timeout = '10min';
set local lock_timeout = '60s';
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $reconcile_010504$
declare
  v_order_id constant uuid := '5fa6bc07-a7d6-4b43-a4c4-70dad6af160a';
  v_ilytk_id constant uuid := '325bb302-75c3-48cc-84ba-e58817d6d148';
  v_g3bxg_id constant uuid := 'b0da2d6d-2fc9-43b3-9e38-260ff2dbd68e';
  v_ilytk public.merchants%rowtype;
  v_g3bxg public.merchants%rowtype;
  v_order_before jsonb;
  v_order_after jsonb;
  v_dependency_before jsonb;
  v_dependency_after jsonb;
  v_dispatch_before jsonb;
  v_dispatch_after jsonb;
  v_order_count_before bigint;
  v_order_count_after bigint;
  v_order_updated integer := 0;
  v_dispatch_updated integer := 0;
  v_invalid_dispatch_owners integer := 0;
  v_audit_before integer := 0;
  v_audit_after integer := 0;
begin
  if session_user not in ('postgres', 'supabase_admin') then
    raise exception 'ilytk_010504_privileged_session_required_%', session_user;
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
    raise exception 'ilytk_010504_canonical_identity_rejected_%', to_jsonb(v_ilytk);
  end if;

  select * into v_g3bxg
  from public.merchants
  where id = v_g3bxg_id
  for share;

  if v_g3bxg.id is null
     or public.dn_normalized_merchant_identity(v_g3bxg.merchant_code)
        <> public.dn_normalized_merchant_identity('DN-MER-SHOP-G3BXG') then
    raise exception 'ilytk_010504_previous_owner_rejected_%', to_jsonb(v_g3bxg);
  end if;

  select to_jsonb(o) into v_order_before
  from public.orders o
  where o.id = v_order_id
    and btrim(coalesce(o.coupon_number, '')) = '010504'
    and btrim(coalesce(o.tracking_number, '')) = 'DN-INV-2026-010504-MS7ZINTM'
    and o.merchant_id in (v_g3bxg_id, v_ilytk_id)
    and public.dn_merchant_phone_digits(o.sender_phone) = '971501050516'
  for update;

  if v_order_before is null then
    raise exception 'ilytk_010504_exact_order_state_rejected';
  end if;

  select count(*) into v_order_count_before from public.orders;

  v_dependency_before := public.dn_order_dependency_ownership_snapshot(
    v_order_id,
    v_g3bxg_id,
    v_ilytk_id
  );

  if (v_order_before ->> 'merchant_id')::uuid = v_g3bxg_id
     and coalesce((v_dependency_before ->> 'total_conflicts')::integer, 0) <> 0 then
    raise exception 'ilytk_010504_dependency_security_conflict_%', v_dependency_before;
  end if;

  select count(*)::integer into v_invalid_dispatch_owners
  from public.merchant_statement_dispatch_log d
  where d.order_id = v_order_id
    and d.merchant_id not in (v_g3bxg_id, v_ilytk_id);

  if v_invalid_dispatch_owners <> 0 then
    raise exception 'ilytk_010504_dispatch_owner_conflict_%', v_invalid_dispatch_owners;
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(d) - 'merchant_id' order by d.id),
    '[]'::jsonb
  ) into v_dispatch_before
  from public.merchant_statement_dispatch_log d
  where d.order_id = v_order_id;

  select count(*)::integer into v_audit_before
  from public.order_merchant_repair_audit
  where order_id = v_order_id
    and new_merchant_id = v_ilytk_id;

  update public.orders
  set merchant_id = v_ilytk_id
  where id = v_order_id
    and merchant_id = v_g3bxg_id;
  get diagnostics v_order_updated = row_count;

  if v_order_updated not in (0, 1) then
    raise exception 'ilytk_010504_order_update_count_rejected_%', v_order_updated;
  end if;

  update public.merchant_statement_dispatch_log
  set merchant_id = v_ilytk_id
  where order_id = v_order_id
    and merchant_id = v_g3bxg_id;
  get diagnostics v_dispatch_updated = row_count;

  select to_jsonb(o) into v_order_after
  from public.orders o
  where o.id = v_order_id;

  if v_order_after is null
     or (v_order_after ->> 'merchant_id')::uuid <> v_ilytk_id
     or public.dn_normalized_merchant_identity(v_order_after ->> 'merchant_code')
        <> public.dn_normalized_merchant_identity(v_ilytk.merchant_code)
     or btrim(coalesce(v_order_after ->> 'merchant_name', ''))
        <> btrim(coalesce(v_ilytk.trade_name, '')) then
    raise exception 'ilytk_010504_post_update_owner_verification_failed_%', v_order_after;
  end if;

  if (v_order_before - 'merchant_id' - 'merchant_code' - 'merchant_name' - 'updated_at')
     is distinct from
     (v_order_after - 'merchant_id' - 'merchant_code' - 'merchant_name' - 'updated_at') then
    raise exception 'ilytk_010504_non_identity_order_fields_changed';
  end if;

  v_dependency_after := public.dn_order_dependency_ownership_snapshot(
    v_order_id,
    v_g3bxg_id,
    v_ilytk_id
  );

  if coalesce((v_dependency_after ->> 'total_conflicts')::integer, 0) <> 0
     or coalesce((v_dependency_after ->> 'total_repairable')::integer, 0) <> 0 then
    raise exception 'ilytk_010504_dependency_owner_mismatch_%', v_dependency_after;
  end if;

  if exists (
    select 1
    from public.merchant_statement_dispatch_log d
    where d.order_id = v_order_id
      and d.merchant_id <> v_ilytk_id
  ) then
    raise exception 'ilytk_010504_dispatch_owner_mismatch_after_update';
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(d) - 'merchant_id' order by d.id),
    '[]'::jsonb
  ) into v_dispatch_after
  from public.merchant_statement_dispatch_log d
  where d.order_id = v_order_id;

  if v_dispatch_before is distinct from v_dispatch_after then
    raise exception 'ilytk_010504_dispatch_non_owner_fields_changed';
  end if;

  select count(*)::integer into v_audit_after
  from public.order_merchant_repair_audit
  where order_id = v_order_id
    and new_merchant_id = v_ilytk_id;

  if v_audit_after - v_audit_before <> v_order_updated then
    raise exception 'ilytk_010504_repair_audit_delta_%_expected_%',
      v_audit_after - v_audit_before,
      v_order_updated;
  end if;

  select count(*) into v_order_count_after from public.orders;
  if v_order_count_after <> v_order_count_before then
    raise exception 'ilytk_010504_order_count_changed_%_to_%',
      v_order_count_before,
      v_order_count_after;
  end if;

  if v_order_updated > 0 or v_dispatch_updated > 0 then
    insert into public.admin_audit_events (
      entity_type,
      entity_id,
      action,
      after_data,
      metadata,
      actor_id
    ) values (
      'order',
      v_order_id::text,
      'owner_confirmed_merchant_reassignment',
      jsonb_build_object(
        'coupon_number', '010504',
        'tracking_number', 'DN-INV-2026-010504-MS7ZINTM',
        'merchant_id', v_ilytk_id,
        'merchant_code', v_ilytk.merchant_code,
        'merchant_name', v_ilytk.trade_name
      ),
      jsonb_build_object(
        'previous_merchant_id', v_g3bxg_id,
        'previous_merchant_code', v_g3bxg.merchant_code,
        'owner_confirmation_date', '2026-08-02',
        'order_rows_updated', v_order_updated,
        'statement_dispatch_rows_updated', v_dispatch_updated,
        'source', 'explicit_company_owner_confirmation'
      ),
      auth.uid()
    );
  end if;

  raise notice 'Coupon 010504 restored to ILYTK: order rows %, statement dispatch rows %, dependencies verified',
    v_order_updated,
    v_dispatch_updated;
end;
$reconcile_010504$;

commit;
