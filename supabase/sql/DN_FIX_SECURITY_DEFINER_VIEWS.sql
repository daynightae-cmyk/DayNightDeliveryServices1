-- -----------------------------------------------------------------------------
-- DAY NIGHT DELIVERY SERVICES
-- Fix Supabase Advisor: Security Definer View warnings
-- -----------------------------------------------------------------------------
-- Purpose:
--   Convert public website/AI helper views to SECURITY INVOKER so Supabase RLS
--   is evaluated as the querying role instead of the view owner.
--
-- Apply in Supabase SQL Editor, then run the verification query at the bottom.
-- -----------------------------------------------------------------------------

begin;

do $$
declare
  target_view text;
begin
  foreach target_view in array array[
    'public.daynight_public_ai_agent_pack',
    'public.daynight_public_website_content_pack',
    'public.daynight_final_extra_data_summary'
  ]
  loop
    if to_regclass(target_view) is not null then
      execute format('alter view %s set (security_invoker = true)', target_view);
      raise notice 'Fixed SECURITY DEFINER warning for view: %', target_view;
    else
      raise notice 'View not found, skipped: %', target_view;
    end if;
  end loop;
end $$;

commit;

-- -----------------------------------------------------------------------------
-- Verification 1: show security settings for the 3 target views.
-- Expected: reloptions contains security_invoker=true for each existing view.
-- -----------------------------------------------------------------------------
select
  n.nspname as schema_name,
  c.relname as view_name,
  c.reloptions
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('v', 'm')
  and c.relname in (
    'daynight_public_ai_agent_pack',
    'daynight_public_website_content_pack',
    'daynight_final_extra_data_summary'
  )
order by c.relname;

-- -----------------------------------------------------------------------------
-- Verification 2: list any remaining public views without security_invoker=true.
-- Expected after fixing all Advisor items: no rows for the flagged views.
-- -----------------------------------------------------------------------------
select
  n.nspname as schema_name,
  c.relname as view_name,
  c.reloptions
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
  and not coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true']
order by c.relname;
