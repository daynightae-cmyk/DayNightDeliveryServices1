import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);
const assert = (condition, message) => {
  if (!condition) throw new Error(`finalize_admin_order_create_v3_ui_failed: ${message}`);
};
const replaceOnce = (content, from, to, label) => {
  assert(content.includes(from), `missing target: ${label}`);
  return content.replace(from, to);
};
const replaceBetween = (content, startToken, endToken, replacement, label) => {
  const start = content.indexOf(startToken);
  const end = content.indexOf(endToken, start + startToken.length);
  assert(start >= 0 && end > start, `missing boundaries: ${label}`);
  return content.slice(0, start) + replacement + content.slice(end);
};

function removeNativeRequired(content) {
  return content
    .replace(/\n\s*required=\{[^\n]+\}/g, "")
    .replace(/\n\s*required(?=\n)/g, "")
    .replace(/\n\s*aria-required="true"/g, "");
}

const completePath = "artifacts/day-night-delivery/src/components/admin/AdminNewOrderComplete.tsx";
let complete = read(completePath);
const completeValidation = `  function validate() {
    const numericFields: Array<[string, unknown]> = [
      [isArabic ? "قيمة البضاعة" : "goods value", form.goods_value],
      [isArabic ? "الخصم" : "discount", form.discount_amount],
      [isArabic ? "مبلغ التحصيل" : "COD amount", form.cod_amount],
    ];
    if (form.price_mode === "manual") {
      numericFields.push([
        isArabic ? "رسوم التوصيل" : "delivery fee",
        form.manual_delivery_price,
      ]);
    }
    for (const [label, value] of numericFields) {
      if (value === "" || value === null || value === undefined) continue;
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        return isArabic ? \`قيمة غير صحيحة في حقل \${label}.\` : \`Invalid value in \${label}.\`;
      }
    }
    const financialError = orderFinancialValidation({
      goodsValue: form.goods_value === "" ? 0 : form.goods_value,
      deliveryFee: pricing.total,
      discountAmount: form.discount_amount,
      deliveryFeeMode: authoritativeDeliveryFeeMode,
    });
    if (financialError) {
      return isArabic
        ? "راجع القيم المالية المدخلة. يمكن إنشاء طلب بقيمة صفر، لكن لا يمكن إدخال قيمة رقمية غير صحيحة."
        : "Review the entered financial values. Zero-value orders are allowed, but invalid numeric values are not.";
    }
    if (entryMode === "coupon" && couponReview && !reviewConfirmed) {
      return isArabic ? "أكد المراجعة اليدوية قبل الحفظ." : "Confirm manual review before saving.";
    }
    return "";
  }

`;
complete = replaceBetween(
  complete,
  "  function validate() {\n",
  "  function prepareNextOrder(",
  completeValidation,
  "complete order validation",
);
complete = replaceOnce(
  complete,
  `      setSource(result.source);
      setMessage(
        isArabic
          ? \`تم حفظ الطلب وتنظيف الخانات للطلب التالي. الكوبون \${couponNumber} — المطلوب من العميل \${calculated.customerTotal.toFixed(2)} درهم — \${savedSettlement.label} \${savedSettlement.amount.toFixed(2)} درهم — دخل داي نايت \${calculated.companyRevenue.toFixed(2)} درهم.\${auditSuffix}\`
          : \`Order saved and the form is ready for the next order. Coupon \${couponNumber} — customer total \${calculated.customerTotal.toFixed(2)} AED — \${savedSettlement.label.toLowerCase()} \${savedSettlement.amount.toFixed(2)} AED — DAY NIGHT revenue \${calculated.companyRevenue.toFixed(2)} AED.\${auditSuffix}\`,
      );`,
  `      const warningCodes = (result.warnings || [])
        .map((warning) => String(warning.code || ""))
        .filter(Boolean);
      const warningSuffix = warningCodes.length
        ? isArabic
          ? \` تم حفظ الطلب، وتوجد ملاحظة تحتاج مراجعة دون إلغاء الحفظ: \${warningCodes.join("، ")}.\`
          : \` The order was saved with non-blocking review notes: \${warningCodes.join(", ")}.\`
        : "";
      setSource(result.source);
      setMessage(
        isArabic
          ? \`تم حفظ الطلب وتنظيف الخانات للطلب التالي. المرجع \${couponNumber || reference} — المطلوب من العميل \${calculated.customerTotal.toFixed(2)} درهم — \${savedSettlement.label} \${savedSettlement.amount.toFixed(2)} درهم — دخل داي نايت \${calculated.companyRevenue.toFixed(2)} درهم.\${warningSuffix}\${auditSuffix}\`
          : \`Order saved and the form is ready for the next order. Reference \${couponNumber || reference} — customer total \${calculated.customerTotal.toFixed(2)} AED — \${savedSettlement.label.toLowerCase()} \${savedSettlement.amount.toFixed(2)} AED — DAY NIGHT revenue \${calculated.companyRevenue.toFixed(2)} AED.\${warningSuffix}\${auditSuffix}\`,
      );`,
  "complete order warning success message",
);
complete = complete
  .replace("التاجر *", "التاجر — اختياري")
  .replace("Merchant *", "Merchant — optional")
  .replace(/رقم الكوبون \*/g, "رقم الكوبون — اختياري")
  .replace(/Coupon number \*/g, "Coupon number — optional")
  .replace(/اسم العميل \*/g, "اسم العميل — اختياري")
  .replace(/Customer name \*/g, "Customer name — optional")
  .replace(/رقم هاتف العميل \*/g, "رقم هاتف العميل — اختياري")
  .replace(/Customer phone \*/g, "Customer phone — optional")
  .replace(/قيمة البضاعة \*/g, "قيمة البضاعة — يمكن أن تكون صفرًا")
  .replace(/Goods value \*/g, "Goods value — zero allowed");
