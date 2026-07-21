-- DAY NIGHT DELIVERY SERVICES
-- Runtime delivery verification, secure live-driver tracking, customer history,
-- and automatic delivery-confirmation email outbox.

begin;

create extension if not exists pgcrypto;

alter table public.orders
  add column if not exists delivered_at timestamptz;

create or replace function public.dn_set_order_delivered_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if lower(coalesce(new.status, '')) = 'delivered'
     and lower(coalesce(old.status, '')) is distinct from 'delivered' then
    new.delivered_at := coalesce(new.delivered_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists dn_orders_set_delivered_at on public.orders;
create trigger dn_orders_set_delivered_at
before update of status on public.orders
for each row execute function public.dn_set_order_delivered_at();

update public.orders
set delivered_at = coalesce(delivered_at, updated_at, created_at)
where lower(coalesce(status, '')) = 'delivered'
  and delivered_at is null;

create table if not exists public.delivery_confirmation_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  recipient_email text not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0,
  last_error text,
  provider_message_id text,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id, recipient_email)
);

create index if not exists delivery_confirmation_outbox_pending_idx
  on public.delivery_confirmation_outbox(status, next_attempt_at, created_at);

alter table public.delivery_confirmation_outbox enable row level security;
revoke all on public.delivery_confirmation_outbox from public, anon, authenticated;

create or replace function public.dn_queue_delivery_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_order jsonb := to_jsonb(new);
  v_email text := lower(coalesce(
    nullif(btrim(v_order->>'customer_email'), ''),
    nullif(btrim(v_order->>'sender_email'), ''),
    nullif(btrim(v_order->>'receiver_email'), ''),
    nullif(btrim(v_order->>'email'), '')
  ));
  v_customer_id uuid;
begin
  if v_email is null then
    begin
      v_customer_id := nullif(v_order->>'customer_id', '')::uuid;
    exception when others then
      v_customer_id := null;
    end;

    if v_customer_id is not null then
      select lower(email) into v_email
      from auth.users
      where id = v_customer_id
      limit 1;
    end if;
  end if;

  if v_email is not null and v_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    insert into public.delivery_confirmation_outbox(order_id, recipient_email, status, next_attempt_at, updated_at)
    values(new.id, v_email, 'pending', now(), now())
    on conflict (order_id, recipient_email) do update
      set status = case when public.delivery_confirmation_outbox.status = 'sent' then 'sent' else 'pending' end,
          next_attempt_at = case when public.delivery_confirmation_outbox.status = 'sent' then public.delivery_confirmation_outbox.next_attempt_at else now() end,
          updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists dn_orders_queue_delivery_confirmation on public.orders;
create trigger dn_orders_queue_delivery_confirmation
after insert on public.orders
for each row execute function public.dn_queue_delivery_confirmation();

