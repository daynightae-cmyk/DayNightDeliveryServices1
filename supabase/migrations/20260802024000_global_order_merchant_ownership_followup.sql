-- DAY NIGHT DELIVERY SERVICES
-- Follow-up hardening for the global order -> merchant restoration framework.
--
-- Adds:
-- - INSERT-safe canonical trigger evaluation (never references OLD on INSERT);
-- - complete merchant/account inventory;
-- - combined ownership + finance dry-run evidence;
-- - separate explicit finance reconciliation after reviewed ownership apply;
-- - stricter 010505 / merchant-code-1999 acceptance evidence.

begin;

alter table public.merchant_ownership_audit_runs
  add column if not exists finance_health_before jsonb,
  add column if not exists finance_health_after jsonb,
  add column if not exists finance_reconciled_at timestamptz;

create table if not exists public.merchant_ownership_finance_reconciliation_log (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.merchant_ownership_audit_runs(id) on delete restrict,
  health_before jsonb not null,
  reconciliation_result jsonb not null,
  health_after jsonb not null,
  order_totals_before jsonb not null,
  order_totals_after jsonb not null,
  executed_by uuid not null,
  executed_at timestamptz not null default now(),
  unique (audit_id)
);

alter table public.merchant_ownership_finance_reconciliation_log enable row level security;
drop policy if exists "admin ownership finance reconciliation access"
  on public.merchant_ownership_finance_reconciliation_log;
create policy "admin ownership finance reconciliation access"
  on public.merchant_ownership_finance_reconciliation_log
  for all to authenticated
  using (public.is_admin_or_support())
  with check (public.is_admin_or_support());

create or replace function public.dn_enforce_canonical_order_merchant_link()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_resolved_id uuid;
  v_merchant public.merchants%rowtype;
  v_identity_changed boolean;
begin
  if tg_op = 'INSERT' then
    v_identity_changed := true;
  else
    v_identity_changed :=
      new.merchant_id is distinct from old.merchant_id
      or new.merchant_code is distinct from old.merchant_code
      or new.merchant_name is distinct from old.merchant_name;
  end if;

  if not v_identity_changed then return new; end if;

  if new.merchant_id is null then
    if public.dn_normalized_merchant_identity(new.merchant_code) is not null
       or public.dn_normalized_merchant_identity(new.merchant_name) is not null then
      raise exception using
        errcode = '23502',
        message = 'merchant_uuid_required',
        hint = 'تعذر ربط الطلب بالتاجر المحدد بشكل آمن، ولذلك لم يتم حفظ الطلب. راجع ربط حساب التاجر ثم أعد المحاولة.';
    end if;
    return new;
  end if;

  v_resolved_id := public.dn_resolve_portal_merchant_uuid(new.merchant_id);

  select * into v_merchant
  from public.merchants
  where id = v_resolved_id
    and public.dn_merchant_is_active(status)
    and public.dn_effective_portal_link_count(id) > 0;

  if v_merchant.id is null then
    raise exception using
      errcode = '23514',
      message = 'merchant_portal_account_not_linked',
      hint = 'تعذر ربط الطلب بالتاجر المحدد بشكل آمن، ولذلك لم يتم حفظ الطلب. راجع ربط حساب التاجر ثم أعد المحاولة.';
  end if;

  new.merchant_id := v_merchant.id;
  new.merchant_code := v_merchant.merchant_code;
  new.merchant_name := v_merchant.trade_name;
  return new;
end;
$$;