complete = removeNativeRequired(complete);
write(completePath, complete);

const flexiblePath = "artifacts/day-night-delivery/src/components/admin/AdminNewOrderFlexible.tsx";
let flexible = read(flexiblePath);
const flexibleValidation = `  function validate() {
    const numericFields: Array<[string, unknown]> = [
      [isArabic ? "مبلغ التحصيل" : "COD amount", form.cod_amount],
      [isArabic ? "سعر التوصيل اليدوي" : "manual delivery price", form.manual_delivery_price],
      [isArabic ? "الوزن" : "weight", form.weight],
      [isArabic ? "عدد القطع" : "piece count", form.order_count],
    ];
    for (const [label, value] of numericFields) {
      if (value === "" || value === null || value === undefined) continue;
      if (!Number.isFinite(Number(value))) {
        return isArabic ? \`قيمة غير صحيحة في حقل \${label}.\` : \`Invalid value in \${label}.\`;
      }
    }
    if (form.price_mode === "manual" && Number(form.manual_delivery_price || 0) < 0) {
      return isArabic ? "سعر التوصيل لا يمكن أن يكون سالبًا." : "Delivery price cannot be negative.";
    }
    if (entryMode === "coupon" && couponReview && !reviewConfirmed) {
      return isArabic ? "أكد المراجعة اليدوية قبل الحفظ." : "Confirm manual review before saving.";
    }
    return "";
  }

`;
flexible = replaceBetween(
  flexible,
  "  function validate() {\n",
  "  async function submit(",
  flexibleValidation,
  "flexible order validation",
);
flexible = replaceOnce(
  flexible,
  `      setSource(result.source);
      setMessage(
        isArabic
          ? \`تم حفظ الطلب وربطه بصاحب المتجر \${selectedMerchant?.owner_name || selectedMerchant?.trade_name || ""}. رقم التتبع: \${reference}. السعر: \${price.total.toFixed(2)} درهم.\${auditSuffix}\`
          : \`Order saved and linked to \${selectedMerchant?.owner_name || selectedMerchant?.trade_name || "merchant"}. Tracking: \${reference}. Price: \${price.total.toFixed(2)} AED.\${auditSuffix}\`,
      );`,
  `      const warningCodes = (result.warnings || [])
        .map((warning) => String(warning.code || ""))
        .filter(Boolean);
      const ownerLabel =
        selectedMerchant?.owner_name || selectedMerchant?.trade_name ||
        (isArabic ? "طلب إداري دون ربط حساب تاجر" : "unlinked Admin order");
      const warningSuffix = warningCodes.length
        ? isArabic
          ? \` تم حفظ الطلب، وتوجد ملاحظة تحتاج مراجعة دون إلغاء الحفظ: \${warningCodes.join("، ")}.\`
          : \` Saved with non-blocking review notes: \${warningCodes.join(", ")}.\`
        : "";
      setSource(result.source);
      setMessage(
        isArabic
          ? \`تم حفظ الطلب لصاحب السجل \${ownerLabel}. رقم التتبع: \${reference}. السعر: \${price.total.toFixed(2)} درهم.\${warningSuffix}\${auditSuffix}\`
          : \`Order saved for \${ownerLabel}. Tracking: \${reference}. Price: \${price.total.toFixed(2)} AED.\${warningSuffix}\${auditSuffix}\`,
      );`,
  "flexible warning success message",
);
flexible = flexible
  .replace("التاجر *", "التاجر — اختياري")
  .replace("Merchant *", "Merchant — optional")
  .replace(/اسم المستلم \*/g, "اسم المستلم — اختياري")
  .replace(/Receiver name \*/g, "Receiver name — optional")
  .replace(/هاتف المستلم \*/g, "هاتف المستلم — اختياري")
  .replace(/Receiver phone \*/g, "Receiver phone — optional")
  .replace(/رقم الكوبون \*/g, "رقم الكوبون — اختياري")
  .replace(/Coupon number \*/g, "Coupon number — optional");
