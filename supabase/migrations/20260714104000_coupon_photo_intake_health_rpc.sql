-- =========================================================
-- DAY NIGHT — Coupon Photo Intake Health RPC
-- Read-only admin/support verification for table + private bucket.
-- =========================================================

create or replace function public.get_coupon_intake_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, storage
as $$
declare
  table_ready boolean;
  bucket_ready boolean;
  bucket_public boolean;
  session_count bigint;
begin
  if not public.is_admin_or_support() then
    raise exception 'admin_or_support_required';
  end if;

  table_ready := to_regclass('public.coupon_intake_sessions') is not null;

  select exists (
    select 1
    from storage.buckets b
    where b.id = 'coupon-images'
  ) into bucket_ready;

  select coalesce((
    select b.public
    from storage.buckets b
    where b.id = 'coupon-images'
    limit 1
  ), false) into bucket_public;

  if table_ready then
    select count(*) into session_count
    from public.coupon_intake_sessions;
  else
    session_count := 0;
  end if;

  return jsonb_build_object(
    'table_ready', table_ready,
    'bucket_ready', bucket_ready,
    'bucket_private', bucket_ready and not bucket_public,
    'session_count', session_count,
    'checked_at', now()
  );
end;
$$;

revoke all on function public.get_coupon_intake_health() from public;
grant execute on function public.get_coupon_intake_health() to authenticated;

comment on function public.get_coupon_intake_health() is
  'Admin/support read-only health check for coupon_intake_sessions and private coupon-images storage.';