create or replace function public.admin_merchant_identity_inventory()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_support() then
    raise exception 'not_authorized';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.merchant_code nulls last, x.merchant_id), '[]'::jsonb)
  into v_result
  from (
    select
      m.id merchant_id,
      m.merchant_code,
      m.trade_name official_name,
      m.user_id direct_user_id,
      exists(select 1 from auth.users u where u.id = m.user_id) direct_auth_user_exists,
      public.dn_effective_portal_user_ids(m.id) effective_portal_user_ids,
      public.dn_effective_portal_link_count(m.id) effective_portal_user_count,
      m.phone,
      m.email,
      m.status,
      public.dn_merchant_is_active(m.status) active,
      count(distinct o.id) order_count,
      count(distinct o.id) filter (
        where lower(replace(replace(coalesce(o.status::text, ''), '-', '_'), ' ', '_'))
          in ('delivered','completed','complete')
      ) delivered_order_count,
      (
        select count(*) from public.merchants duplicate_code
        where public.dn_normalized_merchant_identity(duplicate_code.merchant_code)
          = public.dn_normalized_merchant_identity(m.merchant_code)
      ) duplicate_code_count,
      (
        select count(*) from public.merchants duplicate_phone
        where public.dn_merchant_phone_digits(duplicate_phone.phone)
          = public.dn_merchant_phone_digits(m.phone)
          and public.dn_merchant_phone_digits(m.phone) is not null
      ) duplicate_phone_count,
      (
        select count(*) from public.merchants duplicate_email
        where lower(btrim(coalesce(duplicate_email.email, '')))
          = lower(btrim(coalesce(m.email, '')))
          and nullif(btrim(coalesce(m.email, '')), '') is not null
      ) duplicate_email_count,
      exists (
        select 1 from public.merchant_user_links conflicting_link
        where conflicting_link.user_id = m.user_id
          and conflicting_link.active
          and conflicting_link.merchant_id <> m.id
      ) direct_user_link_conflict,
      case
        when not public.dn_merchant_is_active(m.status) then 'INACTIVE'
        when public.dn_effective_portal_link_count(m.id) = 0 then 'MISSING_PORTAL_LINK'
        when public.dn_effective_portal_link_count(m.id) > 1 then 'MULTIPLE_PORTAL_USERS_REVIEW'
        when (
          select count(*) from public.merchants duplicate_code
          where public.dn_normalized_merchant_identity(duplicate_code.merchant_code)
            = public.dn_normalized_merchant_identity(m.merchant_code)
        ) > 1 then 'DUPLICATE_CODE_REVIEW'
        else 'CANONICAL_ACTIVE'
      end identity_status
    from public.merchants m
    left join public.orders o on o.merchant_id = m.id
    group by m.id
  ) x;

  return jsonb_build_object(
    'ok', true,
    'merchants', v_result,
    'generated_at', now()
  );
end;
$$;

