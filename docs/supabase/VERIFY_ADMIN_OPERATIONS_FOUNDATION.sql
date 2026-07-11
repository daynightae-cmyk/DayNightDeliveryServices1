-- DAY NIGHT Admin Operations Verification
-- Run after supabase/migrations/20260711223000_admin_operations_foundation.sql

select 'merchants_table' as check_name, to_regclass('public.merchants') is not null as passed;
select 'orders_table' as check_name, to_regclass('public.orders') is not null as passed;

select 'admin_create_merchant_rpc' as check_name, exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'admin_create_merchant'
) as passed;

select 'admin_update_merchant_rpc' as check_name, exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'admin_update_merchant'
) as passed;

select 'admin_create_coupon_order_rpc' as check_name, exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'admin_create_coupon_order'
) as passed;

select 'admin_operations_summary_view' as check_name, to_regclass('public.admin_operations_summary') is not null as passed;

select 'merchant_columns_ready' as check_name, count(*) = 22 as passed
from information_schema.columns
where table_schema = 'public'
  and table_name = 'merchants'
  and column_name in (
    'id','merchant_code','trade_name','owner_name','phone','alt_phone','email','emirate','city',
    'address','pickup_address','license_number','trn','tax_number','logo_url','bank_name','iban',
    'settlement_cycle','commission_type','default_payment_method','notes','status'
  );

select 'order_columns_ready' as check_name, count(*) >= 35 as passed
from information_schema.columns
where table_schema = 'public'
  and table_name = 'orders'
  and column_name in (
    'id','tracking_number','invoice_number','coupon_number','merchant_id','merchant_name','merchant_code',
    'order_count','shipping_scope','destination_country','source_channel','source_domain','sender_name','sender_phone',
    'sender_city','sender_address','receiver_name','receiver_phone','receiver_city','receiver_address','package_type',
    'package_description','weight','pieces','service_type','payment_method','cod_amount','delivery_price','subtotal',
    'base_price','total','total_price','amount','price','currency','notes','status','status_history'
  );

select 'rls_enabled_merchants' as check_name, relrowsecurity as passed
from pg_class where oid = 'public.merchants'::regclass;

select 'rls_enabled_orders' as check_name, relrowsecurity as passed
from pg_class where oid = 'public.orders'::regclass;

select 'admin_operations_counts' as check_name, * from public.admin_operations_summary;
