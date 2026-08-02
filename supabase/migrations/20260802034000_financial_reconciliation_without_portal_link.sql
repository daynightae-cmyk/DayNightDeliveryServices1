-- Accounting ownership follows the legal merchants.id relation.  A missing
-- portal login must remain visible as an access-review issue, but must not make
-- an otherwise legal merchant's COD or statement projections disappear.
do $migration$
declare
  v_definition text;
  v_old text := $old$
    and (
      o.merchant_id is null
      or (
        exists (
          select 1 from public.merchants m
          where m.id = o.merchant_id
            and lower(coalesce(m.status, 'active')) not in ('deleted','archived','blocked','suspended')
        )
        and public.dn_merchant_portal_link_count(o.merchant_id) > 0
      )
    );
$old$;
  v_new text := $new$
    and (
      o.merchant_id is null
      or exists (
        select 1 from public.merchants m
        where m.id = o.merchant_id
          and lower(coalesce(m.status, 'active')) not in ('deleted','archived','blocked','suspended')
      )
    );
$new$;
begin
  select pg_get_functiondef(
    'public.admin_apply_safe_missing_financial_dependencies(uuid,boolean)'::regprocedure
  ) into v_definition;

  if strpos(v_definition, v_new) > 0 then
    return;
  end if;
  if strpos(v_definition, v_old) = 0 then
    raise exception 'financial_reconciliation_eligibility_contract_not_found';
  end if;

  execute replace(v_definition, v_old, v_new);
end;
$migration$;

notify pgrst, 'reload schema';
