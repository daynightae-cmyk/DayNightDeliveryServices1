-- DAY NIGHT: driver mission status, private order chat, and real driver payroll.
-- Additive production migration; no demo rows and no destructive data rewrite.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Driver mission status: accepted is a legacy UI alias for confirmed.
--    Cast dynamically so this works with both text and production order_status.
-- ---------------------------------------------------------------------------
create or replace function public.driver_update_order_status(
  p_order_id text,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_driver public.driver_profiles%rowtype;
  v_order public.orders%rowtype;
  v_status text := lower(replace(btrim(coalesce(p_status,'')),' ','_'));
  v_order_status_type text;
  v_order_status_is_enum boolean := false;
  v_history_status_type text;
  v_history_status_is_enum boolean := false;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_status in ('accepted','approved') then v_status := 'confirmed'; end if;
  if v_status='failed' then v_status := 'cancelled'; end if;
  if v_status not in ('confirmed','picked_up','in_transit','delivered','cancelled','returned','postponed') then
    raise exception 'unsupported_driver_status: %',p_status;
  end if;
  if v_status in ('delivered','cancelled','returned') and nullif(btrim(coalesce(p_note,'')),'') is null then
    raise exception 'status_note_required';
  end if;

  select * into v_driver
  from public.driver_profiles
  where (id=auth.uid() or user_id=auth.uid()) and status::text='active'
  order by case when id=auth.uid() then 0 else 1 end, created_at desc nulls last
  limit 1;
  if not found then raise exception 'driver_setup_required_or_inactive'; end if;

  select * into v_order
  from public.orders
  where (id::text=p_order_id or tracking_number=p_order_id or invoice_number=p_order_id or coupon_number=p_order_id)
    and (driver_id=v_driver.id or assigned_driver_id=v_driver.id)
  limit 1;
  if not found then raise exception 'order_not_assigned_to_driver'; end if;

  select format('%I.%I', ns.nspname, typ.typname), typ.typtype='e'
    into v_order_status_type, v_order_status_is_enum
  from pg_attribute att
  join pg_class cls on cls.oid=att.attrelid
  join pg_namespace relns on relns.oid=cls.relnamespace
  join pg_type typ on typ.oid=att.atttypid
  join pg_namespace ns on ns.oid=typ.typnamespace
  where relns.nspname='public' and cls.relname='orders' and att.attname='status' and att.attnum>0 and not att.attisdropped;

  if v_order_status_is_enum then
    execute format(
      'update public.orders set status=$1::%s,driver_id=$2,assigned_driver_id=$2,driver_name=coalesce($3,driver_name),driver_phone=coalesce($4,driver_phone),updated_at=now() where id=$5 returning *',
      v_order_status_type
    ) into v_order using v_status,v_driver.id,v_driver.full_name,v_driver.phone,v_order.id;
  else
    update public.orders set
      status=v_status,
      driver_id=v_driver.id,
      assigned_driver_id=v_driver.id,
      driver_name=coalesce(v_driver.full_name,driver_name),
      driver_phone=coalesce(v_driver.phone,driver_phone),
      updated_at=now()
    where id=v_order.id returning * into v_order;
  end if;

  if to_regclass('public.order_status_history') is not null then
    select format('%I.%I', ns.nspname, typ.typname), typ.typtype='e'
      into v_history_status_type, v_history_status_is_enum
    from pg_attribute att
    join pg_class cls on cls.oid=att.attrelid
    join pg_namespace relns on relns.oid=cls.relnamespace
    join pg_type typ on typ.oid=att.atttypid
    join pg_namespace ns on ns.oid=typ.typnamespace
    where relns.nspname='public' and cls.relname='order_status_history' and att.attname='status' and att.attnum>0 and not att.attisdropped;

    if v_history_status_is_enum then
      execute format(
        'insert into public.order_status_history(order_id,status,note,driver_id,changed_by,created_at) values ($1,$2::%s,$3,$4,$5,now())',
        v_history_status_type
      ) using v_order.id,v_status,coalesce(nullif(btrim(coalesce(p_note,'')),''),'Driver status update'),v_driver.id,auth.uid();
    else
      insert into public.order_status_history(order_id,status,note,driver_id,changed_by,created_at)
      values (v_order.id,v_status,coalesce(nullif(btrim(coalesce(p_note,'')),''),'Driver status update'),v_driver.id,auth.uid(),now());
    end if;
  end if;

  if v_status in ('delivered','cancelled','returned') then
    update public.driver_locations set current_order_id=null,updated_at=now()
    where driver_id=v_driver.id and current_order_id=v_order.id;
    update public.driver_profiles set shift_status='available',updated_at=now() where id=v_driver.id;
  else
    update public.driver_locations set current_order_id=v_order.id,updated_at=now() where driver_id=v_driver.id;
    update public.driver_profiles set shift_status='busy',updated_at=now() where id=v_driver.id;
  end if;

  perform public.driver_audit(v_driver.id,'order_status_updated',v_order.id,jsonb_build_object('status',v_status,'note',p_note,'source','driver_portal'));
  return jsonb_build_object('ok',true,'order_id',v_order.id,'status',v_status);
end
$dn$;

revoke all on function public.driver_update_order_status(text,text,text) from public, anon;
grant execute on function public.driver_update_order_status(text,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Private realtime order conversation.
-- ---------------------------------------------------------------------------
create table if not exists public.order_conversation_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('driver','customer','admin')),
  sender_name text,
  body text,
  message_type text not null default 'text' check (message_type in ('text','location','system')),
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  constraint order_chat_body_length check (char_length(coalesce(body,'')) <= 2000),
  constraint order_chat_location_valid check (
    (message_type <> 'location') or
    (latitude between -90 and 90 and longitude between -180 and 180)
  ),
  constraint order_chat_content_present check (
    nullif(btrim(coalesce(body,'')),'') is not null or message_type='location'
  )
);

