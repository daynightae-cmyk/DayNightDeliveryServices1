const root = String(process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || '');
const email = String(process.env.RUNTIME_ADMIN_EMAIL || '').trim().toLowerCase();
const password = String(process.env.RUNTIME_ADMIN_PASSWORD || '');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const response = await fetch(`${root}${path}`, {
    ...options,
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`merchant_dispatch_probe_http_${response.status}: ${String(body?.message || body?.error_description || body || '').slice(0, 600)}`);
  }
  return body;
}

assert(root && anonKey && email && password, 'merchant_dispatch_probe_missing_runtime_configuration');

const auth = await request('/auth/v1/token?grant_type=password', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});
const token = String(auth?.access_token || '');
const userId = String(auth?.user?.id || '');
assert(token && userId, 'merchant_dispatch_probe_admin_session_missing');
const authHeaders = { Authorization: `Bearer ${token}` };

try {
  const profiles = await request(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role&limit=1`, {
    headers: authHeaders,
  });
  const role = String(profiles?.[0]?.role || '').toLowerCase();
  assert(['admin', 'support'].includes(role), 'merchant_dispatch_probe_user_not_admin');

  const orders = await request(
    '/rest/v1/orders?select=id,merchant_id,status,coupon_number&merchant_id=not.is.null&order=created_at.desc&limit=1',
    { headers: authHeaders },
  );
  const order = orders?.[0];
  assert(order?.id && order?.merchant_id, 'merchant_dispatch_probe_no_merchant_order');

  const before = await request('/rest/v1/rpc/admin_get_merchant_statement_dispatch_status', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ p_merchant_id: order.merchant_id }),
  });
  const beforeCount = Array.isArray(before) ? before.length : 0;

  const dryRun = await request('/rest/v1/rpc/admin_confirm_merchant_statement_dispatch', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      p_merchant_id: order.merchant_id,
      p_order_ids: [order.id],
      p_period_label: 'PRODUCTION DRY RUN',
      p_channel: 'whatsapp_pdf',
      p_resend_reason: null,
      p_metadata: { source: 'github_actions_production_probe' },
      p_dry_run: true,
    }),
  });

  assert(dryRun?.ok === true, 'merchant_dispatch_probe_dry_run_not_ok');
  assert(dryRun?.dry_run === true, 'merchant_dispatch_probe_dry_run_flag_missing');
  assert(Number(dryRun?.order_count) === 1, 'merchant_dispatch_probe_wrong_order_count');
  assert(String(dryRun?.merchant_id || '') === String(order.merchant_id), 'merchant_dispatch_probe_wrong_merchant');

  const after = await request('/rest/v1/rpc/admin_get_merchant_statement_dispatch_status', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ p_merchant_id: order.merchant_id }),
  });
  const afterCount = Array.isArray(after) ? after.length : 0;
  assert(afterCount === beforeCount, 'merchant_dispatch_probe_dry_run_wrote_rows');

  const health = await request('/rest/v1/rpc/admin_merchant_statement_dispatch_health', {
    method: 'POST',
    headers: authHeaders,
    body: '{}',
  });
  assert(health?.ok === true, 'merchant_dispatch_probe_health_failed');
  assert(health?.duplicate_guard === true, 'merchant_dispatch_probe_duplicate_guard_missing');
  assert(health?.resend_requires_reason === true, 'merchant_dispatch_probe_resend_guard_missing');
  assert(health?.confirmed_send_only === true, 'merchant_dispatch_probe_confirmation_guard_missing');

  console.log(JSON.stringify({
    result: 'PASS',
    role,
    orderId: order.id,
    merchantId: order.merchant_id,
    orderStatus: order.status,
    coupon: order.coupon_number || null,
    dryRunVerified: true,
    rowCountUnchanged: true,
    duplicateGuard: true,
    resendRequiresReason: true,
    confirmedSendOnly: true,
  }, null, 2));
} finally {
  await fetch(`${root}/auth/v1/logout`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }).catch(() => {});
}
