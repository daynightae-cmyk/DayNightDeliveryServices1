-- DAY NIGHT DELIVERY SERVICES
-- Final merchant/driver portal recovery: real notifications + strict official merchant link.
-- IMPORTANT: no plaintext credentials are stored in this public repository.

begin;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) Recover the official merchant record and link it to the existing auth user.
-- -----------------------------------------------------------------------------

alter table public.merchants
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_merchants_user_id on public.merchants(user_id);
create index if not exists idx_merchants_email_lower on public.merchants((lower(coalesce(email, ''))));

insert into public.merchants (
  merchant_code,
  trade_name,
  owner_name,
  phone,
  email,
  emirate,
  city,
  address,
  pickup_address,
  settlement_cycle,
  commission_type,
  default_payment_method,
  status,
  notes
)
select
  'DN-MERCHANT-OFFICIAL',
  'DAY NIGHT Merchant',
  'DAY NIGHT DELIVERY SERVICES',
  '+971568757331',
  'merchant@daynightae.com',
  'Abu Dhabi',
  'Mussafah',
  'UAE — Abu Dhabi — Mussafah 40',
  'UAE — Abu Dhabi — Mussafah 40',
  'weekly',
  'fixed_delivery_fee',
  'sender_pays',
  'active',
  'Official DAY NIGHT merchant portal account'
where not exists (
  select 1 from public.merchants where merchant_code = 'DN-MERCHANT-OFFICIAL'
);

update public.merchants
set trade_name = 'DAY NIGHT Merchant',
    owner_name = 'DAY NIGHT DELIVERY SERVICES',
    phone = '+971568757331',
    email = 'merchant@daynightae.com',
    emirate = coalesce(nullif(emirate, ''), 'Abu Dhabi'),
    city = coalesce(nullif(city, ''), 'Mussafah'),
    address = coalesce(nullif(address, ''), 'UAE — Abu Dhabi — Mussafah 40'),
    pickup_address = coalesce(nullif(pickup_address, ''), 'UAE — Abu Dhabi — Mussafah 40'),
    settlement_cycle = coalesce(nullif(settlement_cycle, ''), 'weekly'),
    status = 'active',
    notes = 'Official DAY NIGHT merchant portal account',
    updated_at = now()
where merchant_code = 'DN-MERCHANT-OFFICIAL';

do $dn$
declare
  v_uid uuid;
begin
  select id into v_uid
  from auth.users
  where lower(coalesce(email, '')) = 'merchant@daynightae.com'
  order by created_at asc nulls last
  limit 1;

  if v_uid is not null then
    -- The strict isolation model is one auth user -> one merchant row.
    update public.merchants
    set user_id = null,
        updated_at = now()
    where user_id = v_uid
      and merchant_code <> 'DN-MERCHANT-OFFICIAL';

    update public.merchants
    set user_id = v_uid,
        status = 'active',
        updated_at = now()
    where merchant_code = 'DN-MERCHANT-OFFICIAL';
  end if;
end
$dn$;

-- -----------------------------------------------------------------------------
-- 2) Canonical realtime notifications used by merchant and driver portals.
-- -----------------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'info',
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications add column if not exists user_id uuid;
alter table public.notifications add column if not exists title text;
alter table public.notifications add column if not exists message text;
alter table public.notifications add column if not exists type text not null default 'info';
alter table public.notifications add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.notifications add column if not exists read_at timestamptz;
alter table public.notifications add column if not exists created_at timestamptz not null default now();

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, read_at, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
for select to authenticated
using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists notifications_no_direct_insert on public.notifications;
create policy notifications_no_direct_insert on public.notifications
for insert to authenticated
with check (false);

drop policy if exists notifications_no_direct_delete on public.notifications;
create policy notifications_no_direct_delete on public.notifications
for delete to authenticated
using (false);

create or replace function public.portal_notifications(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth, pg_temp
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_rows jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(n) order by n.created_at desc),
    '[]'::jsonb
  )
  into v_rows
  from (
    select id, user_id, title, message, type, metadata, read_at, created_at
    from public.notifications
    where user_id = auth.uid()
    order by created_at desc
    limit v_limit
  ) n;

  return jsonb_build_object(
    'ok', true,
    'generated_at', now(),
    'unread_count', (
      select count(*) from public.notifications
      where user_id = auth.uid() and read_at is null
    ),
    'notifications', v_rows
  );
end;
$$;

