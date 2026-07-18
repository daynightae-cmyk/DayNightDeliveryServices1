-- DAY NIGHT DELIVERY SERVICES
-- Production reconciliation: authenticated admin -> selected merchant -> real order -> merchant portal.
-- Safe and idempotent. No passwords, service-role keys, fake orders, or destructive data resets.

begin;

create extension if not exists pgcrypto;

alter table public.merchants
  add column if not exists user_id uuid references auth.users(id) on delete set null;

alter table public.orders add column if not exists merchant_id uuid;
alter table public.orders add column if not exists merchant_name text;
alter table public.orders add column if not exists merchant_code text;
alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists invoice_number text;
alter table public.orders add column if not exists coupon_number text;
alter table public.orders add column if not exists status_history jsonb default '[]'::jsonb;
alter table public.orders add column if not exists created_by uuid references auth.users(id);
alter table public.orders add column if not exists updated_at timestamptz default now();

create index if not exists idx_merchants_user_id on public.merchants(user_id);
create index if not exists idx_merchants_email_lower on public.merchants((lower(coalesce(email, ''))));
create index if not exists idx_merchants_phone_digits on public.merchants((regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')));
create index if not exists idx_merchants_alt_phone_digits on public.merchants((regexp_replace(coalesce(alt_phone, ''), '[^0-9]', '', 'g')));
create index if not exists idx_orders_merchant_id on public.orders(merchant_id);
create index if not exists idx_orders_merchant_code on public.orders(merchant_code);
create index if not exists idx_orders_merchant_name_lower on public.orders((lower(coalesce(merchant_name, ''))));

create or replace function public.admin_safe_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if value is null or btrim(value) = '' then
    return null;
  end if;
  return value::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.current_profile_role()
returns text
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select lower(coalesce(p.role::text, ''))
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.is_admin_or_support()
returns boolean
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select coalesce(public.current_profile_role() in ('admin', 'support'), false);
$$;

create or replace function public.merchant_session_ids()
returns uuid[]
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  with identity as (
    select
      auth.uid() as uid,
      lower(coalesce(auth.jwt() ->> 'email', '')) as email,
      regexp_replace(
        coalesce(
          auth.jwt() ->> 'phone',
          auth.jwt() #>> '{user_metadata,phone}',
          auth.jwt() #>> '{user_metadata,phone_number}',
          auth.jwt() #>> '{user_metadata,mobile}',
          ''
        ),
        '[^0-9]', '', 'g'
      ) as phone_digits
  )
  select coalesce(array_agg(m.id order by m.updated_at desc nulls last), '{}'::uuid[])
  from public.merchants m
  cross join identity i
  where i.uid is not null
    and lower(coalesce(m.status, 'active')) not in ('deleted', 'archived', 'blocked', 'suspended')
    and (
      m.user_id = i.uid
      or (i.email <> '' and lower(coalesce(m.email, '')) = i.email)
      or (i.phone_digits <> '' and regexp_replace(coalesce(m.phone, ''), '[^0-9]', '', 'g') = i.phone_digits)
      or (i.phone_digits <> '' and regexp_replace(coalesce(m.alt_phone, ''), '[^0-9]', '', 'g') = i.phone_digits)
    );
$$;

revoke all on function public.admin_safe_uuid(text) from public, anon;
revoke all on function public.current_profile_role() from public, anon;
revoke all on function public.is_admin_or_support() from public, anon;
revoke all on function public.merchant_session_ids() from public, anon;
grant execute on function public.admin_safe_uuid(text) to authenticated;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.is_admin_or_support() to authenticated;
grant execute on function public.merchant_session_ids() to authenticated;

alter table public.merchants enable row level security;
alter table public.orders enable row level security;

drop policy if exists merchants_admin_support_select on public.merchants;
create policy merchants_admin_support_select on public.merchants
for select to authenticated using (public.is_admin_or_support());

drop policy if exists merchants_admin_support_insert on public.merchants;
create policy merchants_admin_support_insert on public.merchants
for insert to authenticated with check (public.is_admin_or_support());

drop policy if exists merchants_admin_support_update on public.merchants;
create policy merchants_admin_support_update on public.merchants
for update to authenticated using (public.is_admin_or_support()) with check (public.is_admin_or_support());

drop policy if exists merchants_session_self_select on public.merchants;
create policy merchants_session_self_select on public.merchants
for select to authenticated using (id = any(public.merchant_session_ids()));

drop policy if exists orders_admin_support_select on public.orders;
create policy orders_admin_support_select on public.orders
for select to authenticated using (public.is_admin_or_support());

drop policy if exists orders_admin_support_insert on public.orders;
create policy orders_admin_support_insert on public.orders
for insert to authenticated with check (public.is_admin_or_support());

drop policy if exists orders_admin_support_update on public.orders;
create policy orders_admin_support_update on public.orders
for update to authenticated using (public.is_admin_or_support()) with check (public.is_admin_or_support());

drop policy if exists orders_merchant_session_select on public.orders;
create policy orders_merchant_session_select on public.orders
for select to authenticated
using (
  merchant_id = any(public.merchant_session_ids())
  or exists (
    select 1
    from public.merchants m
    where m.id = any(public.merchant_session_ids())
      and (
        (nullif(trim(m.merchant_code), '') is not null and coalesce(orders.merchant_code, '') = m.merchant_code)
        or (nullif(trim(m.trade_name), '') is not null and lower(coalesce(orders.merchant_name, '')) = lower(m.trade_name))
      )
  )
);

grant select, insert, update on public.merchants to authenticated;
grant select, insert, update on public.orders to authenticated;

create or replace function public.admin_create_coupon_order(p_order jsonb)
returns public.orders
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  r public.orders;
  v_merchant public.merchants%rowtype;
  v_merchant_id uuid := public.admin_safe_uuid(p_order ->> 'merchant_id');
  v_created_at timestamptz := coalesce(nullif(p_order ->> 'created_at', '')::timestamptz, now());
  v_tracking text := coalesce(
    nullif(p_order ->> 'tracking_number', ''),
    nullif(p_order ->> 'invoice_number', ''),
    'DN-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  );
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_admin_or_support() then
    raise exception 'not_authorized';
  end if;
  if v_merchant_id is null then
    raise exception 'merchant_required';
  end if;

  select * into v_merchant
  from public.merchants
  where id = v_merchant_id
    and lower(coalesce(status, 'active')) not in ('deleted', 'archived', 'blocked', 'suspended')
  limit 1;

  if v_merchant.id is null then
    raise exception 'merchant_not_found_or_inactive';
  end if;

  insert into public.orders (
    tracking_number, invoice_number, coupon_number,
    merchant_id, merchant_name, merchant_code,
    order_count, shipping_scope, destination_country, source_channel, source_domain,
    sender_name, sender_phone, sender_city, sender_address,
    receiver_name, receiver_phone, receiver_city, receiver_address,
    package_type, package_description, weight, pieces, service_type, payment_method,
    cod_amount, delivery_price, subtotal, base_price, total, total_price, amount, price,
    currency, notes, status_history, created_by, created_at, updated_at
  ) values (
    v_tracking,
    coalesce(nullif(p_order ->> 'invoice_number', ''), v_tracking),
    nullif(p_order ->> 'coupon_number', ''),
    v_merchant.id,
    v_merchant.trade_name,
    v_merchant.merchant_code,
    greatest(coalesce(nullif(p_order ->> 'order_count', '')::integer, 1), 1),
    coalesce(nullif(p_order ->> 'shipping_scope', ''), 'local'),
    nullif(p_order ->> 'destination_country', ''),
    'admin_operations',
    coalesce(nullif(p_order ->> 'source_domain', ''), 'daynightae.com'),
    v_merchant.trade_name,
    coalesce(nullif(v_merchant.phone, ''), nullif(p_order ->> 'sender_phone', ''), '971568757331'),
    coalesce(nullif(p_order ->> 'sender_city', ''), nullif(v_merchant.emirate, ''), 'Abu Dhabi'),
    coalesce(nullif(p_order ->> 'sender_address', ''), nullif(v_merchant.pickup_address, ''), nullif(v_merchant.address, ''), 'Abu Dhabi'),
    nullif(p_order ->> 'receiver_name', ''),
    nullif(p_order ->> 'receiver_phone', ''),
    coalesce(nullif(p_order ->> 'receiver_city', ''), 'Dubai'),
    nullif(p_order ->> 'receiver_address', ''),
    coalesce(nullif(p_order ->> 'package_type', ''), 'Shipment'),
    nullif(p_order ->> 'package_description', ''),
    greatest(coalesce(nullif(p_order ->> 'weight', '')::numeric, 1), 0.01),
    greatest(coalesce(nullif(p_order ->> 'pieces', '')::integer, 1), 1),
    coalesce(nullif(p_order ->> 'service_type', ''), 'standard'),
    coalesce(nullif(p_order ->> 'payment_method', ''), nullif(v_merchant.default_payment_method, ''), 'sender_pays'),
    greatest(coalesce(nullif(p_order ->> 'cod_amount', '')::numeric, 0), 0),
    greatest(coalesce(nullif(p_order ->> 'delivery_price', '')::numeric, 0), 0),
    greatest(coalesce(nullif(p_order ->> 'subtotal', '')::numeric, nullif(p_order ->> 'delivery_price', '')::numeric, 0), 0),
    greatest(coalesce(nullif(p_order ->> 'base_price', '')::numeric, nullif(p_order ->> 'delivery_price', '')::numeric, 0), 0),
    greatest(coalesce(nullif(p_order ->> 'total', '')::numeric, nullif(p_order ->> 'delivery_price', '')::numeric, 0), 0),
    greatest(coalesce(nullif(p_order ->> 'total_price', '')::numeric, nullif(p_order ->> 'delivery_price', '')::numeric, 0), 0),
    greatest(coalesce(nullif(p_order ->> 'amount', '')::numeric, nullif(p_order ->> 'delivery_price', '')::numeric, 0), 0),
    greatest(coalesce(nullif(p_order ->> 'price', '')::numeric, nullif(p_order ->> 'delivery_price', '')::numeric, 0), 0),
    coalesce(nullif(p_order ->> 'currency', ''), 'AED'),
    concat_ws(' | ', nullif(p_order ->> 'notes', ''), 'Created by authenticated admin', 'Merchant ID: ' || v_merchant.id::text),
    jsonb_build_array(jsonb_build_object(
      'status', 'pending',
      'date', v_created_at,
      'created_at', v_created_at,
      'note', 'Created from admin for merchant ' || v_merchant.trade_name
    )),
    auth.uid(), v_created_at, now()
  ) returning * into r;

  return r;
end;
$$;

revoke all on function public.admin_create_coupon_order(jsonb) from public, anon;
grant execute on function public.admin_create_coupon_order(jsonb) to authenticated;

create or replace function public.merchant_claim_approved_account()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_phone text := regexp_replace(
    coalesce(
      auth.jwt() ->> 'phone',
      auth.jwt() #>> '{user_metadata,phone}',
      auth.jwt() #>> '{user_metadata,phone_number}',
      auth.jwt() #>> '{user_metadata,mobile}',
      ''
    ), '[^0-9]', '', 'g'
  );
  v_merchant public.merchants%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  update public.merchants m
  set user_id = v_uid,
      status = case when lower(coalesce(m.status, 'active')) in ('deleted', 'archived', 'blocked', 'suspended') then m.status else 'active' end,
      updated_at = now()
  where (m.user_id is null or m.user_id = v_uid)
    and (
      (v_email <> '' and lower(coalesce(m.email, '')) = v_email)
      or (v_phone <> '' and regexp_replace(coalesce(m.phone, ''), '[^0-9]', '', 'g') = v_phone)
      or (v_phone <> '' and regexp_replace(coalesce(m.alt_phone, ''), '[^0-9]', '', 'g') = v_phone)
    )
  returning * into v_merchant;

  if v_merchant.id is null then
    select * into v_merchant
    from public.merchants
    where id = any(public.merchant_session_ids())
    order by updated_at desc nulls last
    limit 1;
  end if;

  if v_merchant.id is null then
    raise exception 'merchant_profile_not_found';
  end if;

  return jsonb_build_object('ok', true, 'merchant', to_jsonb(v_merchant), 'linked_user_id', v_uid);
end;
$$;

create or replace function public.merchant_get_session_profile()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_ids uuid[] := public.merchant_session_ids();
  v_merchants jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.updated_at desc nulls last, m.created_at desc nulls last), '[]'::jsonb)
  into v_merchants
  from public.merchants m
  where m.id = any(v_ids);

  return jsonb_build_object('ok', true, 'generated_at', now(), 'merchant_count', jsonb_array_length(v_merchants), 'merchants', v_merchants);
end;
$$;

create or replace function public.merchant_portal_orders(p_limit integer default 120)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_ids uuid[] := public.merchant_session_ids();
  v_limit integer := least(greatest(coalesce(p_limit, 120), 1), 250);
  v_orders jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  with my_merchants as (
    select m.id, nullif(trim(m.merchant_code), '') as merchant_code, lower(nullif(trim(m.trade_name), '')) as trade_name_lower
    from public.merchants m
    where m.id = any(v_ids)
  ), scoped_orders as (
    select o.*
    from public.orders o
    where exists (
      select 1 from my_merchants m
      where o.merchant_id = m.id
        or (m.merchant_code is not null and coalesce(o.merchant_code, '') = m.merchant_code)
        or (m.trade_name_lower is not null and lower(coalesce(o.merchant_name, '')) = m.trade_name_lower)
    )
    order by o.created_at desc nulls last, o.updated_at desc nulls last
    limit v_limit
  )
  select coalesce(jsonb_agg(to_jsonb(scoped_orders) order by scoped_orders.created_at desc nulls last, scoped_orders.updated_at desc nulls last), '[]'::jsonb)
  into v_orders
  from scoped_orders;

  return jsonb_build_object('ok', true, 'generated_at', now(), 'limit', v_limit, 'orders_count', jsonb_array_length(v_orders), 'orders', v_orders);
end;
$$;

revoke all on function public.merchant_claim_approved_account() from public, anon;
revoke all on function public.merchant_get_session_profile() from public, anon;
revoke all on function public.merchant_portal_orders(integer) from public, anon;
grant execute on function public.merchant_claim_approved_account() to authenticated;
grant execute on function public.merchant_get_session_profile() to authenticated;
grant execute on function public.merchant_portal_orders(integer) to authenticated;

with candidate_links as (
  select o.id as order_id, m.id as merchant_id, m.trade_name, m.merchant_code,
         count(*) over (partition by o.id) as match_count
  from public.orders o
  join public.merchants m on (
    (nullif(trim(o.merchant_code), '') is not null and o.merchant_code = m.merchant_code)
    or (nullif(trim(o.merchant_name), '') is not null and lower(o.merchant_name) = lower(m.trade_name))
    or (
      nullif(trim(o.sender_name), '') is not null
      and lower(o.sender_name) = lower(m.trade_name)
      and regexp_replace(coalesce(o.sender_phone, ''), '[^0-9]', '', 'g') = regexp_replace(coalesce(m.phone, ''), '[^0-9]', '', 'g')
    )
  )
  where o.merchant_id is null
)
update public.orders o
set merchant_id = c.merchant_id,
    merchant_name = c.trade_name,
    merchant_code = c.merchant_code,
    updated_at = now()
from candidate_links c
where o.id = c.order_id and c.match_count = 1;

create or replace function public.admin_merchant_order_flow_health()
returns jsonb
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'ok',
      to_regprocedure('public.admin_create_coupon_order(jsonb)') is not null
      and to_regprocedure('public.merchant_get_session_profile()') is not null
      and to_regprocedure('public.merchant_portal_orders(integer)') is not null,
    'current_user_id', auth.uid(),
    'current_role', public.current_profile_role(),
    'is_admin_or_support', public.is_admin_or_support(),
    'merchant_count', (select count(*) from public.merchants),
    'order_count', (select count(*) from public.orders),
    'linked_order_count', (select count(*) from public.orders where merchant_id is not null),
    'unlinked_order_count', (select count(*) from public.orders where merchant_id is null),
    'admin_create_order_rpc', to_regprocedure('public.admin_create_coupon_order(jsonb)') is not null,
    'merchant_profile_rpc', to_regprocedure('public.merchant_get_session_profile()') is not null,
    'merchant_orders_rpc', to_regprocedure('public.merchant_portal_orders(integer)') is not null,
    'checked_at', now()
  );
$$;

revoke all on function public.admin_merchant_order_flow_health() from public, anon;
grant execute on function public.admin_merchant_order_flow_health() to authenticated;

notify pgrst, 'reload schema';

commit;

select public.admin_merchant_order_flow_health();
