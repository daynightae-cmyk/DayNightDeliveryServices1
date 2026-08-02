import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createClient } = require(
  path.resolve(process.cwd(), 'artifacts/day-night-delivery/node_modules/@supabase/supabase-js'),
);

const url = String(process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const anon = String(process.env.VITE_SUPABASE_ANON_KEY || '');
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const email = String(process.env.RUNTIME_ADMIN_EMAIL || '').trim().toLowerCase();
const password = String(process.env.RUNTIME_ADMIN_PASSWORD || '').trim();
const runId = String(process.env.GITHUB_RUN_ID || Date.now());
const coupon = `PERS-RPC-${runId}`;

const admin = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

function fail(label, value) {
  throw new Error(`${label}: ${JSON.stringify(value, null, 2)}`);
}

async function cleanup() {
  const { data: rows, error } = await service
    .from('orders')
    .select('id,coupon_number,source_channel')
    .eq('coupon_number', coupon)
    .eq('source_channel', 'admin_personal_order');
  if (error) fail('cleanup_lookup_failed', error);
  for (const row of rows || []) {
    for (const table of [
      'merchant_statement_dispatch_log',
      'order_status_history',
      'order_status_events',
      'order_events',
      'cod_collections',
      'merchant_statement_entries',
      'driver_statement_entries',
      'order_financial_settlements',
      'financial_account_entries',
      'merchant_invoices',
      'invoices',
      'notifications',
      'delivery_assignments',
      'order_driver_assignments',
      'driver_missions',
      'shipment_events',
      'order_tracking_events',
      'order_notes',
    ]) {
      const result = await service.from(table).delete().eq('order_id', row.id);
      const code = String(result.error?.code || '');
      if (result.error && !['42P01', '42703', 'PGRST204', 'PGRST205'].includes(code)) {
        console.warn(`optional cleanup ${table}:`, JSON.stringify(result.error));
      }
    }
    const deleted = await service.from('orders').delete().eq('id', row.id).select('id');
    if (deleted.error) fail('cleanup_order_failed', deleted.error);
  }
}

try {
  await cleanup();
  const login = await admin.auth.signInWithPassword({ email, password });
  if (login.error || !login.data?.user?.id) fail('admin_login_failed', login.error);
  const profile = await admin.from('profiles').select('role').eq('id', login.data.user.id).single();
  if (profile.error || String(profile.data?.role || '').toLowerCase() !== 'admin') {
    fail('admin_role_failed', { error: profile.error, profile: profile.data });
  }

  const health = await admin.rpc('admin_personal_orders_runtime_health');
  console.log('PERSONAL_ORDER_HEALTH');
  console.log(JSON.stringify({ data: health.data, error: health.error }, null, 2));

  const now = new Date().toISOString();
  const payload = {
    tracking_number: `DN-PER-DIAG-${runId}`,
    tracking_code: `DN-PER-DIAG-${runId}`,
    invoice_number: `DN-PER-DIAG-${runId}`,
    coupon_number: coupon,
    merchant_id: null,
    merchant_name: null,
    merchant_code: null,
    source_channel: 'admin_personal_order',
    source_domain: 'daynightae.com',
    sender_name: `Diagnostic Sender ${runId}`,
    sender_phone: '971500000111',
    sender_city: 'Abu Dhabi',
    sender_address: 'Mussafah - Diagnostic pickup - Abu Dhabi',
    receiver_name: `Diagnostic Receiver ${runId}`,
    receiver_phone: '971500000222',
    receiver_city: 'Abu Dhabi',
    receiver_address: 'Al Shahama - Diagnostic delivery - Abu Dhabi',
    package_type: 'Personal shipment',
    package_description: 'Personal shipment',
    weight: 1,
    pieces: 1,
    order_count: 1,
    shipping_scope: 'local',
    service_type: 'standard',
    payment_method: 'cod',
    cod_amount: 150,
    goods_value: 125,
    delivery_fee: 25,
    discount_amount: 0,
    delivery_fee_mode: 'customer_pays',
    customer_total: 150,
    merchant_due: 0,
    company_revenue: 25,
    delivery_price: 25,
    base_price: 25,
    subtotal: 150,
    total: 150,
    total_price: 150,
    amount: 150,
    price: 150,
    manual_delivery_price: null,
    price_source: 'system',
    currency: 'AED',
    notes: 'PERSONAL_ORDER · Fixed delivery 25 AED · diagnostic',
    status: 'pending',
    status_history: [{ status: 'pending', date: now, created_at: now, note: 'Diagnostic personal order' }],
    created_at: now,
    updated_at: now,
  };

  const result = await admin.rpc('admin_create_personal_order', { p_order: payload });
  console.log('PERSONAL_ORDER_RPC_RESULT');
  console.log(JSON.stringify({ data: result.data, error: result.error }, null, 2));
  if (result.error) fail('personal_order_rpc_failed', result.error);
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!row?.id) fail('personal_order_rpc_returned_no_row', result.data);
  if (row.merchant_id !== null || row.source_channel !== 'admin_personal_order') {
    fail('personal_order_rpc_invariant_failed', row);
  }
  console.log(JSON.stringify({ result: 'PASS', order_id: row.id, coupon, merchant_id: row.merchant_id }, null, 2));
} finally {
  await cleanup();
  await admin.auth.signOut({ scope: 'local' }).catch(() => {});
}
