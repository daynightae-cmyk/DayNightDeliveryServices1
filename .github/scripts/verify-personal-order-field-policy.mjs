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
const coupon = `PERS-REQ-${runId}`;
const validTracking = `DN-PER-POLICY-${runId}`;
const missingTracking = `DN-PER-NOCOUPON-${runId}`;

const admin = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

function fail(label, value) {
  throw new Error(`${label}: ${JSON.stringify(value, null, 2)}`);
}

async function removeOrder(row) {
  if (!row?.id) return;
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

async function findAndRemoveByTracking(tracking) {
  const found = await service.from('orders').select('*').eq('tracking_number', tracking);
  if (found.error) fail('cleanup_lookup_failed', found.error);
  for (const row of found.data || []) await removeOrder(row);
}

let validRow = null;
try {
  await findAndRemoveByTracking(validTracking);
  await findAndRemoveByTracking(missingTracking);

  const login = await admin.auth.signInWithPassword({ email, password });
  if (login.error || !login.data?.user?.id) fail('admin_login_failed', login.error);

  const profile = await admin.from('profiles').select('role').eq('id', login.data.user.id).single();
  if (profile.error || String(profile.data?.role || '').toLowerCase() !== 'admin') {
    fail('admin_role_failed', { error: profile.error, profile: profile.data });
  }

  const health = await admin.rpc('admin_personal_orders_runtime_health');
  if (health.error) fail('runtime_health_failed', health.error);
  if (health.data?.coupon_required !== true) fail('coupon_not_required', health.data);
  if (health.data?.sender_phone_required !== false) fail('sender_phone_not_optional', health.data);
  if (health.data?.detailed_addresses_required !== false) fail('details_not_optional', health.data);
  if (health.data?.notes_required !== false) fail('notes_not_optional', health.data);

  const now = new Date().toISOString();
  const common = {
    merchant_id: null,
    merchant_name: null,
    merchant_code: null,
    source_channel: 'admin_personal_order',
    source_domain: 'daynightae.com',
    sender_name: `Policy Sender ${runId}`,
    sender_phone: '',
    sender_city: 'Abu Dhabi',
    sender_address: 'Mussafah - Abu Dhabi',
    receiver_name: `Policy Receiver ${runId}`,
    receiver_phone: '971500000222',
    receiver_city: 'Abu Dhabi',
    receiver_address: 'Al Shahama - Abu Dhabi',
    package_type: 'Personal shipment',
    package_description: 'Personal shipment',
    weight: 1,
    pieces: 1,
    order_count: 1,
    shipping_scope: 'local',
    service_type: 'standard',
    payment_method: 'cod',
    cod_amount: 75,
    goods_value: 50,
    delivery_fee: 25,
    discount_amount: 0,
    delivery_fee_mode: 'customer_pays',
    customer_total: 75,
    merchant_due: 0,
    company_revenue: 25,
    delivery_price: 25,
    base_price: 25,
    subtotal: 75,
    total: 75,
    total_price: 75,
    amount: 75,
    price: 75,
    manual_delivery_price: null,
    price_source: 'system',
    currency: 'AED',
    status: 'pending',
    created_at: now,
    updated_at: now,
  };

  const missingCoupon = await admin.rpc('admin_create_personal_order', {
    p_order: {
      ...common,
      tracking_number: missingTracking,
      tracking_code: missingTracking,
      invoice_number: missingTracking,
    },
  });
  if (!missingCoupon.error) {
    const row = Array.isArray(missingCoupon.data) ? missingCoupon.data[0] : missingCoupon.data;
    await removeOrder(row);
    fail('missing_coupon_was_accepted', row);
  }
  const missingError = JSON.stringify(missingCoupon.error);
  if (!missingError.includes('coupon_number_required_for_personal_order') && !missingError.includes('رقم الكوبون')) {
    fail('missing_coupon_wrong_error', missingCoupon.error);
  }

  const valid = await admin.rpc('admin_create_personal_order', {
    p_order: {
      ...common,
      tracking_number: validTracking,
      tracking_code: validTracking,
      invoice_number: validTracking,
      coupon_number: coupon,
    },
  });
  if (valid.error) fail('valid_save_failed', valid.error);
  validRow = Array.isArray(valid.data) ? valid.data[0] : valid.data;
  if (!validRow?.id) fail('valid_save_missing_row', valid.data);
  if (String(validRow.coupon_number || '') !== coupon) fail('coupon_not_persisted', validRow);
  if (String(validRow.sender_phone || '') !== '') fail('blank_sender_phone_not_accepted', validRow);
  if (validRow.merchant_id !== null) fail('merchant_link_created', validRow);
  if (Number(validRow.merchant_due || 0) !== 0) fail('merchant_due_created', validRow);
  if (Number(validRow.delivery_fee || 0) !== 25) fail('delivery_fee_changed', validRow);

  console.log(JSON.stringify({
    result: 'PASS',
    coupon_required: true,
    sender_phone_optional: true,
    detailed_addresses_optional: true,
    notes_optional: true,
    valid_order_id: validRow.id,
  }, null, 2));
} finally {
  await removeOrder(validRow);
  await findAndRemoveByTracking(validTracking).catch(() => {});
  await findAndRemoveByTracking(missingTracking).catch(() => {});
  await admin.auth.signOut({ scope: 'local' }).catch(() => {});
}