create index if not exists order_conversation_messages_order_created_idx
  on public.order_conversation_messages(order_id,created_at,id);
create index if not exists order_conversation_messages_sender_idx
  on public.order_conversation_messages(sender_user_id,created_at desc);

create or replace function public.order_chat_can_access(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $dn$
  select auth.uid() is not null and exists (
    select 1
    from public.orders o
    where o.id=p_order_id
      and (
        public.driver_is_admin()
        or exists (
          select 1 from public.driver_profiles dp
          where (dp.id=auth.uid() or dp.user_id=auth.uid())
            and (o.driver_id=dp.id or o.assigned_driver_id=dp.id)
        )
        or coalesce(to_jsonb(o)->>'customer_id','')=auth.uid()::text
        or (
          coalesce(lower(auth.jwt()->>'email'),'')<>''
          and lower(auth.jwt()->>'email') in (
            lower(coalesce(to_jsonb(o)->>'customer_email','')),
            lower(coalesce(to_jsonb(o)->>'receiver_email',''))
          )
        )
        or (
          regexp_replace(coalesce(auth.jwt()->>'phone',''),'\D','','g')<>''
          and regexp_replace(coalesce(auth.jwt()->>'phone',''),'\D','','g') in (
            regexp_replace(coalesce(to_jsonb(o)->>'customer_phone',''),'\D','','g'),
            regexp_replace(coalesce(to_jsonb(o)->>'receiver_phone',''),'\D','','g')
          )
        )
      )
  );
$dn$;

create or replace function public.order_chat_resolve_id(p_order_id text)
returns uuid
language sql
stable
security definer
set search_path = public
as $dn$
  select o.id
  from public.orders o
  where o.id::text=p_order_id or o.tracking_number=p_order_id or o.invoice_number=p_order_id or o.coupon_number=p_order_id
  order by o.created_at desc
  limit 1;
$dn$;

create or replace function public.order_chat_list(p_order_id text)
returns table (
  id uuid,
  order_id uuid,
  sender_user_id uuid,
  sender_role text,
  sender_name text,
  body text,
  message_type text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare v_order_id uuid := public.order_chat_resolve_id(p_order_id);
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_order_id is null then raise exception 'order_not_found'; end if;
  if not public.order_chat_can_access(v_order_id) then raise exception 'order_chat_access_denied'; end if;
  return query
  select m.id,m.order_id,m.sender_user_id,m.sender_role,m.sender_name,m.body,m.message_type,m.latitude,m.longitude,m.created_at
  from public.order_conversation_messages m
  where m.order_id=v_order_id
  order by m.created_at,m.id;
end
$dn$;

create or replace function public.order_chat_send(
  p_order_id text,
  p_body text default null,
  p_message_type text default 'text',
  p_latitude double precision default null,
  p_longitude double precision default null
)
returns public.order_conversation_messages
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_order_id uuid := public.order_chat_resolve_id(p_order_id);
  v_type text := lower(btrim(coalesce(p_message_type,'text')));
  v_role text;
  v_name text;
  v_row public.order_conversation_messages%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_order_id is null then raise exception 'order_not_found'; end if;
  if not public.order_chat_can_access(v_order_id) then raise exception 'order_chat_access_denied'; end if;
  if v_type not in ('text','location') then raise exception 'unsupported_chat_message_type'; end if;
  if v_type='text' and nullif(btrim(coalesce(p_body,'')),'') is null then raise exception 'chat_message_required'; end if;
  if char_length(coalesce(p_body,''))>2000 then raise exception 'chat_message_too_long'; end if;
  if v_type='location' and (p_latitude is null or p_longitude is null or p_latitude not between -90 and 90 or p_longitude not between -180 and 180) then
    raise exception 'invalid_chat_location';
  end if;

  if public.driver_is_admin() then
    v_role := 'admin';
  elsif exists (
    select 1 from public.driver_profiles dp join public.orders o on o.id=v_order_id
    where (dp.id=auth.uid() or dp.user_id=auth.uid()) and (o.driver_id=dp.id or o.assigned_driver_id=dp.id)
  ) then
    v_role := 'driver';
  else
    v_role := 'customer';
  end if;

  select coalesce(
    (select dp.full_name from public.driver_profiles dp where dp.id=auth.uid() or dp.user_id=auth.uid() order by case when dp.id=auth.uid() then 0 else 1 end limit 1),
    (select p.full_name from public.profiles p where p.id=auth.uid()),
    auth.jwt()->'user_metadata'->>'full_name',auth.jwt()->>'email',
    case when v_role='admin' then 'DAY NIGHT Operations' when v_role='driver' then 'DAY NIGHT Driver' else 'Customer' end
  ) into v_name;

  insert into public.order_conversation_messages(order_id,sender_user_id,sender_role,sender_name,body,message_type,latitude,longitude)
  values(v_order_id,auth.uid(),v_role,left(v_name,160),left(nullif(btrim(coalesce(p_body,'')),''),2000),v_type,p_latitude,p_longitude)
  returning * into v_row;
  return v_row;
end
$dn$;

alter table public.order_conversation_messages enable row level security;
drop policy if exists "order chat participants read" on public.order_conversation_messages;
create policy "order chat participants read" on public.order_conversation_messages
for select to authenticated using (public.order_chat_can_access(order_id));

revoke all on table public.order_conversation_messages from public, anon;
grant select on table public.order_conversation_messages to authenticated;
revoke all on function public.order_chat_can_access(uuid) from public, anon;
revoke all on function public.order_chat_resolve_id(text) from public, anon;
revoke all on function public.order_chat_list(text) from public, anon;
revoke all on function public.order_chat_send(text,text,text,double precision,double precision) from public, anon;
grant execute on function public.order_chat_list(text) to authenticated;
grant execute on function public.order_chat_send(text,text,text,double precision,double precision) to authenticated;

do $dn$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname='supabase_realtime' and schemaname='public' and tablename='order_conversation_messages'
     ) then
    alter publication supabase_realtime add table public.order_conversation_messages;
  end if;
end
$dn$;

-- ---------------------------------------------------------------------------
-- 3) Driver salary and deductions/expenses ledger.
-- ---------------------------------------------------------------------------
alter table public.driver_profiles add column if not exists base_salary numeric(12,2) not null default 0;
alter table public.driver_profiles add column if not exists salary_currency text not null default 'AED';
alter table public.driver_profiles add column if not exists salary_cycle text not null default 'monthly';
alter table public.driver_profiles add column if not exists salary_effective_from date;

