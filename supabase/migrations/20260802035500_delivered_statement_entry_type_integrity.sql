-- A delivered order can legitimately have multiple statement entries.  The
-- authoritative delivery projection is complete only when its specific entry
-- type exists; an adjustment, refund, payout, or return row must not suppress it.
begin;

create or replace function pg_temp.dn_patch_statement_entry_predicate(
  p_function regprocedure,
  p_old_fragment text,
  p_new_fragment text
)
returns void
language plpgsql
as $$
declare
  v_definition text;
begin
  select pg_get_functiondef(p_function::oid) into v_definition;

  if position(p_new_fragment in v_definition) > 0 then
    return;
  end if;

  if position(p_old_fragment in v_definition) = 0 then
    raise exception 'statement_entry_predicate_not_found_%', p_function::text;
  end if;

  execute replace(v_definition, p_old_fragment, p_new_fragment);
end;
$$;

select pg_temp.dn_patch_statement_entry_predicate(
  'public.dn_missing_financial_dependencies_snapshot()'::regprocedure,
  'not exists (select 1 from public.merchant_statement_entries m where m.order_id = o.id)',
  'not exists (select 1 from public.merchant_statement_entries m where m.order_id = o.id and m.entry_type = ''order_cod'')'
);

select pg_temp.dn_patch_statement_entry_predicate(
  'public.dn_missing_financial_dependencies_snapshot()'::regprocedure,
  'not exists (select 1 from public.driver_statement_entries d where d.order_id = o.id)',
  'not exists (select 1 from public.driver_statement_entries d where d.order_id = o.id and d.entry_type = ''delivery_earning'')'
);

select pg_temp.dn_patch_statement_entry_predicate(
  'public.admin_apply_safe_missing_financial_dependencies(uuid,boolean)'::regprocedure,
  'not exists (select 1 from public.merchant_statement_entries m where m.order_id = o.id)',
  'not exists (select 1 from public.merchant_statement_entries m where m.order_id = o.id and m.entry_type = ''order_cod'')'
);

select pg_temp.dn_patch_statement_entry_predicate(
  'public.admin_apply_safe_missing_financial_dependencies(uuid,boolean)'::regprocedure,
  'not exists (select 1 from public.driver_statement_entries d where d.order_id = o.id)',
  'not exists (select 1 from public.driver_statement_entries d where d.order_id = o.id and d.entry_type = ''delivery_earning'')'
);

select pg_temp.dn_patch_statement_entry_predicate(
  'public.dn_project_delivered_order_dependencies()'::regprocedure,
  'not exists (select 1 from public.merchant_statement_entries m where m.order_id = new.id)',
  'not exists (select 1 from public.merchant_statement_entries m where m.order_id = new.id and m.entry_type = ''order_cod'')'
);

select pg_temp.dn_patch_statement_entry_predicate(
  'public.dn_project_delivered_order_dependencies()'::regprocedure,
  'not exists (select 1 from public.driver_statement_entries d where d.order_id = new.id)',
  'not exists (select 1 from public.driver_statement_entries d where d.order_id = new.id and d.entry_type = ''delivery_earning'')'
);

do $$
declare
  v_missing_definition text := pg_get_functiondef(
    'public.dn_missing_financial_dependencies_snapshot()'::regprocedure
  );
  v_apply_definition text := pg_get_functiondef(
    'public.admin_apply_safe_missing_financial_dependencies(uuid,boolean)'::regprocedure
  );
  v_projection_definition text := pg_get_functiondef(
    'public.dn_project_delivered_order_dependencies()'::regprocedure
  );
begin
  if v_missing_definition not like '%m.entry_type = ''order_cod''%'
     or v_missing_definition not like '%d.entry_type = ''delivery_earning''%'
     or v_apply_definition not like '%m.entry_type = ''order_cod''%'
     or v_apply_definition not like '%d.entry_type = ''delivery_earning''%'
     or v_projection_definition not like '%m.entry_type = ''order_cod''%'
     or v_projection_definition not like '%d.entry_type = ''delivery_earning''%' then
    raise exception 'delivered_statement_entry_type_integrity_install_failed';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
