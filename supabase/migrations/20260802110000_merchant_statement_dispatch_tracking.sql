begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.merchant_statement_dispatch_log (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  channel text not null default 'whatsapp_pdf'
    check (channel in ('whatsapp_pdf', 'whatsapp_summary', 'pdf_only')),
  period_label text,
  sent_at timestamptz not null default now(),
  sent_by uuid references auth.users(id),
  resend_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists merchant_statement_dispatch_log_batch_order_uidx
  on public.merchant_statement_dispatch_log(batch_id, order_id);
create index if not exists merchant_statement_dispatch_log_merchant_idx
  on public.merchant_statement_dispatch_log(merchant_id, sent_at desc);
create index if not exists merchant_statement_dispatch_log_order_idx
  on public.merchant_statement_dispatch_log(order_id, sent_at desc);
create index if not exists merchant_statement_dispatch_log_sent_by_idx
  on public.merchant_statement_dispatch_log(sent_by, sent_at desc);

alter table public.merchant_statement_dispatch_log enable row level security;

drop policy if exists merchant_statement_dispatch_log_admin_support_select
  on public.merchant_statement_dispatch_log;
create policy merchant_statement_dispatch_log_admin_support_select
  on public.merchant_statement_dispatch_log
  for select
  to authenticated
  using (public.is_admin_or_support());

revoke all on table public.merchant_statement_dispatch_log from anon, authenticated;
grant select on table public.merchant_statement_dispatch_log to authenticated;
grant all on table public.merchant_statement_dispatch_log to service_role;

create or replace function public.admin_get_merchant_statement_dispatch_status(
  p_merchant_id uuid
)
returns table (
  order_id uuid,
  latest_sent_at timestamptz,
  sent_count bigint,
  latest_batch_id uuid,
  latest_sent_by uuid,
  last_resend_reason text,
  latest_channel text
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
stable
as $$
begin
  if not public.is_admin_or_support() then
    raise exception using
      errcode = '42501',
      message = 'merchant_statement_dispatch_not_authorized';
  end if;

  if p_merchant_id is null then
    raise exception using
      errcode = '22023',
      message = 'merchant_statement_dispatch_merchant_required';
  end if;

  return query
  with ranked as (
    select
      dispatch.order_id,
      dispatch.sent_at,
      count(*) over (partition by dispatch.order_id)::bigint as dispatch_count,
      dispatch.batch_id,
      dispatch.sent_by,
      dispatch.resend_reason,
      dispatch.channel,
      row_number() over (
        partition by dispatch.order_id
        order by dispatch.sent_at desc, dispatch.created_at desc, dispatch.id desc
      ) as row_rank
    from public.merchant_statement_dispatch_log dispatch
    where dispatch.merchant_id = p_merchant_id
  )
  select
    ranked.order_id,
    ranked.sent_at,
    ranked.dispatch_count,
    ranked.batch_id,
    ranked.sent_by,
    ranked.resend_reason,
    ranked.channel
  from ranked
  where ranked.row_rank = 1;
end;
$$;

create or replace function public.admin_confirm_merchant_statement_dispatch(
  p_merchant_id uuid,
  p_order_ids uuid[],
  p_period_label text default null,
  p_channel text default 'whatsapp_pdf',
  p_resend_reason text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_order_ids uuid[];
  v_order_count integer;
  v_matching_count integer;
  v_previously_sent_count integer;
  v_batch_id uuid := gen_random_uuid();
  v_sent_at timestamptz := clock_timestamp();
  v_actor uuid := auth.uid();
  v_channel text := lower(coalesce(nullif(btrim(p_channel), ''), 'whatsapp_pdf'));
  v_reason text := nullif(btrim(coalesce(p_resend_reason, '')), '');
begin
  if not public.is_admin_or_support() then
    raise exception using
      errcode = '42501',
      message = 'merchant_statement_dispatch_not_authorized';
  end if;

  if p_merchant_id is null then
    raise exception using
      errcode = '22023',
      message = 'merchant_statement_dispatch_merchant_required';
  end if;

  if v_channel not in ('whatsapp_pdf', 'whatsapp_summary', 'pdf_only') then
    raise exception using
      errcode = '22023',
      message = 'merchant_statement_dispatch_channel_invalid';
  end if;

  select array_agg(candidate.order_id order by candidate.order_id)
  into v_order_ids
  from (
    select distinct input_id as order_id
    from unnest(coalesce(p_order_ids, '{}'::uuid[])) input_id
    where input_id is not null
  ) candidate;

  v_order_count := coalesce(cardinality(v_order_ids), 0);

  if v_order_count = 0 then
    raise exception using
      errcode = '22023',
      message = 'merchant_statement_dispatch_orders_required';
  end if;

  if v_order_count > 500 then
    raise exception using
      errcode = '54000',
      message = 'merchant_statement_dispatch_too_many_orders';
  end if;

  perform 1
  from public.merchants merchant
  where merchant.id = p_merchant_id
  for share;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'merchant_statement_dispatch_merchant_not_found';
  end if;

  select count(*)::integer
  into v_matching_count
  from public.orders order_row
  where order_row.id = any(v_order_ids)
    and order_row.merchant_id = p_merchant_id;

  if v_matching_count <> v_order_count then
    raise exception using
      errcode = '23514',
      message = 'merchant_statement_dispatch_order_ownership_mismatch',
      detail = format('Expected %s orders owned by merchant; matched %s.', v_order_count, v_matching_count);
  end if;

  select count(distinct dispatch.order_id)::integer
  into v_previously_sent_count
  from public.merchant_statement_dispatch_log dispatch
  where dispatch.order_id = any(v_order_ids)
    and dispatch.merchant_id = p_merchant_id;

  if v_previously_sent_count > 0 and v_reason is null then
    raise exception using
      errcode = '23505',
      message = 'merchant_statement_resend_reason_required',
      detail = format('%s selected orders were already transferred to this merchant.', v_previously_sent_count);
  end if;

  if not coalesce(p_dry_run, false) then
    insert into public.merchant_statement_dispatch_log (
      batch_id,
      merchant_id,
      order_id,
      channel,
      period_label,
      sent_at,
      sent_by,
      resend_reason,
      metadata
    )
    select
      v_batch_id,
      p_merchant_id,
      order_id,
      v_channel,
      nullif(btrim(coalesce(p_period_label, '')), ''),
      v_sent_at,
      v_actor,
      v_reason,
      coalesce(p_metadata, '{}'::jsonb)
    from unnest(v_order_ids) order_id;

    insert into public.admin_audit_events (
      entity_type,
      entity_id,
      action,
      after_data,
      metadata,
      actor_id
    )
    values (
      'merchant_statement_dispatch',
      v_batch_id::text,
      case when v_previously_sent_count > 0
        then 'merchant_statement_resent'
        else 'merchant_statement_sent'
      end,
      jsonb_build_object(
        'merchant_id', p_merchant_id,
        'order_ids', to_jsonb(v_order_ids),
        'order_count', v_order_count,
        'channel', v_channel,
        'period_label', nullif(btrim(coalesce(p_period_label, '')), ''),
        'sent_at', v_sent_at,
        'resend_reason', v_reason
      ),
      jsonb_build_object(
        'source', 'admin_merchant_statements_center',
        'previously_sent_count', v_previously_sent_count
      ) || coalesce(p_metadata, '{}'::jsonb),
      v_actor
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'dry_run', coalesce(p_dry_run, false),
    'batch_id', v_batch_id,
    'merchant_id', p_merchant_id,
    'order_count', v_order_count,
    'previously_sent_count', v_previously_sent_count,
    'resend', v_previously_sent_count > 0,
    'sent_at', v_sent_at,
    'channel', v_channel
  );
end;
$$;

create or replace function public.admin_merchant_statement_dispatch_health()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select jsonb_build_object(
    'ok',
      to_regclass('public.merchant_statement_dispatch_log') is not null
      and to_regprocedure('public.admin_get_merchant_statement_dispatch_status(uuid)') is not null
      and to_regprocedure('public.admin_confirm_merchant_statement_dispatch(uuid,uuid[],text,text,text,jsonb,boolean)') is not null,
    'dispatch_table', to_regclass('public.merchant_statement_dispatch_log') is not null,
    'status_rpc', to_regprocedure('public.admin_get_merchant_statement_dispatch_status(uuid)') is not null,
    'confirm_rpc', to_regprocedure('public.admin_confirm_merchant_statement_dispatch(uuid,uuid[],text,text,text,jsonb,boolean)') is not null,
    'duplicate_guard', true,
    'resend_requires_reason', true,
    'confirmed_send_only', true
  );
$$;

revoke all on function public.admin_get_merchant_statement_dispatch_status(uuid) from public, anon;
revoke all on function public.admin_confirm_merchant_statement_dispatch(uuid, uuid[], text, text, text, jsonb, boolean) from public, anon;
revoke all on function public.admin_merchant_statement_dispatch_health() from public, anon;

grant execute on function public.admin_get_merchant_statement_dispatch_status(uuid) to authenticated, service_role;
grant execute on function public.admin_confirm_merchant_statement_dispatch(uuid, uuid[], text, text, text, jsonb, boolean) to authenticated, service_role;
grant execute on function public.admin_merchant_statement_dispatch_health() to authenticated, service_role;

select pg_notify('pgrst', 'reload schema');

commit;
