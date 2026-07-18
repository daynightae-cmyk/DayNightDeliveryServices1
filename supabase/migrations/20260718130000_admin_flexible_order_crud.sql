-- DAY NIGHT DELIVERY SERVICES
-- Flexible order CRUD, manual pricing, and safe deletion runtime.
--
-- Provides:
--   * admin_update_order_runtime(jsonb)
--   * admin_delete_order_runtime(jsonb)
--   * optional manual delivery price metadata
--   * protected deletion audit
--
-- Existing driver dispatch remains handled by admin_dispatch_order_runtime(jsonb).

begin;

create extension if not exists pgcrypto;

alter table public.orders
  add column if not exists manual_delivery_price numeric;

alter table public.orders
  add column if not exists price_source text default 'system';

alter table public.orders
  add column if not exists merchant_id uuid;

alter table public.orders
  add column if not exists merchant_name text;

alter table public.orders
  add column if not exists merchant_code text;

alter table public.orders
  add column if not exists tracking_number text;

alter table public.orders
  add column if not exists invoice_number text;

alter table public.orders
  add column if not exists coupon_number text;

alter table public.orders
  add column if not exists updated_at timestamptz default now();

create index if not exists idx_orders_merchant_id
  on public.orders(merchant_id);

create index if not exists idx_orders_tracking_number
  on public.orders(tracking_number);

create table if not exists public.admin_order_deletion_log (
  id uuid primary key default gen_random_uuid(),
  order_id text,
  order_reference text not null,
  merchant_id uuid,
  reason text not null,
  order_snapshot jsonb not null,
  deleted_by uuid references auth.users(id),
  deleted_at timestamptz not null default now()
);

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

create or replace function public.admin_flexible_order_reference(
  p_order public.orders
)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(
    nullif(to_jsonb(p_order) ->> 'tracking_number', ''),
    nullif(to_jsonb(p_order) ->> 'invoice_number', ''),
    nullif(to_jsonb(p_order) ->> 'coupon_number', ''),
    nullif(to_jsonb(p_order) ->> 'id', '')
  );
$$;

create or replace function public.admin_find_order_for_update(
  p_reference text
)
returns public.orders
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  r public.orders;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_admin_or_support() then
    raise exception 'not_authorized';
  end if;

  if nullif(btrim(p_reference), '') is null then
    raise exception 'order_reference_required';
  end if;

  select o.*
  into r
  from public.orders o
  where to_jsonb(o) ->> 'id' = btrim(p_reference)
     or to_jsonb(o) ->> 'tracking_number' = btrim(p_reference)
     or to_jsonb(o) ->> 'invoice_number' = btrim(p_reference)
     or to_jsonb(o) ->> 'coupon_number' = btrim(p_reference)
  limit 1
  for update;

  if to_jsonb(r) ->> 'id' is null then
    raise exception 'order_not_found';
  end if;

  return r;
end;
$$;

