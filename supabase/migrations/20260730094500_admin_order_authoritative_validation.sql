-- DAY NIGHT DELIVERY SERVICES
-- Prevent incomplete/default-filled admin orders from becoming operational rows.
-- The trigger protects RPC and direct inserts. The preflight RPC records invalid
-- input before the write transaction so validation evidence is not rolled back.

begin;

create table if not exists public.admin_order_validation_audit (
  id uuid primary key default gen_random_uuid(),
  order_id text,
  source_channel text not null default 'admin_panel',
  validation_stage text not null check (validation_stage in ('preflight', 'draft_warning')),
  invalid_fields text[] not null default '{}',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.admin_order_validation_audit enable row level security;

drop policy if exists admin_order_validation_audit_admin_read on public.admin_order_validation_audit;
create policy admin_order_validation_audit_admin_read
on public.admin_order_validation_audit
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role::text, '')) in ('admin', 'support')
  )
);

create or replace function public.dn_admin_order_invalid_fields(p_payload jsonb)
returns text[]
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_invalid text[] := '{}';
  v_scope text := lower(btrim(coalesce(p_payload->>'shipping_scope', 'local')));
  v_sender_name text := btrim(coalesce(p_payload->>'sender_name', p_payload->>'merchant_name', ''));
  v_receiver_city text := btrim(coalesce(p_payload->>'receiver_city', ''));
  v_destination text := btrim(coalesce(p_payload->>'destination_country', ''));
  v_weight numeric := nullif(p_payload->>'weight', '')::numeric;
begin
  if v_sender_name = '' or lower(v_sender_name) in ('day night merchant', 'unknown', 'n/a') then
    v_invalid := array_append(v_invalid, 'sender_name');
  end if;
  if btrim(coalesce(p_payload->>'sender_phone', '')) = '' then
    v_invalid := array_append(v_invalid, 'sender_phone');
  end if;
  if btrim(coalesce(p_payload->>'sender_city', '')) = '' then
    v_invalid := array_append(v_invalid, 'sender_city');
  end if;
  if btrim(coalesce(p_payload->>'sender_address', '')) = '' then
    v_invalid := array_append(v_invalid, 'sender_address');
  end if;
  if btrim(coalesce(p_payload->>'receiver_name', '')) = '' then
    v_invalid := array_append(v_invalid, 'receiver_name');
  end if;
  if btrim(coalesce(p_payload->>'receiver_phone', '')) = '' then
    v_invalid := array_append(v_invalid, 'receiver_phone');
  end if;
  if btrim(coalesce(p_payload->>'receiver_address', '')) = '' then
    v_invalid := array_append(v_invalid, 'receiver_address');
  end if;
  if v_receiver_city = '' or lower(v_receiver_city) in ('world', 'unknown', 'n/a') then
    v_invalid := array_append(v_invalid, 'receiver_city');
  end if;
  if btrim(coalesce(p_payload->>'package_type', p_payload->>'package_description', '')) = '' then
    v_invalid := array_append(v_invalid, 'package_type');
  end if;
  if btrim(coalesce(p_payload->>'payment_method', '')) = '' then
    v_invalid := array_append(v_invalid, 'payment_method');
  end if;

  if v_scope = 'international' or lower(coalesce(p_payload->>'service_type', '')) = 'international' then
    if v_destination = '' or lower(v_destination) in ('world', 'unknown', 'n/a') then
      v_invalid := array_append(v_invalid, 'destination_country');
    end if;
    if coalesce(v_weight, 0) <= 0 then
      v_invalid := array_append(v_invalid, 'weight');
    end if;
  end if;

  if coalesce(nullif(p_payload->>'pieces', '')::numeric, nullif(p_payload->>'order_count', '')::numeric, 0) <= 0 then
    v_invalid := array_append(v_invalid, 'pieces');
  end if;

  return array(select distinct field_name from unnest(v_invalid) as field_name order by field_name);
exception
  when invalid_text_representation then
    return array_append(v_invalid, 'numeric_format');
