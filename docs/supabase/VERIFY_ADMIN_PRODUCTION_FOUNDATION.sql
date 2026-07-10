-- Phase 8B verification. No secrets. No destructive statements.
with required_tables(name) as (values
 ('admin_expenses'),('admin_adjustments'),('cod_collections'),('merchant_statement_entries'),('driver_statement_entries'),('import_batches'),('import_batch_rows'),('print_jobs'),('admin_daily_closings'),('admin_audit_events')
)
select name, to_regclass('public.' || name) is not null as exists from required_tables order by name;

select 'finance_summary' as object_name, to_regclass('public.finance_summary') is not null as exists;

select p.proname as rpc_name, pg_get_function_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('get_finance_summary','admin_create_expense','admin_create_adjustment','admin_create_print_job','admin_mark_print_job_printed','admin_save_daily_closing','admin_create_audit_event','current_profile_role','is_admin_or_support')
order by p.proname;

select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('admin_expenses','admin_adjustments','cod_collections','merchant_statement_entries','driver_statement_entries','import_batches','import_batch_rows','print_jobs','admin_daily_closings','admin_audit_events')
order by c.relname;

select 'admin_expenses' as table_name, count(*) from public.admin_expenses union all
select 'admin_adjustments', count(*) from public.admin_adjustments union all
select 'cod_collections', count(*) from public.cod_collections union all
select 'print_jobs', count(*) from public.print_jobs union all
select 'admin_daily_closings', count(*) from public.admin_daily_closings union all
select 'admin_audit_events', count(*) from public.admin_audit_events;

select auth.uid() as current_auth_uid, public.current_profile_role() as current_profile_role, public.is_admin_or_support() as is_admin_or_support;