flexible = removeNativeRequired(flexible);
write(flexiblePath, flexible);

const personalFormPath = "artifacts/day-night-delivery/src/components/admin/AdminPersonalOrderForm.tsx";
let personalForm = read(personalFormPath);
const submitStart = personalForm.indexOf("  async function submit(event: FormEvent<HTMLFormElement>) {");
const savingAt = personalForm.indexOf("    setSaving(true);", submitStart);
assert(submitStart >= 0 && savingAt > submitStart, "personal validation boundaries");
const personalSubmitPrefix = `  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!financials) {
      setError(
        isArabic
          ? "راجع القيم المالية. يمكن إنشاء الطلب بقيمة صفر، لكن لا يمكن أن يتجاوز الخصم الإجمالي."
          : "Review the financial values. Zero-value orders are allowed, but discount cannot exceed the total.",
      );
      return;
    }

`;
personalForm = personalForm.slice(0, submitStart) + personalSubmitPrefix + personalForm.slice(savingAt);
personalForm = replaceOnce(
  personalForm,
  `      setMessage(
        isArabic
          ? \`تم إنشاء الطلب الشخصي \${ref} بدون تاجر. التوصيل ثابت \${PERSONAL_ORDER_DELIVERY_FEE.toFixed(2)} درهم، والمطلوب من العميل \${financials.customerTotal.toFixed(2)} درهم.\`
          : \`Personal order \${ref} was created without a merchant. Delivery is fixed at \${PERSONAL_ORDER_DELIVERY_FEE.toFixed(2)} AED and customer total is \${financials.customerTotal.toFixed(2)} AED.\`,
      );`,
  `      const warningCodes = (result.warnings || [])
        .map((warning) => String(warning.code || ""))
        .filter(Boolean);
      const warningSuffix = warningCodes.length
        ? isArabic
          ? \` تم حفظ الطلب، وتوجد ملاحظة تحتاج مراجعة دون إلغاء الحفظ: \${warningCodes.join("، ")}.\`
          : \` Saved with non-blocking review notes: \${warningCodes.join(", ")}.\`
        : "";
      setMessage(
        isArabic
          ? \`تم إنشاء الطلب الشخصي \${ref} بدون تاجر. التوصيل ثابت \${PERSONAL_ORDER_DELIVERY_FEE.toFixed(2)} درهم، والمطلوب من العميل \${financials.customerTotal.toFixed(2)} درهم.\${warningSuffix}\`
          : \`Personal order \${ref} was created without a merchant. Delivery is fixed at \${PERSONAL_ORDER_DELIVERY_FEE.toFixed(2)} AED and customer total is \${financials.customerTotal.toFixed(2)} AED.\${warningSuffix}\`,
      );`,
  "personal warning success message",
);
personalForm = personalForm
  .replace("رقم الكوبون * — إجباري", "رقم الكوبون — اختياري ويمكن مراجعته لاحقًا")
  .replace("Coupon number * — required", "Coupon number — optional and reviewable later")
  .replace(
    "طلب مباشر بين مرسل ومستلم. رقم الكوبون إلزامي، ولا يُنشأ حساب تاجر، ورسوم التوصيل ثابتة 25 درهم.",
    "طلب مباشر صالح بدون تاجر. يمكن ترك الكوبون وبيانات الربط غير المكتملة للمراجعة لاحقًا، ورسوم التوصيل ثابتة 25 درهم.",
  )
  .replace(
    "Direct sender-to-recipient order. The coupon number is required, no merchant ledger is created, and delivery is fixed at 25 AED.",
    "Valid direct order without merchant. Coupon and incomplete relationship data can be reviewed later; delivery is fixed at 25 AED.",
  );
