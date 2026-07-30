-- DAY NIGHT DELIVERY SERVICES
-- P1 production runtime reconciliation repair.
-- Backfills only missing authoritative rows from existing delivered-order snapshots,
-- preserves historical provider errors, and reports only unresolved current errors.

begin;

create or replace function public.admin_reconcile_authoritative_finance()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_settlements integer := 0;
  v_merchant_accounts integer := 0;
  v_company_accounts integer := 0;
  v_cod integer := 0;
  v_merchant_statements integer := 0;
  v_driver_statements integer := 0;
  v_health jsonb;
  v_now timestamptz := now();
begin
  if not public.is_admin_or_support() then
    raise exception 'not_authorized';
  end if;

  insert into public.order_financial_settlements (
    order_id,
    order_reference,
    merchant_id,
    coupon_number,
    goods_value,
    delivery_fee,
    discount_amount,
    delivery_fee_mode,
    customer_total,
    collected_amount,
    merchant_due,
    company_revenue,
    currency,
    posted_at,
    posted_by,
    source_status,
    snapshot
  )
  select
    o.id::text,
    coalesce(
      nullif(to_jsonb(o)->>'tracking_number', ''),
      nullif(to_jsonb(o)->>'invoice_number', ''),
      nullif(to_jsonb(o)->>'coupon_number', ''),
      o.id::text
    ),
    o.merchant_id,
    nullif(to_jsonb(o)->>'coupon_number', ''),
    coalesce(o.goods_value, 0),
    coalesce(o.delivery_fee, 0),
    coalesce(o.discount_amount, 0),
    coalesce(nullif(o.delivery_fee_mode, ''), 'customer_pays'),
    coalesce(o.customer_total, 0),
    coalesce(o.collected_amount, 0),
    coalesce(o.merchant_due, 0),
    coalesce(o.company_revenue, 0),
    coalesce(nullif(to_jsonb(o)->>'currency', ''), 'AED'),
    coalesce(
      o.financial_posted_at,
      nullif(to_jsonb(o)->>'delivered_at', '')::timestamptz,
      o.updated_at,
      o.created_at,
      v_now
    ),
    auth.uid(),
    lower(replace(replace(coalesce(o.status::text, 'delivered'), '-', '_'), ' ', '_')),
    to_jsonb(o)
  from public.orders o
  where lower(replace(replace(coalesce(o.status::text, ''), '-', '_'), ' ', '_'))
      in ('delivered', 'completed', 'complete')
    and not exists (
      select 1
      from public.order_financial_settlements s
      where s.order_id = o.id::text
    )
  on conflict (order_id) do nothing;
  get diagnostics v_settlements = row_count;

  insert into public.financial_account_entries (
    order_id,
    order_reference,
    merchant_id,
    account_type,
    entry_type,
    direction,
    amount,
    currency,
    notes,
    posted_at
  )
  select
    s.order_id,
    s.order_reference,
    s.merchant_id,
    'merchant',
    'delivered_order_settlement',
    case when s.merchant_due < 0 then 'debit' else 'credit' end,
    abs(s.merchant_due),
    s.currency,
    'Authoritative merchant settlement reconciled from delivered-order snapshot',
    s.posted_at
  from public.order_financial_settlements s
  where s.merchant_id is not null
    and not exists (
      select 1
      from public.financial_account_entries e
      where e.order_id = s.order_id
        and e.account_type = 'merchant'
        and e.entry_type = 'delivered_order_settlement'
    )
  on conflict (order_id, account_type, entry_type) do nothing;
  get diagnostics v_merchant_accounts = row_count;

  insert into public.financial_account_entries (
    order_id,
    order_reference,
    merchant_id,
    account_type,
    entry_type,
    direction,
    amount,
    currency,
    notes,
    posted_at
  )
  select
    s.order_id,
    s.order_reference,
    s.merchant_id,
    'company',
    'delivered_order_settlement',
    'credit',
    greatest(s.company_revenue, 0),
    s.currency,
    'Authoritative DAY NIGHT revenue reconciled from delivered-order snapshot',
    s.posted_at
  from public.order_financial_settlements s
  where not exists (
    select 1
    from public.financial_account_entries e
    where e.order_id = s.order_id
      and e.account_type = 'company'
      and e.entry_type = 'delivered_order_settlement'
  )
  on conflict (order_id, account_type, entry_type) do nothing;
  get diagnostics v_company_accounts = row_count;

  insert into public.cod_collections (
    order_id,
    tracking_number,
    merchant_id,
    driver_id,
    cod_amount,
    collected_amount,
    reconciled_amount,
    collection_date,
    status,
    payment_method,
    notes,
    created_by,
    created_at,
    updated_at
  )
  select
    o.id,
    coalesce(
      nullif(to_jsonb(o)->>'tracking_number', ''),
      nullif(to_jsonb(o)->>'invoice_number', ''),
      nullif(to_jsonb(o)->>'coupon_number', ''),
      o.id::text
    ),
    o.merchant_id,
    public.dn_safe_uuid(coalesce(
      nullif(to_jsonb(o)->>'assigned_driver_id', ''),
      nullif(to_jsonb(o)->>'driver_id', '')
    )),
    greatest(coalesce(o.customer_total, 0), 0),
    greatest(coalesce(nullif(o.collected_amount, 0), o.customer_total, 0), 0),
    0,
    coalesce(
      nullif(to_jsonb(o)->>'delivered_at', '')::timestamptz,
      o.updated_at,
      o.created_at,
      v_now
    )::date,
    'collected',
    'cod',
    'Authoritative COD collection reconciled from delivered-order snapshot',
    auth.uid(),
    v_now,
    v_now
  from public.orders o
  where lower(replace(replace(coalesce(o.status::text, ''), '-', '_'), ' ', '_'))
      in ('delivered', 'completed', 'complete')
    and lower(coalesce(o.payment_method::text, '')) = 'cod'
    and coalesce(o.customer_total, 0) > 0
    and not exists (
      select 1 from public.cod_collections c where c.order_id = o.id
    )
  on conflict do nothing;
  get diagnostics v_cod = row_count;

  insert into public.merchant_statement_entries (
    merchant_id,
    order_id,
    tracking_number,
    entry_date,
    entry_type,
    debit,
    credit,
    balance,
    status,
    notes,
    created_by,
    created_at,
    updated_at
  )
  select
    o.merchant_id,
    o.id,
    coalesce(
      nullif(to_jsonb(o)->>'tracking_number', ''),
      nullif(to_jsonb(o)->>'invoice_number', ''),
      nullif(to_jsonb(o)->>'coupon_number', ''),
      o.id::text
    ),
    coalesce(
      nullif(to_jsonb(o)->>'delivered_at', '')::timestamptz,
      o.updated_at,
      o.created_at,
      v_now
    )::date,
    'order_cod',
    case when coalesce(o.merchant_due, 0) < 0 then abs(o.merchant_due) else 0 end,
    case when coalesce(o.merchant_due, 0) >= 0 then o.merchant_due else 0 end,
    coalesce(o.merchant_due, 0),
    'posted',
    'Authoritative merchant statement reconciled from delivered-order snapshot',
    auth.uid(),
    v_now,
    v_now
  from public.orders o
  where lower(replace(replace(coalesce(o.status::text, ''), '-', '_'), ' ', '_'))
      in ('delivered', 'completed', 'complete')
    and o.merchant_id is not null
    and not exists (
      select 1 from public.merchant_statement_entries m where m.order_id = o.id
    )
  on conflict do nothing;
  get diagnostics v_merchant_statements = row_count;

  insert into public.driver_statement_entries (
    driver_id,
    order_id,
    tracking_number,
    entry_date,
    entry_type,
    debit,
    credit,
    balance,
    status,
    notes,
    created_by,
    created_at,
    updated_at
  )
  select
    public.dn_safe_uuid(coalesce(
      nullif(to_jsonb(o)->>'assigned_driver_id', ''),
      nullif(to_jsonb(o)->>'driver_id', '')
    )),
    o.id,
    coalesce(
      nullif(to_jsonb(o)->>'tracking_number', ''),
      nullif(to_jsonb(o)->>'invoice_number', ''),
      nullif(to_jsonb(o)->>'coupon_number', ''),
      o.id::text
    ),
    coalesce(
      nullif(to_jsonb(o)->>'delivered_at', '')::timestamptz,
      o.updated_at,
      o.created_at,
      v_now
    )::date,
    'delivery_earning',
    0,
    greatest(public.dn_safe_numeric(to_jsonb(o)->>'driver_earning', 0), 0),
    greatest(public.dn_safe_numeric(to_jsonb(o)->>'driver_earning', 0), 0),
    'posted',
    'Authoritative driver statement reconciled from delivered-order snapshot',
    auth.uid(),
    v_now,
    v_now
  from public.orders o
  where lower(replace(replace(coalesce(o.status::text, ''), '-', '_'), ' ', '_'))
      in ('delivered', 'completed', 'complete')
    and public.dn_safe_uuid(coalesce(
      nullif(to_jsonb(o)->>'assigned_driver_id', ''),
      nullif(to_jsonb(o)->>'driver_id', '')
    )) is not null
    and not exists (
      select 1 from public.driver_statement_entries d where d.order_id = o.id
    )
  on conflict do nothing;
  get diagnostics v_driver_statements = row_count;

  v_health := public.admin_finance_reconciliation_health();

  insert into public.admin_audit_events(
    entity_type,
    action,
    after_data,
    actor_id,
    created_at
  ) values (
    'finance_runtime_reconciliation',
    'backfill_missing_authoritative_rows',
    jsonb_build_object(
      'settlements_inserted', v_settlements,
      'merchant_account_entries_inserted', v_merchant_accounts,
      'company_account_entries_inserted', v_company_accounts,
      'cod_rows_inserted', v_cod,
      'merchant_statement_rows_inserted', v_merchant_statements,
      'driver_statement_rows_inserted', v_driver_statements,
      'health', v_health
    ),
    auth.uid(),
    v_now
  );

  return jsonb_build_object(
    'ok', coalesce((v_health->>'ok')::boolean, false),
    'settlements_inserted', v_settlements,
    'merchant_account_entries_inserted', v_merchant_accounts,
    'company_account_entries_inserted', v_company_accounts,
    'cod_rows_inserted', v_cod,
    'merchant_statement_rows_inserted', v_merchant_statements,
    'driver_statement_rows_inserted', v_driver_statements,
    'health', v_health,
    'reconciled_at', v_now
  );
