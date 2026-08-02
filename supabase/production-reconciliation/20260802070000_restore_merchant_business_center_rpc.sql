-- DAY NIGHT DELIVERY SERVICES
-- One-time production reconciliation: restore the authenticated merchant
-- business-center aggregate RPC that is referenced by the current portal but
-- absent from the live PostgREST schema cache.
--
-- Safety contract:
-- - creates/replaces one read-only SECURITY DEFINER function only;
-- - never inserts, updates, or deletes orders, merchants, links, finance, or portal data;
-- - resolves ownership exclusively through public.merchant_session_id();
-- - tolerates optional/legacy business-center tables by returning empty arrays;
-- - remains outside portable migrations and is applied once through a guarded workflow.

begin;

set local statement_timeout = '5min';
set local lock_timeout = '30s';

create temporary table dn_business_center_rpc_guard on commit drop as
select
  (select count(*)::bigint from public.orders) as orders_count,
  (select count(*)::bigint from public.merchants) as merchants_count,
  (select count(*)::bigint from public.merchant_user_links) as merchant_links_count;

create or replace function public.merchant_portal_business_center()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_mid uuid := public.merchant_session_id();
  v_branches jsonb := '[]'::jsonb;
  v_pickups jsonb := '[]'::jsonb;
  v_address_book jsonb := '[]'::jsonb;
  v_documents jsonb := '[]'::jsonb;
  v_team jsonb := '[]'::jsonb;
  v_tickets jsonb := '[]'::jsonb;
  v_notifications jsonb := '[]'::jsonb;
  v_cod jsonb := '[]'::jsonb;
  v_statements jsonb := '[]'::jsonb;
  v_import_batches jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if v_mid is null then
    raise exception 'merchant_profile_not_found';
  end if;

  if to_regclass('public.merchant_branches') is not null then
    execute $q$
      select coalesce(jsonb_agg(to_jsonb(x) order by x.is_default desc, x.name), '[]'::jsonb)
      from (
        select * from public.merchant_branches
        where merchant_id = $1
        order by is_default desc, name, id
        limit 500
      ) x
    $q$ into v_branches using v_mid;
  end if;

  if to_regclass('public.merchant_pickup_requests') is not null then
    execute $q$
      select coalesce(jsonb_agg(to_jsonb(x) order by x.requested_date desc, x.created_at desc), '[]'::jsonb)
      from (
        select * from public.merchant_pickup_requests
        where merchant_id = $1
        order by requested_date desc, created_at desc, id
        limit 500
      ) x
    $q$ into v_pickups using v_mid;
  end if;

  if to_regclass('public.merchant_address_book') is not null then
    execute $q$
      select coalesce(jsonb_agg(to_jsonb(x) order by x.recipient_name, x.id), '[]'::jsonb)
      from (
        select * from public.merchant_address_book
        where merchant_id = $1
          and coalesce(archived, false) = false
        order by recipient_name, id
        limit 2000
      ) x
    $q$ into v_address_book using v_mid;
  end if;

  if to_regclass('public.merchant_documents') is not null then
    execute $q$
      select coalesce(jsonb_agg(to_jsonb(x) order by x.expiry_date nulls last, x.id), '[]'::jsonb)
      from (
        select * from public.merchant_documents
        where merchant_id = $1
        order by expiry_date nulls last, id
        limit 500
      ) x
    $q$ into v_documents using v_mid;
  end if;

  if to_regclass('public.merchant_team_members') is not null then
    execute $q$
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at, x.id), '[]'::jsonb)
      from (
        select * from public.merchant_team_members
        where merchant_id = $1
        order by created_at, id
        limit 500
      ) x
    $q$ into v_team using v_mid;
  end if;

  if to_regclass('public.merchant_support_tickets') is not null then
    execute $q$
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc, x.id), '[]'::jsonb)
      from (
        select * from public.merchant_support_tickets
        where merchant_id = $1
        order by created_at desc, id
        limit 120
      ) x
    $q$ into v_tickets using v_mid;
  end if;

  if to_regclass('public.merchant_notifications') is not null then
    execute $q$
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc, x.id), '[]'::jsonb)
      from (
        select * from public.merchant_notifications
        where merchant_id = $1
        order by created_at desc, id
        limit 150
      ) x
    $q$ into v_notifications using v_mid;
  end if;

  if to_regclass('public.cod_collections') is not null then
    execute $q$
      select coalesce(jsonb_agg(to_jsonb(x) order by x.collection_date desc nulls last, x.created_at desc, x.id), '[]'::jsonb)
      from (
        select * from public.cod_collections
        where merchant_id = $1
        order by collection_date desc nulls last, created_at desc, id
        limit 500
      ) x
    $q$ into v_cod using v_mid;
  end if;

  if to_regclass('public.merchant_statement_entries') is not null then
    execute $q$
      select coalesce(jsonb_agg(to_jsonb(x) order by x.entry_date, x.created_at, x.id), '[]'::jsonb)
      from (
        select * from public.merchant_statement_entries
        where merchant_id = $1
        order by entry_date, created_at, id
        limit 1000
      ) x
    $q$ into v_statements using v_mid;
  end if;

  if to_regclass('public.import_batches') is not null then
    execute $q$
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc, x.id), '[]'::jsonb)
      from (
        select * from public.import_batches
        where merchant_id = $1
        order by created_at desc, id
        limit 50
      ) x
    $q$ into v_import_batches using v_mid;
  end if;

  return jsonb_build_object(
    'ok', true,
    'merchant_id', v_mid,
    'generated_at', now(),
    'branches', v_branches,
    'pickup_requests', v_pickups,
    'address_book', v_address_book,
    'documents', v_documents,
    'team', v_team,
    'support_tickets', v_tickets,
    'notifications', v_notifications,
    'cod_collections', v_cod,
    'statement_entries', v_statements,
    'import_batches', v_import_batches
  );
end;
$$;

revoke all on function public.merchant_portal_business_center() from public, anon;
grant execute on function public.merchant_portal_business_center() to authenticated, service_role;

notify pgrst, 'reload schema';

do $verify$
declare
  v_before record;
  v_orders_after bigint;
  v_merchants_after bigint;
  v_links_after bigint;
begin
  if session_user not in ('postgres', 'supabase_admin') then
    raise exception 'merchant_business_center_rpc_privileged_session_required_%', session_user;
  end if;

  if to_regprocedure('public.merchant_portal_business_center()') is null then
    raise exception 'merchant_business_center_rpc_not_created';
  end if;

  select * into v_before from dn_business_center_rpc_guard;
  select count(*) into v_orders_after from public.orders;
  select count(*) into v_merchants_after from public.merchants;
  select count(*) into v_links_after from public.merchant_user_links;

  if v_orders_after <> v_before.orders_count
     or v_merchants_after <> v_before.merchants_count
     or v_links_after <> v_before.merchant_links_count then
    raise exception 'merchant_business_center_rpc_unexpected_row_count_change_orders_%_to_%_merchants_%_to_%_links_%_to_%',
      v_before.orders_count, v_orders_after,
      v_before.merchants_count, v_merchants_after,
      v_before.merchant_links_count, v_links_after;
  end if;
end;
$verify$;

commit;
