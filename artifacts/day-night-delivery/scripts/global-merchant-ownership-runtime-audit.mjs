import fs from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const output = process.env.MERCHANT_OWNERSHIP_REPORT_PATH
  || "global-merchant-ownership-runtime-report.json";

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function rpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data;
}

const startedAt = new Date().toISOString();
const dryRun = await rpc("admin_run_global_merchant_ownership_dry_run", {
  p_notes: `Trusted production dry run ${startedAt}`,
});
const auditId = dryRun?.audit_id;
if (!auditId) throw new Error("Dry run returned no audit_id.");

const report = await rpc("admin_global_merchant_ownership_report", {
  p_audit_id: auditId,
});
const acceptance010505 = await rpc("admin_order_merchant_acceptance", {
  p_coupon: "010505",
});
const matrix = await rpc("admin_merchant_ownership_visibility_matrix");

const affectedRows = Array.isArray(report?.affected_rows) ? report.affected_rows : [];
const merchantMatrix = Array.isArray(matrix) ? matrix : [];
const matrixFailures = merchantMatrix.filter((row) => row?.result !== "PASS");
const classifications = affectedRows.reduce((acc, row) => {
  const key = String(row?.classification || "UNKNOWN");
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});

const payload = {
  generated_at: new Date().toISOString(),
  project_ref: new URL(url).hostname.split(".")[0],
  dry_run: dryRun,
  run: report?.run || null,
  classifications,
  affected_rows: affectedRows,
  merchant_matrix: merchantMatrix,
  merchant_matrix_failures: matrixFailures,
  acceptance_010505: acceptance010505,
  safety: {
    apply_called: false,
    orders_deleted: false,
    merchants_deleted: false,
    financial_values_changed: false,
    note: "This runner never calls admin_apply_global_merchant_ownership_repair.",
  },
};

fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Runtime report written to ${output}`);
console.log(`Audit ID: ${auditId}`);
console.log(`Dry-run status: ${dryRun?.status || "unknown"}`);
console.log(`Affected rows: ${affectedRows.length}`);
console.log(`Merchant matrix failures: ${matrixFailures.length}`);
console.log(`010505 acceptance: ${acceptance010505?.ok === true ? "PASS" : "FAIL"}`);

const unresolved = Number(dryRun?.unresolved_rows || 0);
if (dryRun?.status !== "completed" || unresolved > 0 || matrixFailures.length > 0 || acceptance010505?.ok !== true) {
  console.error("PRODUCTION OWNERSHIP AUDIT: REVIEW REQUIRED");
  process.exit(1);
}

console.log("PRODUCTION OWNERSHIP AUDIT: PASS (dry run only; no backfill applied)");
