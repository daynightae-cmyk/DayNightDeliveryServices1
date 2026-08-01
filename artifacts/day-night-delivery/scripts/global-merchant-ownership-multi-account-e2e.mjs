import fs from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const rawAccounts = process.env.RUNTIME_MERCHANT_ACCOUNTS_JSON;
const output = process.env.MERCHANT_OWNERSHIP_MULTI_ACCOUNT_REPORT_PATH
  || "global-merchant-ownership-multi-account-report.json";

if (!url || !anonKey || !rawAccounts) {
  console.error("Missing VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, or RUNTIME_MERCHANT_ACCOUNTS_JSON.");
  process.exit(2);
}

const projectRef = new URL(url).hostname.split(".")[0];
if (projectRef !== "ngdwybpgacauorygoedi") {
  throw new Error(`Refusing non-production project: ${projectRef}`);
}

let accounts;
try {
  accounts = JSON.parse(rawAccounts);
} catch {
  throw new Error("RUNTIME_MERCHANT_ACCOUNTS_JSON must be valid JSON.");
}
if (!Array.isArray(accounts) || accounts.length < 2) {
  throw new Error("At least two protected merchant accounts are required for isolation evidence.");
}

function createPortalClient() {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function clean(value) {
  return String(value || "").trim();
}

const results = [];
const orderOwnerById = new Map();

for (let index = 0; index < accounts.length; index += 1) {
  const account = accounts[index] || {};
  const email = clean(account.email);
  const password = clean(account.password);
  const expectedMerchantCode = clean(account.expectedMerchantCode || account.merchantCode);
  if (!email || !password) throw new Error(`Merchant account ${index + 1} is incomplete.`);

  const supabase = createPortalClient();
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError || !authData.session) {
      throw new Error(`Merchant ${index + 1} authentication failed: ${authError?.message || "session_missing"}`);
    }

    const { data: profileData, error: profileError } = await supabase.rpc("merchant_get_session_profile");
    if (profileError) throw new Error(`Merchant ${index + 1} profile: ${profileError.message}`);
    const merchants = Array.isArray(profileData?.merchants) ? profileData.merchants : [];
    if (merchants.length !== 1) {
      throw new Error(`Merchant ${index + 1} expected one canonical profile, got ${merchants.length}.`);
    }
    const merchant = merchants[0];
    if (expectedMerchantCode && clean(merchant.merchant_code) !== expectedMerchantCode) {
      throw new Error(`Merchant ${index + 1} code mismatch: expected ${expectedMerchantCode}, got ${merchant.merchant_code}.`);
    }

    let page = 1;
    let totalPages = 1;
    let totalCount = 0;
    const orderIds = [];
    do {
      const { data, error } = await supabase.rpc("merchant_portal_orders_page", {
        p_page: page,
        p_page_size: 100,
        p_search: null,
        p_status: null,
      });
      if (error) throw new Error(`Merchant ${index + 1} page ${page}: ${error.message}`);
      if (clean(data?.merchant_id) !== clean(merchant.id)) {
        throw new Error(`Merchant ${index + 1} RPC merchant UUID mismatch.`);
      }
      const rows = Array.isArray(data?.orders) ? data.orders : [];
      for (const order of rows) {
        if (clean(order.merchant_id) !== clean(merchant.id)) {
          throw new Error(`Security violation: order ${order.id} belongs to a different merchant UUID.`);
        }
        const orderId = clean(order.id);
        if (orderId) {
          const previousOwner = orderOwnerById.get(orderId);
          if (previousOwner && previousOwner !== clean(merchant.id)) {
            throw new Error(`Security violation: order ${orderId} appeared in two merchant accounts.`);
          }
          orderOwnerById.set(orderId, clean(merchant.id));
          orderIds.push(orderId);
        }
      }
      totalPages = Math.max(0, Number(data?.total_pages || 0));
      totalCount = Math.max(0, Number(data?.total_count || 0));
      page += 1;
    } while (page <= totalPages);

    const uniqueOrderIds = [...new Set(orderIds)];
    if (uniqueOrderIds.length !== totalCount) {
      throw new Error(
        `Merchant ${index + 1} pagination mismatch: RPC count ${totalCount}, unique rows ${uniqueOrderIds.length}.`,
      );
    }

    results.push({
      user_id: authData.user.id,
      merchant_id: merchant.id,
      merchant_code: merchant.merchant_code,
      merchant_name: merchant.trade_name,
      total_count: totalCount,
      pages_loaded: totalPages,
      unique_order_count: uniqueOrderIds.length,
      isolation_result: "PASS",
    });
  } finally {
    await supabase.auth.signOut();
  }
}

const merchantIds = results.map((row) => clean(row.merchant_id));
if (new Set(merchantIds).size !== merchantIds.length) {
  throw new Error("Two protected accounts resolved to the same merchant UUID; cross-merchant isolation was not tested.");
}

const report = {
  ok: true,
  generated_at: new Date().toISOString(),
  project_ref: projectRef,
  accounts_tested: results.length,
  merchants: results,
  cross_account_order_overlap: false,
  service_role_used: false,
};
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`MULTI-MERCHANT OWNERSHIP E2E: PASS (${results.length} distinct merchants)`);
console.log(`Report written to ${output}`);
