import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createClient } = require(
  path.resolve(process.cwd(), 'artifacts/day-night-delivery/node_modules/@supabase/supabase-js'),
);

const supabaseUrl = String(process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const evidenceDirectory = 'preview-browser-evidence';
const acceptanceName = 'DAY NIGHT FINANCIAL TEST';
const acceptancePhone = '0500000000';
const acceptanceMerchantId = '325bb302-75c3-48cc-84ba-e58817d6d148';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('financial_acceptance_cleanup_credentials_missing');
}

fs.mkdirSync(evidenceDirectory, { recursive: true });

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

async function findAcceptanceRows() {
  const { data, error } = await client
    .from('orders')
    .select('id,coupon_number,tracking_number,receiver_name,receiver_phone,merchant_id,is_deleted,deleted_at,created_at')
    .eq('receiver_name', acceptanceName)
    .eq('receiver_phone', acceptancePhone)
    .eq('merchant_id', acceptanceMerchantId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`financial_acceptance_lookup_failed:${error.message}`);
  return Array.isArray(data) ? data : [];
}

async function deleteOptionalChildren(orderId) {
  const tables = [
    'merchant_statement_dispatch_log',
    'admin_order_reconciliation_queue',
    'admin_order_mutation_audit_v3',
  ];

  for (const table of tables) {
    const { error } = await client.from(table).delete().eq('order_id', orderId);
    if (error && !/does not exist|schema cache|not found|relation .* does not exist/i.test(String(error.message || ''))) {
      throw new Error(`financial_acceptance_cleanup_${table}_failed:${error.message}`);
    }
  }
}

const before = await findAcceptanceRows();
const deleted = [];

for (const row of before) {
  await deleteOptionalChildren(row.id);
  const { error } = await client.from('orders').delete().eq('id', row.id);
  if (error) throw new Error(`financial_acceptance_order_delete_failed:${row.id}:${error.message}`);
  deleted.push({ id: row.id, coupon_number: row.coupon_number, tracking_number: row.tracking_number });
}

const after = await findAcceptanceRows();
if (after.length) {
  throw new Error(`financial_acceptance_cleanup_not_verified:${after.map((row) => row.id).join(',')}`);
}

const report = {
  result: 'PASS',
  marker: {
    receiver_name: acceptanceName,
    receiver_phone: acceptancePhone,
    merchant_id: acceptanceMerchantId,
  },
  matched: before.length,
  deleted: deleted.length,
  deletedRows: deleted,
  remaining: 0,
  verified: true,
};

fs.writeFileSync(
  `${evidenceDirectory}/financial-acceptance-preflight-purge.json`,
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