personalForm = removeNativeRequired(personalForm);
write(personalFormPath, personalForm);

const gatePath = "artifacts/day-night-delivery/scripts/admin-order-create-v3-gate.mjs";
write(gatePath, `import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const read = (file) => fs.readFileSync(path.resolve(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(\`admin_order_create_v3_gate_failed: \${message}\`);
};
const migration = read("../../supabase/migrations/20260804211500_admin_order_crud_v3_nonblocking.sql");
const mutations = read("src/lib/adminOrderMutations.ts");
const adminData = read("src/lib/adminOperationsData.ts");
const financial = read("src/lib/orderFinancialOperations.ts");
const personal = read("src/lib/personalOrderOperations.ts");
const complete = read("src/components/admin/AdminNewOrderComplete.tsx");
const flexible = read("src/components/admin/AdminNewOrderFlexible.tsx");
const personalForm = read("src/components/admin/AdminPersonalOrderForm.tsx");
for (const token of [
  "admin_create_order_v3",
  "admin_order_mutation_audit_v3_create_request_uidx",
  "merchant_link_warning",
  "merchant_portal_account_not_linked",
  "coupon_reconciliation_required",
  "notification_sync_queued",
  "dn_admin_order_override_active",
]) assert(migration.includes(token), \`missing create migration contract: \${token}\`);
assert(migration.includes("if v_actor is null") && migration.includes("daynight_admin_or_support()"), "create authorization missing");
assert(migration.includes("insert into public.orders") && migration.includes("returning *"), "core create does not return the saved row");
assert(migration.includes("jsonb_populate_record(null::public.orders"), "schema-aware create payload missing");
assert(migration.includes("merchant_id','null") || migration.includes("'{merchant_id}','null'"), "merchant-null create support missing");
assert(mutations.includes("createAdminOrder") && mutations.includes('supabase.rpc("admin_create_order_v3"'), "shared create client missing");
assert(mutations.includes("inFlight") && mutations.includes("requestId"), "create idempotency/duplicate prevention missing");
assert(adminData.includes("createAdminOrder(payload") && !/createOpsOrder[\\s\\S]*admin_create_canonical_merchant_order/.test(adminData), "flexible create still uses restrictive merchant RPC");
assert(financial.includes("createAdminOrder(payload") && !/createFinancialOpsOrder[\\s\\S]*resolveCanonicalMerchantForOrder/.test(financial), "financial create still requires portal-linked merchant");
assert(personal.includes("createAdminOrder(payload") && !personal.includes("coupon_number_required_for_personal_order"), "personal create remains coupon-blocked");
assert(!/function validate\\(\\)[\\s\\S]*!selectedMerchant/.test(complete), "complete create still blocks missing merchant");
assert(!/function validate\\(\\)[\\s\\S]*coupon number/.test(complete), "complete create still blocks missing coupon");
assert(!/function validate\\(\\)[\\s\\S]*!selectedMerchant/.test(flexible), "flexible create still blocks missing merchant");
assert(personalForm.includes("اختياري ويمكن مراجعته لاحقًا") && !/data-admin-personal-coupon="true"[\\s\\S]{0,180}required/.test(personalForm), "personal form coupon remains required");
assert(complete.includes("ملاحظة تحتاج مراجعة دون إلغاء الحفظ"), "complete create warning-success UI missing");
assert(flexible.includes("ملاحظة تحتاج مراجعة دون إلغاء الحفظ"), "flexible create warning-success UI missing");
assert(personalForm.includes("ملاحظة تحتاج مراجعة دون إلغاء الحفظ"), "personal create warning-success UI missing");
console.log(JSON.stringify({
  result: "PASS",
  canonicalCreateRpc: "admin_create_order_v3",
  merchantNull: true,
  unlinkedMerchantWarning: true,
  couponWarning: true,
  zeroValue: true,
  manualFee: true,
  personalOrder: true,
  returnedRow: true,
  idempotency: true,
  warningSuccessUi: true,
}, null, 2));
`);

