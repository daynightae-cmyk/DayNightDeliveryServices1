import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createClient } = require(
  path.resolve(process.cwd(), 'artifacts/day-night-delivery/node_modules/@supabase/supabase-js'),
);

const supabaseUrl = String(process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || '');
const adminEmail = String(process.env.RUNTIME_ADMIN_EMAIL || '').trim().toLowerCase();
const adminPassword = String(process.env.RUNTIME_ADMIN_PASSWORD || '').trim();
const reviewedCoupon = '003860';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value, fallback = '') {
  const result = String(value ?? '').trim();
  return result || fallback;
}

function normalizedPayment(value) {
  const normalized = text(value, 'cod').toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'merchant_pays') return 'sender_pays';
  if (normalized === 'cash') return 'cod';
  if (['card', 'bank_transfer'].includes(normalized)) return 'prepaid';
  return ['cod', 'receiver_pays', 'sender_pays', 'prepaid'].includes(normalized)
    ? normalized
    : 'cod';
}

const supabase = createClient(supabaseUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: adminEmail,
  password: adminPassword,
});
if (authError) throw new Error(`production_save_probe_admin_login_failed: ${authError.message}`);
assert(authData?.user?.id && authData?.session?.access_token, 'production_save_probe_admin_session_missing');

try {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single();
  if (profileError) throw new Error(`production_save_probe_profile_failed: ${profileError.message}`);
  assert(['admin', 'support'].includes(text(profile?.role).toLowerCase()), 'production_save_probe_user_not_admin');

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('coupon_number', reviewedCoupon)
    .limit(1)
    .single();
  if (orderError) throw new Error(`production_save_probe_order_lookup_failed: ${orderError.message}`);
  assert(order?.id, 'production_save_probe_order_missing');
  assert(order?.merchant_id, 'production_save_probe_requires_merchant_order');

  const beforeUpdatedAt = order.updated_at ?? null;
  const beforeFinancialVersion = order.financial_version ?? null;
  const beforeMerchantId = String(order.merchant_id);

  const deliveryFee = numberValue(
    order.delivery_fee ?? order.delivery_price ?? order.base_price ?? order.manual_delivery_price,
    0,
  );
  const payload = {
    order_id: order.id,
    patch: {
      merchant_id: order.merchant_id,
      merchant_name: order.merchant_name,
      merchant_code: order.merchant_code,
      sender_name: order.sender_name,
      sender_phone: order.sender_phone,
      sender_city: order.sender_city,
      sender_address: order.sender_address,
      receiver_name: order.receiver_name ?? order.customer_name,
      receiver_phone: order.receiver_phone ?? order.customer_phone,
      receiver_city: order.receiver_city,
      receiver_address: order.receiver_address,
      coupon_number: order.coupon_number,
      package_type: order.package_type ?? order.package_description ?? 'Shipment',
      package_description: order.package_description ?? order.package_type ?? 'Shipment',
      weight: numberValue(order.weight, 1),
      pieces: Math.max(1, Math.ceil(numberValue(order.pieces ?? order.order_count, 1))),
      order_count: Math.max(1, Math.ceil(numberValue(order.order_count ?? order.pieces, 1))),
      shipping_scope: text(order.shipping_scope, 'local'),
      destination_country: order.destination_country,
      service_type: text(order.service_type, 'standard'),
      currency: text(order.currency, 'AED'),
      notes: order.notes,
      payment_method: normalizedPayment(order.payment_method),
      price_source: text(order.price_source, 'system').toLowerCase() === 'manual' ? 'manual' : 'system',
      manual_delivery_price:
        text(order.price_source, 'system').toLowerCase() === 'manual'
          ? numberValue(order.manual_delivery_price ?? deliveryFee, deliveryFee)
          : null,
    },
    financials: {
      goods_value: numberValue(order.goods_value, 0),
      delivery_fee: deliveryFee,
      discount_amount: numberValue(order.discount_amount, 0),
      delivery_fee_mode: text(order.delivery_fee_mode, 'customer_pays'),
    },
    reason: 'Automated production rollback verification for complete admin order save',
  };

  let probeData = null;
  let lastProbeError = null;
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const { data, error } = await supabase.rpc('admin_probe_order_complete_save', {
      p_payload: payload,
    });
    if (!error) {
      probeData = data;
      lastProbeError = null;
      break;
    }
    lastProbeError = error;
    const detail = [error.code, error.message, error.details, error.hint]
      .filter(Boolean)
      .join(' | ');
    if (!/PGRST202|schema cache|Could not find the function|does not exist/i.test(detail)) {
      throw new Error(`production_save_probe_rpc_failed: ${detail}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  if (lastProbeError || !probeData) {
    throw new Error(
      `production_save_probe_rpc_unavailable: ${[
        lastProbeError?.code,
        lastProbeError?.message,
        lastProbeError?.details,
        lastProbeError?.hint,
      ]
        .filter(Boolean)
        .join(' | ')}`,
    );
  }

  assert(probeData.ok === true, 'production_save_probe_not_ok');
  assert(probeData.real_save_rpc_executed === true, 'production_save_probe_real_rpc_not_executed');
  assert(probeData.rollback_verified === true, 'production_save_probe_rollback_not_verified');
  assert(probeData.order_unchanged === true, 'production_save_probe_order_changed');
  assert(probeData.audit_unchanged === true, 'production_save_probe_audit_changed');

  const { data: after, error: afterError } = await supabase
    .from('orders')
    .select('id,merchant_id,updated_at,financial_version')
    .eq('id', order.id)
    .single();
  if (afterError) throw new Error(`production_save_probe_readback_failed: ${afterError.message}`);

  assert(String(after.merchant_id) === beforeMerchantId, 'production_save_probe_merchant_persisted_change');
  assert((after.updated_at ?? null) === beforeUpdatedAt, 'production_save_probe_updated_at_persisted_change');
  assert(
    (after.financial_version ?? null) === beforeFinancialVersion,
    'production_save_probe_financial_version_persisted_change',
  );

  console.log(
    JSON.stringify(
      {
        result: 'PASS',
        coupon: reviewedCoupon,
        orderId: order.id,
        merchantId: beforeMerchantId,
        realSaveRpcExecuted: true,
        rollbackVerified: true,
        orderUnchanged: true,
        auditUnchanged: true,
        userRole: profile.role,
      },
      null,
      2,
    ),
  );
} finally {
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}
