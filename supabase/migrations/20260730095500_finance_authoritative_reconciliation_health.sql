-- DAY NIGHT DELIVERY SERVICES
-- Authoritative finance runtime health and write protection.
-- No approval/payout-style posting may proceed while the ledger is derived,
-- incomplete, or out of balance.

begin;

create or replace function public.admin_finance_reconciliation_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_tables jsonb;
  v_all_tables boolean;
  v_delivered bigint := 0;
  v_missing_settlements bigint := 0;
  v_missing_cod bigint := 0;
  v_missing_merchant_entries bigint := 0;
  v_missing_driver_entries bigint := 0;
  v_customer_variance numeric := 0;
  v_company_variance numeric := 0;
  v_merchant_variance numeric := 0;
  v_collected_variance numeric := 0;
  v_variance_zero boolean;
  v_authoritative boolean;
begin
  if not public.is_admin_or_support() then
    raise exception 'not_authorized';
  end if;

  v_tables := jsonb_build_object(
    'orders', to_regclass('public.orders') is not null,
    'settlements', to_regclass('public.order_financial_settlements') is not null,
    'account_entries', to_regclass('public.financial_account_entries') is not null,
    'cod_collections', to_regclass('public.cod_collections') is not null,
    'merchant_statements', to_regclass('public.merchant_statement_entries') is not null,
    'driver_statements', to_regclass('public.driver_statement_entries') is not null,
    'expenses', to_regclass('public.admin_expenses') is not null,
    'adjustments', to_regclass('public.admin_adjustments') is not null,
    'audit_events', to_regclass('public.admin_audit_events') is not null
  );

  v_all_tables := not exists (
    select 1
    from jsonb_each_text(v_tables) item
    where item.value <> 'true'
  );

  if not v_all_tables then
    return jsonb_build_object(
      'ok', false,
      'source', 'unavailable',
      'authoritative', false,
      'writes_allowed', false,
      'tables', v_tables,
      'reason', 'finance_migrations_incomplete',
      'variance_zero', false,
      'checked_at', now()
    );
  end if;

  select count(*)
  into v_delivered
  from public.orders o
  where lower(replace(replace(coalesce(o.status::text, ''), '-', '_'), ' ', '_'))
    in ('delivered', 'completed', 'complete');

  select count(*)
  into v_missing_settlements
  from public.orders o
  where lower(replace(replace(coalesce(o.status::text, ''), '-', '_'), ' ', '_'))
      in ('delivered', 'completed', 'complete')
    and not exists (
      select 1
      from public.order_financial_settlements s
      where s.order_id = o.id::text
    );

  select
    coalesce(sum(abs(coalesce(o.customer_total, 0) - coalesce(s.customer_total, 0))), 0),
    coalesce(sum(abs(coalesce(o.company_revenue, 0) - coalesce(s.company_revenue, 0))), 0),
    coalesce(sum(abs(coalesce(o.merchant_due, 0) - coalesce(s.merchant_due, 0))), 0),
    coalesce(sum(abs(coalesce(o.collected_amount, 0) - coalesce(s.collected_amount, 0))), 0)
  into v_customer_variance, v_company_variance, v_merchant_variance, v_collected_variance
  from public.orders o
  join public.order_financial_settlements s on s.order_id = o.id::text
  where lower(replace(replace(coalesce(o.status::text, ''), '-', '_'), ' ', '_'))
    in ('delivered', 'completed', 'complete');

  select count(*)
  into v_missing_cod
  from public.orders o
  where lower(replace(replace(coalesce(o.status::text, ''), '-', '_'), ' ', '_'))
      in ('delivered', 'completed', 'complete')
    and lower(coalesce(o.payment_method::text, '')) = 'cod'
    and coalesce(o.customer_total, 0) > 0
    and not exists (
      select 1 from public.cod_collections c where c.order_id::text = o.id::text
    );

  select count(*)
  into v_missing_merchant_entries
  from public.orders o
  where lower(replace(replace(coalesce(o.status::text, ''), '-', '_'), ' ', '_'))
      in ('delivered', 'completed', 'complete')
    and o.merchant_id is not null
    and not exists (
      select 1 from public.merchant_statement_entries m where m.order_id::text = o.id::text
    );

  select count(*)
  into v_missing_driver_entries
  from public.orders o
  where lower(replace(replace(coalesce(o.status::text, ''), '-', '_'), ' ', '_'))
      in ('delivered', 'completed', 'complete')
    and coalesce(to_jsonb(o)->>'assigned_driver_id', to_jsonb(o)->>'driver_id', '') <> ''
    and not exists (
      select 1 from public.driver_statement_entries d where d.order_id::text = o.id::text
    );

  v_variance_zero :=
    round(v_customer_variance, 2) = 0
    and round(v_company_variance, 2) = 0
    and round(v_merchant_variance, 2) = 0
    and round(v_collected_variance, 2) = 0;

  v_authoritative :=
    v_all_tables
    and v_missing_settlements = 0
    and v_missing_cod = 0
    and v_missing_merchant_entries = 0
    and v_missing_driver_entries = 0
    and v_variance_zero;

  return jsonb_build_object(
    'ok', v_authoritative,
    'source', case when v_authoritative then 'db_ledger' else 'unavailable' end,
    'authoritative', v_authoritative,
    'writes_allowed', v_authoritative,
    'tables', v_tables,
    'delivered_orders', v_delivered,
    'missing_settlement_rows', v_missing_settlements,
    'missing_cod_rows', v_missing_cod,
    'missing_merchant_statement_rows', v_missing_merchant_entries,
    'missing_driver_statement_rows', v_missing_driver_entries,
    'variance', jsonb_build_object(
      'customer_total', round(v_customer_variance, 2),
      'company_revenue', round(v_company_variance, 2),
      'merchant_due', round(v_merchant_variance, 2),
      'collected_amount', round(v_collected_variance, 2)
    ),
    'variance_zero', v_variance_zero,
    'checked_at', now()
  );
