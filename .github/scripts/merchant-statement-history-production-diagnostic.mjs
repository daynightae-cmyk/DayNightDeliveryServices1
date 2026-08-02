import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createClient } = require(
  path.resolve(process.cwd(), 'artifacts/day-night-delivery/node_modules/@supabase/supabase-js'),
);

const supabaseUrl = String(process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || '');
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const adminEmail = String(process.env.RUNTIME_ADMIN_EMAIL || '').trim().toLowerCase();
const adminPassword = String(process.env.RUNTIME_ADMIN_PASSWORD || '').trim();
const merchantCode = 'DN-MER-SHOP-ILYTK';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function errorDetail(error) {
  if (!error) return null;
  return [error.code, error.message, error.details, error.hint]
    .filter(Boolean)
    .join(' | ');
}

assert(supabaseUrl && anonKey && serviceRoleKey && adminEmail && adminPassword, 'statement_history_diagnostic_missing_secrets');

const admin = createClient(supabaseUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
const service = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const result = {
  result: 'FAIL',
  adminLogin: false,
  adminUserId: null,
  profileRole: null,
  merchantId: null,
  rpc: { ok: false, rows: null, error: null },
  adminTable: { ok: false, rows: null, error: null },
  serviceTable: { ok: false, rows: null, error: null },
  health: { ok: false, data: null, error: null },
};

try {
  const { data: authData, error: authError } = await admin.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  if (authError) throw new Error(`statement_history_admin_login_failed: ${errorDetail(authError)}`);
  assert(authData?.user?.id && authData?.session?.access_token, 'statement_history_admin_session_missing');
  result.adminLogin = true;
  result.adminUserId = authData.user.id;

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single();
  result.profileRole = profile?.role ?? null;
  if (profileError) throw new Error(`statement_history_profile_failed: ${errorDetail(profileError)}`);

  const { data: merchant, error: merchantError } = await service
    .from('merchants')
    .select('id,merchant_code,name')
    .eq('merchant_code', merchantCode)
    .limit(1)
    .single();
  if (merchantError) throw new Error(`statement_history_merchant_lookup_failed: ${errorDetail(merchantError)}`);
  assert(merchant?.id, 'statement_history_merchant_missing');
  result.merchantId = merchant.id;

  const healthResponse = await admin.rpc('admin_merchant_statement_dispatch_health');
  result.health = {
    ok: !healthResponse.error,
    data: healthResponse.data ?? null,
    error: errorDetail(healthResponse.error),
  };

  const rpcResponse = await admin.rpc('admin_get_merchant_statement_dispatch_status', {
    p_merchant_id: merchant.id,
  });
  result.rpc = {
    ok: !rpcResponse.error,
    rows: Array.isArray(rpcResponse.data) ? rpcResponse.data.length : rpcResponse.data ? 1 : 0,
    error: errorDetail(rpcResponse.error),
  };

  const adminTableResponse = await admin
    .from('merchant_statement_dispatch_log')
    .select('order_id,sent_at,batch_id,sent_by,resend_reason,channel,created_at,id')
    .eq('merchant_id', merchant.id)
    .order('sent_at', { ascending: false })
    .limit(10);
  result.adminTable = {
    ok: !adminTableResponse.error,
    rows: Array.isArray(adminTableResponse.data) ? adminTableResponse.data.length : 0,
    error: errorDetail(adminTableResponse.error),
  };

  const serviceTableResponse = await service
    .from('merchant_statement_dispatch_log')
    .select('order_id,sent_at,batch_id,sent_by,resend_reason,channel,created_at,id')
    .eq('merchant_id', merchant.id)
    .order('sent_at', { ascending: false })
    .limit(10);
  result.serviceTable = {
    ok: !serviceTableResponse.error,
    rows: Array.isArray(serviceTableResponse.data) ? serviceTableResponse.data.length : 0,
    error: errorDetail(serviceTableResponse.error),
  };

  const authorizedRole = ['admin', 'support'].includes(String(result.profileRole || '').toLowerCase());
  result.result = authorizedRole && result.health.ok && result.serviceTable.ok && (result.rpc.ok || result.adminTable.ok)
    ? 'PASS'
    : 'FAIL';

  console.log(JSON.stringify(result, null, 2));

  if (result.result !== 'PASS') {
    throw new Error(
      `statement_history_protected_reads_failed: role=${result.profileRole}; health=${result.health.error || result.health.ok}; rpc=${result.rpc.error || result.rpc.ok}; admin_table=${result.adminTable.error || result.adminTable.ok}; service_table=${result.serviceTable.error || result.serviceTable.ok}`,
    );
  }
} finally {
  await admin.auth.signOut({ scope: 'local' }).catch(() => {});
}