end;
$$;

revoke all on function public.admin_reconcile_authoritative_finance() from public, anon;
grant execute on function public.admin_reconcile_authoritative_finance() to authenticated;

create or replace function public.international_tracking_runtime_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_tables jsonb;
  v_tables_ok boolean;
  v_shipments bigint := 0;
  v_active bigint := 0;
  v_unregistered bigint := 0;
  v_stale bigint := 0;
  v_events bigint := 0;
  v_webhooks bigint := 0;
  v_valid_webhooks bigint := 0;
  v_invalid_webhooks bigint := 0;
  v_api_errors bigint := 0;
  v_quota jsonb := '{}'::jsonb;
  v_quota_fresh boolean := false;
  v_quota_available boolean := false;
  v_database_ok boolean;
begin
  if not public.daynight_is_admin_or_support() then
    raise exception 'not_authorized';
  end if;

  v_tables := jsonb_build_object(
    'international_shipments', to_regclass('public.international_shipments') is not null,
    'international_tracking_events', to_regclass('public.international_tracking_events') is not null,
    'track17_webhook_logs', to_regclass('public.track17_webhook_logs') is not null,
    'track17_api_logs', to_regclass('public.track17_api_logs') is not null,
    'track17_quota_cache', to_regclass('public.track17_quota_cache') is not null
  );
  v_tables_ok := not exists (
    select 1 from jsonb_each_text(v_tables) item where item.value <> 'true'
  );

  if not v_tables_ok then
    return jsonb_build_object(
      'ok', false,
      'database_ok', false,
      'tables', v_tables,
      'reason', 'international_tracking_migration_required',
      'edge_functions_expected', jsonb_build_array(
        'register-track17-shipment',
        'sync-track17-shipment',
        'track17-admin',
        'track17-webhook',
        'public-international-tracking'
      ),
      'secret_expected', 'TRACK17_API_KEY',
      'checked_at', now()
    );
  end if;

  select count(*),
         count(*) filter (where normalized_status not in ('delivered','expired') and tracking_stopped_at is null),
         count(*) filter (where registered_at is null),
         count(*) filter (
           where normalized_status not in ('delivered','expired')
             and tracking_stopped_at is null
             and coalesce(last_webhook_at, last_synced_at, registered_at, created_at) < now() - interval '24 hours'
         )
  into v_shipments, v_active, v_unregistered, v_stale
  from public.international_shipments;

  select count(*) into v_events from public.international_tracking_events;

  select count(*),
         count(*) filter (where signature_valid),
         count(*) filter (where not signature_valid)
  into v_webhooks, v_valid_webhooks, v_invalid_webhooks
  from public.track17_webhook_logs
  where received_at >= now() - interval '24 hours';

  -- Historical failures are retained. A provider error is current only when no
  -- later successful call exists for the same operation and shipment/tracking key.
  select count(*)
  into v_api_errors
  from public.track17_api_logs failed
  where failed.created_at >= now() - interval '24 hours'
    and failed.operation in (
      'register',
      'gettrackinfo',
      'gettrackinfo_after_register',
      'getquota',
      'stoptrack',
      'retrack',
      'push'
    )
    and (
      failed.error_code is not null
      or failed.error_message is not null
      or coalesce(failed.rejected, 0) > 0
    )
    and not exists (
      select 1
      from public.track17_api_logs succeeded
      where succeeded.created_at > failed.created_at
        and succeeded.operation = failed.operation
        and coalesce(succeeded.shipment_id::text, '') = coalesce(failed.shipment_id::text, '')
        and coalesce(succeeded.tracking_number, '') = coalesce(failed.tracking_number, '')
        and succeeded.error_code is null
        and succeeded.error_message is null
        and coalesce(succeeded.rejected, 0) = 0
        and (
          coalesce(succeeded.accepted, 0) > 0
          or succeeded.operation = 'getquota'
        )
    );

  select jsonb_build_object(
           'total', quota_total,
           'used', quota_used,
           'remain', quota_remain,
           'today_used', today_used,
           'max_track_daily', max_track_daily,
           'checked_at', checked_at
         ),
         checked_at >= now() - interval '6 hours',
         coalesce(quota_remain, 0) > 0
  into v_quota, v_quota_fresh, v_quota_available
  from public.track17_quota_cache
  where id is true;

  v_database_ok :=
    v_tables_ok
    and v_unregistered = 0
    and v_stale = 0
    and v_invalid_webhooks = 0
    and v_api_errors = 0
    and (v_shipments = 0 or (v_quota_fresh and v_quota_available));

  return jsonb_build_object(
    'ok', v_database_ok,
    'database_ok', v_database_ok,
    'tables', v_tables,
    'shipments', jsonb_build_object(
      'total', v_shipments,
      'active', v_active,
      'unregistered', v_unregistered,
      'stale_active', v_stale
    ),
    'events_total', v_events,
    'webhooks_last_24h', jsonb_build_object(
      'total', v_webhooks,
      'signature_valid', v_valid_webhooks,
      'signature_invalid', v_invalid_webhooks
    ),
    'api_unresolved_errors_last_24h', v_api_errors,
    'quota', coalesce(v_quota, '{}'::jsonb),
    'quota_fresh', v_quota_fresh,
    'quota_available', v_quota_available,
    'edge_functions_expected', jsonb_build_array(
      'register-track17-shipment',
      'sync-track17-shipment',
      'track17-admin',
      'track17-webhook',
      'public-international-tracking'
    ),
    'edge_function_deployment_proof_required', true,
    'secret_expected', 'TRACK17_API_KEY',
    'webhook_expected', 'track17-webhook',
    'checked_at', now()
  );
end;
$$;

revoke all on function public.international_tracking_runtime_health() from public, anon;
grant execute on function public.international_tracking_runtime_health() to authenticated;

notify pgrst, 'reload schema';

commit;
