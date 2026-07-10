-- DAY NIGHT admin operations verification script.
-- Read-only checks for Supabase SQL Editor. Do not paste secrets here.

select 'finance_summary view' as check_name, to_regclass('public.finance_summary') is not null as exists;
select 'admin_daily_closings table' as check_name, to_regclass('public.admin_daily_closings') is not null as exists;
select 'print_jobs table' as check_name, to_regclass('public.print_jobs') is not null as exists;

select * from public.finance_summary limit 1;
select public.get_finance_summary();

select count(*) from public.orders;
select count(*) from public.admin_daily_closings;
select count(*) from public.print_jobs;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'admin_daily_closings',
    'admin_expenses',
    'admin_adjustments',
    'cod_collections',
    'print_jobs',
    'admin_audit_events'
  )
order by tablename, policyname;
