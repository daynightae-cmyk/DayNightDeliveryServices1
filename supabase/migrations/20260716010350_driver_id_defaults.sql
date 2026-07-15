-- =========================================================
-- DAY NIGHT — LEGACY DRIVER UUID DEFAULT COMPATIBILITY
-- Handles both supported identity models:
-- 1) shared identity: driver_profiles.id references profiles.id
-- 2) independent driver id with driver_profiles.user_id referencing auth.users.id
-- =========================================================

create extension if not exists pgcrypto;

do $dn$
declare
  v_shared_driver_identity boolean := false;
begin
  select exists (
    select 1
    from pg_constraint con
    join pg_class child on child.oid=con.conrelid
    join pg_namespace child_ns on child_ns.oid=child.relnamespace
    join pg_class parent on parent.oid=con.confrelid
    join pg_namespace parent_ns on parent_ns.oid=parent.relnamespace
    where con.contype='f'
      and child_ns.nspname='public'
      and child.relname='driver_profiles'
      and parent_ns.nspname='public'
      and parent.relname='profiles'
  ) into v_shared_driver_identity;

  if v_shared_driver_identity then
    -- Production legacy schema: driver id must be an existing profiles.id.
    alter table public.driver_profiles alter column id drop default;
    update public.driver_profiles
    set user_id=id
    where user_id is null
      and exists(select 1 from auth.users au where au.id=driver_profiles.id);
  else
    alter table public.driver_profiles alter column id set default gen_random_uuid();
    update public.driver_profiles set id=gen_random_uuid() where id is null;
  end if;

  alter table public.driver_locations alter column id set default gen_random_uuid();
  alter table public.driver_location_history alter column id set default gen_random_uuid();
  if to_regclass('public.driver_events') is not null then
    alter table public.driver_events alter column id set default gen_random_uuid();
  end if;
end
$dn$;

update public.driver_locations set id=gen_random_uuid() where id is null;
update public.driver_location_history set id=gen_random_uuid() where id is null;
update public.driver_events set id=gen_random_uuid() where id is null;

create unique index if not exists driver_profiles_id_uidx on public.driver_profiles(id);
create unique index if not exists driver_locations_id_uidx on public.driver_locations(id);
create unique index if not exists driver_location_history_id_uidx on public.driver_location_history(id);
create unique index if not exists driver_events_id_uidx on public.driver_events(id);

select
  cols.table_name,
  cols.column_name,
  cols.column_default,
  cols.is_nullable,
  exists(
    select 1
    from pg_constraint con
    join pg_class child on child.oid=con.conrelid
    join pg_class parent on parent.oid=con.confrelid
    where child.relname=cols.table_name
      and parent.relname='profiles'
      and con.contype='f'
  ) as references_profiles
from information_schema.columns cols
where cols.table_schema='public'
  and cols.table_name in ('driver_profiles','driver_locations','driver_location_history','driver_events')
  and cols.column_name='id'
order by cols.table_name;