create or replace function public.portal_mark_notification_read(p_notification_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_updated integer := 0;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where id::text = p_notification_id
    and user_id = auth.uid();

  get diagnostics v_updated = row_count;
  return jsonb_build_object('ok', v_updated = 1, 'updated', v_updated);
end;
$$;

revoke all on function public.portal_notifications(integer) from public, anon;
revoke all on function public.portal_mark_notification_read(text) from public, anon;
grant execute on function public.portal_notifications(integer) to authenticated;
grant execute on function public.portal_mark_notification_read(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3) Generate real merchant/driver notifications from order lifecycle changes.
-- -----------------------------------------------------------------------------

create or replace function public.portal_insert_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text default 'info',
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if p_user_id is null then return; end if;

  insert into public.notifications(user_id, title, message, type, metadata, created_at)
  values (
    p_user_id,
    nullif(btrim(coalesce(p_title, '')), ''),
    nullif(btrim(coalesce(p_message, '')), ''),
    coalesce(nullif(btrim(coalesce(p_type, '')), ''), 'info'),
    coalesce(p_metadata, '{}'::jsonb),
    now()
  );
exception when others then
  raise notice 'Portal notification skipped: %', sqlerrm;
end;
$$;

revoke all on function public.portal_insert_notification(uuid,text,text,text,jsonb) from public, anon, authenticated;

create or replace function public.portal_notify_order_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_merchant_user uuid;
  v_driver_user uuid;
  v_reference text;
  v_status text;
  v_old_status text;
  v_metadata jsonb;
begin
  v_reference := coalesce(new.tracking_number, new.tracking_code, new.invoice_number, new.coupon_number, new.id::text);
  v_status := lower(coalesce(new.status, 'pending'));
  v_old_status := case when tg_op = 'UPDATE' then lower(coalesce(old.status, '')) else '' end;

  if new.merchant_id is not null then
    select m.user_id into v_merchant_user
    from public.merchants m
    where m.id = new.merchant_id
    limit 1;
  end if;

  if coalesce(new.assigned_driver_id, new.driver_id) is not null then
    select d.user_id into v_driver_user
    from public.driver_profiles d
    where d.id = coalesce(new.assigned_driver_id, new.driver_id)
    limit 1;
  end if;

  v_metadata := jsonb_build_object(
    'order_id', new.id,
    'tracking_reference', v_reference,
    'status', v_status,
    'merchant_id', new.merchant_id,
    'driver_id', coalesce(new.assigned_driver_id, new.driver_id),
    'title_ar', case when tg_op = 'INSERT' then 'تم إنشاء طلب جديد' else 'تم تحديث حالة الطلب' end,
    'message_ar', case when tg_op = 'INSERT'
      then 'تم تسجيل الطلب ' || v_reference
      else 'الطلب ' || v_reference || ' أصبح بالحالة: ' || v_status
    end
  );

  if tg_op = 'INSERT' then
    perform public.portal_insert_notification(
      v_merchant_user,
      'New order created',
      'Order ' || v_reference || ' was created successfully.',
      'order_created',
      v_metadata
    );

    if v_driver_user is not null then
      perform public.portal_insert_notification(
        v_driver_user,
        'New assigned order',
        'Order ' || v_reference || ' is assigned to you.',
        'driver_assignment',
        v_metadata
      );
    end if;
  elsif v_status is distinct from v_old_status then
    perform public.portal_insert_notification(
      v_merchant_user,
      'Order status updated',
      'Order ' || v_reference || ' is now ' || v_status || '.',
      'order_status',
      v_metadata
    );

    if v_driver_user is not null then
      perform public.portal_insert_notification(
        v_driver_user,
        'Order status updated',
        'Order ' || v_reference || ' is now ' || v_status || '.',
        'order_status',
        v_metadata
      );
    end if;
  elsif tg_op = 'UPDATE'
    and coalesce(new.assigned_driver_id, new.driver_id) is distinct from coalesce(old.assigned_driver_id, old.driver_id)
    and v_driver_user is not null then
      perform public.portal_insert_notification(
        v_driver_user,
        'New assigned order',
        'Order ' || v_reference || ' is assigned to you.',
        'driver_assignment',
        v_metadata
      );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_portal_notify_order_lifecycle on public.orders;
create trigger trg_portal_notify_order_lifecycle
after insert or update of status, assigned_driver_id, driver_id on public.orders
for each row execute function public.portal_notify_order_lifecycle();

-- Add notifications to Supabase Realtime when the publication exists.
do $dn$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception when duplicate_object then
  null;
end
$dn$;

notify pgrst, 'reload schema';

commit;
