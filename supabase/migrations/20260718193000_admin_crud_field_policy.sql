-- DAY NIGHT DELIVERY SERVICES
-- Admin CRUD visibility and required/optional field hardening.
--
-- Goals:
--   * coupon number is mandatory for authenticated admin/support order writes
--   * coupon numbers cannot be duplicated for the same merchant
--   * historical/public orders are not globally forced to have a coupon number
--   * existing safe order deletion runtime remains authoritative

begin;

create index if not exists idx_orders_merchant_coupon_lookup
  on public.orders (merchant_id, lower(btrim(coupon_number)))
  where merchant_id is not null
    and nullif(btrim(coupon_number), '') is not null;

create or replace function public.admin_enforce_order_coupon_policy()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_coupon text := nullif(btrim(to_jsonb(new) ->> 'coupon_number'), '');
  v_source text := lower(coalesce(to_jsonb(new) ->> 'source_channel', ''));
  v_admin_write boolean := false;
begin
  if auth.uid() is not null then
    begin
      v_admin_write := public.is_admin_or_support();
    exception when others then
      v_admin_write := false;
    end;
  end if;

  if v_admin_write or v_source in ('admin_operations', 'admin', 'admin_coupon_photo') then
    if v_coupon is null then
      raise exception 'coupon_number_required_for_admin_order';
    end if;
  end if;

  if v_coupon is not null and new.merchant_id is not null then
    if exists (
      select 1
      from public.orders o
      where o.merchant_id = new.merchant_id
        and lower(btrim(coalesce(o.coupon_number, ''))) = lower(v_coupon)
        and o.id is distinct from new.id
    ) then
      raise exception 'duplicate_coupon_number_for_merchant';
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

create or replace function public.admin_crud_field_policy_health()
returns jsonb
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'ok',
      to_regprocedure('public.admin_update_order_runtime(jsonb)') is not null
      and to_regprocedure('public.admin_delete_order_runtime(jsonb)') is not null
      and to_regprocedure('public.admin_dispatch_order_runtime(jsonb)') is not null
      and to_regprocedure('public.admin_enforce_order_coupon_policy()') is not null,
    'authenticated_user_id', auth.uid(),
    'is_admin_or_support', public.is_admin_or_support(),
    'order_update_rpc', to_regprocedure('public.admin_update_order_runtime(jsonb)')::text,
    'order_delete_rpc', to_regprocedure('public.admin_delete_order_runtime(jsonb)')::text,
    'dispatch_rpc', to_regprocedure('public.admin_dispatch_order_runtime(jsonb)')::text,
    'coupon_trigger', exists (
      select 1
      from pg_trigger
      where tgname = 'trg_admin_enforce_order_coupon_policy'
        and not tgisinternal
    ),
    'coupon_lookup_index', to_regclass('public.idx_orders_merchant_coupon_lookup')::text,
    'deletion_audit_table', to_regclass('public.admin_order_deletion_log')::text
  );
$$;

revoke all on function public.admin_crud_field_policy_health()
  from public, anon;
grant execute on function public.admin_crud_field_policy_health()
  to authenticated;

notify pgrst, 'reload schema';

commit;
