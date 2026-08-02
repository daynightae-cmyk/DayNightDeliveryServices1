-- Production orders.status is an enum while the immutable audit snapshot stores
-- its textual representation.  Compare their text values explicitly so the
-- stale-row guards work without weakening or skipping either check.
do $migration$
declare
  v_definition text;
  v_old text := 'v_order.status is distinct from v_snapshot.status';
  v_new text := 'v_order.status::text is distinct from v_snapshot.status::text';
begin
  select pg_get_functiondef(
    'public.admin_apply_order_merchant_safe_backfill(uuid,boolean)'::regprocedure
  ) into v_definition;
  if strpos(v_definition, v_new) = 0 then
    if strpos(v_definition, v_old) = 0 then
      raise exception 'order_backfill_status_guard_contract_not_found';
    end if;
    execute replace(v_definition, v_old, v_new);
  end if;
end;
$migration$;

do $migration$
declare
  v_definition text;
  v_old text := 'o.status is distinct from s.status';
  v_new text := 'o.status::text is distinct from s.status::text';
begin
  select pg_get_functiondef(
    'public.admin_apply_safe_missing_financial_dependencies(uuid,boolean)'::regprocedure
  ) into v_definition;
  if strpos(v_definition, v_new) = 0 then
    if strpos(v_definition, v_old) = 0 then
      raise exception 'finance_backfill_status_guard_contract_not_found';
    end if;
    execute replace(v_definition, v_old, v_new);
  end if;
end;
$migration$;
