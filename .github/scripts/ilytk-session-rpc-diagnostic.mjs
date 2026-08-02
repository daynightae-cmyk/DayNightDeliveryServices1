import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createClient } = require(
  path.resolve(process.cwd(), 'artifacts/day-night-delivery/node_modules/@supabase/supabase-js'),
);

const supabaseUrl = String(process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || '');
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const runtimeAdminEmail = String(process.env.RUNTIME_ADMIN_EMAIL || '').trim().toLowerCase();
const runtimeAdminPassword = String(process.env.RUNTIME_ADMIN_PASSWORD || '').trim();
const ilytkId = '325bb302-75c3-48cc-84ba-e58817d6d148';
const reviewedCoupons = new Set(['003860', '010503', '010504', '010505']);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const adminSessionClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

let adminReadDiagnostic = null;
try {
  assert(runtimeAdminEmail && runtimeAdminPassword, 'runtime_admin_credentials_missing');
  const { data: adminLogin, error: adminLoginError } = await adminSessionClient.auth.signInWithPassword({
    email: runtimeAdminEmail,
    password: runtimeAdminPassword,
  });
  if (adminLoginError) throw new Error(`runtime_admin_login_failed_${adminLoginError.message}`);
  assert(adminLogin?.user?.id, 'runtime_admin_user_missing');

  const { data: adminProfile, error: adminProfileError } = await adminSessionClient
    .from('profiles')
    .select('role')
    .eq('id', adminLogin.user.id)
    .single();
  if (adminProfileError) throw new Error(`runtime_admin_profile_failed_${adminProfileError.message}`);
  assert(String(adminProfile?.role || '').toLowerCase() === 'admin', `runtime_admin_role_${adminProfile?.role || 'null'}`);

  const startedMinimal = Date.now();
  const minimal = await adminSessionClient
    .from('orders')
    .select('id,merchant_id,coupon_number,created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 24);
  const minimalDurationMs = Date.now() - startedMinimal;

  const startedFull = Date.now();
  const full = await adminSessionClient
    .from('orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 24);
  const fullDurationMs = Date.now() - startedFull;

  adminReadDiagnostic = {
    user_id: adminLogin.user.id,
    role: adminProfile.role,
    minimal: {
      ok: !minimal.error,
      message: minimal.error?.message || null,
      code: minimal.error?.code || null,
      count: minimal.count,
      rows: Array.isArray(minimal.data) ? minimal.data.length : 0,
      duration_ms: minimalDurationMs,
    },
    full: {
      ok: !full.error,
      message: full.error?.message || null,
      code: full.error?.code || null,
      count: full.count,
      rows: Array.isArray(full.data) ? full.data.length : 0,
      duration_ms: fullDurationMs,
    },
  };

  console.log('ADMIN_ORDER_READ_DIAGNOSTIC');
  console.log(JSON.stringify(adminReadDiagnostic, null, 2));
} finally {
  const { error: adminSignOutError } = await adminSessionClient.auth.signOut({ scope: 'local' });
  if (adminSignOutError) throw new Error(`runtime_admin_cleanup_failed_${adminSignOutError.message}`);
}

const { data: links, error: linkError } = await adminClient
  .from('merchant_user_links')
  .select('user_id,updated_at')
  .eq('merchant_id', ilytkId)
  .eq('active', true)
  .order('updated_at', { ascending: false });
if (linkError) throw new Error(`ilytk_link_lookup_failed_${linkError.message}`);
assert(Array.isArray(links) && links.length > 0, 'ilytk_has_no_active_auth_link');

const linkedIds = new Set(links.map((row) => String(row.user_id || '')).filter(Boolean));
let linkedUser = null;
for (let page = 1; page <= 20 && !linkedUser; page += 1) {
  const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw new Error(`auth_user_lookup_failed_${error.message}`);
  const users = data?.users || [];
  linkedUser = users.find((user) => linkedIds.has(String(user.id)) && user.email) || null;
  if (users.length < 1000) break;
}
assert(linkedUser?.email, 'ilytk_linked_auth_user_not_found');

const { data: linkData, error: generateError } = await adminClient.auth.admin.generateLink({
  type: 'magiclink',
  email: linkedUser.email,
});
if (generateError) throw new Error(`ilytk_magic_link_failed_${generateError.message}`);
const tokenHash = linkData?.properties?.hashed_token;
assert(tokenHash, 'ilytk_magic_link_hash_missing');

const sessionClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

try {
  const { data: verified, error: verifyError } = await sessionClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });
  if (verifyError) throw new Error(`ilytk_magic_link_verification_failed_${verifyError.message}`);
  assert(String(verified?.session?.user?.id || '') === String(linkedUser.id), 'ilytk_session_user_mismatch');

  const { data: merchantSessionId, error: sessionIdError } = await sessionClient.rpc('merchant_session_id');
  if (sessionIdError) throw new Error(`merchant_session_id_failed_${sessionIdError.message}`);
  assert(String(merchantSessionId || '') === ilytkId, `merchant_session_id_resolved_${merchantSessionId || 'null'}`);

  const { data: profileData, error: profileError } = await sessionClient.rpc('merchant_get_session_profile');
  if (profileError) throw new Error(`merchant_get_session_profile_failed_${profileError.message}`);
  const profile = Array.isArray(profileData) ? profileData[0] : profileData;
  const merchants = Array.isArray(profile?.merchants) ? profile.merchants : [];
  assert(merchants.length === 1, `merchant_profile_count_${merchants.length}_expected_1`);
  assert(String(merchants[0]?.id || '') === ilytkId, `merchant_profile_resolved_${merchants[0]?.id || 'null'}`);

  const { data: ordersData, error: ordersError } = await sessionClient.rpc('merchant_portal_orders_page', {
    p_page: 1,
    p_page_size: 200,
  });
  if (ordersError) throw new Error(`merchant_portal_orders_page_failed_${ordersError.message}`);
  const ordersPage = Array.isArray(ordersData) ? ordersData[0] : ordersData;
  assert(ordersPage?.ok === true, 'merchant_orders_page_ok_false');
  assert(String(ordersPage?.merchant_id || '') === ilytkId, `merchant_orders_owner_${ordersPage?.merchant_id || 'null'}`);
  assert(Number(ordersPage?.total_count) === 4, `merchant_orders_total_${ordersPage?.total_count}_expected_4`);
  const orders = Array.isArray(ordersPage?.orders) ? ordersPage.orders : [];
  assert(orders.length === 4, `merchant_orders_page_count_${orders.length}_expected_4`);
  assert(orders.every((order) => String(order?.merchant_id || '') === ilytkId), 'merchant_orders_cross_owner_row');
  const returnedCoupons = new Set(orders.map((order) => String(order?.coupon_number || '').trim()));
  for (const coupon of reviewedCoupons) {
    assert(returnedCoupons.has(coupon), `merchant_orders_missing_reviewed_coupon_${coupon}`);
  }

  const { data: centerData, error: centerError } = await sessionClient.rpc('merchant_portal_business_center');
  if (centerError) throw new Error(`merchant_portal_business_center_failed_${centerError.message}`);
  const center = Array.isArray(centerData) ? centerData[0] : centerData;
  assert(center && typeof center === 'object', 'merchant_business_center_invalid_payload');
  assert(center.ok === true, 'merchant_business_center_ok_false');
  assert(String(center.merchant_id || '') === ilytkId, `merchant_business_center_owner_${center.merchant_id || 'null'}`);
  const arrayKeys = [
    'branches',
    'pickup_requests',
    'address_book',
    'documents',
    'team',
    'support_tickets',
    'notifications',
    'cod_collections',
    'statement_entries',
    'import_batches',
  ];
  for (const key of arrayKeys) {
    assert(Array.isArray(center[key]), `merchant_business_center_${key}_not_array`);
  }

  console.log(JSON.stringify({
    result: 'PASS',
    admin_order_read: adminReadDiagnostic,
    merchant_session_id: merchantSessionId,
    profile_merchant_count: merchants.length,
    orders_total_count: Number(ordersPage.total_count),
    reviewed_coupons: [...reviewedCoupons],
    confirmed_coupon_010504_visible: returnedCoupons.has('010504'),
    business_center_owner: center.merchant_id,
    business_center_arrays: Object.fromEntries(arrayKeys.map((key) => [key, center[key].length])),
  }, null, 2));
} finally {
  const { error: signOutError } = await sessionClient.auth.signOut({ scope: 'local' });
  if (signOutError) throw new Error(`temporary_session_cleanup_failed_${signOutError.message}`);
}
