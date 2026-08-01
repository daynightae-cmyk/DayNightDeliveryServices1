-- DAY NIGHT DELIVERY SERVICES
-- Global order -> merchant ownership restoration framework.
--
-- IMPORTANT SAFETY CONTRACT
-- - This migration does NOT rewrite historical orders automatically.
-- - It creates an idempotent dry-run inventory, a reviewed transactional apply RPC,
--   exact UUID portal pagination, future-write constraints, and immutable audit logs.
-- - AUTO_REPAIR_SAFE rows can be applied only by an explicit administrator/service
--   call after the dry-run report has been reviewed.
-- - Coupon numbers, tracking numbers, status, customer data and financial amounts
--   are never changed by the repair RPC.

begin;

create extension if not exists pgcrypto;

create or replace function public.dn_normalized_merchant_identity(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select nullif(
    lower(
      regexp_replace(
        translate(
          btrim(coalesce(p_value, '')),
          '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
          '01234567890123456789'
        ),
        '[^[:alnum:]]+',
        '',
        'g'
      )
    ),
    ''
  );
$$;

create or replace function public.dn_merchant_phone_digits(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select nullif(
    regexp_replace(
      translate(
        btrim(coalesce(p_value, '')),
        '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
        '01234567890123456789'
      ),
      '[^0-9]+',
      '',
      'g'
    ),
    ''
  );
$$;

create or replace function public.dn_safe_numeric(p_value text)
returns numeric
language plpgsql
immutable
parallel safe
set search_path = public, pg_temp
as $$
begin
  if nullif(btrim(coalesce(p_value, '')), '') is null then
    return 0;
  end if;
  return p_value::numeric;
exception when others then
  return 0;
end;
$$;

create or replace function public.dn_merchant_is_active(p_status text)
returns boolean
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select lower(coalesce(p_status, 'active')) not in ('deleted','archived','blocked','suspended');
$$;

create or replace function public.dn_effective_portal_user_ids(p_merchant_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select coalesce(array_agg(distinct effective.user_id order by effective.user_id), '{}'::uuid[])
  from (
    select l.user_id
    from public.merchant_user_links l
    join public.merchants m on m.id = l.merchant_id
    where l.merchant_id = p_merchant_id
      and l.active
      and public.dn_merchant_is_active(m.status)

    union

    select m.user_id
    from public.merchants m
    where m.id = p_merchant_id
      and m.user_id is not null
      and public.dn_merchant_is_active(m.status)
      and not exists (
        select 1
        from public.merchant_user_links l
        where l.user_id = m.user_id
          and l.active
          and l.merchant_id <> m.id
      )
  ) effective;
$$;

create or replace function public.dn_effective_portal_link_count(p_merchant_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select coalesce(cardinality(public.dn_effective_portal_user_ids(p_merchant_id)), 0);
$$;

create table if not exists public.merchant_ownership_audit_runs (
  id uuid primary key default gen_random_uuid(),
  migration_version text not null default '20260802023000',
  status text not null default 'running'
    check (status in ('running','completed','blocked','applying','applied','failed')),
  started_by uuid,
  notes text,
  counts jsonb not null default '{}'::jsonb,
  financial_before jsonb not null default '{}'::jsonb,
  financial_after jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  applied_at timestamptz,
  failure_reason text
);

create table if not exists public.merchant_ownership_audit_rows (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.merchant_ownership_audit_runs(id) on delete restrict,
  order_id text not null,
  coupon_number text,
  tracking_number text,
  current_merchant_id uuid,
  current_merchant_code text,
  current_merchant_name text,
  candidate_merchant_id uuid,
  candidate_merchant_code text,
  candidate_merchant_name text,
  category_code text not null,
  classification text not null
    check (classification in (
      'AUTO_REPAIR_SAFE','MANUAL_REVIEW','ALREADY_CORRECT',
      'SECURITY_CONFLICT','MISSING_MERCHANT','MISSING_PORTAL_LINK'
    )),
  resolution_source text,
  confidence numeric(5,2) not null default 0,
  candidate_count integer not null default 0,
  evidence jsonb not null default '{}'::jsonb,
  order_snapshot jsonb not null,
  order_fingerprint text not null,
  status text,
  goods_value numeric not null default 0,
  delivery_fee numeric not null default 0,
  discount_amount numeric not null default 0,
  customer_total numeric not null default 0,
  merchant_due numeric not null default 0,
  cod_amount numeric not null default 0,
  created_at timestamptz,
  applied_at timestamptz,
  created_on timestamptz not null default now(),
  unique (audit_id, order_id)
);

create table if not exists public.merchant_ownership_repair_log (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.merchant_ownership_audit_runs(id) on delete restrict,
  audit_row_id uuid not null references public.merchant_ownership_audit_rows(id) on delete restrict,
  order_id text not null,
  old_merchant_id uuid,
  new_merchant_id uuid not null,
  old_merchant_code text,
  new_merchant_code text,
  old_merchant_name text,
  new_merchant_name text,
  resolution_evidence jsonb not null,
  dependent_updates jsonb not null default '{}'::jsonb,
  before_snapshot jsonb not null,
  after_snapshot jsonb not null,
  migration_version text not null default '20260802023000',
  executed_by uuid,
  executed_at timestamptz not null default now(),
  unique (audit_id, order_id)
);

create index if not exists merchant_ownership_audit_rows_audit_idx
  on public.merchant_ownership_audit_rows(audit_id, classification);
create index if not exists merchant_ownership_audit_rows_order_idx
  on public.merchant_ownership_audit_rows(order_id);
create index if not exists merchant_ownership_repair_log_order_idx
  on public.merchant_ownership_repair_log(order_id, executed_at desc);

alter table public.merchant_ownership_audit_runs enable row level security;
alter table public.merchant_ownership_audit_rows enable row level security;
alter table public.merchant_ownership_repair_log enable row level security;

do $policies$
declare
  v_table text;
begin
  foreach v_table in array array[
    'merchant_ownership_audit_runs',
    'merchant_ownership_audit_rows',
    'merchant_ownership_repair_log'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'admin ownership audit access', v_table);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin_or_support()) with check (public.is_admin_or_support())',
      'admin ownership audit access',
      v_table
    );
  end loop;
end
$policies$;

create or replace function public.dn_order_ownership_fingerprint(p_order jsonb)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select md5(
    jsonb_build_object(
      'id', p_order ->> 'id',
      'merchant_id', p_order ->> 'merchant_id',
      'merchant_code', p_order ->> 'merchant_code',
      'merchant_name', p_order ->> 'merchant_name',
      'coupon_number', p_order ->> 'coupon_number',
      'tracking_number', p_order ->> 'tracking_number',
      'status', p_order ->> 'status',
      'goods_value', p_order ->> 'goods_value',
      'delivery_fee', coalesce(p_order ->> 'delivery_fee', p_order ->> 'delivery_price'),
      'discount_amount', p_order ->> 'discount_amount',
      'customer_total', coalesce(p_order ->> 'customer_total', p_order ->> 'total'),
      'merchant_due', p_order ->> 'merchant_due',
      'cod_amount', p_order ->> 'cod_amount',
      'receiver_name', p_order ->> 'receiver_name',
      'receiver_phone', p_order ->> 'receiver_phone',
      'receiver_address', p_order ->> 'receiver_address',
      'created_at', p_order ->> 'created_at',
      'updated_at', p_order ->> 'updated_at'
    )::text
  );
$$;

create or replace function public.dn_global_order_financial_totals()
returns jsonb
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'orders_count', count(*),
    'goods_value', coalesce(sum(public.dn_safe_numeric(to_jsonb(o) ->> 'goods_value')), 0),
    'delivery_fees', coalesce(sum(public.dn_safe_numeric(coalesce(to_jsonb(o) ->> 'delivery_fee', to_jsonb(o) ->> 'delivery_price'))), 0),
    'discounts', coalesce(sum(public.dn_safe_numeric(to_jsonb(o) ->> 'discount_amount')), 0),
    'customer_totals', coalesce(sum(public.dn_safe_numeric(coalesce(to_jsonb(o) ->> 'customer_total', to_jsonb(o) ->> 'total'))), 0),
    'merchant_dues', coalesce(sum(public.dn_safe_numeric(to_jsonb(o) ->> 'merchant_due')), 0),
    'cod_total', coalesce(sum(public.dn_safe_numeric(to_jsonb(o) ->> 'cod_amount')), 0),
    'status_counts', coalesce((
      select jsonb_object_agg(status_key, status_count)
      from (
        select lower(coalesce(nullif(btrim(o2.status::text), ''), 'unknown')) status_key, count(*) status_count
        from public.orders o2
        group by 1
      ) grouped_statuses
    ), '{}'::jsonb)
  )
  from public.orders o;
$$;

create or replace function public.admin_run_global_merchant_ownership_dry_run(p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_audit_id uuid;
  v_counts jsonb;
  v_financial jsonb;
begin
  if auth.role() <> 'service_role'
     and (auth.uid() is null or not public.is_admin_or_support()) then
    raise exception 'not_authorized';
  end if;

  v_financial := public.dn_global_order_financial_totals();

  insert into public.merchant_ownership_audit_runs(
    started_by, notes, financial_before
  ) values (
    auth.uid(), nullif(btrim(coalesce(p_notes, '')), ''), v_financial
  ) returning id into v_audit_id;

  insert into public.merchant_ownership_audit_rows(
    audit_id,
    order_id,
    coupon_number,
    tracking_number,
    current_merchant_id,
    current_merchant_code,
    current_merchant_name,
    candidate_merchant_id,
    candidate_merchant_code,
    candidate_merchant_name,
    category_code,
    classification,
    resolution_source,
    confidence,
    candidate_count,
    evidence,
    order_snapshot,
    order_fingerprint,
    status,
    goods_value,
    delivery_fee,
    discount_amount,
    customer_total,
    merchant_due,
    cod_amount,
    created_at
  )
  with order_base as (
    select
      o,
      to_jsonb(o) as order_json,
      m.id as current_exists_id,
      m.merchant_code as legal_code,
      m.trade_name as legal_name,
      m.phone as legal_phone,
      m.status as legal_status,
      public.dn_effective_portal_link_count(m.id) as current_portal_links,
      coalesce(
        public.dn_normalized_merchant_identity(o.merchant_code),
        public.dn_normalized_merchant_identity(m.merchant_code)
      ) as effective_code,
      coalesce(
        public.dn_normalized_merchant_identity(o.merchant_name),
        public.dn_normalized_merchant_identity(m.trade_name)
      ) as effective_name,
      coalesce(
        public.dn_merchant_phone_digits(o.sender_phone),
        public.dn_merchant_phone_digits(m.phone)
      ) as effective_phone
    from public.orders o
    left join public.merchants m on m.id = o.merchant_id
  ), candidates as (
    select
      b.*,
      coalesce(code_match.ids, '{}'::uuid[]) as code_candidate_ids,
      coalesce(name_phone_match.ids, '{}'::uuid[]) as name_phone_candidate_ids
    from order_base b
    left join lateral (
      select array_agg(m2.id order by m2.updated_at desc nulls last, m2.created_at desc nulls last, m2.id) as ids
      from public.merchants m2
      where b.effective_code is not null
        and public.dn_merchant_is_active(m2.status)
        and public.dn_effective_portal_link_count(m2.id) > 0
        and public.dn_normalized_merchant_identity(m2.merchant_code) = b.effective_code
    ) code_match on true
    left join lateral (
      select array_agg(m3.id order by m3.updated_at desc nulls last, m3.created_at desc nulls last, m3.id) as ids
      from public.merchants m3
      where b.effective_code is null
        and b.effective_name is not null
        and b.effective_phone is not null
        and public.dn_merchant_is_active(m3.status)
        and public.dn_effective_portal_link_count(m3.id) > 0
        and public.dn_normalized_merchant_identity(m3.trade_name) = b.effective_name
        and public.dn_merchant_phone_digits(m3.phone) = b.effective_phone
    ) name_phone_match on true
  ), classified as (
    select
      c.*,
      case
        when cardinality(c.code_candidate_ids) = 1 then c.code_candidate_ids[1]
        when cardinality(c.code_candidate_ids) = 0
             and cardinality(c.name_phone_candidate_ids) = 1 then c.name_phone_candidate_ids[1]
        else null
      end as candidate_id,
      case
        when cardinality(c.code_candidate_ids) > 0 then cardinality(c.code_candidate_ids)
        else cardinality(c.name_phone_candidate_ids)
      end as candidate_total,
      case
        when cardinality(c.code_candidate_ids) = 1 then 'exact_unique_merchant_code'
        when cardinality(c.name_phone_candidate_ids) = 1 then 'exact_unique_name_and_phone_manual_review'
        when cardinality(c.code_candidate_ids) > 1 then 'duplicate_merchant_code_conflict'
        when cardinality(c.name_phone_candidate_ids) > 1 then 'duplicate_name_phone_conflict'
        else 'no_canonical_candidate'
      end as source
    from candidates c
  ), final_rows as (
    select
      x.*,
      case
        when x.current_exists_id is not null
             and public.dn_merchant_is_active(x.legal_status)
             and x.current_portal_links > 0
             and x.candidate_id is not null
             and x.candidate_id <> x.current_exists_id
          then 'SECURITY_CONFLICT'
        when x.candidate_total > 1
          then 'SECURITY_CONFLICT'
        when x.current_exists_id is not null
             and public.dn_merchant_is_active(x.legal_status)
             and x.current_portal_links > 0
             and (
               coalesce(x.o.merchant_code, '') is distinct from coalesce(x.legal_code, '')
               or coalesce(x.o.merchant_name, '') is distinct from coalesce(x.legal_name, '')
             )
          then 'AUTO_REPAIR_SAFE'
        when x.current_exists_id is not null
             and public.dn_merchant_is_active(x.legal_status)
             and x.current_portal_links > 0
          then 'ALREADY_CORRECT'
        when x.candidate_id is not null and x.source = 'exact_unique_merchant_code'
          then 'AUTO_REPAIR_SAFE'
        when x.source = 'exact_unique_name_and_phone_manual_review'
          then 'MANUAL_REVIEW'
        when x.o.merchant_id is null and x.effective_code is null and x.effective_name is null
          then 'MISSING_MERCHANT'
        when x.current_exists_id is null and x.o.merchant_id is not null
          then 'MISSING_MERCHANT'
        when x.current_exists_id is not null and x.current_portal_links = 0
          then 'MISSING_PORTAL_LINK'
        else 'MANUAL_REVIEW'
      end as final_classification,
      case
        when x.current_exists_id is not null
             and public.dn_merchant_is_active(x.legal_status)
             and x.current_portal_links > 0
             and x.candidate_id is not null
             and x.candidate_id <> x.current_exists_id then 'L_SECURITY_WRONG_MERCHANT'
        when x.candidate_total > 1 then 'I_CONFLICTING_IDENTITY'
        when x.current_exists_id is not null and x.current_portal_links > 0
             and (
               coalesce(x.o.merchant_code, '') is distinct from coalesce(x.legal_code, '')
               or coalesce(x.o.merchant_name, '') is distinct from coalesce(x.legal_name, '')
             ) then 'B_STALE_DISPLAY_FIELDS'
        when x.current_exists_id is not null and x.current_portal_links > 0 then 'A_LEGAL_AND_PORTAL_LINKED'
        when x.o.merchant_id is null and x.effective_code is not null then 'C_MISSING_MERCHANT_ID_WITH_CODE'
        when x.o.merchant_id is null then 'H_NAME_ONLY_OR_UNIDENTIFIED'
        when x.current_exists_id is null then 'D_DANGLING_MERCHANT_ID'
        when x.current_exists_id is not null and x.current_portal_links = 0 and x.candidate_id is not null then 'F_OLD_OR_DUPLICATE_MERCHANT_ROW'
        when x.current_exists_id is not null and x.current_portal_links = 0 then 'E_MERCHANT_WITHOUT_PORTAL_LINK'
        else 'J_PORTAL_VISIBILITY_REVIEW'
      end as final_category,
      case
        when x.current_exists_id is not null and x.current_portal_links > 0 then x.current_exists_id
        else x.candidate_id
      end as final_candidate_id
    from classified x
  )
  select
    v_audit_id,
    r.o.id::text,
    r.o.coupon_number,
    coalesce(nullif(btrim(r.o.tracking_number), ''), nullif(btrim(r.o.invoice_number), ''), r.o.id::text),
    r.o.merchant_id,
    r.o.merchant_code,
    r.o.merchant_name,
    r.final_candidate_id,
    cm.merchant_code,
    cm.trade_name,
    r.final_category,
    r.final_classification,
    r.source,
    case
      when r.final_classification = 'ALREADY_CORRECT' then 100
      when r.final_classification = 'AUTO_REPAIR_SAFE' and r.source = 'exact_unique_merchant_code' then 100
      when r.final_classification = 'AUTO_REPAIR_SAFE' then 99
      when r.source = 'exact_unique_name_and_phone_manual_review' then 75
      else 0
    end,
    r.candidate_total,
    jsonb_build_object(
      'current_merchant_exists', r.current_exists_id is not null,
      'current_merchant_active', public.dn_merchant_is_active(r.legal_status),
      'current_portal_link_count', r.current_portal_links,
      'effective_code', r.effective_code,
      'effective_name', r.effective_name,
      'effective_phone_suffix', right(coalesce(r.effective_phone, ''), 4),
      'code_candidate_ids', r.code_candidate_ids,
      'name_phone_candidate_ids', r.name_phone_candidate_ids,
      'resolution_source', r.source
    ),
    r.order_json,
    public.dn_order_ownership_fingerprint(r.order_json),
    r.o.status::text,
    public.dn_safe_numeric(r.order_json ->> 'goods_value'),
    public.dn_safe_numeric(coalesce(r.order_json ->> 'delivery_fee', r.order_json ->> 'delivery_price')),
    public.dn_safe_numeric(r.order_json ->> 'discount_amount'),
    public.dn_safe_numeric(coalesce(r.order_json ->> 'customer_total', r.order_json ->> 'total')),
    public.dn_safe_numeric(r.order_json ->> 'merchant_due'),
    public.dn_safe_numeric(r.order_json ->> 'cod_amount'),
    r.o.created_at,
    null
  from final_rows r
  left join public.merchants cm on cm.id = r.final_candidate_id;

  select jsonb_object_agg(classification, row_count)
  into v_counts
  from (
    select classification, count(*)::integer as row_count
    from public.merchant_ownership_audit_rows
    where audit_id = v_audit_id
    group by classification
  ) grouped;

  update public.merchant_ownership_audit_runs
  set status = case
        when coalesce((v_counts ->> 'SECURITY_CONFLICT')::integer, 0) > 0 then 'blocked'
        else 'completed'
      end,
      counts = coalesce(v_counts, '{}'::jsonb),
      completed_at = now()
  where id = v_audit_id;

  return jsonb_build_object(
    'ok', true,
    'audit_id', v_audit_id,
    'status', case
      when coalesce((v_counts ->> 'SECURITY_CONFLICT')::integer, 0) > 0 then 'blocked'
      else 'completed'
    end,
    'counts', coalesce(v_counts, '{}'::jsonb),
    'financial_before', v_financial,
    'next_step', 'Review audit rows. Apply only with admin_apply_global_merchant_ownership_repair(audit_id, APPLY_AUTO_REPAIR_SAFE).',
    'checked_at', now()
  );
exception when others then
  if v_audit_id is not null then
    update public.merchant_ownership_audit_runs
    set status = 'failed', failure_reason = sqlerrm, completed_at = now()
    where id = v_audit_id;
  end if;
  raise;
end;
$$;

create or replace function public.dn_sync_order_merchant_dependency(
  p_table text,
  p_order_id text,
  p_merchant_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_count integer := 0;
  v_relation regclass;
begin
  v_relation := to_regclass(format('public.%I', p_table));
  if v_relation is null then return 0; end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table and column_name = 'order_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table and column_name = 'merchant_id'
  ) then
    return 0;
  end if;

  execute format(
    'update public.%I set merchant_id = $1 where order_id::text = $2 and merchant_id is distinct from $1',
    p_table
  ) using p_merchant_id, p_order_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.admin_apply_global_merchant_ownership_repair(
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
  v_row public.merchant_ownership_audit_rows%rowtype;
  v_current jsonb;
  v_after jsonb;
  v_merchant public.merchants%rowtype;
  v_financial_before jsonb;
  v_financial_after jsonb;
  v_applied integer := 0;
  v_dependencies jsonb;
  v_cod integer;
  v_statements integer;
  v_settlements integer;
  v_accounts integer;
  v_invoices integer;
begin
  if auth.role() <> 'service_role'
     and (auth.uid() is null or not public.is_admin_or_support()) then
    raise exception 'not_authorized';
  end if;

  if p_confirmation is distinct from 'APPLY_AUTO_REPAIR_SAFE' then
    raise exception 'explicit_confirmation_required';
  end if;

  select * into v_run
  from public.merchant_ownership_audit_runs
  where id = p_audit_id
  for update;

  if v_run.id is null then raise exception 'audit_run_not_found'; end if;
  if v_run.status <> 'completed' then
    raise exception 'audit_run_not_applicable:%', v_run.status;
  end if;
  if exists (
    select 1 from public.merchant_ownership_audit_rows
    where audit_id = p_audit_id and classification = 'SECURITY_CONFLICT'
  ) then
    raise exception 'security_conflict_blocks_repair';
  end if;

  v_financial_before := public.dn_global_order_financial_totals();
  if v_financial_before is distinct from v_run.financial_before then
    raise exception 'production_data_changed_since_dry_run';
  end if;

  update public.merchant_ownership_audit_runs
  set status = 'applying'
  where id = p_audit_id;

  for v_row in
    select *
    from public.merchant_ownership_audit_rows
    where audit_id = p_audit_id
      and classification = 'AUTO_REPAIR_SAFE'
      and applied_at is null
    order by created_at nulls last, order_id
    for update
  loop
    if v_row.candidate_merchant_id is null then
      raise exception 'safe_row_missing_candidate:%', v_row.order_id;
    end if;

    select to_jsonb(o) into v_current
    from public.orders o
    where o.id::text = v_row.order_id
    for update;

    if v_current is null then raise exception 'order_missing_during_apply:%', v_row.order_id; end if;
    if public.dn_order_ownership_fingerprint(v_current) is distinct from v_row.order_fingerprint then
      raise exception 'order_changed_since_dry_run:%', v_row.order_id;
    end if;

    select * into v_merchant
    from public.merchants
    where id = v_row.candidate_merchant_id
      and public.dn_merchant_is_active(status)
      and public.dn_effective_portal_link_count(id) > 0;

    if v_merchant.id is null then
      raise exception 'candidate_no_longer_canonical:%', v_row.order_id;
    end if;

    update public.orders o
    set merchant_id = v_merchant.id,
        merchant_code = v_merchant.merchant_code,
        merchant_name = v_merchant.trade_name,
        updated_at = case
          when to_jsonb(o) ? 'updated_at' then now()
          else o.created_at
        end
    where o.id::text = v_row.order_id;

    select to_jsonb(o) into v_after
    from public.orders o
    where o.id::text = v_row.order_id;

    if coalesce(v_after ->> 'coupon_number', '') is distinct from coalesce(v_current ->> 'coupon_number', '')
       or coalesce(v_after ->> 'tracking_number', '') is distinct from coalesce(v_current ->> 'tracking_number', '')
       or coalesce(v_after ->> 'status', '') is distinct from coalesce(v_current ->> 'status', '')
       or public.dn_safe_numeric(v_after ->> 'goods_value') is distinct from public.dn_safe_numeric(v_current ->> 'goods_value')
       or public.dn_safe_numeric(coalesce(v_after ->> 'delivery_fee', v_after ->> 'delivery_price')) is distinct from public.dn_safe_numeric(coalesce(v_current ->> 'delivery_fee', v_current ->> 'delivery_price'))
       or public.dn_safe_numeric(v_after ->> 'discount_amount') is distinct from public.dn_safe_numeric(v_current ->> 'discount_amount')
       or public.dn_safe_numeric(coalesce(v_after ->> 'customer_total', v_after ->> 'total')) is distinct from public.dn_safe_numeric(coalesce(v_current ->> 'customer_total', v_current ->> 'total'))
       or public.dn_safe_numeric(v_after ->> 'merchant_due') is distinct from public.dn_safe_numeric(v_current ->> 'merchant_due')
       or public.dn_safe_numeric(v_after ->> 'cod_amount') is distinct from public.dn_safe_numeric(v_current ->> 'cod_amount') then
      raise exception 'protected_order_data_changed:%', v_row.order_id;
    end if;

    v_cod := public.dn_sync_order_merchant_dependency('cod_collections', v_row.order_id, v_merchant.id);
    v_statements := public.dn_sync_order_merchant_dependency('merchant_statement_entries', v_row.order_id, v_merchant.id);
    v_settlements := public.dn_sync_order_merchant_dependency('order_financial_settlements', v_row.order_id, v_merchant.id);
    v_accounts := public.dn_sync_order_merchant_dependency('financial_account_entries', v_row.order_id, v_merchant.id);
    v_invoices := public.dn_sync_order_merchant_dependency('invoices', v_row.order_id, v_merchant.id);

    v_dependencies := jsonb_build_object(
      'cod_collections', v_cod,
      'merchant_statement_entries', v_statements,
      'order_financial_settlements', v_settlements,
      'financial_account_entries', v_accounts,
      'invoices', v_invoices
    );

    insert into public.merchant_ownership_repair_log(
      audit_id, audit_row_id, order_id,
      old_merchant_id, new_merchant_id,
      old_merchant_code, new_merchant_code,
      old_merchant_name, new_merchant_name,
      resolution_evidence, dependent_updates,
      before_snapshot, after_snapshot, executed_by
    ) values (
      p_audit_id, v_row.id, v_row.order_id,
      nullif(v_current ->> 'merchant_id', '')::uuid, v_merchant.id,
      v_current ->> 'merchant_code', v_merchant.merchant_code,
      v_current ->> 'merchant_name', v_merchant.trade_name,
      v_row.evidence, v_dependencies,
      v_current, v_after, auth.uid()
    ) on conflict (audit_id, order_id) do nothing;

    if to_regclass('public.admin_audit_events') is not null then
      insert into public.admin_audit_events(
        actor_id, actor_email, entity_type, entity_id, action,
        before_data, after_data, metadata
      ) values (
        auth.uid(), auth.jwt() ->> 'email', 'order', v_row.order_id,
        'merchant_ownership_repaired', v_current, v_after,
        jsonb_build_object(
          'audit_id', p_audit_id,
          'migration_version', '20260802023000',
          'resolution_evidence', v_row.evidence,
          'dependent_updates', v_dependencies
        )
      );
    end if;

    update public.merchant_ownership_audit_rows
    set applied_at = now()
    where id = v_row.id;

    v_applied := v_applied + 1;
  end loop;

  v_financial_after := public.dn_global_order_financial_totals();
  if v_financial_after is distinct from v_financial_before then
    raise exception 'financial_integrity_variance_detected';
  end if;

  update public.merchant_ownership_audit_runs
  set status = 'applied',
      financial_after = v_financial_after,
      applied_at = now()
  where id = p_audit_id;

  return jsonb_build_object(
    'ok', true,
    'audit_id', p_audit_id,
    'orders_repaired', v_applied,
    'financial_before', v_financial_before,
    'financial_after', v_financial_after,
    'financial_variance', false,
    'completed_at', now()
  );
exception when others then
  if p_audit_id is not null then
    update public.merchant_ownership_audit_runs
    set status = 'failed', failure_reason = sqlerrm, completed_at = now()
    where id = p_audit_id;
  end if;
  raise;
end;
$$;

create or replace function public.admin_global_merchant_ownership_report(p_audit_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_id uuid;
  v_run public.merchant_ownership_audit_runs%rowtype;
  v_rows jsonb;
begin
  if auth.role() <> 'service_role'
     and (auth.uid() is null or not public.is_admin_or_support()) then
    raise exception 'not_authorized';
  end if;

  v_id := p_audit_id;
  if v_id is null then
    select id into v_id
    from public.merchant_ownership_audit_runs
    order by started_at desc
    limit 1;
  end if;

  select * into v_run
  from public.merchant_ownership_audit_runs
  where id = v_id;

  if v_run.id is null then
    return jsonb_build_object('ok', false, 'reason', 'audit_run_not_found');
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at nulls last, r.order_id), '[]'::jsonb)
  into v_rows
  from public.merchant_ownership_audit_rows r
  where r.audit_id = v_id
    and r.classification <> 'ALREADY_CORRECT';

  return jsonb_build_object(
    'ok', true,
    'run', to_jsonb(v_run),
    'affected_rows', v_rows,
    'merchant_matrix', public.admin_merchant_ownership_visibility_matrix(),
    'generated_at', now()
  );
end;
$$;

create or replace function public.admin_merchant_ownership_visibility_matrix()
returns jsonb
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select coalesce(jsonb_agg(to_jsonb(matrix) order by matrix.merchant_code nulls last, matrix.merchant_id), '[]'::jsonb)
  from (
    select
      m.id as merchant_id,
      m.merchant_code,
      m.trade_name as merchant_name,
      public.dn_effective_portal_link_count(m.id) as portal_user_count,
      count(o.id) as database_count,
      count(o.id) as admin_count,
      case when public.dn_effective_portal_link_count(m.id) > 0 then count(o.id) else 0 end as portal_count,
      case
        when public.dn_effective_portal_link_count(m.id) = 0 then 'MISSING_PORTAL_LINK'
        else 'PASS'
      end as result
    from public.merchants m
    left join public.orders o on o.merchant_id = m.id
    where public.dn_merchant_is_active(m.status)
    group by m.id, m.merchant_code, m.trade_name
  ) matrix;
$$;

create or replace function public.merchant_portal_orders_page(
  p_page integer default 1,
  p_page_size integer default 50,
  p_search text default null,
  p_status text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_merchant_id uuid := public.merchant_session_id();
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 50), 1), 100);
  v_offset integer;
  v_count bigint;
  v_orders jsonb;
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_status text := nullif(lower(btrim(coalesce(p_status, ''))), '');
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_merchant_id is null then raise exception 'merchant_profile_not_found'; end if;

  v_offset := (v_page - 1) * v_page_size;

  select count(*) into v_count
  from public.orders o
  where o.merchant_id = v_merchant_id
    and (v_status is null or lower(o.status::text) = v_status)
    and (
      v_search is null
      or coalesce(o.coupon_number, '') ilike '%' || v_search || '%'
      or coalesce(o.tracking_number, '') ilike '%' || v_search || '%'
      or coalesce(o.invoice_number, '') ilike '%' || v_search || '%'
      or coalesce(o.receiver_phone, '') ilike '%' || v_search || '%'
      or coalesce(o.receiver_name, '') ilike '%' || v_search || '%'
    );

  select coalesce(jsonb_agg(to_jsonb(rows_page) order by rows_page.created_at desc nulls last, rows_page.updated_at desc nulls last), '[]'::jsonb)
  into v_orders
  from (
    select *
    from public.orders o
    where o.merchant_id = v_merchant_id
      and (v_status is null or lower(o.status::text) = v_status)
      and (
        v_search is null
        or coalesce(o.coupon_number, '') ilike '%' || v_search || '%'
        or coalesce(o.tracking_number, '') ilike '%' || v_search || '%'
        or coalesce(o.invoice_number, '') ilike '%' || v_search || '%'
        or coalesce(o.receiver_phone, '') ilike '%' || v_search || '%'
        or coalesce(o.receiver_name, '') ilike '%' || v_search || '%'
      )
    order by created_at desc nulls last, updated_at desc nulls last
    offset v_offset limit v_page_size
  ) rows_page;

  return jsonb_build_object(
    'ok', true,
    'merchant_id', v_merchant_id,
    'ownership_rule', 'orders.merchant_id = merchant_session_id() exact UUID',
    'page', v_page,
    'page_size', v_page_size,
    'total_count', v_count,
    'total_pages', case when v_count = 0 then 0 else ceil(v_count::numeric / v_page_size)::integer end,
    'orders', v_orders,
    'generated_at', now()
  );
