const root = String(process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
if (!root || !key) throw new Error("production_readonly_audit_configuration_missing");
if (new URL(root).hostname.split(".")[0] !== "ngdwybpgacauorygoedi") {
  throw new Error("production_readonly_audit_wrong_project");
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };
const clean = (value) => String(value ?? "").trim();
const localizedDigitMap = new Map([..."٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹"].map((digit, index) => [digit, String(index % 10)]));
const identity = (value) => clean(value)
  .replace(/[٠-٩۰-۹]/g, (digit) => localizedDigitMap.get(digit) || digit)
  .toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, "") || null;
const normalizedEmail = (value) => clean(value).toLocaleLowerCase() || null;
const phone = (value) => clean(value).replace(/\D/g, "") || null;
const inactive = (value) => ["deleted", "archived", "blocked", "suspended"].includes(clean(value || "active").toLowerCase());
const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

async function allRows(table, select = "*", optional = false) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const query = new URLSearchParams({ select, order: "id.asc" });
    const response = await fetch(`${root}/rest/v1/${table}?${query}`, {
      headers: { ...headers, Range: `${from}-${from + pageSize - 1}`, Prefer: "count=exact" },
    });
    const payload = await response.json().catch(() => null);
    if (optional && (response.status === 404 || (response.status === 400 && payload?.code === "42703"))) return null;
    if (!response.ok || !Array.isArray(payload)) {
      throw new Error(`${table}_readonly_fetch_${response.status}_${JSON.stringify(payload)}`);
    }
    rows.push(...payload);
    if (payload.length < pageSize) return rows;
    if (from > 10_000_000) throw new Error(`${table}_pagination_safety_limit`);
  }
}