create table if not exists public.driver_payroll_entries (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.driver_profiles(id) on delete cascade,
  entry_date date not null default current_date,
  entry_type text not null check (entry_type in ('bonus','expense','deduction','advance','adjustment','payment')),
  direction text not null check (direction in ('credit','debit')),
  amount numeric(12,2) not null check (amount>0),
  reference_number text,
  notes text not null,
  order_id uuid references public.orders(id) on delete set null,
  status text not null default 'approved' check (status in ('draft','approved','void')),
  created_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists driver_payroll_entries_driver_date_idx on public.driver_payroll_entries(driver_id,entry_date desc,created_at desc);
create index if not exists driver_payroll_entries_status_idx on public.driver_payroll_entries(status,entry_date desc);

create or replace function public.admin_set_driver_salary(
  p_driver_id uuid,
  p_base_salary numeric,
  p_cycle text default 'monthly',
  p_effective_from date default current_date,
  p_note text default null
)
returns public.driver_profiles
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare v_row public.driver_profiles%rowtype;
begin
  if not public.driver_is_admin() then raise exception 'not_authorized'; end if;
  if coalesce(p_base_salary,-1)<0 then raise exception 'invalid_base_salary'; end if;
  if lower(coalesce(p_cycle,'')) not in ('monthly','weekly','daily') then raise exception 'invalid_salary_cycle'; end if;
  update public.driver_profiles set
    base_salary=round(p_base_salary,2),salary_currency='AED',salary_cycle=lower(p_cycle),
    salary_effective_from=coalesce(p_effective_from,current_date),updated_at=now()
  where id=p_driver_id returning * into v_row;
  if not found then raise exception 'driver_not_found'; end if;
  perform public.driver_audit(v_row.id,'salary_updated',null,jsonb_build_object('base_salary',v_row.base_salary,'cycle',v_row.salary_cycle,'effective_from',v_row.salary_effective_from,'note',p_note));
  return v_row;
end
$dn$;

create or replace function public.admin_create_driver_payroll_entry(
  p_driver_id uuid,
  p_entry_date date,
  p_entry_type text,
  p_amount numeric,
  p_reference_number text default null,
  p_notes text default null,
  p_order_id uuid default null,
  p_status text default 'approved'
)
returns public.driver_payroll_entries
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_type text := lower(btrim(coalesce(p_entry_type,'')));
  v_status text := lower(btrim(coalesce(p_status,'approved')));
  v_direction text;
  v_row public.driver_payroll_entries%rowtype;
begin
  if not public.driver_is_admin() then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.driver_profiles where id=p_driver_id) then raise exception 'driver_not_found'; end if;
  if v_type not in ('bonus','expense','deduction','advance','adjustment','payment') then raise exception 'invalid_payroll_entry_type'; end if;
  if v_status not in ('draft','approved') then raise exception 'invalid_payroll_status'; end if;
  if coalesce(p_amount,0)<=0 then raise exception 'invalid_payroll_amount'; end if;
  if nullif(btrim(coalesce(p_notes,'')),'') is null then raise exception 'payroll_note_required'; end if;
  v_direction := case when v_type in ('bonus','adjustment') then 'credit' else 'debit' end;
  insert into public.driver_payroll_entries(driver_id,entry_date,entry_type,direction,amount,reference_number,notes,order_id,status,created_by,approved_by,approved_at)
  values(p_driver_id,coalesce(p_entry_date,current_date),v_type,v_direction,round(p_amount,2),nullif(btrim(coalesce(p_reference_number,'')),''),btrim(p_notes),p_order_id,v_status,auth.uid(),case when v_status='approved' then auth.uid() end,case when v_status='approved' then now() end)
  returning * into v_row;
  perform public.driver_audit(p_driver_id,'payroll_entry_created',p_order_id,jsonb_build_object('entry_id',v_row.id,'entry_type',v_type,'direction',v_direction,'amount',v_row.amount,'status',v_status));
  return v_row;
