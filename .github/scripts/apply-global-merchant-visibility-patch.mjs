import fs from "node:fs";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${count}`);
  }
  return source.replace(before, after);
}

const adminDataPath = "artifacts/day-night-delivery/src/lib/adminData.ts";
let adminData = fs.readFileSync(adminDataPath, "utf8");
adminData = replaceOnce(
  adminData,
  `export async function fetchAdminOrders(): Promise<Order[]> {\n  const result = await fetchAdminOrdersPage({ page: 1, pageSize: 100 });\n  return result.rows;\n}`,
  `export async function fetchAdminOrders(): Promise<Order[]> {\n  const first = await fetchAdminOrdersPage({ page: 1, pageSize: 100 });\n  if (first.source !== "db" || first.warning) {\n    throw new Error(first.warning || "Orders could not be loaded safely right now.");\n  }\n\n  const rows = [...first.rows];\n  for (let page = 2; page <= first.totalPages; page += 1) {\n    const next = await fetchAdminOrdersPage({ page, pageSize: first.pageSize });\n    if (next.source !== "db" || next.warning) {\n      throw new Error(next.warning || \`Orders page \${page} could not be loaded safely.\`);\n    }\n    rows.push(...next.rows);\n  }\n\n  return rows;\n}`,
  "fetch all admin order pages",
);
fs.writeFileSync(adminDataPath, adminData);

const panelPath = "artifacts/day-night-delivery/src/components/AdminPanelLuxury.tsx";
let panel = fs.readFileSync(panelPath, "utf8");
panel = replaceOnce(
  panel,
  `  const [adminLoading, setAdminLoading] = useState(true);\n  const [adminError, setAdminError] = useState("");`,
  `  const [adminLoading, setAdminLoading] = useState(true);\n  const [adminError, setAdminError] = useState("");\n  const [ordersLoaded, setOrdersLoaded] = useState(false);`,
  "orders loaded state",
);
panel = replaceOnce(
  panel,
  `    if (ordersResult.status === "fulfilled") {\n      setOrders(Array.isArray(ordersResult.value) ? ordersResult.value : []);\n    } else {\n      console.warn("Orders request failed:", ordersResult.reason);\n      setAdminError(\n        isArabic\n          ? "تعذر تحميل الطلبات حالياً."\n          : "Could not load orders right now.",\n      );\n    }`,
  `    if (ordersResult.status === "fulfilled") {\n      const loadedOrders = Array.isArray(ordersResult.value) ? ordersResult.value : [];\n      setOrders(loadedOrders);\n      setOrdersLoaded(true);\n    } else {\n      console.warn("Orders request failed:", ordersResult.reason);\n      setAdminError(\n        isArabic\n          ? "تعذر تحميل الطلبات من قاعدة البيانات. لم يتم استبدال البيانات السابقة بصفر كاذب. اضغط تحديث أو سجّل الدخول مجددًا."\n          : "Orders could not be loaded from the database. Existing rows were preserved instead of showing a false zero. Refresh or sign in again.",\n      );\n    }`,
  "preserve orders on load failure",
);
panel = replaceOnce(
  panel,
  `          <AdminNewOrder\n            isArabic={isArabic}\n            merchants={merchants}\n            onSaved={() => void refreshAdminData()}\n          />`,
  `          <AdminNewOrder\n            isArabic={isArabic}\n            merchants={merchants}\n            onSaved={(savedOrder) => {\n              setOrders((current) => [\n                savedOrder,\n                ...current.filter((order) => String(order.id) !== String(savedOrder.id)),\n              ]);\n              setOrdersLoaded(true);\n              setSection("all_orders");\n              void refreshAdminData();\n            }}\n          />`,
  "optimistic saved order visibility",
);
panel = replaceOnce(
  panel,
  `          <AdminOrderCommandDeck\n            isArabic={isArabic}\n            active={active}\n            orders={orders}\n            onSelect={(id) => setSection(id)}\n          />`,
  `          {ordersLoaded && (\n            <AdminOrderCommandDeck\n              isArabic={isArabic}\n              active={active}\n              orders={orders}\n              onSelect={(id) => setSection(id)}\n            />\n          )}`,
  "hide false zero command deck",
);
fs.writeFileSync(panelPath, panel);

const financialPath = "artifacts/day-night-delivery/src/lib/orderFinancialOperations.ts";
let financial = fs.readFileSync(financialPath, "utf8");
financial = replaceOnce(
  financial,
  `export type CouponConflict = {\n  coupon_number: string;\n  order_id: string;\n  tracking_number: string;\n  merchant_name: string;\n  receiver_name: string;\n  receiver_phone: string;\n};`,
  `export type CouponConflict = {\n  coupon_number: string;\n  order_id: string;\n  tracking_number: string;\n  merchant_name: string;\n  receiver_name: string;\n  receiver_phone: string;\n};\n\nexport type MerchantPortalResolution = {\n  ok: boolean;\n  selected_merchant_id: string;\n  canonical_merchant_id: string;\n  canonicalized: boolean;\n  portal_link_count: number;\n  merchant: Merchant;\n  ownership_rule: string;\n};`,
  "merchant portal resolution type",
);
financial = replaceOnce(
  financial,
  `async function recoverCouponConflict(\n  couponNumber: unknown,\n  excludeOrderId: string | null = null,\n) {`,
  `function merchantPortalLinkError(error: unknown, merchant: Merchant) {\n  const detail = opsErrorDetail(error);\n  const normalized = detail.toLowerCase();\n  let message = detail;\n\n  if (normalized.includes("merchant_portal_account_not_linked")) {\n    message = \`التاجر «\${clean(merchant.trade_name) || clean(merchant.merchant_code) || "غير محدد"}» غير مرتبط بحساب دخول في بوابة التاجر. لم يتم حفظ الطلب حتى لا يختفي من حساب التاجر. اربط حساب التاجر أولًا ثم أعد الحفظ.\`;\n  } else if (normalized.includes("merchant_portal_link_ambiguous")) {\n    message = \`يوجد أكثر من حساب بوابة مطابق للتاجر «\${clean(merchant.trade_name) || "غير محدد"}». لم يتم حفظ الطلب. وحّد سجل التاجر واربط حسابًا واحدًا فقط.\`;\n  } else if (normalized.includes("merchant_inactive_for_order")) {\n    message = \`حساب التاجر «\${clean(merchant.trade_name) || "غير محدد"}» غير نشط ولا يمكن إنشاء طلب عليه.\`;\n  }\n\n  const wrapped = new Error(message || "تعذر التحقق من ربط الطلب بحساب التاجر. لم يتم حفظ الطلب.") as Error & { code?: string };\n  wrapped.name = "MerchantPortalLinkError";\n  wrapped.code = "merchant_portal_link_required";\n  return wrapped;\n}\n\nexport async function resolveOrderMerchant(merchant: Merchant): Promise<Merchant> {\n  if (!supabase || !merchant?.id) throw merchantPortalLinkError(null, merchant);\n\n  const { data, error } = await supabase.rpc("admin_resolve_order_merchant", {\n    p_merchant_id: merchant.id,\n  });\n  if (error) throw merchantPortalLinkError(error, merchant);\n\n  const value = (Array.isArray(data) ? data[0] : data) as MerchantPortalResolution | null;\n  const resolved = value?.merchant;\n  if (!value?.ok || !resolved?.id || Number(value.portal_link_count || 0) < 1) {\n    throw merchantPortalLinkError(null, merchant);\n  }\n  return resolved;\n}\n\nasync function recoverCouponConflict(\n  couponNumber: unknown,\n  excludeOrderId: string | null = null,\n) {`,
  "merchant portal resolver",
);
financial = replaceOnce(
  financial,
  `  const merchant = input.merchant;\n  if (!merchant?.id) throw operationError(null, "merchant_required");\n\n  const existingConflict = await findCouponConflict(input.coupon_number);`,
  `  const selectedMerchant = input.merchant;\n  if (!selectedMerchant?.id) throw operationError(null, "merchant_required");\n  const merchant = await resolveOrderMerchant(selectedMerchant);\n\n  const existingConflict = await findCouponConflict(input.coupon_number);`,
  "resolve merchant before create",
);
financial = replaceOnce(
  financial,
  `  if (!row?.id && !row?.tracking_number && !row?.invoice_number) {\n    throw operationError(null, "financial_order_creation_returned_no_row");\n  }\n  return { row, source: "rpc" };`,
  `  if (!row?.id && !row?.tracking_number && !row?.invoice_number) {\n    throw operationError(null, "financial_order_creation_returned_no_row");\n  }\n  if (clean(row.merchant_id) !== clean(merchant.id)) {\n    throw operationError(null, "saved_order_merchant_portal_link_mismatch");\n  }\n  return { row, source: "rpc" };`,
  "verify saved merchant ownership",
);
financial = replaceOnce(
  financial,
  `  const merchant = input.merchant;\n  if (!merchant?.id) throw operationError(null, "merchant_required");\n\n  const excludeOrderId = clean(input.order.id) || null;`,
  `  const selectedMerchant = input.merchant;\n  if (!selectedMerchant?.id) throw operationError(null, "merchant_required");\n  const merchantChanged = clean(selectedMerchant.id) !== clean(input.order.merchant_id);\n  const merchant = merchantChanged\n    ? await resolveOrderMerchant(selectedMerchant)\n    : selectedMerchant;\n\n  const excludeOrderId = clean(input.order.id) || null;`,
  "resolve merchant only on update ownership change",
);
fs.writeFileSync(financialPath, financial);

console.log("Applied global merchant order visibility patch.");