end;
$$;

create or replace function public.admin_assert_authoritative_finance()
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_health jsonb;
begin
  v_health := public.admin_finance_reconciliation_health();
  if coalesce((v_health->>'writes_allowed')::boolean, false) is not true then
    raise exception using
      errcode = '55000',
      message = 'authoritative_finance_required',
      detail = v_health::text;
  end if;
end;
$$;

-- Recreate approval functions with a mandatory authority gate. Draft creation
-- remains available so operators can capture work without posting accounting.
create or replace function public.admin_set_expense_status(
  p_expense_id uuid,
  p_status text,
  p_reason text default null
)
returns public.admin_expenses
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  r public.admin_expenses;
  before_row public.admin_expenses;
  v_status text := lower(btrim(coalesce(p_status,'')));
begin
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;
  if v_status not in ('approved','void') then raise exception 'invalid_expense_status'; end if;
  if v_status = 'approved' then perform public.admin_assert_authoritative_finance(); end if;

  select * into before_row from public.admin_expenses where id = p_expense_id for update;
  if before_row.id is null then raise exception 'expense_not_found'; end if;

  update public.admin_expenses
  set status = v_status,
      approved_at = case when v_status = 'approved' then coalesce(approved_at, now()) else approved_at end,
      approved_by = case when v_status = 'approved' then coalesce(approved_by, auth.uid()) else approved_by end,
      voided_at = case when v_status = 'void' then coalesce(voided_at, now()) else null end,
      voided_by = case when v_status = 'void' then auth.uid() else null end,
      void_reason = case when v_status = 'void' then coalesce(nullif(btrim(p_reason),''), 'Voided by admin') else null end,
      updated_at = now()
  where id = p_expense_id
  returning * into r;

  if v_status = 'approved' then
    insert into public.financial_account_entries(
      order_id, order_reference, merchant_id, account_type, entry_type,
      direction, amount, currency, notes, posted_at
    ) values (
      'expense:' || r.id::text,
      coalesce(nullif(r.reference_number,''), 'EXP-' || upper(substr(r.id::text,1,8))),
      null, 'company', 'approved_expense', 'debit', r.amount, 'AED',
      coalesce(r.notes, 'Approved operating expense'), coalesce(r.approved_at, now())
    ) on conflict (order_id, account_type, entry_type)
      do update set amount = excluded.amount, notes = excluded.notes, posted_at = excluded.posted_at;
  elsif before_row.status = 'approved' then
    insert into public.financial_account_entries(
      order_id, order_reference, merchant_id, account_type, entry_type,
      direction, amount, currency, notes, posted_at
    ) values (
      'expense:' || r.id::text,
      coalesce(nullif(r.reference_number,''), 'EXP-' || upper(substr(r.id::text,1,8))),
      null, 'company', 'void_expense_reversal', 'credit', r.amount, 'AED',
      coalesce(r.void_reason, 'Voided approved expense'), now()
    ) on conflict (order_id, account_type, entry_type) do nothing;
  end if;

  perform public.daynight_admin_finance_audit(
    'admin_expense', r.id::text, v_status, to_jsonb(before_row), to_jsonb(r),
    jsonb_build_object('reason', p_reason, 'authority', 'db_ledger')
  );
  return r;
