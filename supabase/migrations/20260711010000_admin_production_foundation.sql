-- Phase 8B: Supabase production foundation for DB-backed admin operations.
-- Safe/idempotent: no data wipes, no destructive table drops, no secrets.
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.admin_expenses (id uuid primary key default gen_random_uuid(), expense_date date not null default current_date, category text not null, amount numeric(12,2) not null default 0, vat_amount numeric(12,2) not null default 0, payment_method text default 'cash', status text not null default 'draft', reference_number text, receipt_url text, notes text, created_by uuid references auth.users(id), approved_by uuid references auth.users(id), approved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.admin_adjustments (id uuid primary key default gen_random_uuid(), adjustment_type text not null, direction text not null default 'positive' check (direction in ('positive','negative')), amount numeric(12,2) not null default 0, order_id uuid, merchant_id uuid, driver_id uuid, reason text not null, notes text, status text not null default 'draft', created_by uuid references auth.users(id), approved_by uuid references auth.users(id), approved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.cod_collections (id uuid primary key default gen_random_uuid(), order_id uuid, tracking_number text, merchant_id uuid, driver_id uuid, cod_amount numeric(12,2) not null default 0, collected_amount numeric(12,2) not null default 0, reconciled_amount numeric(12,2) not null default 0, collection_date date not null default current_date, status text not null default 'pending', payment_method text default 'cash', reference_number text, notes text, created_by uuid references auth.users(id), reconciled_by uuid references auth.users(id), reconciled_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.merchant_statement_entries (id uuid primary key default gen_random_uuid(), merchant_id uuid, order_id uuid, tracking_number text, entry_date date not null default current_date, entry_type text not null, debit numeric(12,2) not null default 0, credit numeric(12,2) not null default 0, balance numeric(12,2) not null default 0, status text not null default 'posted', notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.driver_statement_entries (id uuid primary key default gen_random_uuid(), driver_id uuid, order_id uuid, tracking_number text, entry_date date not null default current_date, entry_type text not null, debit numeric(12,2) not null default 0, credit numeric(12,2) not null default 0, balance numeric(12,2) not null default 0, status text not null default 'posted', notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.import_batches (id uuid primary key default gen_random_uuid(), merchant_id uuid, file_name text, import_mode text not null default 'preview', total_rows integer not null default 0, valid_rows integer not null default 0, invalid_rows integer not null default 0, committed_rows integer not null default 0, status text not null default 'preview', created_by uuid references auth.users(id), committed_by uuid references auth.users(id), committed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.import_batch_rows (id uuid primary key default gen_random_uuid(), batch_id uuid references public.import_batches(id) on delete cascade, row_index integer not null, raw jsonb not null default '{}'::jsonb, normalized jsonb not null default '{}'::jsonb, errors text[] not null default '{}', status text not null default 'invalid', duplicate_warning text, created_order_id uuid, created_at timestamptz not null default now());
create table if not exists public.print_jobs (id uuid primary key default gen_random_uuid(), job_type text not null default 'invoice', language text not null default 'ar', order_ids uuid[] default '{}', merchant_id uuid, filters jsonb not null default '{}'::jsonb, pdf_payload jsonb not null default '{}'::jsonb, status text not null default 'queued', printed_at timestamptz, printed_by uuid references auth.users(id), created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.admin_daily_closings (id uuid primary key default gen_random_uuid(), closing_date date not null unique, total_orders integer not null default 0, delivered_orders integer not null default 0, cancelled_orders integer not null default 0, returned_orders integer not null default 0, delivery_income numeric(12,2) not null default 0, cod_total numeric(12,2) not null default 0, cod_collected numeric(12,2) not null default 0, cod_pending numeric(12,2) not null default 0, cod_reconciled numeric(12,2) not null default 0, expenses_total numeric(12,2) not null default 0, adjustments_net numeric(12,2) not null default 0, net_total numeric(12,2) not null default 0, unassigned_orders integer not null default 0, pending_review_orders integer not null default 0, unreconciled_cod numeric(12,2) not null default 0, print_jobs_pending integer not null default 0, status text not null default 'draft', source text not null default 'derived', notes text, snapshot jsonb not null default '{}'::jsonb, created_by uuid references auth.users(id), reviewed_by uuid references auth.users(id), reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.admin_audit_events (id uuid primary key default gen_random_uuid(), entity_type text not null, entity_id text, action text not null, before_data jsonb, after_data jsonb, metadata jsonb, actor_id uuid references auth.users(id), created_at timestamptz not null default now());

create index if not exists admin_expenses_expense_date_idx on public.admin_expenses(expense_date); create index if not exists admin_expenses_status_idx on public.admin_expenses(status); create index if not exists admin_expenses_category_idx on public.admin_expenses(category); create index if not exists admin_expenses_created_by_idx on public.admin_expenses(created_by);
create index if not exists admin_adjustments_status_idx on public.admin_adjustments(status); create index if not exists admin_adjustments_created_at_idx on public.admin_adjustments(created_at); create index if not exists admin_adjustments_merchant_id_idx on public.admin_adjustments(merchant_id); create index if not exists admin_adjustments_driver_id_idx on public.admin_adjustments(driver_id); create index if not exists admin_adjustments_order_id_idx on public.admin_adjustments(order_id);
create index if not exists cod_collections_order_id_idx on public.cod_collections(order_id); create index if not exists cod_collections_tracking_number_idx on public.cod_collections(tracking_number); create index if not exists cod_collections_merchant_id_idx on public.cod_collections(merchant_id); create index if not exists cod_collections_driver_id_idx on public.cod_collections(driver_id); create index if not exists cod_collections_status_idx on public.cod_collections(status); create index if not exists cod_collections_collection_date_idx on public.cod_collections(collection_date);
create index if not exists merchant_statement_entries_merchant_id_idx on public.merchant_statement_entries(merchant_id); create index if not exists merchant_statement_entries_order_id_idx on public.merchant_statement_entries(order_id); create index if not exists merchant_statement_entries_tracking_number_idx on public.merchant_statement_entries(tracking_number); create index if not exists merchant_statement_entries_entry_date_idx on public.merchant_statement_entries(entry_date); create index if not exists merchant_statement_entries_status_idx on public.merchant_statement_entries(status);
create index if not exists driver_statement_entries_driver_id_idx on public.driver_statement_entries(driver_id); create index if not exists driver_statement_entries_order_id_idx on public.driver_statement_entries(order_id); create index if not exists driver_statement_entries_tracking_number_idx on public.driver_statement_entries(tracking_number); create index if not exists driver_statement_entries_entry_date_idx on public.driver_statement_entries(entry_date); create index if not exists driver_statement_entries_status_idx on public.driver_statement_entries(status);
create index if not exists import_batches_merchant_id_idx on public.import_batches(merchant_id); create index if not exists import_batches_status_idx on public.import_batches(status); create index if not exists import_batches_created_at_idx on public.import_batches(created_at);
create index if not exists import_batch_rows_batch_id_idx on public.import_batch_rows(batch_id); create index if not exists import_batch_rows_status_idx on public.import_batch_rows(status); create index if not exists import_batch_rows_row_index_idx on public.import_batch_rows(row_index);
create index if not exists print_jobs_status_idx on public.print_jobs(status); create index if not exists print_jobs_job_type_idx on public.print_jobs(job_type); create index if not exists print_jobs_merchant_id_idx on public.print_jobs(merchant_id); create index if not exists print_jobs_created_at_idx on public.print_jobs(created_at);
create index if not exists admin_daily_closings_closing_date_idx on public.admin_daily_closings(closing_date); create index if not exists admin_daily_closings_status_idx on public.admin_daily_closings(status);
create index if not exists admin_audit_events_entity_type_idx on public.admin_audit_events(entity_type); create index if not exists admin_audit_events_entity_id_idx on public.admin_audit_events(entity_id); create index if not exists admin_audit_events_action_idx on public.admin_audit_events(action); create index if not exists admin_audit_events_actor_id_idx on public.admin_audit_events(actor_id); create index if not exists admin_audit_events_created_at_idx on public.admin_audit_events(created_at);

do $$
declare t text;
begin
  foreach t in array array['admin_expenses','admin_adjustments','cod_collections','merchant_statement_entries','driver_statement_entries','import_batches','print_jobs','admin_daily_closings'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_set_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_set_updated_at', t);
  end loop;
end $$;

create or replace function public.current_profile_role()
returns text
language sql
security definer
set search_path = public, auth
stable
as $$
  select p.role::text from public.profiles p where p.id = auth.uid() limit 1;
$$;

create or replace function public.is_admin_or_support()
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select coalesce(public.current_profile_role() in ('admin','support'), false);
$$;

do $$
declare t text;
begin
  foreach t in array array['admin_expenses','admin_adjustments','cod_collections','merchant_statement_entries','driver_statement_entries','import_batches','import_batch_rows','print_jobs','admin_daily_closings','admin_audit_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_support_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_admin_or_support())', t || '_admin_support_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_support_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_admin_or_support())', t || '_admin_support_insert', t);
    if t <> 'admin_audit_events' then
      execute format('drop policy if exists %I on public.%I', t || '_admin_support_update', t);
      execute format('create policy %I on public.%I for update to authenticated using (public.is_admin_or_support()) with check (public.is_admin_or_support())', t || '_admin_support_update', t);
    end if;
  end loop;
end $$;

create or replace view public.finance_summary as
with order_stats as (
  select coalesce(sum(coalesce(delivery_price, base_price, price, 0)),0)::numeric(12,2) total_income,
         coalesce(sum(coalesce(cod_amount,0)),0)::numeric(12,2) cod_total,
         count(*)::integer total_orders,
         count(*) filter (where status in ('active','assigned','picked_up','in_transit','out_for_delivery','pending'))::integer active_orders,
         count(*) filter (where status in ('delivered','completed'))::integer delivered_orders,
         count(*) filter (where status in ('cancelled','canceled'))::integer cancelled_orders,
         count(*) filter (where status in ('returned','return'))::integer returned_orders
  from public.orders
), expense_stats as (
  select coalesce(sum(amount + coalesce(vat_amount,0)) filter (where status is distinct from 'void'),0)::numeric(12,2) total_expenses from public.admin_expenses
), cod_stats as (
  select coalesce(sum(collected_amount),0)::numeric(12,2) cod_collected,
         coalesce(sum(case when status in ('reconciled','closed') then greatest(reconciled_amount, collected_amount) else reconciled_amount end),0)::numeric(12,2) cod_reconciled
  from public.cod_collections
), adjustment_stats as (
  select coalesce(sum(case when direction = 'negative' then -amount else amount end) filter (where status in ('approved','posted')),0)::numeric(12,2) adjustments_net from public.admin_adjustments
), merchant_stats as (
  select coalesce(sum(credit - debit) filter (where status is distinct from 'void'),0)::numeric(12,2) merchant_payable from public.merchant_statement_entries
), driver_stats as (
  select coalesce(sum(credit - debit) filter (where status is distinct from 'void'),0)::numeric(12,2) driver_payable from public.driver_statement_entries
)
select o.total_income, e.total_expenses, c.cod_collected, greatest(o.cod_total - c.cod_collected, 0)::numeric(12,2) cod_pending, c.cod_reconciled, o.cod_total,
       m.merchant_payable, d.driver_payable, (o.total_income - e.total_expenses + a.adjustments_net)::numeric(12,2) net_estimate,
       case when o.total_orders > 0 then round(o.total_income / o.total_orders, 2) else 0 end::numeric(12,2) average_order_revenue,
       o.total_orders, o.active_orders, o.delivered_orders, o.cancelled_orders, o.returned_orders
from order_stats o cross join expense_stats e cross join cod_stats c cross join adjustment_stats a cross join merchant_stats m cross join driver_stats d;

create or replace function public.get_finance_summary()
returns setof public.finance_summary
language sql
security definer
set search_path = public
stable
as $$
  select * from public.finance_summary where public.is_admin_or_support();
$$;

create or replace function public.admin_create_expense(p_expense jsonb) returns public.admin_expenses language plpgsql security definer set search_path = public as $$ declare r public.admin_expenses; begin if not public.is_admin_or_support() then raise exception 'not_authorized'; end if; if coalesce((p_expense->>'_health_check')::boolean,false) then return null; end if; insert into public.admin_expenses(expense_date,category,amount,vat_amount,payment_method,status,reference_number,receipt_url,notes,created_by) values (coalesce((p_expense->>'expense_date')::date,current_date), coalesce(nullif(p_expense->>'category',''),'other'), coalesce((p_expense->>'amount')::numeric,0), coalesce((p_expense->>'vat_amount')::numeric,0), coalesce(nullif(p_expense->>'payment_method',''),'cash'), coalesce(nullif(p_expense->>'status',''),'draft'), p_expense->>'reference_number', coalesce(p_expense->>'receipt_url',p_expense->>'attachment_url'), p_expense->>'notes', auth.uid()) returning * into r; return r; end; $$;
create or replace function public.admin_create_adjustment(p_adjustment jsonb) returns public.admin_adjustments language plpgsql security definer set search_path = public as $$ declare r public.admin_adjustments; begin if not public.is_admin_or_support() then raise exception 'not_authorized'; end if; if coalesce((p_adjustment->>'_health_check')::boolean,false) then return null; end if; insert into public.admin_adjustments(adjustment_type,direction,amount,order_id,merchant_id,driver_id,reason,notes,status,created_by) values (coalesce(nullif(p_adjustment->>'adjustment_type',''),'manual'), coalesce(nullif(p_adjustment->>'direction',''),'positive'), coalesce((p_adjustment->>'amount')::numeric,0), nullif(p_adjustment->>'order_id','')::uuid, nullif(p_adjustment->>'merchant_id','')::uuid, nullif(p_adjustment->>'driver_id','')::uuid, coalesce(nullif(p_adjustment->>'reason',''),'Manual adjustment'), p_adjustment->>'notes', coalesce(nullif(p_adjustment->>'status',''),'draft'), auth.uid()) returning * into r; return r; end; $$;
create or replace function public.admin_create_print_job(p_job jsonb) returns public.print_jobs language plpgsql security definer set search_path = public as $$ declare r public.print_jobs; begin if not public.is_admin_or_support() then raise exception 'not_authorized'; end if; if coalesce((p_job->>'_health_check')::boolean,false) then return null; end if; insert into public.print_jobs(job_type,language,order_ids,merchant_id,filters,pdf_payload,status,created_by) values (coalesce(nullif(p_job->>'job_type',''),'invoice'), coalesce(nullif(p_job->>'language',''),'ar'), coalesce(array(select jsonb_array_elements_text(coalesce(p_job->'order_ids','[]'::jsonb))::uuid), '{}'), nullif(p_job->>'merchant_id','')::uuid, coalesce(p_job->'filters','{}'::jsonb), coalesce(p_job->'pdf_payload','{}'::jsonb), coalesce(nullif(p_job->>'status',''),'queued'), auth.uid()) returning * into r; return r; end; $$;
create or replace function public.admin_mark_print_job_printed(p_job_id uuid) returns public.print_jobs language plpgsql security definer set search_path = public as $$ declare r public.print_jobs; begin if not public.is_admin_or_support() then raise exception 'not_authorized'; end if; update public.print_jobs set status='printed', printed_at=now(), printed_by=auth.uid() where id=p_job_id returning * into r; return r; end; $$;
create or replace function public.admin_save_daily_closing(p_snapshot jsonb) returns public.admin_daily_closings language plpgsql security definer set search_path = public as $$ declare r public.admin_daily_closings; d date := coalesce((p_snapshot->>'closing_date')::date,current_date); begin if not public.is_admin_or_support() then raise exception 'not_authorized'; end if; if coalesce((p_snapshot->>'_health_check')::boolean,false) then return null; end if; insert into public.admin_daily_closings(closing_date,total_orders,delivered_orders,cancelled_orders,returned_orders,delivery_income,cod_total,cod_collected,cod_pending,cod_reconciled,expenses_total,adjustments_net,net_total,unassigned_orders,pending_review_orders,unreconciled_cod,print_jobs_pending,status,source,notes,snapshot,created_by,reviewed_by,reviewed_at) values (d,coalesce((p_snapshot->>'total_orders')::int,0),coalesce((p_snapshot->>'delivered_orders')::int,0),coalesce((p_snapshot->>'cancelled_orders')::int,0),coalesce((p_snapshot->>'returned_orders')::int,0),coalesce((p_snapshot->>'delivery_income')::numeric,0),coalesce((p_snapshot->>'cod_total')::numeric,0),coalesce((p_snapshot->>'cod_collected')::numeric,0),coalesce((p_snapshot->>'cod_pending')::numeric,0),coalesce((p_snapshot->>'cod_reconciled')::numeric,0),coalesce((p_snapshot->>'expenses_total')::numeric,0),coalesce((p_snapshot->>'adjustments_net')::numeric,0),coalesce((p_snapshot->>'net_total')::numeric,0),coalesce((p_snapshot->>'unassigned_orders')::int,0),coalesce((p_snapshot->>'pending_review_orders')::int,0),coalesce((p_snapshot->>'unreconciled_cod')::numeric,0),coalesce((p_snapshot->>'print_jobs_pending')::int,0),coalesce(nullif(p_snapshot->>'status',''),'draft'),'db',p_snapshot->>'notes',p_snapshot,auth.uid(),auth.uid(),now()) on conflict (closing_date) do update set total_orders=excluded.total_orders, delivered_orders=excluded.delivered_orders, cancelled_orders=excluded.cancelled_orders, returned_orders=excluded.returned_orders, delivery_income=excluded.delivery_income, cod_total=excluded.cod_total, cod_collected=excluded.cod_collected, cod_pending=excluded.cod_pending, cod_reconciled=excluded.cod_reconciled, expenses_total=excluded.expenses_total, adjustments_net=excluded.adjustments_net, net_total=excluded.net_total, unassigned_orders=excluded.unassigned_orders, pending_review_orders=excluded.pending_review_orders, unreconciled_cod=excluded.unreconciled_cod, print_jobs_pending=excluded.print_jobs_pending, status=excluded.status, source='db', notes=excluded.notes, snapshot=excluded.snapshot, reviewed_by=auth.uid(), reviewed_at=now() returning * into r; return r; end; $$;
create or replace function public.admin_create_audit_event(p_event jsonb) returns public.admin_audit_events language plpgsql security definer set search_path = public as $$ declare r public.admin_audit_events; begin if not public.is_admin_or_support() then raise exception 'not_authorized'; end if; if coalesce((p_event->>'_health_check')::boolean,false) then return null; end if; insert into public.admin_audit_events(entity_type,entity_id,action,before_data,after_data,metadata,actor_id) values (coalesce(nullif(p_event->>'entity_type',''),'admin'), p_event->>'entity_id', coalesce(nullif(p_event->>'action',''),'event'), p_event->'before_data', p_event->'after_data', p_event->'metadata', auth.uid()) returning * into r; return r; end; $$;

grant select on public.finance_summary to authenticated;
grant execute on function public.get_finance_summary() to authenticated;
grant execute on function public.admin_create_expense(jsonb), public.admin_create_adjustment(jsonb), public.admin_create_print_job(jsonb), public.admin_mark_print_job_printed(uuid), public.admin_save_daily_closing(jsonb), public.admin_create_audit_event(jsonb) to authenticated;