create or replace function public.admin_update_order_runtime(
  p_payload jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  r public.orders;
  v_reference text := nullif(btrim(p_payload ->> 'reference'), '');
  v_patch jsonb := coalesce(p_payload -> 'patch', '{}'::jsonb);
  v_reason text := coalesce(
    nullif(btrim(p_payload ->> 'reason'), ''),
    'Updated from admin flexible order editor'
  );
  v_merchant public.merchants%rowtype;
  v_merchant_id uuid;
  v_payment text;
  v_price_source text;
  v_manual_price numeric;
  v_set_clause text;
begin
  r := public.admin_find_order_for_update(v_reference);

  v_merchant_id := public.admin_safe_uuid(
    coalesce(
      nullif(v_patch ->> 'merchant_id', ''),
      to_jsonb(r) ->> 'merchant_id'
    )
  );

  if v_merchant_id is null then
    raise exception 'merchant_required';
  end if;

  select *
  into v_merchant
  from public.merchants
  where id = v_merchant_id
    and lower(coalesce(status, 'active')) not in (
      'deleted',
      'archived',
      'blocked',
      'suspended'
    )
  limit 1;

  if v_merchant.id is null then
    raise exception 'merchant_not_found_or_inactive';
  end if;

  v_payment := lower(
    coalesce(
      nullif(btrim(v_patch ->> 'payment_method'), ''),
      nullif(to_jsonb(r) ->> 'payment_method', ''),
      'sender_pays'
    )
  );

  if v_payment = 'merchant_pays' then
    v_payment := 'sender_pays';
  end if;

  if v_payment not in ('sender_pays', 'receiver_pays', 'cod') then
    v_payment := 'sender_pays';
  end if;

  v_price_source := lower(
    coalesce(
      nullif(btrim(v_patch ->> 'price_source'), ''),
      'system'
    )
  );

  if v_price_source not in ('system', 'manual') then
    v_price_source := 'system';
  end if;

  if v_price_source = 'manual' then
    begin
      v_manual_price := (v_patch ->> 'manual_delivery_price')::numeric;
    exception when others then
      v_manual_price := null;
    end;

    if v_manual_price is null then
      begin
        v_manual_price := (v_patch ->> 'delivery_price')::numeric;
      exception when others then
        v_manual_price := null;
      end;
    end if;

    if v_manual_price is null or v_manual_price < 0 then
      raise exception 'invalid_manual_delivery_price';
    end if;

    v_patch := v_patch || jsonb_build_object(
      'manual_delivery_price', v_manual_price,
      'delivery_price', v_manual_price,
      'subtotal', v_manual_price,
      'base_price', v_manual_price,
      'total', v_manual_price,
      'total_price', v_manual_price,
      'amount', v_manual_price,
      'price', v_manual_price
    );
  else
    v_patch := v_patch || jsonb_build_object(
      'manual_delivery_price', null
    );
  end if;

  v_patch := jsonb_strip_nulls(
    v_patch
    || jsonb_build_object(
      'merchant_id', v_merchant.id::text,
      'merchant_name', v_merchant.trade_name,
      'merchant_code', v_merchant.merchant_code,
      'sender_name', v_merchant.trade_name,
      'sender_phone', coalesce(
        nullif(v_merchant.phone, ''),
        nullif(v_patch ->> 'sender_phone', ''),
        '971568757331'
      ),
      'sender_city', coalesce(
        nullif(v_patch ->> 'sender_city', ''),
        nullif(v_merchant.emirate, ''),
        nullif(to_jsonb(r) ->> 'sender_city', ''),
        'Abu Dhabi'
      ),
      'sender_address', coalesce(
        nullif(v_patch ->> 'sender_address', ''),
        nullif(v_merchant.pickup_address, ''),
        nullif(v_merchant.address, ''),
        nullif(to_jsonb(r) ->> 'sender_address', ''),
        'Abu Dhabi'
      ),
      'payment_method', v_payment,
      'price_source', v_price_source,
      'notes', concat_ws(
        ' | ',
        nullif(btrim(v_patch ->> 'notes'), ''),
        'Admin edit: ' || v_reason
      ),
      'updated_at', now()
    )
  );

  if v_price_source = 'system' then
    v_patch := v_patch || jsonb_build_object(
      'manual_delivery_price', null
    );
  end if;

  -- Immutable and workflow-controlled fields are never changed by this editor.
  v_patch := v_patch
    - 'id'
    - 'tracking_number'
    - 'tracking_code'
    - 'invoice_number'
    - 'created_at'
    - 'created_by'
    - 'driver_id'
    - 'assigned_driver_id'
    - 'driver_code'
    - 'driver_name'
    - 'driver_phone'
    - 'status'
    - 'status_history';

  select string_agg(
    format(
      '%1$I = (jsonb_populate_record(null::public.orders, $1)).%1$I',
      c.column_name
    ),
    ', ' order by c.ordinal_position
  )
  into v_set_clause
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'orders'
    and v_patch ? c.column_name
    and c.column_name = any(array[
      'merchant_id',
      'merchant_name',
      'merchant_code',
      'sender_name',
      'sender_phone',
      'sender_city',
      'sender_address',
      'receiver_name',
      'receiver_phone',
      'receiver_city',
      'receiver_address',
      'package_type',
      'package_description',
      'weight',
      'pieces',
      'order_count',
      'shipping_scope',
      'destination_country',
      'service_type',
      'payment_method',
      'cod_amount',
      'delivery_price',
      'subtotal',
      'base_price',
      'total',
      'total_price',
      'amount',
      'price',
      'manual_delivery_price',
      'price_source',
      'currency',
      'notes',
      'updated_at',
      'coupon_number'
    ])
    and coalesce(c.is_generated, 'NEVER') = 'NEVER'
    and coalesce(c.identity_generation, '') <> 'ALWAYS';

  if nullif(v_set_clause, '') is null then
    raise exception 'no_editable_order_fields';
  end if;

  execute format(
    'update public.orders set %s where id = $2 returning *',
    v_set_clause
  )
  using v_patch, r.id
  into r;

  if to_jsonb(r) ->> 'id' is null then
    raise exception 'order_update_failed';
  end if;

  if to_jsonb(r) ->> 'merchant_id' is distinct from v_merchant.id::text then
    raise exception 'merchant_link_verification_failed';
  end if;

  return r;
exception
  when others then
    raise exception using
      message = 'admin_update_order_runtime_failed: ' || sqlerrm,
      detail = 'SQLSTATE=' || sqlstate,
      hint = 'Only editable order fields are accepted. Driver assignment and status use their dedicated controls.';
end;
$$;

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
  v_reference text := nullif(btrim(p_payload ->> 'reference'), '');
  v_reason text := nullif(btrim(p_payload ->> 'reason'), '');
  v_status text;
  v_driver text;
  v_order_reference text;
begin
  r := public.admin_find_order_for_update(v_reference);

  if v_reason is null or length(v_reason) < 4 then
    raise exception 'deletion_reason_required';
  end if;

  v_status := lower(
    replace(
      coalesce(to_jsonb(r) ->> 'status', 'pending'),
      '-',
      '_'
    )
  );

  v_driver := coalesce(
    nullif(to_jsonb(r) ->> 'assigned_driver_id', ''),
    nullif(to_jsonb(r) ->> 'driver_id', ''),
    nullif(to_jsonb(r) ->> 'driver_code', ''),
    nullif(to_jsonb(r) ->> 'driver_name', '')
  );

  if v_driver is not null then
    raise exception 'assigned_order_cannot_be_deleted';
  end if;

  if v_status not in (
    'pending',
    'review',
    'under_review',
    'confirmed',
    'cancelled',
    'canceled',
    'returned'
  ) then
    raise exception 'active_or_completed_order_cannot_be_deleted';
  end if;

  v_order_reference := public.admin_flexible_order_reference(r);

  insert into public.admin_order_deletion_log (
    order_id,
    order_reference,
    merchant_id,
    reason,
    order_snapshot,
    deleted_by
  )
  values (
    to_jsonb(r) ->> 'id',
    coalesce(v_order_reference, v_reference),
    public.admin_safe_uuid(to_jsonb(r) ->> 'merchant_id'),
    v_reason,
    to_jsonb(r),
    auth.uid()
  );

  if to_regclass('public.order_status_history') is not null then
    execute
      'delete from public.order_status_history where order_id = $1'
    using r.id;
  end if;

  delete from public.orders
  where id = r.id;

  if not found then
    raise exception 'order_delete_failed';
  end if;

  return jsonb_build_object(
    'deleted', true,
    'reference', coalesce(v_order_reference, v_reference),
    'merchant_id', to_jsonb(r) ->> 'merchant_id',
    'deleted_at', now()
  );
exception
  when others then
    raise exception using
      message = 'admin_delete_order_runtime_failed: ' || sqlerrm,
      detail = 'SQLSTATE=' || sqlstate,
      hint = 'Only unassigned pending/review/confirmed/cancelled/returned orders can be deleted.';
end;
$$;

revoke all on function public.admin_flexible_order_reference(public.orders)
  from public, anon;
revoke all on function public.admin_find_order_for_update(text)
  from public, anon;
revoke all on function public.admin_update_order_runtime(jsonb)
  from public, anon;
revoke all on function public.admin_delete_order_runtime(jsonb)
  from public, anon;

grant execute on function public.admin_flexible_order_reference(public.orders)
  to authenticated;
grant execute on function public.admin_find_order_for_update(text)
  to authenticated;
grant execute on function public.admin_update_order_runtime(jsonb)
  to authenticated;
grant execute on function public.admin_delete_order_runtime(jsonb)
  to authenticated;

create or replace function public.admin_flexible_order_runtime_health()
returns jsonb
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'ok',
      to_regprocedure('public.admin_update_order_runtime(jsonb)') is not null
      and to_regprocedure('public.admin_delete_order_runtime(jsonb)') is not null
      and to_regprocedure('public.admin_dispatch_order_runtime(jsonb)') is not null,
    'authenticated_user_id', auth.uid(),
    'profile_role', public.current_profile_role(),
    'is_admin_or_support', public.is_admin_or_support(),
    'update_rpc',
      to_regprocedure('public.admin_update_order_runtime(jsonb)')::text,
    'delete_rpc',
      to_regprocedure('public.admin_delete_order_runtime(jsonb)')::text,
    'dispatch_rpc',
      to_regprocedure('public.admin_dispatch_order_runtime(jsonb)')::text,
    'manual_price_column',
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'orders'
          and column_name = 'manual_delivery_price'
      ),
    'price_source_column',
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'orders'
          and column_name = 'price_source'
      )
  );
$$;

revoke all on function public.admin_flexible_order_runtime_health()
  from public, anon;
grant execute on function public.admin_flexible_order_runtime_health()
  to authenticated;

notify pgrst, 'reload schema';

commit;