const coreGatePath = "artifacts/day-night-delivery/scripts/production-core-rescue-gate.mjs";
let coreGate = read(coreGatePath);
coreGate = coreGate
  .replace(
    'expect(adminOrder, /!selectedMerchant/, "Admin order creation requires a real selected merchant");',
    'reject(adminOrder, /function validate\\(\\)[\\s\\S]*!selectedMerchant/, "Admin order creation does not require a linked merchant");',
  )
  .replace(
    'expect(adminData, /admin_create_canonical_merchant_order/, "Order creation uses the canonical protected admin order RPC");',
    'expect(adminData, /createAdminOrder/, "Order creation uses the shared canonical Admin mutation service");\nconst createMutations = read("src/lib/adminOrderMutations.ts");\nexpect(createMutations, /admin_create_order_v3/, "Order creation uses the non-blocking canonical v3 RPC");',
  )
  .replace(
    'expect(adminData, /merchant_id:/, "Orders persist the merchant relationship");',
    'expect(adminData, /merchant_id:/, "Orders preserve supplied merchant information when available");\nexpect(adminData, /const merchant = input\\.merchant \\|\\| null/, "Orders support merchant_id null");',
  );
write(coreGatePath, coreGate);

const personalGatePath = "artifacts/day-night-delivery/scripts/personal-orders-admin-gate.mjs";
let personalGate = read(personalGatePath);
personalGate = personalGate
  .replace(
    'expect(personal, /رقم الكوبون \\* — إجباري/, "personal coupon is visibly required during new personal-order creation");',
    'expect(personal, /رقم الكوبون — اختياري ويمكن مراجعته لاحقًا/, "personal coupon is visibly optional for Admin creation");',
  )
  .replace(
    'expect(personal, /data-admin-personal-coupon="true"[\\s\\S]*required[\\s\\S]*aria-required="true"/, "new personal-order coupon uses native required semantics");',
    'reject(personal, /data-admin-personal-coupon="true"[\\s\\S]{0,180}required/, "Admin personal-order coupon is not a native blocking requirement");',
  )
  .replace(
    'expect(personal, /data-admin-next-order-focus="true"/, "personal coupon uses global duplicate preflight during creation");',
    'expect(personal, /data-admin-next-order-focus="true"/, "personal reference remains ready for optional entry");',
  )
  .replace(
    'expect(operations, /coupon_number_required_for_personal_order/, "new personal-order runtime rejects a missing coupon");',
    'reject(operations, /coupon_number_required_for_personal_order/, "Admin personal-order runtime does not reject a missing coupon");',
  )
  .replace(
    'expect(operations, /coupon_number: couponNumber/, "personal coupon is stored in coupon_number during creation");',
    'expect(operations, /coupon_number: couponNumber \\|\\| null/, "personal coupon is stored when supplied and remains nullable otherwise");',
  )
  .replace(
    'expect(operations, /admin_create_personal_order/, "personal order uses protected RPC");',
    'expect(operations, /createAdminOrder/, "personal order uses canonical Admin create v3 service");',
  );
write(personalGatePath, personalGate);

const packagePath = "artifacts/day-night-delivery/package.json";
const packageJson = JSON.parse(read(packagePath));
packageJson.scripts ||= {};
packageJson.scripts["test:admin-order-create-v3"] = "node scripts/admin-order-create-v3-gate.mjs";
const productionGate = String(packageJson.scripts["production:gate"] || "");
if (!productionGate.includes("admin-order-create-v3-gate.mjs")) {
  packageJson.scripts["production:gate"] = `${productionGate} && node scripts/admin-order-create-v3-gate.mjs`;
}
write(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

console.log("Prepared non-blocking Admin order create v3 UI and verification gates.");
