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
  if (['card', 'bank_transfer', 'wallet'].includes(normalized)) return 'prepaid';
  return ['cod', 'receiver_pays', 'sender_pays', 'prepaid'].includes(normalized)
    ? normalized
    : 'cod';
}

function errorDetail(error) {
  return [error?.code, error?.message, error?.details, error?.hint]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' | ');
}

function basePayload(order) {
  const deliveryFee = numberValue(
    order.delivery_fee ?? order.delivery_price ?? order.base_price ?? order.manual_delivery_price,
    0,
  );
  const priceSource = text(order.price_source, 'system').toLowerCase() === 'manual'
    ? 'manual'
    : 'system';

  return {
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
      price_source: priceSource,
      manual_delivery_price:
        priceSource === 'manual'
          ? numberValue(order.manual_delivery_price ?? deliveryFee, deliveryFee)
          : null,
    },
    financials: {
      goods_value: numberValue(order.goods_value, 0),
      delivery_fee: deliveryFee,
      discount_amount: numberValue(order.discount_amount, 0),
      delivery_fee_mode: text(order.delivery_fee_mode, 'customer_pays'),
    },
    reason: 'Automated production rollback verification for a real edited value',
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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
  assert(
    ['admin', 'support', 'owner', 'super_admin'].includes(text(profile?.role).toLowerCase()),
    'production_save_probe_user_not_admin',
  );

  const { data: reviewedRows, error: reviewedError } = await supabase
    .from('orders')
    .select('*')
    .not('merchant_id', 'is', null)
    .not('coupon_number', 'is', null)
    .order('created_at', { ascending: false })
    .limit(250);
  if (reviewedError) {
    throw new Error(`production_save_probe_order_lookup_failed: ${errorDetail(reviewedError)}`);
  }
  const reviewedOrder = (reviewedRows || []).find(
    (row) => row?.id && row?.merchant_id && text(row?.coupon_number),
  );
  assert(reviewedOrder?.id, 'production_save_probe_order_missing');
  assert(reviewedOrder?.merchant_id, 'production_save_probe_requires_merchant_order');

  const { data: orderCandidates, error: candidatesError } = await supabase
    .from('orders')
    .select('*')
    .not('merchant_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(250);
  if (candidatesError) {
    throw new Error(`production_save_probe_candidates_failed: ${errorDetail(candidatesError)}`);
  }

  const nonPostedOrder = (orderCandidates || []).find((row) => {
    const status = text(row.status).toLowerCase().replace(/[\s-]+/g, '_');
    return (
      row.id &&
      row.merchant_id &&
      !row.financial_posted_at &&
      !['delivered', 'completed', 'complete'].includes(status) &&
      text(row.sender_name) &&
      text(row.sender_phone) &&
      text(row.receiver_name ?? row.customer_name) &&
      text(row.receiver_phone ?? row.customer_phone) &&
      text(row.package_type ?? row.package_description)
    );
  }) || reviewedOrder;

  const { data: links, error: linksError } = await supabase
    .from('merchant_user_links')
    .select('*')
    .limit(500);
  if (linksError) {
    throw new Error(`production_save_probe_merchant_links_failed: ${errorDetail(linksError)}`);
  }
  const linkedIds = Array.from(
    new Set(
      (links || [])
        .filter((row) => row.is_active ?? row.active ?? true)
        .map((row) => text(row.merchant_id))
        .filter(Boolean),
    ),
  );
  const { data: merchants, error: merchantsError } = await supabase
    .from('merchants')
    .select('id,trade_name,merchant_code,phone,emirate,pickup_address,address,status')
    .in('id', linkedIds.length ? linkedIds : ['00000000-0000-0000-0000-000000000000'])
    .limit(500);
  if (merchantsError) {
    throw new Error(`production_save_probe_merchants_failed: ${errorDetail(merchantsError)}`);
  }
  const alternateMerchant = (merchants || []).find(
    (merchant) =>
      merchant.id !== reviewedOrder.merchant_id &&
      !['deleted', 'archived', 'blocked', 'suspended'].includes(text(merchant.status, 'active').toLowerCase()),
  );
  assert(alternateMerchant?.id, 'production_save_probe_no_alternate_linked_merchant');

  const cases = [];

  cases.push({
    name: 'baseline_same_values',
    order: reviewedOrder,
    payload: basePayload(reviewedOrder),
  });

  {
    const payload = clone(basePayload(nonPostedOrder));
    payload.patch.receiver_address = `${text(payload.patch.receiver_address, 'Address')} [ROLLBACK-PROBE]`;
    payload.reason = 'Rollback probe: edit customer address';
    cases.push({ name: 'real_core_customer_edit', order: nonPostedOrder, payload });
  }

  {
    const payload = clone(basePayload(nonPostedOrder));
    payload.financials.goods_value = numberValue(payload.financials.goods_value, 0) + 1;
    if (payload.patch.price_source === 'manual') {
      payload.patch.manual_delivery_price = numberValue(payload.patch.manual_delivery_price, 0) + 1;
      payload.financials.delivery_fee = payload.patch.manual_delivery_price;
    } else {
      payload.financials.delivery_fee = numberValue(payload.financials.delivery_fee, 0) + 1;
    }
    payload.reason = 'Rollback probe: edit goods and delivery values';
    cases.push({ name: 'real_financial_edit', order: nonPostedOrder, payload });
  }

  {
    const payload = clone(basePayload(nonPostedOrder));
    const current = normalizedPayment(payload.patch.payment_method);
    payload.patch.payment_method = current === 'prepaid' ? 'cod' : 'prepaid';
    payload.financials.delivery_fee_mode = 'customer_pays';
    payload.reason = 'Rollback probe: edit payment method';
    cases.push({ name: 'real_payment_edit', order: nonPostedOrder, payload });
  }

  {
    const payload = clone(basePayload(reviewedOrder));
    payload.patch.merchant_id = alternateMerchant.id;
    payload.patch.merchant_name = alternateMerchant.trade_name;
    payload.patch.merchant_code = alternateMerchant.merchant_code;
    payload.patch.sender_name = alternateMerchant.trade_name;
    payload.patch.sender_phone = alternateMerchant.phone;
    payload.patch.sender_city = alternateMerchant.emirate;
    payload.patch.sender_address = alternateMerchant.pickup_address || alternateMerchant.address;
    payload.reason = 'Rollback probe: change canonical merchant ownership';
    cases.push({ name: 'real_canonical_merchant_edit', order: reviewedOrder, payload });
  }

  const results = [];
  for (const testCase of cases) {
    const before = {
      merchant_id: testCase.order.merchant_id ?? null,
      updated_at: testCase.order.updated_at ?? null,
      financial_version: testCase.order.financial_version ?? null,
    };

    const { data, error } = await supabase.rpc('admin_probe_order_complete_save', {
      p_payload: testCase.payload,
    });

    if (error) {
      const failure = {
        result: 'FAIL',
        case: testCase.name,
        coupon: testCase.order.coupon_number,
        orderId: testCase.order.id,
        status: testCase.order.status,
        financialPostedAt: testCase.order.financial_posted_at,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        },
      };
      console.error(JSON.stringify(failure, null, 2));
      throw new Error(`production_real_edit_save_probe_failed: ${testCase.name}: ${errorDetail(error)}`);
    }

    assert(data?.ok === true, `${testCase.name}: probe_not_ok`);
    assert(data?.real_save_rpc_executed === true, `${testCase.name}: real_rpc_not_executed`);
    assert(data?.rollback_verified === true, `${testCase.name}: rollback_not_verified`);
    assert(data?.order_unchanged === true, `${testCase.name}: order_changed`);
    assert(data?.audit_unchanged === true, `${testCase.name}: audit_changed`);

    const { data: after, error: afterError } = await supabase
      .from('orders')
      .select('id,merchant_id,updated_at,financial_version')
      .eq('id', testCase.order.id)
      .single();
    if (afterError) {
      throw new Error(`${testCase.name}: readback_failed: ${errorDetail(afterError)}`);
    }
    assert((after.merchant_id ?? null) === before.merchant_id, `${testCase.name}: merchant_persisted_change`);
    assert((after.updated_at ?? null) === before.updated_at, `${testCase.name}: updated_at_persisted_change`);
    assert(
      (after.financial_version ?? null) === before.financial_version,
      `${testCase.name}: financial_version_persisted_change`,
    );

    results.push({
      case: testCase.name,
      orderId: testCase.order.id,
      coupon: testCase.order.coupon_number,
      status: testCase.order.status,
      realSaveRpcExecuted: true,
      rollbackVerified: true,
    });
  }

  console.log(
    JSON.stringify(
      {
        result: 'PASS',
        userRole: profile.role,
        reviewedOrderId: reviewedOrder.id,
        nonPostedOrderId: nonPostedOrder.id,
        alternateMerchantId: alternateMerchant.id,
        cases: results,
      },
      null,
      2,
    ),
  );
} finally {
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}
