#!/usr/bin/env node

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("P1 runtime health requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function rpc(name, body = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text.slice(0, 500) };
  }
  return { name, status: response.status, ok: response.ok && payload?.ok === true, payload };
}

async function edgeFunction(name) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "OPTIONS",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    redirect: "manual",
  });

  // Deployed functions can reject OPTIONS with auth/method responses. A 404 is
  // the decisive missing-deployment signal.
  const deployed = response.status !== 404;
  return { name, status: response.status, deployed };
}

const rpcNames = [
  "admin_order_validation_health",
  "admin_finance_reconciliation_health",
  "international_tracking_runtime_health",
  "customer_experience_runtime_health",
];

const edgeNames = [
  "register-track17-shipment",
  "sync-track17-shipment",
  "track17-admin",
  "track17-webhook",
  "public-international-tracking",
];

const rpcResults = [];
for (const name of rpcNames) {
  try {
    rpcResults.push(await rpc(name));
  } catch (error) {
    rpcResults.push({ name, status: 0, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

const edgeResults = [];
for (const name of edgeNames) {
  try {
    edgeResults.push(await edgeFunction(name));
  } catch (error) {
    edgeResults.push({ name, status: 0, deployed: false, error: error instanceof Error ? error.message : String(error) });
  }
}

const report = {
  checkedAt: new Date().toISOString(),
  supabaseHost: new URL(SUPABASE_URL).host,
  rpc: rpcResults,
  edgeFunctions: edgeResults,
  secretProof: {
    required: "TRACK17_API_KEY",
    verifiedByThisScript: false,
    instruction: "Run `supabase secrets list --project-ref <ref>` without printing secret values.",
  },
};

console.log(JSON.stringify(report, null, 2));

const failedRpc = rpcResults.filter((item) => !item.ok);
const missingEdges = edgeResults.filter((item) => !item.deployed);
if (failedRpc.length || missingEdges.length) {
  console.error(
    `P1 runtime health failed: ${failedRpc.length} unhealthy RPC(s), ${missingEdges.length} missing edge function(s).`,
  );
  process.exit(1);
}

console.log("P1 RUNTIME HEALTH: PASS");
