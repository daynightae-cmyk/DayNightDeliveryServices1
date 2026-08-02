-- Identity reconciliation and financial projection are two reviewed phases.
-- The order backfill sets this transaction-local marker; do not create missing
-- COD/statement rows until the dedicated financial reconciliation function runs
-- and validates its own exact counts and before/after totals.
do $migration$
declare
  v_definition text;
  v_old text := $old$
begin
  if v_status not in ('delivered','completed','complete') then
$old$;
  v_new text := $new$
begin
  if current_setting('daynight.order_merchant_reconciliation', true) = 'backfill' then
    return new;
  end if;

  if v_status not in ('delivered','completed','complete') then
$new$;
begin
  select pg_get_functiondef(
    'public.dn_project_delivered_order_dependencies()'::regprocedure
  ) into v_definition;

  if strpos(v_definition, v_new) > 0 then
    return;
  end if;
  if strpos(v_definition, v_old) = 0 then
    raise exception 'delivered_projection_backfill_guard_contract_not_found';
  end if;
  execute replace(v_definition, v_old, v_new);
end;
$migration$;