async function authUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const response = await fetch(`${root}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(payload?.users)) {
      throw new Error(`auth_users_readonly_fetch_${response.status}_${JSON.stringify(payload)}`);
    }
    users.push(...payload.users);
    if (payload.users.length < 1000) return users;
  }
}

const [orders, merchants, links, users] = await Promise.all([
  allRows("orders", "*"),
  allRows("merchants", "id,merchant_code,trade_name,status,user_id,phone,email"),
  allRows("merchant_user_links", "merchant_id,user_id,active"),
  authUsers(),
]);

const dependencyTables = [
  ["cod_collections", "order_id,merchant_id"],
  ["merchant_statement_entries", "order_id,merchant_id"],
  ["driver_statement_entries", "order_id,driver_id"],
  ["order_financial_settlements", "order_id,merchant_id"],
  ["financial_account_entries", "order_id,merchant_id,account_type,entry_type"],
  ["merchant_invoices", "order_id,merchant_id"],
  ["invoices", "order_id,merchant_id"],
  ["notifications", "order_id,merchant_id"],
];
const dependencyRows = new Map();
for (const [table, select] of dependencyTables) {
  const rows = await allRows(table, select, true);
  dependencyRows.set(table, rows || []);
}

const merchantById = new Map(merchants.map((merchant) => [clean(merchant.id), merchant]));
const activeLinkByUser = new Map();
for (const link of links) if (link.active) activeLinkByUser.set(clean(link.user_id), clean(link.merchant_id));
const portalUsersByMerchant = new Map();
const addPortalUser = (merchantId, userId) => {
  if (!merchantId || !userId) return;
  const set = portalUsersByMerchant.get(merchantId) || new Set();
  set.add(userId); portalUsersByMerchant.set(merchantId, set);
};
for (const link of links) {
  const merchant = merchantById.get(clean(link.merchant_id));
  if (link.active && merchant && !inactive(merchant.status)) addPortalUser(clean(merchant.id), clean(link.user_id));
}
for (const merchant of merchants) {
  const userId = clean(merchant.user_id);
  const linkedElsewhere = userId && activeLinkByUser.has(userId) && activeLinkByUser.get(userId) !== clean(merchant.id);
  if (userId && !linkedElsewhere && !inactive(merchant.status)) addPortalUser(clean(merchant.id), userId);
}

const candidatesByCode = new Map();
for (const merchant of merchants) {
  const code = identity(merchant.merchant_code);
  if (!inactive(merchant.status) && code && (portalUsersByMerchant.get(clean(merchant.id))?.size || 0) > 0) {
    const ids = candidatesByCode.get(code) || [];
    ids.push(clean(merchant.id)); candidatesByCode.set(code, ids);
  }
}
const ownersByOrder = new Map();
const dependencyMerchantIdsByOrder = new Map();
for (const [table, rows] of dependencyRows) for (const row of rows) {
  if (table === "driver_statement_entries") continue;
  const orderId = clean(row.order_id); const merchantId = clean(row.merchant_id);
  if (!orderId) continue;
  const dependencyIds = dependencyMerchantIdsByOrder.get(orderId) || [];
  dependencyIds.push(merchantId); dependencyMerchantIdsByOrder.set(orderId, dependencyIds);
  if (!merchantId) continue;
  const set = ownersByOrder.get(orderId) || new Set(); set.add(merchantId); ownersByOrder.set(orderId, set);
}

const classificationCounts = new Map();
const categoryCounts = new Map();
const classified = [];
for (const order of orders) {
  const merchantId = clean(order.merchant_id);
  const current = merchantById.get(merchantId);
  const currentLinked = current && (portalUsersByMerchant.get(merchantId)?.size || 0) > 0;
  const orderCode = identity(order.merchant_code);
  const currentCode = identity(current?.merchant_code);
  const candidateIds = candidatesByCode.get(orderCode || currentCode) || [];
  const candidateId = currentLinked ? merchantId : candidateIds.length === 1 ? candidateIds[0] : "";
  const codeConflict = Boolean(orderCode && currentCode && orderCode !== currentCode);
  const displayMismatch = Boolean(currentLinked && (clean(order.merchant_code) !== clean(current.merchant_code) || clean(order.merchant_name) !== clean(current.trade_name)));
  const personal = clean(order.source_channel).toLowerCase() === "admin_personal_order" && !merchantId && !orderCode && !clean(order.merchant_name);
  const dependentConflict = [...(ownersByOrder.get(clean(order.id)) || [])].some((id) => id !== merchantId && id !== candidateId);
  const dependentRepairable = Boolean(candidateId && (dependencyMerchantIdsByOrder.get(clean(order.id)) || []).some((id) => id !== candidateId && (!id || id === merchantId)));
  let classification;
  if (personal) classification = "ALREADY_CORRECT";
  else if (dependentConflict || codeConflict || candidateIds.length > 1) classification = "SECURITY_CONFLICT";
  else if (currentLinked && displayMismatch) classification = "AUTO_REPAIR_SAFE";
  else if (currentLinked) classification = "ALREADY_CORRECT";
  else if (candidateIds.length === 1 && (orderCode || currentCode)) classification = "AUTO_REPAIR_SAFE";
  else if (!merchantId && clean(order.merchant_name)) classification = "MANUAL_REVIEW";
  else if (!merchantId || !current) classification = "MISSING_MERCHANT";
  else if (!currentLinked) classification = "MISSING_PORTAL_LINK";
  else classification = "MANUAL_REVIEW";
  classificationCounts.set(classification, (classificationCounts.get(classification) || 0) + 1);
  const categories = [
    currentLinked && "A", displayMismatch && "B", !merchantId && "C", merchantId && !current && "D",
    current && !currentLinked && "E", current && !currentLinked && candidateIds.length === 1 && "F",
    candidateId && candidateId !== merchantId && orderCode && "G", !merchantId && !orderCode && clean(order.merchant_name) && "H",
    (codeConflict || candidateIds.length > 1) && "I", current && !currentLinked && "J",
    dependentRepairable && "K", dependentConflict && "L", personal && "PERSONAL_ORDER",
  ].filter(Boolean);
  for (const category of categories) categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  classified.push({ order, classification, candidateId });
}

const sums = {};
for (const column of ["cod_amount", "goods_value", "delivery_fee", "discount_amount", "customer_total", "merchant_due", "company_revenue", "delivery_price"]) {
  sums[column] = orders.reduce((total, order) => total + num(order[column]), 0);
}
const groupCount = (keyFn) => {
  const counts = new Map();
  for (const merchant of merchants) { const key = keyFn(merchant); if (key) counts.set(key, (counts.get(key) || 0) + 1); }
  return [...counts.values()].filter((count) => count > 1).length;
};
const orderCounts = new Map();
for (const order of orders) orderCounts.set(clean(order.merchant_id), (orderCounts.get(clean(order.merchant_id)) || 0) + 1);
const activeMerchants = merchants.filter((merchant) => !inactive(merchant.status));
const merchantMatrix = activeMerchants.map((merchant) => {
  const merchantId = clean(merchant.id); const databaseCount = orderCounts.get(merchantId) || 0;
  const linked = (portalUsersByMerchant.get(merchantId)?.size || 0) > 0;
  return {
    merchant_id: merchantId,
    merchant_code: clean(merchant.merchant_code) || null,
    database_count: databaseCount,
    admin_count: databaseCount,
    portal_count: linked ? databaseCount : 0,
    result: linked ? "PASS" : "MISSING_PORTAL_LINK",
  };
});
const authUserIds = new Set(users.map((user) => clean(user.id)));
const linkedUserIds = new Set([...portalUsersByMerchant.values()].flatMap((set) => [...set]));
const acceptance = classified.filter(({ order }) => identity(order.coupon_number) === identity("010505"));

const normalizedStatus = (value) => clean(value).toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
const deliveredOrders = orders.filter((order) => ["delivered", "completed", "complete"].includes(normalizedStatus(order.status)));
const idsFor = (table) => new Set((dependencyRows.get(table) || []).map((row) => clean(row.order_id)).filter(Boolean));
const settlementIds = idsFor("order_financial_settlements");
const codIds = idsFor("cod_collections");
const merchantStatementIds = idsFor("merchant_statement_entries");
const driverStatementIds = idsFor("driver_statement_entries");
const financeAccountRows = dependencyRows.get("financial_account_entries") || [];
const financeAccountKey = new Set(financeAccountRows.map((row) => `${clean(row.order_id)}:${clean(row.account_type)}:${clean(row.entry_type)}`));
const driverId = (order) => clean(order.assigned_driver_id || order.driver_id);
const financialGaps = {
  delivered_orders: deliveredOrders.length,
  missing_settlements: deliveredOrders.filter((order) => !settlementIds.has(clean(order.id))).length,
  missing_cod: deliveredOrders.filter((order) => clean(order.payment_method).toLowerCase() === "cod" && num(order.customer_total) > 0 && !codIds.has(clean(order.id))).length,
  missing_merchant_statements: deliveredOrders.filter((order) => clean(order.merchant_id) && !merchantStatementIds.has(clean(order.id))).length,
  missing_driver_statements: deliveredOrders.filter((order) => driverId(order) && !driverStatementIds.has(clean(order.id))).length,
  missing_merchant_accounts: deliveredOrders.filter((order) => clean(order.merchant_id) && !financeAccountKey.has(`${clean(order.id)}:merchant:delivered_order_settlement`)).length,
  missing_company_accounts: deliveredOrders.filter((order) => !financeAccountKey.has(`${clean(order.id)}:company:delivered_order_settlement`)).length,
};

const usersByEmail = new Map();
const usersByPhone = new Map();
for (const user of users) {
  const email = normalizedEmail(user.email);
  const role = clean(user.app_metadata?.role || user.user_metadata?.role).toLowerCase();
  if (["admin", "support", "driver"].includes(role)) continue;
  if (email && user.email_confirmed_at) {
    const matches = usersByEmail.get(email) || [];
    matches.push(user); usersByEmail.set(email, matches);
  }
  const userPhone = phone(user.phone);
  if (userPhone && user.phone_confirmed_at) {
    const matches = usersByPhone.get(userPhone) || [];
    matches.push(user); usersByPhone.set(userPhone, matches);
  }
}
const activeMerchantEmailCounts = new Map();
const activeMerchantPhoneCounts = new Map();
for (const merchant of activeMerchants) {
  const email = normalizedEmail(merchant.email);
  if (email) activeMerchantEmailCounts.set(email, (activeMerchantEmailCounts.get(email) || 0) + 1);
  const merchantPhone = phone(merchant.phone);
  if (merchantPhone) activeMerchantPhoneCounts.set(merchantPhone, (activeMerchantPhoneCounts.get(merchantPhone) || 0) + 1);
}
const merchantIdentityAudit = activeMerchants.map((merchant) => {
  const merchantId = clean(merchant.id);
  const currentUsers = portalUsersByMerchant.get(merchantId) || new Set();
  const email = normalizedEmail(merchant.email);
  const merchantPhone = phone(merchant.phone);
  const eligible = (user) => {
    const userId = clean(user.id);
    const activeOwner = activeLinkByUser.get(userId);
    const legacyOwner = activeMerchants.find((other) => clean(other.id) !== merchantId && clean(other.user_id) === userId);
    return (!activeOwner || activeOwner === merchantId) && !legacyOwner;
  };
  const emailCandidates = (usersByEmail.get(email) || []).filter(eligible);
  const phoneCandidates = (usersByPhone.get(merchantPhone) || []).filter(eligible);
  const candidates = [...new Map([...emailCandidates, ...phoneCandidates].map((user) => [clean(user.id), user])).values()];
  let classification = "MISSING_PORTAL_LINK";
  let resolution_evidence = email || merchantPhone ? "NO_EXACT_UNIQUE_CONFIRMED_AUTH_IDENTITY" : "MERCHANT_EMAIL_AND_PHONE_MISSING";
  if (currentUsers.size > 0) {
    classification = "ALREADY_CORRECT"; resolution_evidence = "EXPLICIT_EFFECTIVE_PORTAL_RELATION";
  } else if ((activeMerchantEmailCounts.get(email) || 0) > 1) {
    classification = "SECURITY_CONFLICT"; resolution_evidence = "EMAIL_SHARED_BY_MULTIPLE_ACTIVE_MERCHANTS";
  } else if ((activeMerchantPhoneCounts.get(merchantPhone) || 0) > 1) {
    classification = "SECURITY_CONFLICT"; resolution_evidence = "PHONE_SHARED_BY_MULTIPLE_ACTIVE_MERCHANTS";
  } else if (candidates.length > 1) {
    classification = "SECURITY_CONFLICT"; resolution_evidence = "CONFLICTING_OR_MULTIPLE_EXACT_CONFIRMED_AUTH_USERS";
  } else if (candidates.length === 1) {
    classification = "AUTO_REPAIR_SAFE";
    resolution_evidence = emailCandidates.length === 1
      ? "EXACT_UNIQUE_CONFIRMED_AUTH_EMAIL"
      : "EXACT_UNIQUE_CONFIRMED_AUTH_PHONE";
  }
  return {
    merchant_id: merchantId,
    merchant_code: clean(merchant.merchant_code) || null,
    linked_order_count: orderCounts.get(merchantId) || 0,
    classification,
    resolution_evidence,
    candidate_found: candidates.length === 1,
  };
});
const merchantIdentityCounts = Object.fromEntries([...merchantIdentityAudit.reduce((counts, row) => {
  counts.set(row.classification, (counts.get(row.classification) || 0) + 1); return counts;
}, new Map())].sort());

const report = {
  mode: "READ_ONLY_NO_WRITES",
  inventory: {
    orders: orders.length,
    merchants: merchants.length,
    merchant_user_links: links.length,
    auth_users: users.length,
    auth_users_linked_to_merchants: [...linkedUserIds].filter((id) => authUserIds.has(id)).length,
    active_merchants: activeMerchants.length,
    portal_linked_merchants: activeMerchants.filter((merchant) => (portalUsersByMerchant.get(clean(merchant.id))?.size || 0) > 0).length,
    dependent_tables: Object.fromEntries([...dependencyRows].map(([table, rows]) => [table, rows.length])),
  },
  classification_counts: Object.fromEntries([...classificationCounts].sort()),
  category_counts: Object.fromEntries([...categoryCounts].sort()),
  merchant_audit: {
    duplicate_code_groups: groupCount((merchant) => identity(merchant.merchant_code)),
    duplicate_phone_groups: groupCount((merchant) => phone(merchant.phone)),
    duplicate_email_groups: groupCount((merchant) => normalizedEmail(merchant.email)),
    duplicate_legacy_user_id_groups: groupCount((merchant) => clean(merchant.user_id)),
    conflicting_user_links: links.filter((link) => link.active && merchants.some((merchant) => clean(merchant.id) !== clean(link.merchant_id) && clean(merchant.user_id) === clean(link.user_id))).length,
    links_to_missing_merchants: links.filter((link) => !merchantById.has(clean(link.merchant_id))).length,
    merchants_without_portal_link: merchants.filter((merchant) => (portalUsersByMerchant.get(clean(merchant.id))?.size || 0) === 0).length,
    merchants_with_count_match: merchantMatrix.filter((row) => row.result === "PASS").length,
    merchants_missing_portal_link: merchantMatrix.filter((row) => row.result !== "PASS").length,
    identity_classification_counts: merchantIdentityCounts,
    identity_rows_requiring_attention: merchantIdentityAudit.filter((row) => row.classification !== "ALREADY_CORRECT"),
    count_matrix: merchantMatrix,
  },
  financial_dependency_gaps: financialGaps,
  financial_totals: sums,
  acceptance_010505: acceptance.map(({ classification, candidateId }) => ({ classification, candidate_found: Boolean(candidateId) })),
  orders_modified: 0,
};

console.log(JSON.stringify(report, null, 2));
