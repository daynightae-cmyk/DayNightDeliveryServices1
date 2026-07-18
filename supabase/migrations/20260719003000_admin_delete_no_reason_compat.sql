-- DAY NIGHT DELIVERY SERVICES
-- One-click, no-reason admin order deletion compatibility runtime.
--
-- Goals:
--   * No user-entered reason and no second confirmation.
--   * Exact PostgREST signatures for both p_payload jsonb and p_reference text.
--   * Works for any order status or driver-assignment state when the caller is admin/support.
--   * Preserves an internal audit snapshot without exposing a reason field to the UI.
--   * Detaches nullable child foreign keys and removes required child rows before deletion.

begin;

create extension if not exists pgcrypto;

create table if not exists public.admin_order_deletion_log (
  id uuid primary key default gen_random_uuid(),
  order_id text,
  order_reference text not null,
  merchant_id uuid,
  reason text not null default 'admin_one_click_delete',
  order_snapshot jsonb not null,
  deleted_by uuid references auth.users(id),
  deleted_at timestamptz not null default now()
);

alter table public.admin_order_deletion_log
  alter column reason set default 'admin_one_click_delete';

alter table public.admin_order_deletion_log enable row level security;

drop policy if exists admin_order_deletion_log_read
  on public.admin_order_deletion_log;

create policy admin_order_deletion_log_read
on public.admin_order_deletion_log
for select
to authenticated
using (public.is_admin_or_support());

revoke all on public.admin_order_deletion_log from anon;
grant select on public.admin_order_deletion_log to authenticated;

create or replace function public.admin_delete_order_runtime(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  r public.orders;
  v_reference text := nullif(
    btrim(
      coalesce(
        p_payload ->> 'reference',
        p_payload ->> 'order_id',
        p_payload ->> 'tracking_number',
        p_payload ->> 'invoice_number',
        p_payload ->> 'coupon_number'
      )
    ),
    ''
  );
  v_order_reference text;
  v_snapshot jsonb;
  v_fk record;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_admin_or_support() then
    raise exception 'not_authorized';
  end if;

  if v_reference is null then
    raise exception 'order_reference_required';
  end if;

  select o.*
  into r
  from public.orders o
  where to_jsonb(o) ->> 'id' = v_reference
     or to_jsonb(o) ->> 'tracking_number' = v_reference
     or to_jsonb(o) ->> 'invoice_number' = v_reference
     or to_jsonb(o) ->> 'coupon_number' = v_reference
  limit 1
  for update;

  if to_jsonb(r) ->> 'id' is null then
    raise exception 'order_not_found';
  end if;

  v_snapshot := to_jsonb(r);
  v_order_reference := coalesce(
    nullif(v_snapshot ->> 'tracking_number', ''),
    nullif(v_snapshot ->> 'invoice_number', ''),
    nullif(v_snapshot ->> 'coupon_number', ''),
    nullif(v_snapshot ->> 'id', ''),
    v_reference
  );

  insert into public.admin_order_deletion_log (
    order_id,
    order_reference,
    merchant_id,
    reason,
    order_snapshot,
    deleted_by
  )
  values (
    v_snapshot ->> 'id',
    v_order_reference,
    case
      when nullif(v_snapshot ->> 'merchant_id', '') is null then null
      else (v_snapshot ->> 'merchant_id')::uuid
    end,
    'admin_one_click_delete',
    v_snapshot,
    auth.uid()
  );

  -- Resolve every simple foreign key that points to orders.id. Nullable links are
  -- detached; required child rows are removed. This makes admin deletion flexible
  -- without leaving the operator to understand database dependency errors.
  for v_fk in
    select
      child_ns.nspname as child_schema,
      child.relname as child_table,
      child_attr.attname as child_column,
      not child_attr.attnotnull as child_nullable
    from pg_constraint con
    join pg_class child
      on child.oid = con.conrelid
    join pg_namespace child_ns
      on child_ns.oid = child.relnamespace
    join lateral unnest(con.conkey) with ordinality child_key(attnum, ord)
      on true
    join lateral unnest(con.confkey) with ordinality parent_key(attnum, ord)
      on parent_key.ord = child_key.ord
    join pg_attribute child_attr
      on child_attr.attrelid = con.conrelid
     and child_attr.attnum = child_key.attnum
    join pg_attribute parent_attr
      on parent_attr.attrelid = con.confrelid
     and parent_attr.attnum = parent_key.attnum
    where con.contype = 'f'
      and con.confrelid = 'public.orders'::regclass
      and con.conrelid <> con.confrelid
      and array_length(con.conkey, 1) = 1
      and array_length(con.confkey, 1) = 1
      and parent_attr.attname = 'id'
  loop
    begin
      if v_fk.child_nullable then
        execute format(
          'update %I.%I set %I = null where %I = $1',
          v_fk.child_schema,
          v_fk.child_table,
          v_fk.child_column,
          v_fk.child_column
        ) using r.id;
      else
        execute format(
          'delete from %I.%I where %I = $1',
          v_fk.child_schema,
          v_fk.child_table,
          v_fk.child_column
        ) using r.id;
      end if;
    exception
      when undefined_table or undefined_column then
        null;
    end;
  end loop;

  delete from public.orders
  where id = r.id;

  if not found then
    raise exception 'order_delete_failed';
  end if;

  return jsonb_build_object(
    'deleted', true,
    'reference', v_order_reference,
    'merchant_id', v_snapshot ->> 'merchant_id',
    'deleted_at', now()
  );
exception
  when others then
    raise exception using
      message = 'admin_delete_order_runtime_failed: ' || sqlerrm,
      detail = 'SQLSTATE=' || sqlstate,
      hint = 'The caller must be an authenticated admin or support user.';
end;
$$;

create or replace function public.admin_delete_order_runtime(
  p_reference text
)
returns jsonb
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select public.admin_delete_order_runtime(
    jsonb_build_object('reference', p_reference)
  );
$$;

create or replace function public.admin_delete_order(
  p_reference text
)
returns jsonb
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select public.admin_delete_order_runtime(p_reference);
$$;

revoke all on function public.admin_delete_order_runtime(jsonb) from public, anon;
revoke all on function public.admin_delete_order_runtime(text) from public, anon;
revoke all on function public.admin_delete_order(text) from public, anon;

grant execute on function public.admin_delete_order_runtime(jsonb) to authenticated;
grant execute on function public.admin_delete_order_runtime(text) to authenticated;
grant execute on function public.admin_delete_order(text) to authenticated;

create or replace function public.admin_delete_order_runtime_health()
returns jsonb
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'ok',
      to_regprocedure('public.admin_delete_order_runtime(jsonb)') is not null
      and to_regprocedure('public.admin_delete_order_runtime(text)') is not null,
    'authenticated_user_id', auth.uid(),
    'is_admin_or_support', public.is_admin_or_support(),
    'jsonb_rpc', to_regprocedure('public.admin_delete_order_runtime(jsonb)')::text,
    'text_rpc', to_regprocedure('public.admin_delete_order_runtime(text)')::text,
    'reason_required', false
  );
$$;

revoke all on function public.admin_delete_order_runtime_health() from public, anon;
grant execute on function public.admin_delete_order_runtime_health() to authenticated;

notify pgrst, 'reload schema';

commit;