create or replace function public.public_customer_order_history(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_phone text := regexp_replace(coalesce(auth.jwt() ->> 'phone', auth.jwt() #>> '{user_metadata,phone}', ''), '[^0-9]', '', 'g');
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_orders jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select coalesce(jsonb_agg(to_jsonb(o) order by coalesce(o.delivered_at, o.updated_at, o.created_at) desc), '[]'::jsonb)
    into v_orders
  from (
    select *
    from public.orders o
    where lower(coalesce(o.status, '')) in ('delivered','cancelled','canceled','returned','failed','delivery_failed')
      and (
        coalesce(to_jsonb(o)->>'customer_id', '') = v_uid::text
        or (v_email <> '' and lower(coalesce(to_jsonb(o)->>'customer_email', '')) = v_email)
        or (v_email <> '' and lower(coalesce(to_jsonb(o)->>'sender_email', '')) = v_email)
        or (v_email <> '' and lower(coalesce(to_jsonb(o)->>'receiver_email', '')) = v_email)
        or (v_phone <> '' and regexp_replace(coalesce(to_jsonb(o)->>'customer_phone', ''), '[^0-9]', '', 'g') = v_phone)
        or (v_phone <> '' and regexp_replace(coalesce(to_jsonb(o)->>'sender_phone', ''), '[^0-9]', '', 'g') = v_phone)
        or (v_phone <> '' and regexp_replace(coalesce(to_jsonb(o)->>'receiver_phone', ''), '[^0-9]', '', 'g') = v_phone)
      )
    order by coalesce(o.delivered_at, o.updated_at, o.created_at) desc
    limit v_limit
  ) o;

  return v_orders;
end;
$$;

create or replace function public.tracking_live_driver_location(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_order jsonb;
  v_status text;
  v_driver_id uuid;
  v_merchant_id uuid;
  v_role text;
  v_location jsonb;
  v_authorized boolean := false;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select to_jsonb(o) into v_order
  from public.orders o
  where o.id = p_order_id
  limit 1;

  if v_order is null then raise exception 'order_not_found'; end if;

  v_status := lower(coalesce(v_order->>'status', ''));
  if v_status <> 'out_for_delivery' then
    return jsonb_build_object('ok', true, 'live', false, 'status', v_status, 'location', null);
  end if;

  begin
    v_driver_id := nullif(coalesce(v_order->>'driver_id', v_order->>'assigned_driver_id', v_order->>'courier_id'), '')::uuid;
  exception when others then
    v_driver_id := null;
  end;

  begin
    v_merchant_id := nullif(v_order->>'merchant_id', '')::uuid;
  exception when others then
    v_merchant_id := null;
  end;

  select lower(coalesce(p.role::text, '')) into v_role
  from public.profiles p
  where p.id = v_uid
  limit 1;

  if v_role in ('admin','support','super_admin') then
    v_authorized := true;
  elsif v_driver_id is not null and exists (
    select 1 from public.driver_profiles d
    where d.id = v_driver_id and (d.user_id = v_uid or d.id = v_uid)
  ) then
    v_authorized := true;
  elsif v_merchant_id is not null and public.merchant_session_id() = v_merchant_id then
    v_authorized := true;
  elsif coalesce(v_order->>'customer_id', '') = v_uid::text then
    v_authorized := true;
  elsif v_email <> '' and v_email in (
    lower(coalesce(v_order->>'customer_email', '')),
    lower(coalesce(v_order->>'sender_email', '')),
    lower(coalesce(v_order->>'receiver_email', ''))
  ) then
    v_authorized := true;
  end if;

  if not v_authorized then raise exception 'not_authorized'; end if;
  if v_driver_id is null then return jsonb_build_object('ok', true, 'live', false, 'status', v_status, 'location', null); end if;

  select to_jsonb(dl) into v_location
  from public.driver_locations dl
  where dl.driver_id = v_driver_id
  order by coalesce(dl.updated_at, dl.last_seen_at, dl.created_at) desc nulls last
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'live', v_location is not null,
    'status', v_status,
    'driver_id', v_driver_id,
    'location', v_location
  );
end;
$$;

create or replace function public.admin_delivery_runtime_snapshot(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_order jsonb;
  v_merchant jsonb;
  v_driver jsonb;
  v_location jsonb;
  v_history jsonb := '[]'::jsonb;
  v_cod jsonb := '[]'::jsonb;
  v_statement jsonb := '[]'::jsonb;
  v_order_record public.orders%rowtype;
  v_driver_id uuid;
  v_merchant_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select lower(coalesce(role::text, '')) into v_role from public.profiles where id = v_uid limit 1;
  if v_role not in ('admin','support','super_admin') then raise exception 'not_authorized'; end if;

  select * into v_order_record from public.orders where id = p_order_id limit 1;
  if v_order_record.id is null then raise exception 'order_not_found'; end if;
  v_order := to_jsonb(v_order_record);

  begin v_merchant_id := nullif(v_order->>'merchant_id','')::uuid; exception when others then v_merchant_id := null; end;
  begin v_driver_id := nullif(coalesce(v_order->>'driver_id',v_order->>'assigned_driver_id'),'')::uuid; exception when others then v_driver_id := null; end;

  if v_merchant_id is not null then select to_jsonb(m) into v_merchant from public.merchants m where m.id = v_merchant_id; end if;
  if v_driver_id is not null then
    select to_jsonb(d) into v_driver from public.driver_profiles d where d.id = v_driver_id;
    select to_jsonb(dl) into v_location from public.driver_locations dl where dl.driver_id = v_driver_id order by coalesce(dl.updated_at,dl.last_seen_at,dl.created_at) desc nulls last limit 1;
  end if;

  if to_regclass('public.order_status_history') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at), ''[]''::jsonb) from public.order_status_history h where h.order_id = $1'
      into v_history using p_order_id;
  end if;
  if to_regclass('public.cod_collections') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at), ''[]''::jsonb) from public.cod_collections c where c.order_id = $1'
      into v_cod using p_order_id;
  end if;
  if to_regclass('public.merchant_statement_entries') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at), ''[]''::jsonb) from public.merchant_statement_entries s where s.order_id = $1'
      into v_statement using p_order_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'order', v_order,
    'merchant', v_merchant,
    'driver', v_driver,
    'driver_location', v_location,
    'status_history', v_history,
    'cod_collections', v_cod,
    'statement_entries', v_statement,
    'email_outbox', (select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at), '[]'::jsonb) from public.delivery_confirmation_outbox e where e.order_id = p_order_id)
  );
end;
$$;

revoke all on function public.public_customer_order_history(integer) from public, anon;
revoke all on function public.tracking_live_driver_location(uuid) from public, anon;
revoke all on function public.admin_delivery_runtime_snapshot(uuid) from public, anon;
grant execute on function public.public_customer_order_history(integer) to authenticated;
grant execute on function public.tracking_live_driver_location(uuid) to authenticated;
grant execute on function public.admin_delivery_runtime_snapshot(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
