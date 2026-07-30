-- DAY NIGHT DELIVERY SERVICES
-- Extends the admin order guard to legacy direct inserts that omit source_channel.
-- Any authenticated admin/support actor must satisfy final-order validation.

begin;

create or replace function public.dn_guard_admin_order_required_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_payload jsonb := to_jsonb(new);
  v_source text := lower(btrim(coalesce(v_payload->>'source_channel', '')));
  v_status text := lower(replace(replace(btrim(coalesce(v_payload->>'status', 'pending')), '-', '_'), ' ', '_'));
  v_admin_actor boolean := exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role::text, '')) in ('admin', 'support', 'owner', 'super_admin')
  );
  v_invalid text[];
begin
  if v_status = 'draft' then
    return new;
  end if;

  -- Merchant/customer/system rows keep their own creation rules. Admin-origin
  -- writes are validated even when the old compatibility payload removed
  -- source_channel before inserting directly into public.orders.
  if v_source <> 'admin_panel' and not v_admin_actor then
    return new;
  end if;

  v_invalid := public.dn_admin_order_invalid_fields(v_payload);
  if coalesce(array_length(v_invalid, 1), 0) > 0 then
    -- PostgreSQL LOG survives as operational evidence even though the blocked
    -- transaction itself is rolled back. Never include customer PII here.
    raise log 'DAY_NIGHT_ADMIN_ORDER_BLOCKED actor=% source=% status=% invalid_fields=% reference=%',
      coalesce(auth.uid()::text, 'unknown'),
      coalesce(v_source, 'legacy_direct_insert'),
      v_status,
      array_to_string(v_invalid, ','),
      coalesce(v_payload->>'invoice_number', v_payload->>'tracking_number', v_payload->>'id', 'unassigned');

    raise exception using
      errcode = '23514',
      message = 'admin_order_validation_failed',
      detail = array_to_string(v_invalid, ',');
  end if;

  return new;
end;
$$;

commit;