end
$dn$;

create or replace function public.admin_set_driver_payroll_entry_status(p_entry_id uuid,p_status text,p_note text default null)
returns public.driver_payroll_entries
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare v_status text:=lower(btrim(coalesce(p_status,''))); v_row public.driver_payroll_entries%rowtype;
begin
  if not public.driver_is_admin() then raise exception 'not_authorized'; end if;
  if v_status not in ('approved','void') then raise exception 'invalid_payroll_status'; end if;
  update public.driver_payroll_entries set status=v_status,approved_by=case when v_status='approved' then auth.uid() else approved_by end,approved_at=case when v_status='approved' then now() else approved_at end,updated_at=now(),notes=case when nullif(btrim(coalesce(p_note,'')),'') is null then notes else notes||E'\n'||btrim(p_note) end where id=p_entry_id returning * into v_row;
  if not found then raise exception 'payroll_entry_not_found'; end if;
  perform public.driver_audit(v_row.driver_id,'payroll_entry_status',v_row.order_id,jsonb_build_object('entry_id',v_row.id,'status',v_status,'note',p_note));
  return v_row;
end
$dn$;

create or replace function public.admin_driver_payroll_snapshot(p_driver_id uuid,p_from date,p_to date)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_driver public.driver_profiles%rowtype;
  v_from date:=coalesce(p_from,date_trunc('month',current_date)::date);
  v_to date:=coalesce(p_to,current_date);
  v_gross numeric:=0; v_credits numeric:=0; v_expenses numeric:=0; v_deductions numeric:=0; v_advances numeric:=0; v_payments numeric:=0;
