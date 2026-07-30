-- DAY NIGHT DELIVERY SERVICES
-- Runtime evidence for Aramex-only international tracking through 17TRACK.
-- Edge-function deployment and secret presence are verified by the companion
-- CI/runtime script; this RPC verifies the database, quota, registration,
-- webhook, and synchronization evidence stored in Supabase.

begin;

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

  select count(*)
  into v_api_errors
  from public.track17_api_logs
  where created_at >= now() - interval '24 hours'
    and (error_code is not null or error_message is not null or coalesce(rejected, 0) > 0);

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
    'api_errors_last_24h', v_api_errors,
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

commit;
