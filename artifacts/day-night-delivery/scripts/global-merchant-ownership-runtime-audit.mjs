import fs from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const adminEmail = process.env.RUNTIME_ADMIN_EMAIL;
const adminPassword = process.env.RUNTIME_ADMIN_PASSWORD;
const output = process.env.MERCHANT_OWNERSHIP_REPORT_PATH
  || "global-merchant-ownership-runtime-report.json";

const required = { url, anonKey, adminEmail, adminPassword };
const missing = Object.entries(required)
  .filter(([, value]) => !String(value || "").trim())
  .map(([name]) => name);
if (missing.length) {
  console.error(`Missing protected admin audit variables: ${missing.join(", ")}`);
  process.exit(2);
}

const projectRef = new URL(url).hostname.split(".")[0];
if (projectRef !== "ngdwybpgacauorygoedi") {
  throw new Error(`Refusing non-production project: ${projectRef}`);
}

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: adminEmail,
  password: adminPassword,
});
if (authError || !authData.session) {
  throw new Error(`Protected admin authentication failed: ${authError?.message || "session_missing"}`);
}

async function rpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data;
}

try {
  const startedAt = new Date().toISOString();
  const dryRun = await rpc("admin_run_global_merchant_system_dry_run", {
    p_notes: `Trusted production dry run ${startedAt}`,
  });
  const auditId = dryRun?.audit_id;
  if (!auditId) throw new Error("Dry run returned no audit_id.");

  const report = await rpc("admin_global_merchant_ownership_report", {
    p_audit_id: auditId,
  });
  const acceptance010505 = await rpc("admin_order_merchant_acceptance", {
    p_coupon: "010505",
    p_expected_merchant_code: "1999",
  });
  const matrix = await rpc("admin_merchant_ownership_visibility_matrix");
  const merchantInventory = await rpc("admin_merchant_identity_inventory");

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
    project_ref: projectRef,
    authenticated_admin_user_id: authData.user.id,
    dry_run: dryRun,
    run: report?.run || null,
    finance_health: dryRun?.finance_health || null,
    classifications,
    affected_rows: affectedRows,
    merchant_inventory: merchantInventory,
    merchant_matrix: merchantMatrix,
    merchant_matrix_failures: matrixFailures,
    acceptance_010505_merchant_1999: acceptance010505,
    safety: {
      service_role_used: false,
      ownership_apply_called: false,
      finance_reconciliation_called: false,
      orders_deleted: false,
      merchants_deleted: false,
      financial_values_changed: false,
      note: "This runner authenticates as the real protected admin and performs dry-run audit calls only.",
    },
  };

  fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Runtime report written to ${output}`);
  console.log(`Audit ID: ${auditId}`);
  console.log(`Dry-run status: ${dryRun?.status || "unknown"}`);
  console.log(`Affected rows: ${affectedRows.length}`);
  console.log(`Merchant matrix failures: ${matrixFailures.length}`);
  console.log(`010505 / 1999 acceptance: ${acceptance010505?.ok === true ? "PASS" : "FAIL"}`);

  const unresolved = Number(dryRun?.unresolved_rows || 0);
  const financeVarianceZero = dryRun?.finance_health?.variance_zero === true;
  if (
    dryRun?.status !== "completed"
    || unresolved > 0
    || matrixFailures.length > 0
    || acceptance010505?.ok !== true
    || !financeVarianceZero
  ) {
    console.error("PRODUCTION OWNERSHIP AUDIT: REVIEW REQUIRED");
    process.exitCode = 1;
  } else {
    console.log("PRODUCTION OWNERSHIP AUDIT: PASS (dry run only; no backfill applied)");
  }
} finally {
  await supabase.auth.signOut();
}