begin
  if not public.driver_is_admin() then raise exception 'not_authorized'; end if;
  if v_from>v_to then raise exception 'invalid_payroll_period'; end if;
  select * into v_driver from public.driver_profiles where id=p_driver_id;
  if not found then raise exception 'driver_not_found'; end if;
  v_gross := coalesce(v_driver.base_salary,0);
  select
    coalesce(sum(amount) filter(where direction='credit' and status='approved'),0),
    coalesce(sum(amount) filter(where entry_type='expense' and status='approved'),0),
    coalesce(sum(amount) filter(where entry_type='deduction' and status='approved'),0),
    coalesce(sum(amount) filter(where entry_type='advance' and status='approved'),0),
    coalesce(sum(amount) filter(where entry_type='payment' and status='approved'),0)
  into v_credits,v_expenses,v_deductions,v_advances,v_payments
  from public.driver_payroll_entries where driver_id=p_driver_id and entry_date between v_from and v_to;
  return jsonb_build_object(
    'driver',to_jsonb(v_driver),'period_from',v_from,'period_to',v_to,'currency','AED',
    'gross_salary',v_gross,'credits',v_credits,'expenses',v_expenses,'deductions',v_deductions,'advances',v_advances,'payments',v_payments,
    'net_salary',greatest(0,v_gross+v_credits-v_expenses-v_deductions-v_advances),
    'outstanding',greatest(0,v_gross+v_credits-v_expenses-v_deductions-v_advances-v_payments),
    'entries',(select coalesce(jsonb_agg(to_jsonb(e) order by e.entry_date desc,e.created_at desc),'[]'::jsonb) from public.driver_payroll_entries e where e.driver_id=p_driver_id and e.entry_date between v_from and v_to)
  );
end
$dn$;

alter table public.driver_payroll_entries enable row level security;
drop policy if exists "admins manage driver payroll" on public.driver_payroll_entries;
create policy "admins manage driver payroll" on public.driver_payroll_entries for all to authenticated using (public.driver_is_admin()) with check (public.driver_is_admin());
drop policy if exists "drivers read own payroll" on public.driver_payroll_entries;
create policy "drivers read own payroll" on public.driver_payroll_entries for select to authenticated using (exists(select 1 from public.driver_profiles dp where dp.id=driver_payroll_entries.driver_id and (dp.id=auth.uid() or dp.user_id=auth.uid())));

revoke all on table public.driver_payroll_entries from public, anon;
grant select on table public.driver_payroll_entries to authenticated;
revoke all on function public.admin_set_driver_salary(uuid,numeric,text,date,text) from public, anon;
revoke all on function public.admin_create_driver_payroll_entry(uuid,date,text,numeric,text,text,uuid,text) from public, anon;
revoke all on function public.admin_set_driver_payroll_entry_status(uuid,text,text) from public, anon;
revoke all on function public.admin_driver_payroll_snapshot(uuid,date,date) from public, anon;
grant execute on function public.admin_set_driver_salary(uuid,numeric,text,date,text) to authenticated;
grant execute on function public.admin_create_driver_payroll_entry(uuid,date,text,numeric,text,text,uuid,text) to authenticated;
grant execute on function public.admin_set_driver_payroll_entry_status(uuid,text,text) to authenticated;
grant execute on function public.admin_driver_payroll_snapshot(uuid,date,date) to authenticated;

create or replace function public.driver_chat_payroll_runtime_health()
returns jsonb
language sql
stable
security definer
set search_path = public
as $dn$
  select jsonb_build_object(
    'ok',to_regprocedure('public.driver_update_order_status(text,text,text)') is not null
      and to_regprocedure('public.order_chat_list(text)') is not null
      and to_regprocedure('public.order_chat_send(text,text,text,double precision,double precision)') is not null
      and to_regprocedure('public.admin_driver_payroll_snapshot(uuid,date,date)') is not null,
    'mission_status','confirmed',
    'chat_table',to_regclass('public.order_conversation_messages') is not null,
    'payroll_table',to_regclass('public.driver_payroll_entries') is not null,
    'generated_at',now()
  );
$dn$;

revoke all on function public.driver_chat_payroll_runtime_health() from public, anon;
grant execute on function public.driver_chat_payroll_runtime_health() to authenticated;

commit;
