-- DAY NIGHT DELIVERY SERVICES
-- Global order -> canonical merchant ownership, visibility and accounting repair.
--
-- This migration is intentionally two phase:
--   1. install read-only Dry Run/audit contracts and future-write protections;
--   2. expose an explicit transactional backfill RPC that updates only rows captured
--      as AUTO_REPAIR_SAFE in a reviewed audit run.
--
-- Installing this migration DOES NOT backfill any historical order.
-- No order, merchant, coupon, tracking number, status or financial value is deleted.

begin;

create extension if not exists pgcrypto with schema extensions;

-- Preserve historical rows while enforcing referential integrity for every future
-- merchant_id write. NOT VALID deliberately avoids rewriting or hiding old rows.
do $constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_merchant_id_legal_fk'
  ) then
    alter table public.orders
      add constraint orders_merchant_id_legal_fk
      foreign key (merchant_id)
      references public.merchants(id)
      not valid;
  end if;
end
$constraint$;

create or replace function public.dn_effective_portal_user_ids(p_merchant_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select coalesce(array_agg(x.user_id order by x.user_id), '{}'::uuid[])
  from (
    select l.user_id
    from public.merchant_user_links l
    join public.merchants m on m.id = l.merchant_id
    where l.merchant_id = p_merchant_id
      and l.active
      and lower(coalesce(m.status, 'active')) not in ('deleted','archived','blocked','suspended')

    union

    select m.user_id
    from public.merchants m
    where m.id = p_merchant_id
      and m.user_id is not null
      and lower(coalesce(m.status, 'active')) not in ('deleted','archived','blocked','suspended')
      and not exists (
        select 1
        from public.merchant_user_links l
        where l.user_id = m.user_id
          and l.active
          and l.merchant_id <> m.id
      )
  ) x;
$$;

create or replace function public.dn_merchant_portal_link_count(p_merchant_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select coalesce(cardinality(public.dn_effective_portal_user_ids(p_merchant_id)), 0);
$$;

-- A selected legal row may canonicalize only through its exact documented merchant
-- code. Display name and phone are never ownership evidence.
create or replace function public.dn_resolve_portal_merchant_uuid(p_merchant_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_selected public.merchants%rowtype;
  v_code text;
  v_candidates uuid[] := '{}'::uuid[];
begin
  if p_merchant_id is null then
    raise exception using errcode = '23502', message = 'merchant_required';
  end if;

  -- Keep merchant activity and every effective portal-link row stable until the
  -- surrounding order transaction commits.  SHARE conflicts with the
  -- ROW EXCLUSIVE lock required by inserts/updates/deletes on these tables.
  lock table public.merchants in share mode;
  lock table public.merchant_user_links in share mode;

  select * into v_selected
  from public.merchants m
  where m.id = p_merchant_id;

  if v_selected.id is null then
    raise exception using
      errcode = '23503',
      message = 'merchant_not_found_for_order',
      detail = jsonb_build_object('merchant_id', p_merchant_id)::text;
  end if;

  if lower(coalesce(v_selected.status, 'active')) in ('deleted','archived','blocked','suspended') then
    raise exception using
      errcode = '23514',
      message = 'merchant_inactive_for_order',
      detail = jsonb_build_object('merchant_id', v_selected.id, 'status', v_selected.status)::text;
  end if;

  if public.dn_merchant_portal_link_count(v_selected.id) > 0 then
    return v_selected.id;
  end if;

  v_code := public.dn_normalized_merchant_identity(v_selected.merchant_code);
  if v_code is null then
    raise exception using
      errcode = '23514',
      message = 'merchant_portal_account_not_linked',
      detail = jsonb_build_object(
        'merchant_id', v_selected.id,
        'merchant_code', v_selected.merchant_code,
        'reason', 'missing_exact_merchant_code_evidence'
      )::text;
  end if;

  select coalesce(array_agg(m.id order by m.id), '{}'::uuid[])
  into v_candidates
  from public.merchants m
  where m.id <> v_selected.id
    and lower(coalesce(m.status, 'active')) not in ('deleted','archived','blocked','suspended')
    and public.dn_merchant_portal_link_count(m.id) > 0
    and public.dn_normalized_merchant_identity(m.merchant_code) = v_code;

  if cardinality(v_candidates) = 1 then
    return v_candidates[1];
  end if;

  if cardinality(v_candidates) > 1 then
    raise exception using
      errcode = '23514',
      message = 'merchant_portal_link_ambiguous',
      detail = jsonb_build_object(
        'selected_merchant_id', v_selected.id,
        'merchant_code', v_selected.merchant_code,
        'candidate_ids', v_candidates
      )::text;
  end if;

  raise exception using
    errcode = '23514',
    message = 'merchant_portal_account_not_linked',
    detail = jsonb_build_object(
      'merchant_id', v_selected.id,
      'merchant_code', v_selected.merchant_code
    )::text;
end;
$$;

create or replace function public.admin_resolve_order_merchant(p_merchant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_resolved_id uuid;
  v_merchant public.merchants%rowtype;
  v_users uuid[];
begin
  if auth.role() <> 'service_role'
     and (auth.uid() is null or not public.is_admin_or_support()) then
    raise exception 'not_authorized';
  end if;

  v_resolved_id := public.dn_resolve_portal_merchant_uuid(p_merchant_id);
  select * into v_merchant from public.merchants where id = v_resolved_id;
  v_users := public.dn_effective_portal_user_ids(v_resolved_id);

  return jsonb_build_object(
    'ok', true,
    'selected_merchant_id', p_merchant_id,
    'canonical_merchant_id', v_resolved_id,
    'canonicalized', v_resolved_id is distinct from p_merchant_id,
    'portal_link_count', cardinality(v_users),
    'portal_user_ids', v_users,
    'merchant', to_jsonb(v_merchant),
    'resolution_source', case
      when v_resolved_id = p_merchant_id then 'EXPLICIT_PORTAL_LINK'
      else 'EXACT_MERCHANT_CODE_TO_SINGLE_PORTAL_CANONICAL'
    end,
    'ownership_rule', 'orders.merchant_id = canonical merchants.id'
  );
end;
$$;

-- Strict only when identity is inserted or actually changed. Historical rows can
-- still receive unrelated operational edits without being rewritten.
create or replace function public.dn_enforce_canonical_order_merchant_link()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_resolved_id uuid;
  v_merchant public.merchants%rowtype;
  v_dependencies jsonb;
  v_dependent_updates jsonb := '{}'::jsonb;
begin
  if tg_op = 'UPDATE'
     and new.merchant_id is not distinct from old.merchant_id
     and new.merchant_code is not distinct from old.merchant_code
     and new.merchant_name is not distinct from old.merchant_name then
    return new;
  end if;

  -- Merchant ownership changes must never recalculate or rewrite money. An older
  -- financial normalization trigger runs before this trigger on UPDATE, so restore
  -- every financial/legacy amount from OLD before changing canonical identity.
  if tg_op = 'UPDATE' then
    new.cod_amount := old.cod_amount;
    new.goods_value := old.goods_value;
    new.delivery_fee := old.delivery_fee;
    new.discount_amount := old.discount_amount;
    new.customer_total := old.customer_total;
    new.merchant_due := old.merchant_due;
    new.company_revenue := old.company_revenue;
    new.delivery_price := old.delivery_price;
    new.base_price := old.base_price;
    new.subtotal := old.subtotal;
    new.total := old.total;
    new.total_price := old.total_price;
    new.amount := old.amount;
    new.price := old.price;
    new.collected_amount := old.collected_amount;
    new.delivery_fee_mode := old.delivery_fee_mode;
    new.manual_delivery_price := old.manual_delivery_price;
    new.price_source := old.price_source;
    new.payment_method := old.payment_method;
    new.currency := old.currency;
    new.financial_version := old.financial_version;
    new.financial_posted_at := old.financial_posted_at;
  end if;

  if new.merchant_id is null then
    if nullif(btrim(coalesce(new.merchant_code, '')), '') is not null
       or nullif(btrim(coalesce(new.merchant_name, '')), '') is not null then
      raise exception using
        errcode = '23502',
        message = 'merchant_id_required_for_selected_merchant',
        hint = 'تعذر ربط الطلب بالتاجر المحدد بشكل آمن، ولذلك لم يتم حفظ الطلب. راجع ربط حساب التاجر ثم أعد المحاولة.';
    end if;
    return new;
  end if;

  v_resolved_id := public.dn_resolve_portal_merchant_uuid(new.merchant_id);
  select * into v_merchant from public.merchants where id = v_resolved_id;
  new.merchant_id := v_merchant.id;
  new.merchant_code := v_merchant.merchant_code;
  new.merchant_name := v_merchant.trade_name;

  if tg_op = 'UPDATE'
     and coalesce(current_setting('daynight.order_merchant_reconciliation', true), '') <> 'backfill' then
    v_dependencies := public.dn_order_dependency_ownership_snapshot(
      old.id,
      old.merchant_id,
      v_merchant.id
    );
    if coalesce((v_dependencies ->> 'total_conflicts')::integer, 0) <> 0 then
      raise exception using
        errcode = '23514',
        message = 'dependent_merchant_security_conflict',
        detail = jsonb_build_object('order_id', old.id, 'dependencies', v_dependencies)::text;
    end if;

    v_dependent_updates := public.dn_apply_order_dependency_ownership(
      old.id,
      old.merchant_id,
      v_merchant.id
    );

    insert into public.order_merchant_repair_audit (
      run_id, order_id, old_merchant_id, new_merchant_id,
      old_merchant_code, new_merchant_code, old_merchant_name, new_merchant_name,
      resolution_evidence, dependent_rows_updated, migration_version,
      operation_type, executed_by
    ) values (
      null, old.id, old.merchant_id, v_merchant.id,
      old.merchant_code, v_merchant.merchant_code, old.merchant_name, v_merchant.trade_name,
      case when old.merchant_id is distinct from v_merchant.id
        then 'AUTHORIZED_CANONICAL_MERCHANT_CHANGE'
        else 'CANONICAL_MERCHANT_DISPLAY_SYNC'
      end,
      v_dependent_updates, '20260802023000', 'INTERACTIVE_UPDATE', auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_canonical_merchant_link on public.orders;
create trigger trg_orders_canonical_merchant_link
before insert or update of merchant_id, merchant_code, merchant_name
on public.orders
for each row
execute function public.dn_enforce_canonical_order_merchant_link();

-- One atomic admin creation path. The existing mature admin_create_coupon_order
-- implementation remains responsible for financial/accounting side effects.
create or replace function public.admin_create_canonical_merchant_order(p_order jsonb)
returns public.orders
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_selected_id uuid := public.admin_safe_uuid(p_order ->> 'merchant_id');
  v_resolved_id uuid;
  v_merchant public.merchants%rowtype;
  v_payload jsonb;
  v_created public.orders%rowtype;
  v_saved public.orders%rowtype;
begin
  if auth.uid() is null or not public.is_admin_or_support() then
    raise exception 'not_authorized';
  end if;

  v_resolved_id := public.dn_resolve_portal_merchant_uuid(v_selected_id);
  select * into v_merchant from public.merchants where id = v_resolved_id;
  v_payload := coalesce(p_order, '{}'::jsonb) || jsonb_build_object(
    'merchant_id', v_merchant.id,
    'merchant_code', v_merchant.merchant_code,
    'merchant_name', v_merchant.trade_name
  );

  select * into v_created from public.admin_create_coupon_order(v_payload);
  if v_created.id is null then
    raise exception 'canonical_merchant_order_creation_returned_no_row';
  end if;

  select * into v_saved from public.orders where id = v_created.id for update;
  if v_saved.id is null or v_saved.merchant_id is distinct from v_resolved_id then
    raise exception using
      errcode = '23514',
      message = 'saved_order_merchant_portal_link_mismatch',
      detail = jsonb_build_object(
        'order_id', v_created.id,
        'expected_merchant_id', v_resolved_id,
        'saved_merchant_id', v_saved.merchant_id
      )::text;
  end if;

  return v_saved;
end;
$$;

-- Complete portal pagination. Ownership remains exact merchant UUID only.
create or replace function public.merchant_portal_orders_page(
  p_page integer default 1,
  p_page_size integer default 200
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
  v_page_size integer := least(greatest(coalesce(p_page_size, 200), 1), 250);
  v_total bigint;
  v_pages integer;
  v_orders jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_merchant_id is null then raise exception 'merchant_profile_not_found'; end if;

  select count(*) into v_total
  from public.orders o
  where o.merchant_id = v_merchant_id;

  v_pages := greatest(1, ceil(v_total::numeric / v_page_size)::integer);
  if v_page > v_pages then raise exception 'merchant_orders_page_out_of_range'; end if;

  select coalesce(jsonb_agg(to_jsonb(o) order by o.created_at desc nulls last, o.id desc), '[]'::jsonb)
  into v_orders
  from (
    select *
    from public.orders
    where merchant_id = v_merchant_id
    order by created_at desc nulls last, id desc
    limit v_page_size
    offset ((v_page - 1) * v_page_size)
  ) o;

  return jsonb_build_object(
    'ok', true,
    'merchant_id', v_merchant_id,
    'page', v_page,
    'page_size', v_page_size,
    'total_count', v_total,
    'total_pages', v_pages,
    'orders', v_orders,
    'ownership_rule', 'merchant_id_only'
  );
end;
$$;

create table if not exists public.order_merchant_audit_runs (
  id uuid primary key default gen_random_uuid(),
  migration_version text not null default '20260802023000',
  status text not null default 'DRY_RUN',
  executed_by uuid,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  applied_at timestamptz,
  inventory jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  merchant_summary jsonb not null default '{}'::jsonb,
  financial_before jsonb not null default '{}'::jsonb,
  financial_after jsonb
);

create table if not exists public.order_merchant_audit_snapshot (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.order_merchant_audit_runs(id),
  order_id uuid not null references public.orders(id),
  coupon_number text,
  tracking_number text,
  current_merchant_id uuid,
  current_merchant_code text,
  current_merchant_name text,
  candidate_canonical_merchant_id uuid,
  candidate_merchant_code text,
  candidate_merchant_name text,
  category_codes text[] not null default '{}',
  classification text not null,
  resolution_evidence text,
  confidence integer not null default 0,
  auto_repair_safe boolean not null default false,
  status text,
  financial_values jsonb not null default '{}'::jsonb,
  order_before jsonb not null default '{}'::jsonb,
  dependency_ownership jsonb not null default '{}'::jsonb,
  created_at timestamptz,
  captured_at timestamptz not null default now(),
  unique (run_id, order_id)
);

create table if not exists public.order_merchant_repair_audit (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.order_merchant_audit_runs(id),
  order_id uuid not null references public.orders(id),
  old_merchant_id uuid,
  new_merchant_id uuid not null,
  old_merchant_code text,
  new_merchant_code text,
  old_merchant_name text,
  new_merchant_name text,
  resolution_evidence text not null,
  dependent_rows_updated jsonb not null default '{}'::jsonb,
  migration_version text not null,
  operation_type text not null default 'BACKFILL',
  executed_by uuid,
  executed_at timestamptz not null default now(),
  unique (run_id, order_id)
);

create table if not exists public.merchant_identity_audit_snapshot (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.order_merchant_audit_runs(id),
  merchant_id uuid not null references public.merchants(id),
  merchant_code text,
  official_name text,
  phone text,
  email text,
  status text,
  current_portal_user_ids uuid[] not null default '{}',
  candidate_portal_user_id uuid,
  classification text not null,
  resolution_evidence text not null,
  confidence integer not null default 0,
  auto_repair_safe boolean not null default false,
  linked_order_count bigint not null default 0,
  captured_at timestamptz not null default now(),
  unique (run_id, merchant_id)
);

create table if not exists public.merchant_link_repair_audit (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.order_merchant_audit_runs(id),
  merchant_id uuid not null references public.merchants(id),
  user_id uuid not null,
  resolution_evidence text not null,
  migration_version text not null,
  executed_by uuid,
  executed_at timestamptz not null default now(),
  unique (run_id, merchant_id),
  unique (run_id, user_id)
);

create table if not exists public.order_merchant_financial_repair_audit (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.order_merchant_audit_runs(id),
  order_id uuid not null references public.orders(id),
  dependency_table text not null,
  dependency_key text not null,
  inserted_row_id text not null,
  resolution_evidence text not null,
  financial_values jsonb not null,
  migration_version text not null,
  executed_by uuid,
  executed_at timestamptz not null default now(),
  unique (run_id, order_id, dependency_table, dependency_key)
);

alter table public.order_merchant_repair_audit
  add column if not exists operation_type text not null default 'BACKFILL';

alter table public.order_merchant_audit_snapshot
  add column if not exists order_before jsonb not null default '{}'::jsonb;

alter table public.order_merchant_audit_runs enable row level security;
alter table public.order_merchant_audit_snapshot enable row level security;
alter table public.order_merchant_repair_audit enable row level security;
alter table public.merchant_identity_audit_snapshot enable row level security;
alter table public.merchant_link_repair_audit enable row level security;
alter table public.order_merchant_financial_repair_audit enable row level security;

drop policy if exists order_merchant_audit_runs_admin_select on public.order_merchant_audit_runs;
create policy order_merchant_audit_runs_admin_select on public.order_merchant_audit_runs
for select to authenticated using (public.is_admin_or_support());
drop policy if exists order_merchant_audit_snapshot_admin_select on public.order_merchant_audit_snapshot;
create policy order_merchant_audit_snapshot_admin_select on public.order_merchant_audit_snapshot
for select to authenticated using (public.is_admin_or_support());
drop policy if exists order_merchant_repair_audit_admin_select on public.order_merchant_repair_audit;
create policy order_merchant_repair_audit_admin_select on public.order_merchant_repair_audit
for select to authenticated using (public.is_admin_or_support());
drop policy if exists merchant_identity_audit_snapshot_admin_select on public.merchant_identity_audit_snapshot;
create policy merchant_identity_audit_snapshot_admin_select on public.merchant_identity_audit_snapshot
for select to authenticated using (public.is_admin_or_support());
drop policy if exists merchant_link_repair_audit_admin_select on public.merchant_link_repair_audit;
create policy merchant_link_repair_audit_admin_select on public.merchant_link_repair_audit
for select to authenticated using (public.is_admin_or_support());
drop policy if exists order_merchant_financial_repair_audit_admin_select on public.order_merchant_financial_repair_audit;
create policy order_merchant_financial_repair_audit_admin_select on public.order_merchant_financial_repair_audit
for select to authenticated using (public.is_admin_or_support());

-- Hash every non-ownership value in financial/operational dependent tables. The
-- merchant_id and updated_at fields are excluded because they are the only allowed
-- reconciliation side effects; row counts and all amounts/statuses remain covered.
create or replace function public.dn_financial_dependency_integrity_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_table text;
  v_count bigint;
  v_hash text;
  v_result jsonb := '{}'::jsonb;
begin
  foreach v_table in array array[
    'cod_collections',
    'merchant_statement_entries',
    'driver_statement_entries',
    'order_financial_settlements',
    'financial_account_entries',
    'merchant_invoices',
    'invoices',
    'notifications'
  ]
  loop
    continue when to_regclass(format('public.%I', v_table)) is null;
    execute format(
      'select count(*)::bigint,
              md5(coalesce(string_agg(
                (to_jsonb(t) - ''merchant_id'' - ''updated_at'')::text,
                ''|'' order by coalesce(to_jsonb(t)->>''id'', to_jsonb(t)->>''order_id'', '''')
              ), ''''))
       from public.%I t',
      v_table
    ) into v_count, v_hash;
    v_result := v_result || jsonb_build_object(
      v_table,
      jsonb_build_object('row_count', v_count, 'non_ownership_hash', v_hash)
    );
  end loop;
  return v_result;
end;
$$;

create or replace function public.dn_missing_financial_dependencies_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with delivered as (
    select o.*
    from public.orders o
    where lower(replace(replace(coalesce(o.status::text, ''), '-', '_'), ' ', '_'))
      in ('delivered','completed','complete')
  )
  select jsonb_build_object(
    'delivered_orders', (select count(*) from delivered),
    'missing_settlements', (
      select count(*) from delivered o
      where not exists (
        select 1 from public.order_financial_settlements s where s.order_id = o.id::text
      )
    ),
    'missing_merchant_accounts', (
      select count(*) from delivered o
      where o.merchant_id is not null
        and not exists (
          select 1 from public.financial_account_entries e
          where e.order_id = o.id::text
            and e.account_type = 'merchant'
            and e.entry_type = 'delivered_order_settlement'
        )
    ),
    'missing_company_accounts', (
      select count(*) from delivered o
      where not exists (
        select 1 from public.financial_account_entries e
        where e.order_id = o.id::text
          and e.account_type = 'company'
          and e.entry_type = 'delivered_order_settlement'
      )
    ),
    'missing_cod', (
      select count(*) from delivered o
      where lower(coalesce(o.payment_method::text, '')) = 'cod'
        and coalesce(o.customer_total, 0) > 0
        and not exists (select 1 from public.cod_collections c where c.order_id = o.id)
    ),
    'missing_merchant_statements', (
      select count(*) from delivered o
      where o.merchant_id is not null
        and not exists (select 1 from public.merchant_statement_entries m where m.order_id = o.id)
    ),
    'missing_driver_statements', (
      select count(*) from delivered o
      where public.dn_safe_uuid(coalesce(
        nullif(to_jsonb(o)->>'assigned_driver_id', ''),
        nullif(to_jsonb(o)->>'driver_id', '')
      )) is not null
        and not exists (select 1 from public.driver_statement_entries d where d.order_id = o.id)
    )
  );
$$;

create or replace function public.dn_financial_integrity_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with totals as (
    select
      count(*)::bigint as order_count,
      coalesce(sum(cod_amount), 0) as cod_amount,
      coalesce(sum(goods_value), 0) as goods_value,
      coalesce(sum(delivery_fee), 0) as delivery_fee,
      coalesce(sum(discount_amount), 0) as discount_amount,
      coalesce(sum(customer_total), 0) as customer_total,
      coalesce(sum(merchant_due), 0) as merchant_due,
      coalesce(sum(company_revenue), 0) as company_revenue,
      coalesce(sum(delivery_price), 0) as delivery_price,
      coalesce(sum(collected_amount), 0) as collected_amount,
      coalesce(sum(manual_delivery_price), 0) as manual_delivery_price,
      count(*) filter (where financial_posted_at is not null)::bigint as financial_posted_count
    from public.orders
  ), statuses as (
    select coalesce(jsonb_object_agg(status_key, row_count), '{}'::jsonb) as value
    from (
      select coalesce(nullif(btrim(status::text), ''), '<NULL>') as status_key, count(*)::bigint as row_count
      from public.orders
      group by 1
      order by 1
    ) s
  )
  select jsonb_build_object(
    'order_count', t.order_count,
    'cod_amount', t.cod_amount,
    'goods_value', t.goods_value,
    'delivery_fee', t.delivery_fee,
    'discount_amount', t.discount_amount,
    'customer_total', t.customer_total,
    'merchant_due', t.merchant_due,
    'company_revenue', t.company_revenue,
    'delivery_price', t.delivery_price,
    'collected_amount', t.collected_amount,
    'manual_delivery_price', t.manual_delivery_price,
    'financial_posted_count', t.financial_posted_count,
    'status_counts', s.value,
    'missing_dependencies', public.dn_missing_financial_dependencies_snapshot(),
    'dependent_tables', public.dn_financial_dependency_integrity_snapshot()
  )
  from totals t cross join statuses s;
$$;

create or replace function public.dn_order_dependency_ownership_snapshot(
  p_order_id uuid,
  p_current_merchant_id uuid,
  p_candidate_merchant_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_table text;
  v_rows bigint;
  v_candidate bigint;
  v_repairable bigint;
  v_conflicts bigint;
  v_owners jsonb;
  v_tables jsonb := '{}'::jsonb;
  v_total_repairable bigint := 0;
  v_total_conflicts bigint := 0;
begin
  foreach v_table in array array[
    'cod_collections',
    'merchant_statement_entries',
    'order_financial_settlements',
    'financial_account_entries',
    'merchant_invoices',
    'invoices',
    'notifications'
  ]
  loop
    continue when to_regclass(format('public.%I', v_table)) is null;
    continue when not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = v_table and column_name = 'order_id'
    );
    continue when not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = v_table and column_name = 'merchant_id'
    );

    execute format(
      'select count(*),
              count(*) filter (where merchant_id = $2),
              count(*) filter (
                where merchant_id is distinct from $2
                  and (merchant_id is null or merchant_id is not distinct from $3)
              ),
              count(*) filter (
                where merchant_id is not null
                  and merchant_id is distinct from $2
                  and merchant_id is distinct from $3
              ),
              coalesce(jsonb_agg(distinct merchant_id) filter (where merchant_id is not null), ''[]''::jsonb)
       from public.%I
       where order_id::text = $1',
      v_table
    )
    into v_rows, v_candidate, v_repairable, v_conflicts, v_owners
    using p_order_id::text, p_candidate_merchant_id, p_current_merchant_id;

    v_total_repairable := v_total_repairable + coalesce(v_repairable, 0);
    v_total_conflicts := v_total_conflicts + coalesce(v_conflicts, 0);
    v_tables := v_tables || jsonb_build_object(
      v_table,
      jsonb_build_object(
        'rows', coalesce(v_rows, 0),
        'already_candidate', coalesce(v_candidate, 0),
        'repairable', coalesce(v_repairable, 0),
        'security_conflicts', coalesce(v_conflicts, 0),
        'merchant_ids', coalesce(v_owners, '[]'::jsonb)
      )
    );
  end loop;

  return jsonb_build_object(
    'total_repairable', v_total_repairable,
    'total_conflicts', v_total_conflicts,
    'tables', v_tables
  );
end;
$$;

create or replace function public.dn_production_inventory_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_table text;
  v_count bigint;
  v_tables jsonb := '{}'::jsonb;
begin
  foreach v_table in array array[
    'orders', 'merchants', 'merchant_user_links', 'merchant_statement_entries',
    'driver_statement_entries',
    'cod_collections', 'financial_account_entries', 'order_financial_settlements',
    'invoices', 'merchant_invoices', 'order_status_history'
  ]
  loop
    if to_regclass(format('public.%I', v_table)) is null then
      v_tables := v_tables || jsonb_build_object(v_table, null);
    else
      execute format('select count(*) from public.%I', v_table) into v_count;
      v_tables := v_tables || jsonb_build_object(v_table, v_count);
    end if;
  end loop;

  return v_tables || jsonb_build_object(
    'auth_users_linked_to_merchants', (
      select count(distinct user_id)
      from (
        select user_id from public.merchant_user_links where active
        union all
        select user_id from public.merchants where user_id is not null
      ) u
    ),
    'active_merchants', (
      select count(*) from public.merchants
      where lower(coalesce(status, 'active')) not in ('deleted','archived','blocked','suspended')
    ),
    'portal_linked_merchants', (
      select count(*) from public.merchants m
      where public.dn_merchant_portal_link_count(m.id) > 0
    )
  );
end;
$$;

-- Merchant account reconciliation is intentionally stricter than order display
-- reconciliation.  A portal link can only be proposed from one exact, confirmed
-- Auth email which is not already owned by another merchant and does not declare
-- an administrative, support, or driver role.  Names and phone numbers are never
-- used as account ownership evidence.
create or replace view public.dn_merchant_identity_dry_run_live as
with merchant_base as (
  select
    m.id as merchant_id,
    m.merchant_code,
    m.trade_name as official_name,
    m.phone,
    m.email,
    m.status,
    lower(nullif(btrim(m.email), '')) as normalized_email,
    public.dn_merchant_phone_digits(m.phone) as normalized_phone,
    public.dn_effective_portal_user_ids(m.id) as current_portal_user_ids,
    (
      select count(*)::bigint
      from public.orders o
      where o.merchant_id = m.id
    ) as linked_order_count,
    (
      select count(*)::integer
      from public.merchants duplicate_merchant
      where duplicate_merchant.id <> m.id
        and lower(nullif(btrim(duplicate_merchant.email), '')) = lower(nullif(btrim(m.email), ''))
        and lower(coalesce(duplicate_merchant.status, 'active'))
            not in ('deleted','archived','blocked','suspended')
    ) as duplicate_active_merchant_email_count,
    (
      select count(*)::integer
      from public.merchants duplicate_merchant
      where duplicate_merchant.id <> m.id
        and public.dn_merchant_phone_digits(duplicate_merchant.phone)
            = public.dn_merchant_phone_digits(m.phone)
        and public.dn_merchant_phone_digits(m.phone) is not null
        and lower(coalesce(duplicate_merchant.status, 'active'))
            not in ('deleted','archived','blocked','suspended')
    ) as duplicate_active_merchant_phone_count
  from public.merchants m
), auth_candidates as (
  select
    b.*,
    coalesce(c.candidate_user_ids, '{}'::uuid[]) as candidate_user_ids,
    coalesce(c.email_candidate_user_ids, '{}'::uuid[]) as email_candidate_user_ids,
    coalesce(c.phone_candidate_user_ids, '{}'::uuid[]) as phone_candidate_user_ids,
    cardinality(coalesce(c.candidate_user_ids, '{}'::uuid[])) as candidate_count
  from merchant_base b
  cross join lateral (
    select
      array_agg(distinct u.id order by u.id) as candidate_user_ids,
      array_agg(distinct u.id order by u.id) filter (
        where b.normalized_email is not null
          and lower(nullif(btrim(u.email), '')) = b.normalized_email
          and u.email_confirmed_at is not null
      ) as email_candidate_user_ids,
      array_agg(distinct u.id order by u.id) filter (
        where b.normalized_phone is not null
          and public.dn_merchant_phone_digits(u.phone) = b.normalized_phone
          and u.phone_confirmed_at is not null
      ) as phone_candidate_user_ids
    from auth.users u
    where (
        (
          b.normalized_email is not null
          and lower(nullif(btrim(u.email), '')) = b.normalized_email
          and u.email_confirmed_at is not null
        )
        or (
          b.normalized_phone is not null
          and public.dn_merchant_phone_digits(u.phone) = b.normalized_phone
          and u.phone_confirmed_at is not null
        )
      )
      and lower(coalesce(
        u.raw_app_meta_data ->> 'role',
        u.raw_user_meta_data ->> 'role',
        ''
      )) not in ('admin','support','driver')
      and not exists (
        select 1
        from public.merchant_user_links l
        where l.user_id = u.id
          and l.active
          and l.merchant_id <> b.merchant_id
      )
      and not exists (
        select 1
        from public.merchants other_merchant
        where other_merchant.id <> b.merchant_id
          and other_merchant.user_id = u.id
          and lower(coalesce(other_merchant.status, 'active'))
              not in ('deleted','archived','blocked','suspended')
      )
  ) c
), classified as (
  select
    a.*,
    case
      when cardinality(a.current_portal_user_ids) > 0 then 'ALREADY_CORRECT'
      when lower(coalesce(a.status, 'active')) in ('deleted','archived','blocked','suspended')
        then 'MISSING_PORTAL_LINK'
      when a.duplicate_active_merchant_email_count > 0 then 'SECURITY_CONFLICT'
      when a.duplicate_active_merchant_phone_count > 0 then 'SECURITY_CONFLICT'
      when a.candidate_count > 1 then 'SECURITY_CONFLICT'
      when a.candidate_count = 1 then 'AUTO_REPAIR_SAFE'
      else 'MISSING_PORTAL_LINK'
    end as classification
  from auth_candidates a
)
select
  c.merchant_id,
  c.merchant_code,
  c.official_name,
  c.phone,
  c.email,
  c.status,
  c.current_portal_user_ids,
  case when c.classification = 'AUTO_REPAIR_SAFE' then c.candidate_user_ids[1] end
    as candidate_portal_user_id,
  c.classification,
  case
    when c.classification = 'ALREADY_CORRECT' then 'EXPLICIT_EFFECTIVE_PORTAL_RELATION'
    when c.classification = 'AUTO_REPAIR_SAFE'
      and cardinality(c.email_candidate_user_ids) = 1
      then 'EXACT_UNIQUE_CONFIRMED_AUTH_EMAIL'
    when c.classification = 'AUTO_REPAIR_SAFE' then 'EXACT_UNIQUE_CONFIRMED_AUTH_PHONE'
    when c.classification = 'SECURITY_CONFLICT' and c.duplicate_active_merchant_email_count > 0
      then 'EMAIL_SHARED_BY_MULTIPLE_ACTIVE_MERCHANTS'
    when c.classification = 'SECURITY_CONFLICT' and c.duplicate_active_merchant_phone_count > 0
      then 'PHONE_SHARED_BY_MULTIPLE_ACTIVE_MERCHANTS'
    when c.classification = 'SECURITY_CONFLICT' then 'MULTIPLE_EXACT_CONFIRMED_AUTH_USERS'
    when lower(coalesce(c.status, 'active')) in ('deleted','archived','blocked','suspended')
      then 'INACTIVE_MERCHANT_NOT_AUTO_LINKED'
    when c.normalized_email is null and c.normalized_phone is null
      then 'MERCHANT_EMAIL_AND_PHONE_MISSING'
    else 'NO_EXACT_UNIQUE_CONFIRMED_AUTH_IDENTITY'
  end as resolution_evidence,
  case
    when c.classification in ('ALREADY_CORRECT','AUTO_REPAIR_SAFE') then 100
    else 0
  end as confidence,
  c.classification = 'AUTO_REPAIR_SAFE' as auto_repair_safe,
  c.linked_order_count
from classified c;

create or replace view public.dn_order_merchant_dry_run_live as
with base as (
  select
    o.*,
    cm.id as legal_current_merchant_id,
    cm.merchant_code as legal_current_merchant_code,
    cm.trade_name as legal_current_merchant_name,
    cm.status as legal_current_merchant_status,
    coalesce(public.dn_merchant_portal_link_count(cm.id), 0) as current_portal_link_count,
    public.dn_normalized_merchant_identity(o.merchant_code) as order_code_key,
    public.dn_normalized_merchant_identity(cm.merchant_code) as current_code_key,
    lower(coalesce(o.source_channel, '')) = 'admin_personal_order' as is_personal_order
  from public.orders o
  left join public.merchants cm on cm.id = o.merchant_id
), candidates as (
  select
    b.*,
    c.candidate_ids,
    cardinality(c.candidate_ids) as candidate_count,
    case
      when b.legal_current_merchant_id is not null and b.current_portal_link_count > 0
        then b.legal_current_merchant_id
      when cardinality(c.candidate_ids) = 1 then c.candidate_ids[1]
      else null
    end as candidate_id,
    (
      b.order_code_key is not null
      and b.current_code_key is not null
      and b.order_code_key <> b.current_code_key
    ) as code_conflict
  from base b
  cross join lateral (
    select coalesce(array_agg(m.id order by m.id), '{}'::uuid[]) as candidate_ids
    from public.merchants m
    where lower(coalesce(m.status, 'active')) not in ('deleted','archived','blocked','suspended')
      and public.dn_merchant_portal_link_count(m.id) > 0
      and public.dn_normalized_merchant_identity(m.merchant_code)
          = coalesce(b.order_code_key, b.current_code_key)
  ) c
), enriched as (
  select
    c.*,
    candidate.merchant_code as candidate_merchant_code,
    candidate.trade_name as candidate_merchant_name,
    public.dn_order_dependency_ownership_snapshot(c.id, c.merchant_id, c.candidate_id) as dependencies,
    (
      c.legal_current_merchant_id is not null
      and c.current_portal_link_count > 0
      and (
        c.merchant_code is distinct from c.legal_current_merchant_code
        or c.merchant_name is distinct from c.legal_current_merchant_name
      )
    ) as display_mismatch
  from candidates c
  left join public.merchants candidate on candidate.id = c.candidate_id
), classified as (
  select
    e.*,
    case
      when e.is_personal_order
       and e.merchant_id is null
       and nullif(btrim(coalesce(e.merchant_code, '')), '') is null
       and nullif(btrim(coalesce(e.merchant_name, '')), '') is null
        then 'ALREADY_CORRECT'
      when coalesce((e.dependencies ->> 'total_conflicts')::integer, 0) > 0
        then 'SECURITY_CONFLICT'
      when e.code_conflict then 'SECURITY_CONFLICT'
      when e.candidate_count > 1 then 'SECURITY_CONFLICT'
      when e.legal_current_merchant_id is not null
       and e.current_portal_link_count > 0
       and e.display_mismatch then 'AUTO_REPAIR_SAFE'
      when e.legal_current_merchant_id is not null
       and e.current_portal_link_count > 0 then 'ALREADY_CORRECT'
      when e.candidate_count = 1
       and coalesce(e.order_code_key, e.current_code_key) is not null then 'AUTO_REPAIR_SAFE'
      when e.merchant_id is null
       and nullif(btrim(coalesce(e.merchant_name, '')), '') is not null then 'MANUAL_REVIEW'
      when e.merchant_id is null then 'MISSING_MERCHANT'
      when e.legal_current_merchant_id is null then 'MISSING_MERCHANT'
      when e.current_portal_link_count = 0 then 'MISSING_PORTAL_LINK'
      else 'MANUAL_REVIEW'
    end as classification
  from enriched e
)
select
  c.id as order_id,
  c.coupon_number,
  coalesce(c.tracking_number, c.invoice_number, c.id::text) as tracking_number,
  c.merchant_id as current_merchant_id,
  c.merchant_code as current_merchant_code,
  c.merchant_name as current_merchant_name,
  c.candidate_id as candidate_canonical_merchant_id,
  c.candidate_merchant_code,
  c.candidate_merchant_name,
  array_remove(array[
    case when c.legal_current_merchant_id is not null and c.current_portal_link_count > 0 then 'A' end,
    case when c.display_mismatch then 'B' end,
    case when c.merchant_id is null then 'C' end,
    case when c.merchant_id is not null and c.legal_current_merchant_id is null then 'D' end,
    case when c.legal_current_merchant_id is not null and c.current_portal_link_count = 0 then 'E' end,
    case when c.legal_current_merchant_id is not null and c.current_portal_link_count = 0 and c.candidate_count = 1 then 'F' end,
    case when c.candidate_id is not null and c.candidate_id is distinct from c.merchant_id and c.order_code_key is not null then 'G' end,
    case when c.merchant_id is null and c.order_code_key is null and nullif(btrim(coalesce(c.merchant_name, '')), '') is not null then 'H' end,
    case when c.code_conflict or c.candidate_count > 1 then 'I' end,
    case when c.legal_current_merchant_id is not null and c.current_portal_link_count = 0 then 'J' end,
    case when coalesce((c.dependencies ->> 'total_repairable')::integer, 0) > 0 then 'K' end,
    case when coalesce((c.dependencies ->> 'total_conflicts')::integer, 0) > 0 then 'L' end,
    case when c.is_personal_order then 'PERSONAL_ORDER' end
  ], null) as category_codes,
  c.classification,
  case
    when c.classification = 'ALREADY_CORRECT' and c.is_personal_order then 'PERSONAL_ORDER_WITHOUT_MERCHANT_BY_DESIGN'
    when c.classification = 'ALREADY_CORRECT' then 'EXACT_LEGAL_UUID_AND_PORTAL_LINK'
    when c.classification = 'AUTO_REPAIR_SAFE' and c.candidate_id = c.merchant_id then 'SYNC_DISPLAY_FIELDS_FROM_LEGAL_UUID'
    when c.classification = 'AUTO_REPAIR_SAFE' then 'EXACT_MERCHANT_CODE_TO_SINGLE_PORTAL_CANONICAL'
    when c.classification = 'SECURITY_CONFLICT' then 'CONFLICTING_IDENTITY_OR_DEPENDENT_OWNER'
    when c.classification = 'MISSING_PORTAL_LINK' then 'LEGAL_MERCHANT_HAS_NO_EFFECTIVE_PORTAL_ACCOUNT'
    when c.classification = 'MISSING_MERCHANT' then 'NO_LEGAL_MERCHANT_UUID'
    else 'INSUFFICIENT_EXACT_IDENTITY_EVIDENCE'
  end as resolution_evidence,
  case
    when c.classification = 'ALREADY_CORRECT' then 100
    when c.classification = 'AUTO_REPAIR_SAFE' then 100
    when c.classification = 'SECURITY_CONFLICT' then 0
    else 25
  end as confidence,
  c.classification = 'AUTO_REPAIR_SAFE' as auto_repair_safe,
  c.status,
  jsonb_build_object(
    'cod_amount', c.cod_amount,
    'goods_value', c.goods_value,
    'delivery_fee', c.delivery_fee,
    'discount_amount', c.discount_amount,
    'customer_total', c.customer_total,
    'merchant_due', c.merchant_due,
    'company_revenue', c.company_revenue,
    'delivery_price', c.delivery_price,
    'collected_amount', c.collected_amount,
    'manual_delivery_price', c.manual_delivery_price,
    'delivery_fee_mode', c.delivery_fee_mode,
    'payment_method', c.payment_method,
    'currency', c.currency,
    'financial_version', c.financial_version,
    'financial_posted_at', c.financial_posted_at
  ) as financial_values,
  c.dependencies as dependency_ownership,
  c.created_at
from classified c;

create or replace function public.admin_order_merchant_count_matrix()
returns table (
  merchant_id uuid,
  merchant_code text,
  database_count bigint,
  admin_count bigint,
  portal_count bigint,
  portal_user_count integer,
  result text
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if auth.role() <> 'service_role'
     and (auth.uid() is null or not public.is_admin_or_support()) then
    raise exception 'not_authorized';
  end if;

  return query
  select
    m.id,
    m.merchant_code,
    count(o.id)::bigint as database_count,
    count(o.id)::bigint as admin_count,
    case when public.dn_merchant_portal_link_count(m.id) > 0 then count(o.id)::bigint else 0::bigint end as portal_count,
    public.dn_merchant_portal_link_count(m.id) as portal_user_count,
    case
      when public.dn_merchant_portal_link_count(m.id) > 0 then 'PASS'
      else 'MISSING_PORTAL_LINK'
    end as result
  from public.merchants m
  left join public.orders o on o.merchant_id = m.id
  where lower(coalesce(m.status, 'active')) not in ('deleted','archived','blocked','suspended')
  group by m.id, m.merchant_code
  order by m.merchant_code nulls last, m.id;
end;
$$;

create or replace function public.admin_run_order_merchant_dry_run()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_run_id uuid;
  v_summary jsonb;
  v_inventory jsonb;
  v_merchant_summary jsonb;
  v_financial jsonb;
begin
  if auth.role() <> 'service_role'
     and (auth.uid() is null or not public.is_admin_or_support()) then
    raise exception 'not_authorized';
  end if;

  v_inventory := public.dn_production_inventory_snapshot();
  v_financial := public.dn_financial_integrity_snapshot();

  insert into public.order_merchant_audit_runs (
    executed_by, inventory, financial_before
  ) values (
    auth.uid(), v_inventory, v_financial
  ) returning id into v_run_id;

  insert into public.order_merchant_audit_snapshot (
    run_id,
    order_id,
    coupon_number,
    tracking_number,
    current_merchant_id,
    current_merchant_code,
    current_merchant_name,
    candidate_canonical_merchant_id,
    candidate_merchant_code,
    candidate_merchant_name,
    category_codes,
    classification,
    resolution_evidence,
    confidence,
    auto_repair_safe,
    status,
    financial_values,
    order_before,
    dependency_ownership,
    created_at
  )
  select
    v_run_id,
    d.order_id,
    d.coupon_number,
    d.tracking_number,
    d.current_merchant_id,
    d.current_merchant_code,
    d.current_merchant_name,
    d.candidate_canonical_merchant_id,
    d.candidate_merchant_code,
    d.candidate_merchant_name,
    d.category_codes,
    d.classification,
    d.resolution_evidence,
    d.confidence,
    d.auto_repair_safe,
    d.status,
    d.financial_values,
    to_jsonb(o),
    d.dependency_ownership,
    d.created_at
  from public.dn_order_merchant_dry_run_live d
  join public.orders o on o.id = d.order_id;

  insert into public.merchant_identity_audit_snapshot (
    run_id,
    merchant_id,
    merchant_code,
    official_name,
    phone,
    email,
    status,
    current_portal_user_ids,
    candidate_portal_user_id,
    classification,
    resolution_evidence,
    confidence,
    auto_repair_safe,
    linked_order_count
  )
  select
    v_run_id,
    d.merchant_id,
    d.merchant_code,
    d.official_name,
    d.phone,
    d.email,
    d.status,
    d.current_portal_user_ids,
    d.candidate_portal_user_id,
    d.classification,
    d.resolution_evidence,
    d.confidence,
    d.auto_repair_safe,
    d.linked_order_count
  from public.dn_merchant_identity_dry_run_live d;

  select jsonb_build_object(
    'total_orders', count(*),
    'classification_counts', coalesce((
      select jsonb_object_agg(classification, row_count)
      from (
        select classification, count(*)::bigint as row_count
        from public.order_merchant_audit_snapshot
        where run_id = v_run_id
        group by classification
        order by classification
      ) x
    ), '{}'::jsonb),
    'category_counts', coalesce((
      select jsonb_object_agg(category_code, row_count)
      from (
        select category_code, count(*)::bigint as row_count
        from public.order_merchant_audit_snapshot s,
             unnest(s.category_codes) category_code
        where s.run_id = v_run_id
        group by category_code
        order by category_code
      ) x
    ), '{}'::jsonb),
    'acceptance_010505', coalesce((
      select jsonb_agg(jsonb_build_object(
        'order_id', order_id,
        'coupon_number', coupon_number,
        'tracking_number', tracking_number,
        'current_merchant_id', current_merchant_id,
        'candidate_canonical_merchant_id', candidate_canonical_merchant_id,
        'classification', classification,
        'resolution_evidence', resolution_evidence
      ))
      from public.order_merchant_audit_snapshot
      where run_id = v_run_id
        and public.normalized_order_coupon(coupon_number) = public.normalized_order_coupon('010505')
    ), '[]'::jsonb)
  )
  into v_summary
  from public.order_merchant_audit_snapshot
  where run_id = v_run_id;

  select jsonb_build_object(
    'active_merchants', count(*) filter (
      where lower(coalesce(m.status, 'active')) not in ('deleted','archived','blocked','suspended')
    ),
    'portal_linked_merchants', count(*) filter (
      where public.dn_merchant_portal_link_count(m.id) > 0
    ),
    'duplicate_code_groups', (
      select count(*) from (
        select public.dn_normalized_merchant_identity(merchant_code)
        from public.merchants
        where public.dn_normalized_merchant_identity(merchant_code) is not null
        group by 1 having count(*) > 1
      ) x
    ),
    'duplicate_phone_groups', (
      select count(*) from (
        select public.dn_merchant_phone_digits(phone)
        from public.merchants
        where public.dn_merchant_phone_digits(phone) is not null
        group by 1 having count(*) > 1
      ) x
    ),
    'duplicate_email_groups', (
      select count(*) from (
        select lower(btrim(email))
        from public.merchants
        where nullif(btrim(email), '') is not null
        group by 1 having count(*) > 1
      ) x
    ),
    'conflicting_user_links', (
      select count(*)
      from public.merchant_user_links l
      where l.active
        and exists (
          select 1
          from public.merchants m
          where m.user_id = l.user_id
            and m.id <> l.merchant_id
        )
    ),
    'identity_classification_counts', coalesce((
      select jsonb_object_agg(classification, row_count)
      from (
        select classification, count(*)::bigint as row_count
        from public.merchant_identity_audit_snapshot
        where run_id = v_run_id
        group by classification
        order by classification
      ) identity_counts
    ), '{}'::jsonb),
    'safe_portal_links_proposed', (
      select count(*)
      from public.merchant_identity_audit_snapshot
      where run_id = v_run_id and auto_repair_safe
    ),
    'count_matrix', coalesce((
      select jsonb_agg(to_jsonb(matrix) order by merchant_code nulls last, merchant_id)
      from public.admin_order_merchant_count_matrix() matrix
    ), '[]'::jsonb)
  )
  into v_merchant_summary
  from public.merchants m;

  update public.order_merchant_audit_runs
  set summary = v_summary,
      merchant_summary = v_merchant_summary
  where id = v_run_id;

  return jsonb_build_object(
    'ok', true,
    'run_id', v_run_id,
    'status', 'DRY_RUN',
    'inventory', v_inventory,
    'summary', v_summary,
    'merchant_summary', v_merchant_summary,
    'financial_before', v_financial,
    'orders_modified', 0
  );
end;
$$;

create or replace function public.admin_review_order_merchant_dry_run(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_bad bigint;
begin
  if auth.role() <> 'service_role'
     and (auth.uid() is null or not public.is_admin_or_support()) then
    raise exception 'not_authorized';
  end if;

  if not exists (
    select 1 from public.order_merchant_audit_runs
    where id = p_run_id and status = 'DRY_RUN'
  ) then
    raise exception 'dry_run_not_found_or_not_reviewable';
  end if;

  select count(*) into v_bad
  from public.order_merchant_audit_snapshot
  where run_id = p_run_id
    and auto_repair_safe
    and (
      classification <> 'AUTO_REPAIR_SAFE'
      or candidate_canonical_merchant_id is null
      or confidence <> 100
      or coalesce((dependency_ownership ->> 'total_conflicts')::integer, 0) <> 0
    );

  if v_bad > 0 then
    raise exception 'dry_run_contains_unsafe_auto_repair_rows';
  end if;

  select count(*) into v_bad
  from public.merchant_identity_audit_snapshot
  where run_id = p_run_id
    and auto_repair_safe
    and (
      classification <> 'AUTO_REPAIR_SAFE'
      or candidate_portal_user_id is null
      or confidence <> 100
      or resolution_evidence not in (
        'EXACT_UNIQUE_CONFIRMED_AUTH_EMAIL',
        'EXACT_UNIQUE_CONFIRMED_AUTH_PHONE'
      )
      or cardinality(current_portal_user_ids) <> 0
    );

  if v_bad > 0 then
    raise exception 'dry_run_contains_unsafe_merchant_link_rows';
  end if;

  update public.order_merchant_audit_runs
  set status = 'DRY_RUN_REVIEWED', reviewed_at = now()
  where id = p_run_id;

  return jsonb_build_object(
    'ok', true,
    'run_id', p_run_id,
    'status', 'DRY_RUN_REVIEWED',
    'auto_repair_safe_rows', (
      select count(*) from public.order_merchant_audit_snapshot
      where run_id = p_run_id and auto_repair_safe
    ),
    'auto_repair_safe_merchant_links', (
      select count(*) from public.merchant_identity_audit_snapshot
      where run_id = p_run_id and auto_repair_safe
    ),
    'orders_modified', 0
  );
end;
$$;

create or replace function public.admin_apply_safe_merchant_portal_links(
  p_run_id uuid,
  p_confirm boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_run public.order_merchant_audit_runs%rowtype;
  v_snapshot public.merchant_identity_audit_snapshot%rowtype;
  v_merchant public.merchants%rowtype;
  v_candidate_ids uuid[];
  v_email_candidate_ids uuid[];
  v_phone_candidate_ids uuid[];
  v_existing_user_id uuid;
  v_inserted integer := 0;
  v_already_applied integer := 0;
begin
  if not p_confirm then raise exception 'explicit_merchant_link_confirmation_required'; end if;
  if auth.role() <> 'service_role'
     and (auth.uid() is null or not public.is_admin_or_support()) then
    raise exception 'not_authorized';
  end if;

  select * into v_run
  from public.order_merchant_audit_runs
  where id = p_run_id
  for update;

  if v_run.id is null or v_run.status <> 'DRY_RUN_REVIEWED' then
    raise exception 'reviewed_dry_run_required';
  end if;

  lock table public.merchants in share row exclusive mode;
  lock table public.merchant_user_links in share row exclusive mode;

  for v_snapshot in
    select *
    from public.merchant_identity_audit_snapshot
    where run_id = p_run_id
      and auto_repair_safe
    order by merchant_id
  loop
    if v_snapshot.classification <> 'AUTO_REPAIR_SAFE'
       or v_snapshot.candidate_portal_user_id is null
       or v_snapshot.confidence <> 100
       or v_snapshot.resolution_evidence not in (
         'EXACT_UNIQUE_CONFIRMED_AUTH_EMAIL',
         'EXACT_UNIQUE_CONFIRMED_AUTH_PHONE'
       )
       or cardinality(v_snapshot.current_portal_user_ids) <> 0 then
      raise exception 'unsafe_merchant_link_snapshot_row_aborted';
    end if;

    select user_id into v_existing_user_id
    from public.merchant_link_repair_audit
    where run_id = p_run_id
      and merchant_id = v_snapshot.merchant_id;

    if v_existing_user_id is not null then
      if v_existing_user_id is distinct from v_snapshot.candidate_portal_user_id
         or not exists (
           select 1 from public.merchant_user_links l
           where l.merchant_id = v_snapshot.merchant_id
             and l.user_id = v_existing_user_id
             and l.active
         ) then
        raise exception 'previous_merchant_link_application_no_longer_matches';
      end if;
      v_already_applied := v_already_applied + 1;
      continue;
    end if;

    select * into v_merchant
    from public.merchants
    where id = v_snapshot.merchant_id
    for update;

    if v_merchant.id is null
       or v_merchant.merchant_code is distinct from v_snapshot.merchant_code
       or v_merchant.trade_name is distinct from v_snapshot.official_name
       or v_merchant.phone is distinct from v_snapshot.phone
       or v_merchant.email is distinct from v_snapshot.email
       or v_merchant.status is distinct from v_snapshot.status
       or lower(coalesce(v_merchant.status, 'active')) in ('deleted','archived','blocked','suspended')
       or cardinality(public.dn_effective_portal_user_ids(v_merchant.id)) <> 0 then
      raise exception using
        errcode = '40001',
        message = 'merchant_changed_since_dry_run',
        detail = jsonb_build_object('merchant_id', v_snapshot.merchant_id)::text;
    end if;

    if (
         nullif(btrim(v_merchant.email), '') is null
         and public.dn_merchant_phone_digits(v_merchant.phone) is null
       )
       or (
         nullif(btrim(v_merchant.email), '') is not null
         and exists (
         select 1
         from public.merchants duplicate_merchant
         where duplicate_merchant.id <> v_merchant.id
           and lower(nullif(btrim(duplicate_merchant.email), ''))
               = lower(nullif(btrim(v_merchant.email), ''))
           and lower(coalesce(duplicate_merchant.status, 'active'))
               not in ('deleted','archived','blocked','suspended')
         )
       )
       or (
         public.dn_merchant_phone_digits(v_merchant.phone) is not null
         and exists (
           select 1
           from public.merchants duplicate_merchant
           where duplicate_merchant.id <> v_merchant.id
             and public.dn_merchant_phone_digits(duplicate_merchant.phone)
                 = public.dn_merchant_phone_digits(v_merchant.phone)
             and lower(coalesce(duplicate_merchant.status, 'active'))
                 not in ('deleted','archived','blocked','suspended')
         )
       ) then
      raise exception 'merchant_identity_evidence_missing_or_duplicated';
    end if;

    select
      coalesce(array_agg(distinct u.id order by u.id), '{}'::uuid[]),
      coalesce(array_agg(distinct u.id order by u.id) filter (
        where nullif(btrim(v_merchant.email), '') is not null
          and lower(nullif(btrim(u.email), '')) = lower(nullif(btrim(v_merchant.email), ''))
          and u.email_confirmed_at is not null
      ), '{}'::uuid[]),
      coalesce(array_agg(distinct u.id order by u.id) filter (
        where public.dn_merchant_phone_digits(v_merchant.phone) is not null
          and public.dn_merchant_phone_digits(u.phone) = public.dn_merchant_phone_digits(v_merchant.phone)
          and u.phone_confirmed_at is not null
      ), '{}'::uuid[])
    into v_candidate_ids, v_email_candidate_ids, v_phone_candidate_ids
    from auth.users u
    where (
        (
          nullif(btrim(v_merchant.email), '') is not null
          and lower(nullif(btrim(u.email), '')) = lower(nullif(btrim(v_merchant.email), ''))
          and u.email_confirmed_at is not null
        )
        or (
          public.dn_merchant_phone_digits(v_merchant.phone) is not null
          and public.dn_merchant_phone_digits(u.phone) = public.dn_merchant_phone_digits(v_merchant.phone)
          and u.phone_confirmed_at is not null
        )
      )
      and lower(coalesce(
        u.raw_app_meta_data ->> 'role',
        u.raw_user_meta_data ->> 'role',
        ''
      )) not in ('admin','support','driver')
      and not exists (
        select 1
        from public.merchant_user_links l
        where l.user_id = u.id
          and l.active
          and l.merchant_id <> v_merchant.id
      )
      and not exists (
        select 1
        from public.merchants other_merchant
        where other_merchant.id <> v_merchant.id
          and other_merchant.user_id = u.id
          and lower(coalesce(other_merchant.status, 'active'))
              not in ('deleted','archived','blocked','suspended')
      );

    if cardinality(v_candidate_ids) <> 1
       or v_candidate_ids[1] is distinct from v_snapshot.candidate_portal_user_id
       or v_snapshot.resolution_evidence is distinct from case
         when cardinality(v_email_candidate_ids) = 1
           then 'EXACT_UNIQUE_CONFIRMED_AUTH_EMAIL'
         when cardinality(v_phone_candidate_ids) = 1
           then 'EXACT_UNIQUE_CONFIRMED_AUTH_PHONE'
         else null
       end then
      raise exception using
        errcode = '23514',
        message = 'auth_identity_evidence_changed_or_ambiguous',
        detail = jsonb_build_object(
          'merchant_id', v_snapshot.merchant_id,
          'candidate_count', cardinality(v_candidate_ids)
        )::text;
    end if;

    insert into public.merchant_user_links (
      merchant_id, user_id, access_role, active
    ) values (
      v_merchant.id, v_candidate_ids[1], 'owner', true
    );

    insert into public.merchant_link_repair_audit (
      run_id,
      merchant_id,
      user_id,
      resolution_evidence,
      migration_version,
      executed_by
    ) values (
      p_run_id,
      v_merchant.id,
      v_candidate_ids[1],
      v_snapshot.resolution_evidence,
      v_run.migration_version,
      auth.uid()
    );
    v_inserted := v_inserted + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'run_id', p_run_id,
    'links_inserted', v_inserted,
    'links_already_applied', v_already_applied,
    'orders_modified', 0,
    'count_matrix', (
      select coalesce(jsonb_agg(to_jsonb(matrix) order by merchant_code nulls last, merchant_id), '[]'::jsonb)
      from public.admin_order_merchant_count_matrix() matrix
    )
  );
end;
$$;

create or replace function public.dn_apply_order_dependency_ownership(
  p_order_id uuid,
  p_old_merchant_id uuid,
  p_new_merchant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_table text;
  v_count bigint;
  v_result jsonb := '{}'::jsonb;
begin
  foreach v_table in array array[
    'cod_collections',
    'merchant_statement_entries',
    'order_financial_settlements',
    'financial_account_entries',
    'merchant_invoices',
    'invoices',
    'notifications'
  ]
  loop
    continue when to_regclass(format('public.%I', v_table)) is null;
    continue when not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = v_table and column_name = 'order_id'
    );
    continue when not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = v_table and column_name = 'merchant_id'
    );

    execute format(
      'update public.%I
       set merchant_id = $2
       where order_id::text = $1
         and merchant_id is distinct from $2
         and (merchant_id is null or merchant_id is not distinct from $3)',
      v_table
    ) using p_order_id::text, p_new_merchant_id, p_old_merchant_id;
    get diagnostics v_count = row_count;
    v_result := v_result || jsonb_build_object(v_table, v_count);
  end loop;
  return v_result;
end;
$$;

create or replace function public.admin_apply_order_merchant_safe_backfill(
  p_run_id uuid,
  p_confirm boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_run public.order_merchant_audit_runs%rowtype;
  v_snapshot public.order_merchant_audit_snapshot%rowtype;
  v_order public.orders%rowtype;
  v_after_order public.orders%rowtype;
  v_candidate public.merchants%rowtype;
  v_current_financial jsonb;
  v_after_financial jsonb;
  v_row_financial jsonb;
  v_dependencies jsonb;
  v_dependent_updates jsonb;
  v_table text;
  v_candidate_count integer;
  v_updated integer := 0;
begin
  if not p_confirm then raise exception 'explicit_backfill_confirmation_required'; end if;
  if auth.role() <> 'service_role'
     and (auth.uid() is null or not public.is_admin_or_support()) then
    raise exception 'not_authorized';
  end if;

  select * into v_run
  from public.order_merchant_audit_runs
  where id = p_run_id
  for update;

  if v_run.id is null or v_run.status <> 'DRY_RUN_REVIEWED' then
    raise exception 'reviewed_dry_run_required';
  end if;

  -- Freeze order writes for the short reconciliation transaction so the before/after
  -- integrity proof cannot race a newly created or edited order.
  lock table public.orders in share row exclusive mode;
  lock table public.merchants in share mode;
  lock table public.merchant_user_links in share mode;
  foreach v_table in array array[
    'cod_collections',
    'merchant_statement_entries',
    'order_financial_settlements',
    'financial_account_entries',
    'merchant_invoices',
    'invoices',
    'notifications'
  ]
  loop
    if to_regclass(format('public.%I', v_table)) is not null then
      execute format('lock table public.%I in share row exclusive mode', v_table);
    end if;
  end loop;
  perform set_config('daynight.order_merchant_reconciliation', 'backfill', true);
  v_current_financial := public.dn_financial_integrity_snapshot();
  if v_current_financial is distinct from v_run.financial_before then
    raise exception using
      errcode = '40001',
      message = 'dry_run_is_stale_rerun_required',
      detail = jsonb_build_object(
        'captured', v_run.financial_before,
        'current', v_current_financial
      )::text;
  end if;

  for v_snapshot in
    select *
    from public.order_merchant_audit_snapshot
    where run_id = p_run_id
      and auto_repair_safe
    order by order_id
  loop
    if v_snapshot.classification <> 'AUTO_REPAIR_SAFE'
       or v_snapshot.candidate_canonical_merchant_id is null
       or v_snapshot.confidence <> 100 then
      raise exception 'unsafe_snapshot_row_aborted';
    end if;

    select * into v_order
    from public.orders
    where id = v_snapshot.order_id
    for update;

    if v_order.id is null
       or to_jsonb(v_order) is distinct from v_snapshot.order_before
       or v_order.merchant_id is distinct from v_snapshot.current_merchant_id
       or v_order.merchant_code is distinct from v_snapshot.current_merchant_code
       or v_order.merchant_name is distinct from v_snapshot.current_merchant_name
       or v_order.coupon_number is distinct from v_snapshot.coupon_number
       or coalesce(v_order.tracking_number, v_order.invoice_number, v_order.id::text)
          is distinct from v_snapshot.tracking_number
       or v_order.status is distinct from v_snapshot.status then
      raise exception using
        errcode = '40001',
        message = 'order_changed_since_dry_run',
        detail = jsonb_build_object('order_id', v_snapshot.order_id)::text;
    end if;

    v_row_financial := jsonb_build_object(
      'cod_amount', v_order.cod_amount,
      'goods_value', v_order.goods_value,
      'delivery_fee', v_order.delivery_fee,
      'discount_amount', v_order.discount_amount,
      'customer_total', v_order.customer_total,
      'merchant_due', v_order.merchant_due,
      'company_revenue', v_order.company_revenue,
      'delivery_price', v_order.delivery_price,
      'collected_amount', v_order.collected_amount,
      'manual_delivery_price', v_order.manual_delivery_price,
      'delivery_fee_mode', v_order.delivery_fee_mode,
      'payment_method', v_order.payment_method,
      'currency', v_order.currency,
      'financial_version', v_order.financial_version,
      'financial_posted_at', v_order.financial_posted_at
    );
    if v_row_financial is distinct from v_snapshot.financial_values then
      raise exception using
        errcode = '40001',
        message = 'order_financials_changed_since_dry_run',
        detail = jsonb_build_object('order_id', v_snapshot.order_id)::text;
    end if;

    select * into v_candidate
    from public.merchants
    where id = v_snapshot.candidate_canonical_merchant_id;
    if v_candidate.id is null
       or lower(coalesce(v_candidate.status, 'active')) in ('deleted','archived','blocked','suspended')
       or public.dn_merchant_portal_link_count(v_candidate.id) = 0 then
      raise exception 'candidate_merchant_no_longer_legal_or_portal_linked';
    end if;

    if v_candidate.id = v_order.merchant_id then
      v_candidate_count := 1;
    else
      select count(*)::integer into v_candidate_count
      from public.merchants m
      where lower(coalesce(m.status, 'active')) not in ('deleted','archived','blocked','suspended')
        and public.dn_merchant_portal_link_count(m.id) > 0
        and public.dn_normalized_merchant_identity(m.merchant_code)
            = public.dn_normalized_merchant_identity(v_candidate.merchant_code);
    end if;
    if v_candidate_count <> 1
       or v_candidate.merchant_code is distinct from v_snapshot.candidate_merchant_code
       or v_candidate.trade_name is distinct from v_snapshot.candidate_merchant_name
       or (
         public.dn_normalized_merchant_identity(v_order.merchant_code) is not null
         and public.dn_normalized_merchant_identity(v_order.merchant_code)
             <> public.dn_normalized_merchant_identity(v_candidate.merchant_code)
       ) then
      raise exception using
        errcode = '23514',
        message = 'canonical_merchant_evidence_changed_or_ambiguous',
        detail = jsonb_build_object('order_id', v_order.id, 'candidate_count', v_candidate_count)::text;
    end if;

    v_dependencies := public.dn_order_dependency_ownership_snapshot(
      v_order.id,
      v_order.merchant_id,
      v_candidate.id
    );
    if coalesce((v_dependencies ->> 'total_conflicts')::integer, 0) <> 0 then
      raise exception using
        errcode = '23514',
        message = 'dependent_merchant_security_conflict',
        detail = jsonb_build_object(
          'order_id', v_order.id,
          'dependencies', v_dependencies
        )::text;
    end if;

    update public.orders
    set merchant_id = v_candidate.id,
        merchant_code = v_candidate.merchant_code,
        merchant_name = v_candidate.trade_name,
        updated_at = now()
    where id = v_order.id;

    select * into v_after_order
    from public.orders
    where id = v_order.id;
    if (
      to_jsonb(v_after_order)
        - 'merchant_id' - 'merchant_code' - 'merchant_name' - 'updated_at'
    ) is distinct from (
      v_snapshot.order_before
        - 'merchant_id' - 'merchant_code' - 'merchant_name' - 'updated_at'
    ) then
      raise exception using
        errcode = '23514',
        message = 'non_ownership_order_data_changed_backfill_rolled_back',
        detail = jsonb_build_object('order_id', v_order.id)::text;
    end if;

    v_dependent_updates := public.dn_apply_order_dependency_ownership(
      v_order.id,
      v_order.merchant_id,
      v_candidate.id
    );

    insert into public.order_merchant_repair_audit (
      run_id,
      order_id,
      old_merchant_id,
      new_merchant_id,
      old_merchant_code,
      new_merchant_code,
      old_merchant_name,
      new_merchant_name,
      resolution_evidence,
      dependent_rows_updated,
      migration_version,
      executed_by
    ) values (
      p_run_id,
      v_order.id,
      v_order.merchant_id,
      v_candidate.id,
      v_order.merchant_code,
      v_candidate.merchant_code,
      v_order.merchant_name,
      v_candidate.trade_name,
      v_snapshot.resolution_evidence,
      v_dependent_updates,
      v_run.migration_version,
      auth.uid()
    );
    v_updated := v_updated + 1;
  end loop;

  v_after_financial := public.dn_financial_integrity_snapshot();
  if v_after_financial is distinct from v_run.financial_before then
    raise exception using
      errcode = '23514',
      message = 'financial_integrity_changed_backfill_rolled_back',
      detail = jsonb_build_object(
        'before', v_run.financial_before,
        'after', v_after_financial
      )::text;
  end if;

  update public.order_merchant_audit_runs
  set status = 'APPLIED_SAFE_ONLY',
      applied_at = now(),
      financial_after = v_after_financial
  where id = p_run_id;

  return jsonb_build_object(
    'ok', true,
    'run_id', p_run_id,
    'status', 'APPLIED_SAFE_ONLY',
    'orders_updated', v_updated,
    'financial_before', v_run.financial_before,
    'financial_after', v_after_financial,
    'manual_review_rows_untouched', (
      select count(*)
      from public.order_merchant_audit_snapshot
      where run_id = p_run_id and not auto_repair_safe
    )
  );
end;
$$;

create or replace function public.admin_apply_safe_missing_financial_dependencies(
  p_run_id uuid,
  p_confirm boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_run public.order_merchant_audit_runs%rowtype;
  v_now timestamptz := now();
  v_before_order_financial jsonb;
  v_after_order_financial jsonb;
  v_settlements integer := 0;
  v_merchant_accounts integer := 0;
  v_company_accounts integer := 0;
  v_cod integer := 0;
  v_merchant_statements integer := 0;
  v_driver_statements integer := 0;
begin
  if not p_confirm then raise exception 'explicit_financial_dependency_confirmation_required'; end if;
  if auth.role() <> 'service_role'
     and (auth.uid() is null or not public.is_admin_or_support()) then
    raise exception 'not_authorized';
  end if;

  select * into v_run
  from public.order_merchant_audit_runs
  where id = p_run_id
  for update;

  if v_run.id is null
     or v_run.status not in ('APPLIED_SAFE_ONLY','FINANCE_RECONCILED_SAFE_ONLY') then
    raise exception 'safe_order_backfill_must_be_applied_first';
  end if;

  lock table public.orders in share row exclusive mode;
  lock table public.order_financial_settlements in share row exclusive mode;
  lock table public.financial_account_entries in share row exclusive mode;
  lock table public.cod_collections in share row exclusive mode;
  lock table public.merchant_statement_entries in share row exclusive mode;
  lock table public.driver_statement_entries in share row exclusive mode;

  v_before_order_financial := public.dn_financial_integrity_snapshot()
    - 'dependent_tables' - 'missing_dependencies';
  if v_before_order_financial is distinct from
     (v_run.financial_before - 'dependent_tables' - 'missing_dependencies') then
    raise exception using
      errcode = '40001',
      message = 'order_financial_baseline_changed_since_dry_run';
  end if;

  if exists (
    select 1
    from public.order_merchant_audit_snapshot s
    join public.orders o on o.id = s.order_id
    where s.run_id = p_run_id
      and lower(replace(replace(coalesce(s.status::text, ''), '-', '_'), ' ', '_'))
          in ('delivered','completed','complete')
      and (
        s.classification in ('ALREADY_CORRECT','AUTO_REPAIR_SAFE')
        or (
          s.classification = 'MISSING_PORTAL_LINK'
          and exists (
            select 1 from public.merchant_link_repair_audit a
            where a.run_id = p_run_id
              and a.merchant_id = s.current_merchant_id
          )
        )
      )
      and (
        (to_jsonb(o) - 'merchant_id' - 'merchant_code' - 'merchant_name' - 'updated_at')
          is distinct from
        (s.order_before - 'merchant_id' - 'merchant_code' - 'merchant_name' - 'updated_at')
        or o.merchant_id is distinct from case
          when s.classification = 'AUTO_REPAIR_SAFE' then s.candidate_canonical_merchant_id
          else s.current_merchant_id
        end
        or o.status is distinct from s.status
        or coalesce((s.dependency_ownership ->> 'total_conflicts')::integer, 0) <> 0
      )
  ) then
    raise exception 'eligible_financial_order_changed_or_conflicted_since_dry_run';
  end if;

  create temporary table dn_finance_eligible_orders (
    order_id uuid primary key
  ) on commit drop;

  insert into dn_finance_eligible_orders(order_id)
  select s.order_id
  from public.order_merchant_audit_snapshot s
  join public.orders o on o.id = s.order_id
  where s.run_id = p_run_id
    and lower(replace(replace(coalesce(o.status::text, ''), '-', '_'), ' ', '_'))
        in ('delivered','completed','complete')
    and (
      s.classification in ('ALREADY_CORRECT','AUTO_REPAIR_SAFE')
      or (
        s.classification = 'MISSING_PORTAL_LINK'
        and exists (
          select 1 from public.merchant_link_repair_audit a
          where a.run_id = p_run_id
            and a.merchant_id = s.current_merchant_id
        )
      )
    )
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

  with inserted as (
    insert into public.order_financial_settlements (
      order_id, order_reference, merchant_id, coupon_number, goods_value,
      delivery_fee, discount_amount, delivery_fee_mode, customer_total,
      collected_amount, merchant_due, company_revenue, currency, posted_at,
      posted_by, source_status, snapshot
    )
    select
      o.id::text,
      coalesce(nullif(o.tracking_number, ''), nullif(o.invoice_number, ''), nullif(o.coupon_number, ''), o.id::text),
      o.merchant_id,
      nullif(o.coupon_number, ''),
      coalesce(o.goods_value, 0), coalesce(o.delivery_fee, 0), coalesce(o.discount_amount, 0),
      coalesce(nullif(o.delivery_fee_mode, ''), 'customer_pays'),
      coalesce(o.customer_total, 0), coalesce(o.collected_amount, 0),
      coalesce(o.merchant_due, 0), coalesce(o.company_revenue, 0),
      coalesce(nullif(o.currency, ''), 'AED'),
      coalesce(o.financial_posted_at, nullif(to_jsonb(o)->>'delivered_at', '')::timestamptz, o.updated_at, o.created_at, v_now),
      auth.uid(),
      lower(replace(replace(coalesce(o.status::text, 'delivered'), '-', '_'), ' ', '_')),
      to_jsonb(o)
    from dn_finance_eligible_orders e
    join public.orders o on o.id = e.order_id
    where not exists (
      select 1 from public.order_financial_settlements s where s.order_id = o.id::text
    )
    returning id, order_id
  )
  insert into public.order_merchant_financial_repair_audit (
    run_id, order_id, dependency_table, dependency_key, inserted_row_id,
    resolution_evidence, financial_values, migration_version, executed_by
  )
  select p_run_id, i.order_id::uuid, 'order_financial_settlements', 'settlement', i.id::text,
    'MISSING_AUTHORITATIVE_ROW_FROM_REVIEWED_ORDER_SNAPSHOT', s.financial_values,
    v_run.migration_version, auth.uid()
  from inserted i
  join public.order_merchant_audit_snapshot s
    on s.run_id = p_run_id and s.order_id = i.order_id::uuid;
  get diagnostics v_settlements = row_count;

  with inserted as (
    insert into public.financial_account_entries (
      order_id, order_reference, merchant_id, account_type, entry_type,
      direction, amount, currency, notes, posted_at
    )
    select s.order_id, s.order_reference, s.merchant_id, 'merchant',
      'delivered_order_settlement',
      case when s.merchant_due < 0 then 'debit' else 'credit' end,
      abs(s.merchant_due), s.currency,
      'Authoritative merchant settlement restored from reviewed order snapshot', s.posted_at
    from dn_finance_eligible_orders e
    join public.order_financial_settlements s on s.order_id = e.order_id::text
    where s.merchant_id is not null
      and not exists (
        select 1 from public.financial_account_entries a
        where a.order_id = s.order_id and a.account_type = 'merchant'
          and a.entry_type = 'delivered_order_settlement'
      )
    returning id, order_id
  )
  insert into public.order_merchant_financial_repair_audit (
    run_id, order_id, dependency_table, dependency_key, inserted_row_id,
    resolution_evidence, financial_values, migration_version, executed_by
  )
  select p_run_id, i.order_id::uuid, 'financial_account_entries', 'merchant_delivered_settlement', i.id::text,
    'MISSING_AUTHORITATIVE_ROW_FROM_REVIEWED_ORDER_SNAPSHOT', s.financial_values,
    v_run.migration_version, auth.uid()
  from inserted i join public.order_merchant_audit_snapshot s
    on s.run_id = p_run_id and s.order_id = i.order_id::uuid;
  get diagnostics v_merchant_accounts = row_count;

  with inserted as (
    insert into public.financial_account_entries (
      order_id, order_reference, merchant_id, account_type, entry_type,
      direction, amount, currency, notes, posted_at
    )
    select s.order_id, s.order_reference, s.merchant_id, 'company',
      'delivered_order_settlement', 'credit', greatest(s.company_revenue, 0),
      s.currency, 'Authoritative company revenue restored from reviewed order snapshot', s.posted_at
    from dn_finance_eligible_orders e
    join public.order_financial_settlements s on s.order_id = e.order_id::text
    where not exists (
      select 1 from public.financial_account_entries a
      where a.order_id = s.order_id and a.account_type = 'company'
        and a.entry_type = 'delivered_order_settlement'
    )
    returning id, order_id
  )
  insert into public.order_merchant_financial_repair_audit (
    run_id, order_id, dependency_table, dependency_key, inserted_row_id,
    resolution_evidence, financial_values, migration_version, executed_by
  )
  select p_run_id, i.order_id::uuid, 'financial_account_entries', 'company_delivered_settlement', i.id::text,
    'MISSING_AUTHORITATIVE_ROW_FROM_REVIEWED_ORDER_SNAPSHOT', s.financial_values,
    v_run.migration_version, auth.uid()
  from inserted i join public.order_merchant_audit_snapshot s
    on s.run_id = p_run_id and s.order_id = i.order_id::uuid;
  get diagnostics v_company_accounts = row_count;

  with inserted as (
    insert into public.cod_collections (
      order_id, tracking_number, merchant_id, driver_id, cod_amount,
      collected_amount, reconciled_amount, collection_date, status,
      payment_method, notes, created_by, created_at, updated_at
    )
    select o.id,
      coalesce(nullif(o.tracking_number, ''), nullif(o.invoice_number, ''), nullif(o.coupon_number, ''), o.id::text),
      o.merchant_id,
      public.dn_safe_uuid(coalesce(nullif(to_jsonb(o)->>'assigned_driver_id', ''), nullif(to_jsonb(o)->>'driver_id', ''))),
      greatest(coalesce(o.customer_total, 0), 0),
      greatest(coalesce(nullif(o.collected_amount, 0), o.customer_total, 0), 0),
      0,
      coalesce(nullif(to_jsonb(o)->>'delivered_at', '')::timestamptz, o.updated_at, o.created_at, v_now)::date,
      'collected', 'cod', 'Authoritative COD restored from reviewed order snapshot',
      auth.uid(), v_now, v_now
    from dn_finance_eligible_orders e join public.orders o on o.id = e.order_id
    where lower(coalesce(o.payment_method::text, '')) = 'cod'
      and coalesce(o.customer_total, 0) > 0
      and not exists (select 1 from public.cod_collections c where c.order_id = o.id)
    returning id, order_id
  )
  insert into public.order_merchant_financial_repair_audit (
    run_id, order_id, dependency_table, dependency_key, inserted_row_id,
    resolution_evidence, financial_values, migration_version, executed_by
  )
  select p_run_id, i.order_id, 'cod_collections', 'cod', i.id::text,
    'MISSING_AUTHORITATIVE_ROW_FROM_REVIEWED_ORDER_SNAPSHOT', s.financial_values,
    v_run.migration_version, auth.uid()
  from inserted i join public.order_merchant_audit_snapshot s
    on s.run_id = p_run_id and s.order_id = i.order_id;
  get diagnostics v_cod = row_count;

  with inserted as (
    insert into public.merchant_statement_entries (
      merchant_id, order_id, tracking_number, entry_date, entry_type,
      debit, credit, balance, status, notes, created_by, created_at, updated_at
    )
    select o.merchant_id, o.id,
      coalesce(nullif(o.tracking_number, ''), nullif(o.invoice_number, ''), nullif(o.coupon_number, ''), o.id::text),
      coalesce(nullif(to_jsonb(o)->>'delivered_at', '')::timestamptz, o.updated_at, o.created_at, v_now)::date,
      'order_cod',
      case when coalesce(o.merchant_due, 0) < 0 then abs(o.merchant_due) else 0 end,
      case when coalesce(o.merchant_due, 0) >= 0 then o.merchant_due else 0 end,
      coalesce(o.merchant_due, 0), 'posted',
      'Authoritative merchant statement restored from reviewed order snapshot',
      auth.uid(), v_now, v_now
    from dn_finance_eligible_orders e join public.orders o on o.id = e.order_id
    where o.merchant_id is not null
      and not exists (select 1 from public.merchant_statement_entries m where m.order_id = o.id)
    returning id, order_id
  )
  insert into public.order_merchant_financial_repair_audit (
    run_id, order_id, dependency_table, dependency_key, inserted_row_id,
    resolution_evidence, financial_values, migration_version, executed_by
  )
  select p_run_id, i.order_id, 'merchant_statement_entries', 'merchant_statement', i.id::text,
    'MISSING_AUTHORITATIVE_ROW_FROM_REVIEWED_ORDER_SNAPSHOT', s.financial_values,
    v_run.migration_version, auth.uid()
  from inserted i join public.order_merchant_audit_snapshot s
    on s.run_id = p_run_id and s.order_id = i.order_id;
  get diagnostics v_merchant_statements = row_count;

  with inserted as (
    insert into public.driver_statement_entries (
      driver_id, order_id, tracking_number, entry_date, entry_type,
      debit, credit, balance, status, notes, created_by, created_at, updated_at
    )
    select public.dn_safe_uuid(coalesce(nullif(to_jsonb(o)->>'assigned_driver_id', ''), nullif(to_jsonb(o)->>'driver_id', ''))),
      o.id,
      coalesce(nullif(o.tracking_number, ''), nullif(o.invoice_number, ''), nullif(o.coupon_number, ''), o.id::text),
      coalesce(nullif(to_jsonb(o)->>'delivered_at', '')::timestamptz, o.updated_at, o.created_at, v_now)::date,
      'delivery_earning', 0,
      greatest(public.dn_safe_numeric(to_jsonb(o)->>'driver_earning', 0), 0),
      greatest(public.dn_safe_numeric(to_jsonb(o)->>'driver_earning', 0), 0),
      'posted', 'Authoritative driver statement restored from reviewed order snapshot',
      auth.uid(), v_now, v_now
    from dn_finance_eligible_orders e join public.orders o on o.id = e.order_id
    where public.dn_safe_uuid(coalesce(nullif(to_jsonb(o)->>'assigned_driver_id', ''), nullif(to_jsonb(o)->>'driver_id', ''))) is not null
      and not exists (select 1 from public.driver_statement_entries d where d.order_id = o.id)
    returning id, order_id
  )
  insert into public.order_merchant_financial_repair_audit (
    run_id, order_id, dependency_table, dependency_key, inserted_row_id,
    resolution_evidence, financial_values, migration_version, executed_by
  )
  select p_run_id, i.order_id, 'driver_statement_entries', 'driver_statement', i.id::text,
    'MISSING_AUTHORITATIVE_ROW_FROM_REVIEWED_ORDER_SNAPSHOT', s.financial_values,
    v_run.migration_version, auth.uid()
  from inserted i join public.order_merchant_audit_snapshot s
    on s.run_id = p_run_id and s.order_id = i.order_id;
  get diagnostics v_driver_statements = row_count;

  v_after_order_financial := public.dn_financial_integrity_snapshot()
    - 'dependent_tables' - 'missing_dependencies';
  if v_after_order_financial is distinct from v_before_order_financial then
    raise exception 'order_financial_values_changed_financial_repair_rolled_back';
  end if;

  update public.order_merchant_audit_runs
  set status = 'FINANCE_RECONCILED_SAFE_ONLY',
      financial_after = public.dn_financial_integrity_snapshot()
  where id = p_run_id;

  return jsonb_build_object(
    'ok', true,
    'run_id', p_run_id,
    'status', 'FINANCE_RECONCILED_SAFE_ONLY',
    'orders_modified', 0,
    'settlements_inserted', v_settlements,
    'merchant_account_entries_inserted', v_merchant_accounts,
    'company_account_entries_inserted', v_company_accounts,
    'cod_rows_inserted', v_cod,
    'merchant_statement_rows_inserted', v_merchant_statements,
    'driver_statement_rows_inserted', v_driver_statements,
    'remaining_missing_dependencies', public.dn_missing_financial_dependencies_snapshot(),
    'order_financial_before', v_before_order_financial,
    'order_financial_after', v_after_order_financial
  );
end;
$$;

create or replace function public.admin_order_merchant_integrity_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if auth.role() <> 'service_role'
     and (auth.uid() is null or not public.is_admin_or_support()) then
    raise exception 'not_authorized';
  end if;

  return jsonb_build_object(
    'ok',
      to_regprocedure('public.admin_create_canonical_merchant_order(jsonb)') is not null
      and to_regprocedure('public.merchant_portal_orders_page(integer,integer)') is not null
      and to_regprocedure('public.admin_run_order_merchant_dry_run()') is not null
      and exists (
        select 1 from pg_trigger
        where tgrelid = 'public.orders'::regclass
          and tgname = 'trg_orders_canonical_merchant_link'
          and not tgisinternal and tgenabled <> 'D'
      ),
    'canonical_create_ready', to_regprocedure('public.admin_create_canonical_merchant_order(jsonb)') is not null,
    'portal_pagination_ready', to_regprocedure('public.merchant_portal_orders_page(integer,integer)') is not null,
    'dry_run_ready', to_regprocedure('public.admin_run_order_merchant_dry_run()') is not null,
    'merchant_link_repair_ready', to_regprocedure('public.admin_apply_safe_merchant_portal_links(uuid,boolean)') is not null,
    'transactional_backfill_ready', to_regprocedure('public.admin_apply_order_merchant_safe_backfill(uuid,boolean)') is not null,
    'safe_financial_dependency_repair_ready', to_regprocedure('public.admin_apply_safe_missing_financial_dependencies(uuid,boolean)') is not null,
    'financial_snapshot', public.dn_financial_integrity_snapshot(),
    'checked_at', now()
  );
end;
$$;

revoke all on function public.dn_effective_portal_user_ids(uuid) from public, anon, authenticated;
revoke all on function public.dn_merchant_portal_link_count(uuid) from public, anon, authenticated;
revoke all on function public.dn_resolve_portal_merchant_uuid(uuid) from public, anon, authenticated;
revoke all on function public.dn_financial_dependency_integrity_snapshot() from public, anon, authenticated;
revoke all on function public.dn_missing_financial_dependencies_snapshot() from public, anon, authenticated;
revoke all on function public.dn_financial_integrity_snapshot() from public, anon, authenticated;
revoke all on function public.dn_order_dependency_ownership_snapshot(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.dn_production_inventory_snapshot() from public, anon, authenticated;
revoke all on function public.dn_apply_order_dependency_ownership(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.admin_resolve_order_merchant(uuid) from public, anon;
revoke all on function public.admin_create_canonical_merchant_order(jsonb) from public, anon;
revoke all on function public.merchant_portal_orders_page(integer,integer) from public, anon;
revoke all on function public.admin_order_merchant_count_matrix() from public, anon;
revoke all on function public.admin_run_order_merchant_dry_run() from public, anon;
revoke all on function public.admin_review_order_merchant_dry_run(uuid) from public, anon;
revoke all on function public.admin_apply_safe_merchant_portal_links(uuid,boolean) from public, anon;
revoke all on function public.admin_apply_order_merchant_safe_backfill(uuid,boolean) from public, anon;
revoke all on function public.admin_apply_safe_missing_financial_dependencies(uuid,boolean) from public, anon;
revoke all on function public.admin_order_merchant_integrity_health() from public, anon;
revoke all on table public.dn_order_merchant_dry_run_live from public, anon, authenticated;
revoke all on table public.dn_merchant_identity_dry_run_live from public, anon, authenticated;

grant execute on function public.admin_resolve_order_merchant(uuid) to authenticated, service_role;
grant execute on function public.admin_create_canonical_merchant_order(jsonb) to authenticated, service_role;
grant execute on function public.merchant_portal_orders_page(integer,integer) to authenticated;
grant execute on function public.admin_order_merchant_count_matrix() to authenticated, service_role;
grant execute on function public.admin_run_order_merchant_dry_run() to authenticated, service_role;
grant execute on function public.admin_review_order_merchant_dry_run(uuid) to authenticated, service_role;
grant execute on function public.admin_apply_safe_merchant_portal_links(uuid,boolean) to authenticated, service_role;
grant execute on function public.admin_apply_order_merchant_safe_backfill(uuid,boolean) to authenticated, service_role;
grant execute on function public.admin_apply_safe_missing_financial_dependencies(uuid,boolean) to authenticated, service_role;
grant execute on function public.admin_order_merchant_integrity_health() to authenticated, service_role;
grant select on public.order_merchant_audit_runs to authenticated;
grant select on public.order_merchant_audit_snapshot to authenticated;
grant select on public.order_merchant_repair_audit to authenticated;
grant select on public.merchant_identity_audit_snapshot to authenticated;
grant select on public.merchant_link_repair_audit to authenticated;
grant select on public.order_merchant_financial_repair_audit to authenticated;
grant all on public.order_merchant_audit_runs to service_role;
grant all on public.order_merchant_audit_snapshot to service_role;
grant all on public.order_merchant_repair_audit to service_role;
grant all on public.merchant_identity_audit_snapshot to service_role;
grant all on public.merchant_link_repair_audit to service_role;
grant all on public.order_merchant_financial_repair_audit to service_role;

grant execute on function public.dn_effective_portal_user_ids(uuid) to service_role;
grant execute on function public.dn_merchant_portal_link_count(uuid) to service_role;
grant execute on function public.dn_resolve_portal_merchant_uuid(uuid) to service_role;
grant execute on function public.dn_financial_dependency_integrity_snapshot() to service_role;
grant execute on function public.dn_missing_financial_dependencies_snapshot() to service_role;
grant execute on function public.dn_financial_integrity_snapshot() to service_role;
grant execute on function public.dn_order_dependency_ownership_snapshot(uuid,uuid,uuid) to service_role;
grant execute on function public.dn_production_inventory_snapshot() to service_role;
grant execute on function public.dn_apply_order_dependency_ownership(uuid,uuid,uuid) to service_role;

notify pgrst, 'reload schema';

commit;