end;
$$;

create or replace function public.admin_validate_order_payload(
  p_order jsonb,
  p_stage text default 'preflight'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_invalid text[] := public.dn_admin_order_invalid_fields(coalesce(p_order, '{}'::jsonb));
  v_status text := lower(replace(replace(btrim(coalesce(p_order->>'status', 'pending')), '-', '_'), ' ', '_'));
  v_stage text := case when v_status = 'draft' then 'draft_warning' else 'preflight' end;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role::text, '')) in ('admin', 'support')
  ) then
    raise exception using errcode = '42501', message = 'admin_order_validation_not_authorized';
  end if;

  if coalesce(array_length(v_invalid, 1), 0) > 0 then
    insert into public.admin_order_validation_audit(
      order_id,
      source_channel,
      validation_stage,
      invalid_fields,
      payload,
      created_by
    ) values (
      coalesce(p_order->>'id', p_order->>'invoice_number', p_order->>'tracking_number'),
      lower(btrim(coalesce(p_order->>'source_channel', 'admin_panel'))),
      case when lower(btrim(coalesce(p_stage, ''))) = 'draft_warning' then 'draft_warning' else v_stage end,
      v_invalid,
      coalesce(p_order, '{}'::jsonb) - 'customer_email' - 'email',
      auth.uid()
    );
  end if;

  return jsonb_build_object(
    'ok', coalesce(array_length(v_invalid, 1), 0) = 0,
    'invalid_fields', to_jsonb(v_invalid),
    'status', v_status,
    'checked_at', now()
  );
end;
$$;

create or replace function public.dn_guard_admin_order_required_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_payload jsonb := to_jsonb(new);
  v_source text := lower(btrim(coalesce(v_payload->>'source_channel', '')));
  v_status text := lower(replace(replace(btrim(coalesce(v_payload->>'status', 'pending')), '-', '_'), ' ', '_'));
  v_invalid text[];
begin
  if v_source <> 'admin_panel' or v_status = 'draft' then
    return new;
  end if;

  v_invalid := public.dn_admin_order_invalid_fields(v_payload);
  if coalesce(array_length(v_invalid, 1), 0) > 0 then
    raise exception using
      errcode = '23514',
      message = 'admin_order_validation_failed',
      detail = array_to_string(v_invalid, ',');
  end if;

  return new;
end;
$$;

drop trigger if exists dn_guard_admin_order_required_fields on public.orders;
create trigger dn_guard_admin_order_required_fields
before insert or update on public.orders
for each row
execute function public.dn_guard_admin_order_required_fields();

create or replace function public.admin_order_validation_health()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'ok',
      to_regclass('public.orders') is not null
      and to_regclass('public.admin_order_validation_audit') is not null
      and to_regprocedure('public.admin_validate_order_payload(jsonb,text)') is not null
      and exists (
        select 1
        from pg_trigger
        where tgname = 'dn_guard_admin_order_required_fields'
          and not tgisinternal
      ),
    'orders_table', to_regclass('public.orders') is not null,
    'audit_table', to_regclass('public.admin_order_validation_audit') is not null,
    'preflight_rpc', to_regprocedure('public.admin_validate_order_payload(jsonb,text)') is not null,
    'guard_trigger', exists (
      select 1
      from pg_trigger
      where tgname = 'dn_guard_admin_order_required_fields'
        and not tgisinternal
    ),
    'preflight_failures_last_24h', (
      select count(*)
      from public.admin_order_validation_audit
      where validation_stage = 'preflight'
        and created_at >= now() - interval '24 hours'
    ),
    'draft_warnings_last_24h', (
      select count(*)
      from public.admin_order_validation_audit
      where validation_stage = 'draft_warning'
        and created_at >= now() - interval '24 hours'
    ),
    'checked_at', now()
  );
$$;

grant execute on function public.admin_validate_order_payload(jsonb, text) to authenticated;
grant execute on function public.admin_order_validation_health() to authenticated;

commit;