create or replace function public.admin_run_global_merchant_system_dry_run(
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_ownership jsonb;
  v_finance jsonb;
  v_inventory jsonb;
  v_audit_id uuid;
begin
  if auth.uid() is null or not public.is_admin_or_support() then
    raise exception 'not_authorized';
  end if;

  v_ownership := public.admin_run_global_merchant_ownership_dry_run(p_notes);
  v_audit_id := nullif(v_ownership ->> 'audit_id', '')::uuid;
  v_finance := public.admin_finance_reconciliation_health();
  v_inventory := public.admin_merchant_identity_inventory();

  update public.merchant_ownership_audit_runs
  set finance_health_before = v_finance
  where id = v_audit_id;

  return v_ownership || jsonb_build_object(
    'finance_health', v_finance,
    'merchant_inventory', v_inventory,
    'finance_apply_allowed', false,
    'note', 'This function is read-only apart from audit snapshot rows. It never repairs ownership or finance.',
    'checked_at', now()
  );
end;
$$;

create or replace function public.admin_apply_global_merchant_finance_reconciliation(
  p_audit_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_run public.merchant_ownership_audit_runs%rowtype;
  v_health_before jsonb;
  v_health_after jsonb;
  v_reconciliation jsonb;
  v_order_totals_before jsonb;
  v_order_totals_after jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_support() then
    raise exception 'not_authorized';
  end if;
  if p_confirmation is distinct from 'RECONCILE_MISSING_FINANCE_ROWS_FROM_REVIEWED_ORDER_SNAPSHOTS' then
    raise exception 'explicit_finance_confirmation_required';
  end if;

  select * into v_run
  from public.merchant_ownership_audit_runs
  where id = p_audit_id
  for update;

  if v_run.id is null then raise exception 'audit_run_not_found'; end if;
  if v_run.status <> 'applied' then
    raise exception 'ownership_repair_must_be_applied_first:%', v_run.status;
  end if;
  if v_run.finance_reconciled_at is not null then
    return jsonb_build_object(
      'ok', true,
      'audit_id', p_audit_id,
      'already_reconciled', true,
      'finance_health_after', v_run.finance_health_after
    );
  end if;
  if exists (
    select 1 from public.merchant_ownership_audit_rows
    where audit_id = p_audit_id
      and classification not in ('ALREADY_CORRECT','AUTO_REPAIR_SAFE')
  ) then
    raise exception 'unresolved_ownership_rows_block_finance';
  end if;

  v_order_totals_before := public.dn_global_order_financial_totals();
  v_health_before := public.admin_finance_reconciliation_health();

  if coalesce(v_health_before ->> 'reason', '') = 'finance_migrations_incomplete' then
    raise exception 'finance_schema_incomplete';
  end if;
  if coalesce((v_health_before ->> 'variance_zero')::boolean, false) is not true then
    raise exception using
      errcode = '23514',
      message = 'finance_variance_must_be_zero_before_missing_row_reconciliation',
      detail = v_health_before::text;
  end if;

  v_reconciliation := public.admin_reconcile_authoritative_finance();
  v_health_after := public.admin_finance_reconciliation_health();
  v_order_totals_after := public.dn_global_order_financial_totals();

  if coalesce((v_health_after ->> 'ok')::boolean, false) is not true
     or coalesce((v_health_after ->> 'authoritative')::boolean, false) is not true
     or coalesce((v_health_after ->> 'variance_zero')::boolean, false) is not true then
    raise exception using
      errcode = '23514',
      message = 'finance_reconciliation_incomplete',
      detail = v_health_after::text;
  end if;
  if v_order_totals_after is distinct from v_order_totals_before then
    raise exception 'order_financial_values_changed_during_reconciliation';
  end if;

  insert into public.merchant_ownership_finance_reconciliation_log(
    audit_id,
    health_before,
    reconciliation_result,
    health_after,
    order_totals_before,
    order_totals_after,
    executed_by
  ) values (
    p_audit_id,
    v_health_before,
    v_reconciliation,
    v_health_after,
    v_order_totals_before,
    v_order_totals_after,
    auth.uid()
  );

  update public.merchant_ownership_audit_runs
  set finance_health_before = coalesce(finance_health_before, v_health_before),
      finance_health_after = v_health_after,
      finance_reconciled_at = now()
  where id = p_audit_id;

  return jsonb_build_object(
    'ok', true,
    'audit_id', p_audit_id,
    'reconciliation', v_reconciliation,
    'finance_health_before', v_health_before,
    'finance_health_after', v_health_after,
    'order_totals_before', v_order_totals_before,
    'order_totals_after', v_order_totals_after,
    'order_financial_variance', false,
    'reconciled_at', now()
  );
end;
$$;

drop function if exists public.admin_order_merchant_acceptance(text);
create or replace function public.admin_order_merchant_acceptance(
  p_coupon text default '010505',
  p_expected_merchant_code text default '1999'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_rows jsonb;
  v_one jsonb;
  v_ok boolean;
begin
  if auth.uid() is null or not public.is_admin_or_support() then
    raise exception 'not_authorized';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  into v_rows
  from (
    select
      o.id::text order_id,
      o.coupon_number,
      coalesce(nullif(btrim(o.tracking_number), ''), nullif(btrim(o.invoice_number), ''), o.id::text) tracking_number,
      o.merchant_id,
      o.merchant_code,
      o.merchant_name,
      m.trade_name legal_merchant_name,
      m.merchant_code legal_merchant_code,
      public.dn_effective_portal_link_count(o.merchant_id) portal_link_count,
      public.dn_order_dependency_mismatches(o.id::text, o.merchant_id) dependency_mismatches,
      (m.id is not null and public.dn_effective_portal_link_count(o.merchant_id) > 0) portal_visible_by_exact_uuid,
      o.status,
      o.created_at
    from public.orders o
    left join public.merchants m on m.id = o.merchant_id
    where public.dn_normalized_merchant_identity(o.coupon_number)
      = public.dn_normalized_merchant_identity(p_coupon)
  ) x;

  if jsonb_array_length(v_rows) = 1 then v_one := v_rows -> 0; end if;
  v_ok := jsonb_array_length(v_rows) = 1
    and coalesce((v_one ->> 'portal_visible_by_exact_uuid')::boolean, false)
    and public.dn_normalized_merchant_identity(v_one ->> 'legal_merchant_code')
      = public.dn_normalized_merchant_identity(p_expected_merchant_code)
    and coalesce((v_one -> 'dependency_mismatches' ->> 'total')::integer, 0) = 0;

  return jsonb_build_object(
    'ok', v_ok,
    'coupon', p_coupon,
    'expected_merchant_code', p_expected_merchant_code,
    'matching_orders', jsonb_array_length(v_rows),
    'orders', v_rows,
    'checked_at', now()
  );
end;
$$;

revoke all on function public.admin_merchant_identity_inventory() from public, anon;
revoke all on function public.admin_run_global_merchant_system_dry_run(text) from public, anon;
revoke all on function public.admin_apply_global_merchant_finance_reconciliation(uuid,text) from public, anon;
revoke all on function public.admin_order_merchant_acceptance(text,text) from public, anon;

grant execute on function public.admin_merchant_identity_inventory() to authenticated;
grant execute on function public.admin_run_global_merchant_system_dry_run(text) to authenticated;
grant execute on function public.admin_apply_global_merchant_finance_reconciliation(uuid,text) to authenticated;
grant execute on function public.admin_order_merchant_acceptance(text,text) to authenticated;

grant select on public.merchant_ownership_finance_reconciliation_log to authenticated;

notify pgrst, 'reload schema';

commit;
