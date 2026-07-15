-- =========================================================
-- DAY NIGHT — LEGACY DRIVER UUID DEFAULT COMPATIBILITY
-- Must run after enum compatibility and before primary driver provisioning.
-- Existing legacy tables may have NOT NULL UUID id columns without defaults.
-- =========================================================

create extension if not exists pgcrypto;

do $dn$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='driver_profiles' and column_name='id'
  ) then
    alter table public.driver_profiles alter column id set default gen_random_uuid();
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='driver_locations' and column_name='id'
  ) then
    alter table public.driver_locations alter column id set default gen_random_uuid();
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='driver_location_history' and column_name='id'
  ) then
    alter table public.driver_location_history alter column id set default gen_random_uuid();
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='driver_events' and column_name='id'
  ) then
    alter table public.driver_events alter column id set default gen_random_uuid();
  end if;
end
$dn$;

-- Backfill nullable legacy identifiers if any older migration left them empty.
update public.driver_profiles set id=gen_random_uuid() where id is null;
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
  cols.is_nullable
from information_schema.columns cols
where cols.table_schema='public'
  and cols.table_name in ('driver_profiles','driver_locations','driver_location_history','driver_events')
  and cols.column_name='id'
order by cols.table_name;
