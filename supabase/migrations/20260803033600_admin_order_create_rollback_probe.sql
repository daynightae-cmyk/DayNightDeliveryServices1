-- DAY NIGHT DELIVERY SERVICES
-- Rollback-safe production probe for the exact admin order creation path.
-- The order is created and verified inside a PL/pgSQL subtransaction, then an
-- intentional exception rolls the complete write back before evidence is returned.

begin;

create or replace function public.admin_probe_canonical_merchant_order(p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_created public.orders%rowtype;
  v_evidence jsonb := '{}'::jsonb;
  v_probe_id uuid;
begin
  if auth.role() <> 'service_role'
     and (auth.uid() is null or not public.is_admin_or_support()) then
    raise exception 'not_authorized';
  end if;

  begin
    select * into v_created
    from public.admin_create_canonical_merchant_order(coalesce(p_order, '{}'::jsonb));

    if v_created.id is null then
      raise exception 'admin_order_probe_returned_no_row';
    end if;

    v_probe_id := v_created.id;
    v_evidence := jsonb_build_object(
      'created', true,
      'order_id', v_created.id,
      'merchant_id', v_created.merchant_id,
      'merchant_code', v_created.merchant_code,
      'coupon_number', v_created.coupon_number,
      'shipping_scope', v_created.shipping_scope,
      'destination_country', v_created.destination_country,
      'goods_value', v_created.goods_value,
      'delivery_fee', v_created.delivery_fee,
      'customer_total', v_created.customer_total,
      'merchant_due', v_created.merchant_due,
      'company_revenue', v_created.company_revenue,
      'status', v_created.status
    );

    raise exception using errcode = 'P0001', message = 'daynight_admin_order_probe_rollback';
  exception
    when raise_exception then
      if sqlerrm <> 'daynight_admin_order_probe_rollback' then
        raise;
      end if;
  end;

  if v_probe_id is null then
    raise exception 'admin_order_probe_missing_rollback_id';
  end if;

  if exists (select 1 from public.orders where id = v_probe_id) then
    raise exception 'admin_order_probe_rollback_failed';
  end if;

  return v_evidence || jsonb_build_object(
    'ok', true,
    'rolled_back', true,
    'persisted_after_probe', false,
    'checked_at', now()
  );
end;
$$;

revoke all on function public.admin_probe_canonical_merchant_order(jsonb) from public, anon;
grant execute on function public.admin_probe_canonical_merchant_order(jsonb) to authenticated, service_role;

select pg_notify('pgrst', 'reload schema');

commit;