end;
$$;

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
  v_identity_changed :=
    tg_op = 'INSERT'
    or new.merchant_id is distinct from old.merchant_id
    or new.merchant_code is distinct from old.merchant_code
    or new.merchant_name is distinct from old.merchant_name;

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

drop trigger if exists trg_orders_canonical_merchant_link on public.orders;
create trigger trg_orders_canonical_merchant_link
before insert or update of merchant_id, merchant_code, merchant_name
on public.orders
for each row execute function public.dn_enforce_canonical_order_merchant_link();

-- Enforce future referential integrity without invalidating historical dangling rows.
do $fk$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'f'
      and conname = 'orders_merchant_id_canonical_fk'
  ) then
    alter table public.orders
      add constraint orders_merchant_id_canonical_fk
      foreign key (merchant_id) references public.merchants(id)
      on delete restrict
      not valid;
  end if;
end
$fk$;

revoke all on function public.dn_effective_portal_user_ids(uuid) from public, anon, authenticated;
revoke all on function public.dn_effective_portal_link_count(uuid) from public, anon, authenticated;
revoke all on function public.dn_global_order_financial_totals() from public, anon, authenticated;
revoke all on function public.dn_sync_order_merchant_dependency(text,text,uuid) from public, anon, authenticated;
revoke all on function public.admin_run_global_merchant_ownership_dry_run(text) from public, anon;
revoke all on function public.admin_apply_global_merchant_ownership_repair(uuid,text) from public, anon;
revoke all on function public.admin_global_merchant_ownership_report(uuid) from public, anon;
revoke all on function public.admin_merchant_ownership_visibility_matrix() from public, anon;
revoke all on function public.merchant_portal_orders_page(integer,integer,text,text) from public, anon;

grant execute on function public.dn_effective_portal_user_ids(uuid) to service_role;
grant execute on function public.dn_effective_portal_link_count(uuid) to service_role;
grant execute on function public.dn_global_order_financial_totals() to service_role;
grant execute on function public.dn_sync_order_merchant_dependency(text,text,uuid) to service_role;
grant execute on function public.admin_run_global_merchant_ownership_dry_run(text) to authenticated, service_role;
grant execute on function public.admin_apply_global_merchant_ownership_repair(uuid,text) to authenticated, service_role;
grant execute on function public.admin_global_merchant_ownership_report(uuid) to authenticated, service_role;
grant execute on function public.admin_merchant_ownership_visibility_matrix() to authenticated, service_role;
grant execute on function public.merchant_portal_orders_page(integer,integer,text,text) to authenticated;

grant select on public.merchant_ownership_audit_runs to authenticated, service_role;
grant select on public.merchant_ownership_audit_rows to authenticated, service_role;
grant select on public.merchant_ownership_repair_log to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
