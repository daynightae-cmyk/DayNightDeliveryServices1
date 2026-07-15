-- =========================================================
-- DAY NIGHT — LEGACY DRIVER ENUM COMPATIBILITY
-- Must run after 20260716010000_driver_operations_final.sql
-- and before 20260716010500_provision_primary_driver.sql.
--
-- This migration only extends existing enum types. It does not use the new
-- values in the same transaction, so PostgreSQL can commit them safely before
-- the provisioning migration runs.
-- =========================================================

do $dn$
declare
  v_status_schema text;
  v_status_type text;
  v_shift_schema text;
  v_shift_type text;
  v_value text;
begin
  -- Detect the exact enum backing driver_profiles.status in this project.
  select type_ns.nspname, typ.typname
    into v_status_schema, v_status_type
  from pg_attribute att
  join pg_class cls on cls.oid = att.attrelid
  join pg_namespace table_ns on table_ns.oid = cls.relnamespace
  join pg_type typ on typ.oid = att.atttypid
  join pg_namespace type_ns on type_ns.oid = typ.typnamespace
  where table_ns.nspname = 'public'
    and cls.relname = 'driver_profiles'
    and att.attname = 'status'
    and att.attnum > 0
    and not att.attisdropped
    and typ.typtype = 'e'
  limit 1;

  if v_status_type is not null then
    foreach v_value in array array['active','inactive','suspended'] loop
      execute format(
        'alter type %I.%I add value if not exists %L',
        v_status_schema,
        v_status_type,
        v_value
      );
    end loop;
  end if;

  -- Detect an enum-backed shift_status too, if the older schema uses one.
  select type_ns.nspname, typ.typname
    into v_shift_schema, v_shift_type
  from pg_attribute att
  join pg_class cls on cls.oid = att.attrelid
  join pg_namespace table_ns on table_ns.oid = cls.relnamespace
  join pg_type typ on typ.oid = att.atttypid
  join pg_namespace type_ns on type_ns.oid = typ.typnamespace
  where table_ns.nspname = 'public'
    and cls.relname = 'driver_profiles'
    and att.attname = 'shift_status'
    and att.attnum > 0
    and not att.attisdropped
    and typ.typtype = 'e'
  limit 1;

  if v_shift_type is not null then
    foreach v_value in array array['offline','available','busy','paused'] loop
      execute format(
        'alter type %I.%I add value if not exists %L',
        v_shift_schema,
        v_shift_type,
        v_value
      );
    end loop;
  end if;
end
$dn$;

-- Read-only verification. New enum values are inspected as catalog text only.
select
  cols.column_name,
  cols.udt_schema,
  cols.udt_name,
  coalesce(
    (
      select jsonb_agg(en.enumlabel order by en.enumsortorder)
      from pg_type typ
      join pg_namespace ns on ns.oid = typ.typnamespace
      join pg_enum en on en.enumtypid = typ.oid
      where ns.nspname = cols.udt_schema
        and typ.typname = cols.udt_name
    ),
    '[]'::jsonb
  ) as enum_values
from information_schema.columns cols
where cols.table_schema = 'public'
  and cols.table_name = 'driver_profiles'
  and cols.column_name in ('status','shift_status')
order by cols.column_name;