end;
$$;

create or replace function public.admin_set_adjustment_status(
  p_adjustment_id uuid,
  p_status text,
  p_reason text default null
)
returns public.admin_adjustments
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  r public.admin_adjustments;
  before_row public.admin_adjustments;
  v_status text := lower(btrim(coalesce(p_status,'')));
  v_direction text;
begin
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;
  if v_status not in ('approved','void') then raise exception 'invalid_adjustment_status'; end if;
  if v_status = 'approved' then perform public.admin_assert_authoritative_finance(); end if;

  select * into before_row from public.admin_adjustments where id = p_adjustment_id for update;
  if before_row.id is null then raise exception 'adjustment_not_found'; end if;

  update public.admin_adjustments
  set status = v_status,
      approved_at = case when v_status = 'approved' then coalesce(approved_at, now()) else approved_at end,
      approved_by = case when v_status = 'approved' then coalesce(approved_by, auth.uid()) else approved_by end,
      voided_at = case when v_status = 'void' then coalesce(voided_at, now()) else null end,
      voided_by = case when v_status = 'void' then auth.uid() else null end,
      void_reason = case when v_status = 'void' then coalesce(nullif(btrim(p_reason),''), 'Voided by admin') else null end,
      updated_at = now()
  where id = p_adjustment_id
  returning * into r;

  if v_status = 'approved' then
    v_direction := case when r.direction = 'negative' then 'debit' else 'credit' end;
    insert into public.financial_account_entries(
      order_id, order_reference, merchant_id, account_type, entry_type,
      direction, amount, currency, notes, posted_at
    ) values (
      'adjustment:' || r.id::text,
      coalesce(nullif(r.reference_number,''), 'ADJ-' || upper(substr(r.id::text,1,8))),
      r.merchant_id, 'company', 'approved_adjustment', v_direction, r.amount, 'AED',
      coalesce(r.reason, 'Approved financial adjustment'), coalesce(r.approved_at, now())
    ) on conflict (order_id, account_type, entry_type)
      do update set direction = excluded.direction, amount = excluded.amount, notes = excluded.notes, posted_at = excluded.posted_at;
  elsif before_row.status = 'approved' then
    v_direction := case when before_row.direction = 'negative' then 'credit' else 'debit' end;
    insert into public.financial_account_entries(
      order_id, order_reference, merchant_id, account_type, entry_type,
      direction, amount, currency, notes, posted_at
    ) values (
      'adjustment:' || r.id::text,
      coalesce(nullif(r.reference_number,''), 'ADJ-' || upper(substr(r.id::text,1,8))),
      r.merchant_id, 'company', 'void_adjustment_reversal', v_direction, r.amount, 'AED',
      coalesce(r.void_reason, 'Voided approved adjustment'), now()
    ) on conflict (order_id, account_type, entry_type) do nothing;
  end if;

  perform public.daynight_admin_finance_audit(
    'admin_adjustment', r.id::text, v_status, to_jsonb(before_row), to_jsonb(r),
    jsonb_build_object('reason', p_reason, 'authority', 'db_ledger')
  );
  return r;
end;
$$;

grant execute on function public.admin_finance_reconciliation_health() to authenticated;
grant execute on function public.admin_assert_authoritative_finance() to authenticated;

commit;
