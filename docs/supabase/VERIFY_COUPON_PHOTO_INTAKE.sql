-- =========================================================
-- DAY NIGHT — Verify Coupon Photo Intake Foundation
-- Run after:
-- 1) 20260714103000_coupon_photo_intake.sql
-- 2) 20260714104000_coupon_photo_intake_health_rpc.sql
-- =========================================================

-- 1. Required table
select
  'coupon_intake_sessions table' as check_name,
  case when to_regclass('public.coupon_intake_sessions') is not null then 'PASS' else 'FAIL' end as result;

-- 2. RLS must be enabled
select
  'coupon_intake_sessions RLS' as check_name,
  case when c.relrowsecurity then 'PASS' else 'FAIL' end as result
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'coupon_intake_sessions';

-- 3. Private storage bucket
select
  'coupon-images bucket' as check_name,
  case
    when b.id is null then 'FAIL: missing'
    when b.public then 'FAIL: public bucket'
    else 'PASS: private'
  end as result,
  b.file_size_limit,
  b.allowed_mime_types
from (select 'coupon-images'::text as wanted_id) expected
left join storage.buckets b on b.id = expected.wanted_id;

-- 4. Required RPCs
with required(name) as (
  values
    ('admin_create_coupon_intake_session'),
    ('admin_link_coupon_intake_order'),
    ('public_create_coupon_intake_session'),
    ('get_coupon_intake_health')
)
select
  required.name as rpc_name,
  case when exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = required.name
  ) then 'PASS' else 'FAIL' end as result
from required
order by required.name;

-- 5. Security definer functions must have controlled search_path
select
  p.proname as function_name,
  p.prosecdef as security_definer,
  p.proconfig as function_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'admin_create_coupon_intake_session',
    'admin_link_coupon_intake_order',
    'public_create_coupon_intake_session',
    'get_coupon_intake_health'
  )
order by p.proname;

-- 6. Table policies
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'coupon_intake_sessions'
order by policyname;

-- 7. Storage policies
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'coupon_images_%'
order by policyname;

-- 8. Current authenticated admin/support health check.
-- This succeeds only when the SQL session has an authenticated context that
-- resolves through auth.uid() to profiles.role = admin/support.
-- In the browser admin Database Health flow, call:
--   supabase.rpc('get_coupon_intake_health')
-- Direct SQL Editor sessions may not have auth.uid(), so inspect objects above.

-- 9. Safe row count only; no image content is exposed.
select count(*) as coupon_intake_session_count
from public.coupon_intake_sessions;
