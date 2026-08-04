import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);
const assert = (condition, message) => {
  if (!condition) throw new Error(`finalize_admin_order_crud_v3_failed: ${message}`);
};
const replaceOnce = (content, from, to, label) => {
  assert(content.includes(from), `missing replacement target: ${label}`);
  return content.replace(from, to);
};

const migrationPath = "supabase/migrations/20260804211500_admin_order_crud_v3_nonblocking.sql";
let migration = read(migrationPath);
migration = replaceOnce(
  migration,
  "if v_key in ('order_count','pieces','financial_version') then",
  "if v_key = any(array['order_count','pieces','financial_version']) then",
  "PL/pgSQL numeric integer key condition",
);
migration = replaceOnce(
  migration,
  "if v_key in ('order_count','pieces') then v_numeric := greatest(v_numeric, 1); end if;",
  "if v_key = any(array['order_count','pieces']) then v_numeric := greatest(v_numeric, 1); end if;",
  "PL/pgSQL minimum count condition",
);
migration = replaceOnce(
  migration,
  "select count(*), min(m.id) into v_candidate_count, v_candidate_merchant",
  "select count(*), (array_agg(m.id order by m.id))[1] into v_candidate_count, v_candidate_merchant",
  "UUID exact merchant aggregate",
);
migration = migration.replace(
  "jsonb_set(v_patch, '{merchant_code}', to_jsonb(v_merchant.merchant_code), true)",
  "jsonb_set(v_patch, '{merchant_code}', coalesce(to_jsonb(v_merchant.merchant_code), 'null'::jsonb), true)",
);
migration = migration.replace(
  "jsonb_set(v_patch, '{merchant_name}', to_jsonb(v_merchant.trade_name), true)",
  "jsonb_set(v_patch, '{merchant_name}', coalesce(to_jsonb(v_merchant.trade_name), 'null'::jsonb), true)",
);

const legacyStatusStart = migration.indexOf(
  "create or replace function public.admin_update_order_status(\n  p_order_id text,",
);
const softDeleteStart = migration.indexOf(
  "create or replace function public.admin_soft_delete_order_v3(p_payload jsonb)",
);
assert(legacyStatusStart >= 0 && softDeleteStart > legacyStatusStart, "legacy status wrapper boundaries");
const statusWrapper = `create or replace function public.admin_update_order_status(
  p_order_id text,
  p_status text,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_result jsonb;
  v_order public.orders%rowtype;
begin
  v_result := public.admin_update_order_status_verified(
    public.dn_admin_safe_uuid_v3(p_order_id),
    p_status,
    p_note
  );
  select * into v_order
  from jsonb_populate_record(null::public.orders, v_result -> 'order');
  if v_order.id is null then
    raise exception 'admin_update_order_status_v3_returned_no_order';
  end if;
  return v_order;
end;
$$;

`;
migration =
  migration.slice(0, legacyStatusStart) +
  statusWrapper +
  migration.slice(softDeleteStart);
write(migrationPath, migration);

const deletePath = "artifacts/day-night-delivery/src/lib/adminOrderDeleteData.ts";
let deleteFile = read(deletePath);
deleteFile = replaceOnce(
  deleteFile,
  "  if (!result.order.is_deleted && !result.order.deleted_at) {",
  "  const saved = result.order as Order & { is_deleted?: boolean; deleted_at?: string | null };\n  if (!saved.is_deleted && !saved.deleted_at) {",
  "soft-delete typed readback",
);
write(deletePath, deleteFile);

const modalPath = "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx";
let modal = read(modalPath);
modal = replaceOnce(
  modal,
  `import {
  saveAdminLockedMerchantCoreEdit,
  saveAdminOrderEdit,
} from "../../lib/adminOrderEditPersistence";`,
  `import { saveAdminOrderEdit } from "../../lib/adminOrderEditPersistence";`,
  "modal canonical persistence import",
);
modal = replaceOnce(
  modal,
  `const ORDER_STATUS_LABELS: Record<string, { ar: string; en: string }> = {`,
  `const EDITABLE_ORDER_STATUSES = [
  "pending",
  "review",
  "confirmed",
  "assigned",
  "picked_up",
  "in_transit",
  "delivered",
  "postponed",
  "returned",
  "cancelled",
] as const;

const ORDER_STATUS_LABELS: Record<string, { ar: string; en: string }> = {`,
  "modal editable status catalog",
);
modal = replaceOnce(
  modal,
  `  const [message, setMessage] = useState("");
  const [error, setError] = useState("");`,
  `  const [message, setMessage] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");`,
  "modal warning state",
);
modal = replaceOnce(
  modal,
  `    setMessage("");
    setError("");`,
  `    setMessage("");
    setWarnings([]);
    setError("");`,
  "modal warning reset on open",
);
modal = replaceOnce(
  modal,
  `  function clearFeedback() {
    setMessage("");
    setError("");`,
  `  function clearFeedback() {
    setMessage("");
    setWarnings([]);
    setError("");`,
  "modal warning clear",
);
modal = replaceOnce(
  modal,
  `      if (!selectedMerchant) return null;
      return calculateFinancialOpsOrder({ ...form, merchant: selectedMerchant });`,
  `      if (!selectedMerchant) {
        const goodsValue = Math.max(0, Number(form.goods_value || 0));
        const deliveryFee = Math.max(
          0,
          Number(
            form.manual_delivery_price === "" || form.manual_delivery_price == null
              ? order?.delivery_fee || order?.delivery_price || 0
              : form.manual_delivery_price,
          ),
        );
        const discountAmount = Math.max(0, Number(form.discount_amount || 0));
        const feeMode = form.delivery_fee_mode === "deduct_from_merchant"
          ? "deduct_from_merchant"
          : "customer_pays";
        const customerTotal = Math.max(
          0,
          feeMode === "deduct_from_merchant"
            ? goodsValue - discountAmount
            : goodsValue + deliveryFee - discountAmount,
        );
        return {
          goodsValue,
          deliveryFee,
          discountAmount,
          deliveryFeeMode: feeMode,
          customerTotal,
          merchantDue:
            feeMode === "deduct_from_merchant"
              ? goodsValue - discountAmount - deliveryFee
              : goodsValue - discountAmount,
          companyRevenue: deliveryFee,
          systemDeliveryFee: deliveryFee,
          priceSource: "manual" as const,
        };
      }
      return calculateFinancialOpsOrder({ ...form, merchant: selectedMerchant });`,
  "unlinked merchant financial preview",
);

const validateStart = modal.indexOf("  function validate() {");
const saveStart = modal.indexOf("  async function save(event: FormEvent<HTMLFormElement>) {");
assert(validateStart >= 0 && saveStart > validateStart, "modal validate boundaries");
const validation = `  function validate() {
    const numericFields: Array<[string, unknown]> = [
      [isArabic ? "قيمة البضاعة" : "goods value", currentForm.goods_value],
      [isArabic ? "الخصم" : "discount", currentForm.discount_amount],
      [isArabic ? "مبلغ التحصيل" : "COD amount", currentForm.cod_amount],
    ];
    if (currentForm.price_mode === "manual") {
      numericFields.push([
        isArabic ? "رسوم التوصيل" : "delivery fee",
        currentForm.manual_delivery_price,
      ]);
    }
    for (const [label, value] of numericFields) {
      if (value === "" || value === null || value === undefined) continue;
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        return isArabic ? \`قيمة غير صحيحة في حقل \${label}.\` : \`Invalid value in \${label}.\`;
      }
    }
    return "";
  }

`;
modal = modal.slice(0, validateStart) + validation + modal.slice(saveStart);
modal = replaceOnce(
  modal,
  `      const result =
        financialLocked && !personalOrder && !sensitiveChange
          ? await saveAdminLockedMerchantCoreEdit(saveInput)
          : await saveAdminOrderEdit(saveInput);`,
  `      const result = await saveAdminOrderEdit(saveInput);`,
  "modal single canonical save",
);
modal = replaceOnce(
  modal,
  `            auditId: result.auditId,
          },`,
  `            auditId: result.auditId,
            warnings: result.warnings || [],
            reconciliationRequired: Boolean(result.reconciliationRequired),
            requestId: result.requestId,
          },`,
  "modal canonical event metadata",
);

const successStart = modal.indexOf("      const auditSuffix = result.auditId");
const catchStart = modal.indexOf("    } catch (cause) {", successStart);
assert(successStart >= 0 && catchStart > successStart, "modal success message boundaries");
const successBlock = `      const warningCodes = (result.warnings || [])
        .map((warning) => String(warning.code || ""))
        .filter(Boolean);
      setWarnings(warningCodes);
      setMessage(
        warningCodes.length
          ? isArabic
            ? \`تم حفظ الطلب \${orderReference(result.row)}، وتوجد ملاحظة تحتاج مراجعة دون إلغاء الحفظ.\`
            : \`Order \${orderReference(result.row)} was saved with non-blocking reconciliation notes.\`
          : isArabic
            ? \`تم حفظ الطلب \${orderReference(result.row)} وتأكيد القيم من قاعدة البيانات.\`
            : \`Order \${orderReference(result.row)} was saved and confirmed by the database.\`,
      );
      window.dispatchEvent(
        new CustomEvent("dn-admin-order-operation-result", {
          detail: {
            success: true,
            operation: "update",
            order: result.row,
            warnings: result.warnings || [],
            reconciliationRequired: Boolean(result.reconciliationRequired),
          },
        }),
      );
      window.setTimeout(onClose, warningCodes.length ? 1200 : 450);
`;
modal = modal.slice(0, successStart) + successBlock + modal.slice(catchStart);
modal = modal.replace("disabled={busy || !financials}", "disabled={busy}");
modal = modal.replace(/\n\s*required=\{!personalOrder\}/g, "");
modal = modal.replace(/\n\s*required=\{personalOrder\}/g, "");
modal = modal.replace(/\n\s*required(?=\n)/g, "");
modal = modal.replace(/\n\s*aria-required="true"/g, "");
modal = modal.replace("التاجر القانوني *", "التاجر — اختياري");
modal = modal.replace("Canonical merchant *", "Merchant — optional");
modal = modal.replace("اسم المرسل *", "اسم المرسل — اختياري");
modal = modal.replace("Sender name *", "Sender name — optional");
modal = modal.replace("اسم العميل *", "اسم العميل — اختياري");
modal = modal.replace("Customer name *", "Customer name — optional");
modal = modal.replace("هاتف العميل *", "هاتف العميل — اختياري");
modal = modal.replace("Customer phone *", "Customer phone — optional");
modal = modal.replace(/رقم الكوبون \*/g, "رقم الكوبون — اختياري");
modal = modal.replace(/Coupon number \*/g, "Coupon number — optional");
modal = modal.replace(
  "اختر التاجر",
  "اختر التاجر أو اترك الطلب دون ربط",
);
modal = modal.replace(
  "Select merchant",
  "Select a merchant or leave unlinked",
);
modal = modal.replace(
  "لن يتم الحفظ إلا بعد التحقق من التاجر الجديد وعدم وجود تعارض في ملكية القيود التابعة.",
  "سيُحفظ الطلب أولًا، وأي نقص في ربط حساب التاجر سيظهر كملاحظة مراجعة غير مانعة.",
);
modal = modal.replace(
  "Save is allowed only for a canonical portal-linked merchant with no dependent ownership conflict.",
  "The order is saved first; missing portal linkage is returned as a non-blocking review warning.",
);
modal = modal.replace(
  "تغيير التاجر يزامن ملكية COD وكشف التاجر والقيود التابعة، ويُسجَّل التعديل المالي بالقيم السابقة واللاحقة ضمن عملية واحدة قابلة للمراجعة.",
  "يحفظ مسار الإدارة القيم الأساسية أولًا، ثم يعرض أي مزامنة مالية أو ربط ناقص كملاحظة مراجعة دون التراجع عن الحفظ.",
);
modal = modal.replace(
  "Merchant ownership dependencies and delivered accounting are synchronized atomically with before/after audit evidence.",
  "Core values are saved first; optional ownership or accounting work is returned as a review warning without rolling the order back.",
);

const statusInsertTarget = "          {financialLocked && !personalOrder && (";
assert(modal.includes(statusInsertTarget), "modal status selector insertion point");
const statusSelector = `          <section className={\`${sectionClass} mb-4 border-cyan-300/25 bg-cyan-300/[0.055]\`}>
            <h3 className="flex items-center gap-2 font-black text-cyan-100">
              <PackageCheck className="h-4 w-4" />
              {isArabic ? "الحالة التشغيلية" : "Operational status"}
            </h3>
            <label className={labelClass}>
              <span>{isArabic ? "اختر الحالة الجديدة" : "Select the new status"}</span>
              <select
                value={form.status || order.status || "pending"}
                onChange={(event) => setField("status", event.target.value)}
                className={inputClass()}
                data-admin-order-v3-status="true"
              >
                {EDITABLE_ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {orderStatusLabel(status, isArabic)}
                  </option>
                ))}
              </select>
              <small className="text-[10px] font-bold leading-5 text-white/45">
                {isArabic
                  ? "يمكن للمدير تصحيح الحالة من أي حالة سابقة. الحفظ لا يتوقف بسبب ربط التاجر أو الكوبون أو حساب المندوب."
                  : "Admins can correct any previous status. Merchant, coupon, or driver-account linkage cannot block the core save."}
              </small>
            </label>
          </section>

`;
modal = modal.replace(statusInsertTarget, statusSelector + statusInsertTarget);

const warningInsertTarget = "          {error && (";
assert(modal.includes(warningInsertTarget), "modal warning panel insertion point");
const warningPanel = `          {warnings.length > 0 && (
            <section className="sticky top-0 z-40 mb-4 rounded-[1.4rem] border border-amber-300/35 bg-[linear-gradient(135deg,rgba(100,60,8,0.92),rgba(45,27,4,0.97))] p-4 text-amber-50 shadow-[0_18px_50px_rgba(0,0,0,0.3)] backdrop-blur-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
                <div>
                  <strong className="block text-sm font-black">
                    {isArabic ? "تم الحفظ وتوجد ملاحظات مراجعة" : "Saved with review notes"}
                  </strong>
                  <p className="mt-1 text-xs font-bold leading-6 text-amber-50/85">
                    {isArabic
                      ? "لم تُلغِ هذه الملاحظات حفظ الطلب. رموز المراجعة: "
                      : "These notes did not roll the order back. Review codes: "}
                    <span dir="ltr">{warnings.join("، ")}</span>
                  </p>
                </div>
              </div>
            </section>
          )}
`;
modal = modal.replace(warningInsertTarget, warningPanel + warningInsertTarget);
write(modalPath, modal);

const gatePath = "artifacts/day-night-delivery/scripts/admin-order-crud-v3-gate.mjs";
write(
  gatePath,
  `import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const read = (file) => fs.readFileSync(path.resolve(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(\`admin_order_crud_v3_gate_failed: \${message}\`);
};
const migration = read("../../supabase/migrations/20260804211500_admin_order_crud_v3_nonblocking.sql");
const service = read("src/lib/adminOrderMutations.ts");
const persistence = read("src/lib/adminOrderEditPersistence.ts");
const statusClient = read("src/supabaseAdminOps.ts");
const modal = read("src/components/admin/AdminOrderEditModalComplete.tsx");
const deletion = read("src/lib/adminOrderDeleteData.ts");
for (const token of [
  "admin_update_order_complete_v3",
  "dn_admin_order_override_active",
  "merchant_link_warning",
  "coupon_reconciliation_required",
  "financial_reconciliation_required",
  "admin_order_mutation_audit_v3",
  "admin_order_reconciliation_queue",
  "admin_soft_delete_order_v3",
  "admin_restore_order_v3",
  "admin_bulk_mutate_orders_v3",
  "admin_permanently_delete_order_v3",
]) assert(migration.includes(token), \`missing migration contract: \${token}\`);
assert(migration.includes("when (not public.dn_admin_order_override_active())"), "strict trigger override predicates missing");
assert(!migration.includes("if v_key in ("), "invalid PL/pgSQL IN syntax remains");
assert(/returns public\.orders[\\s\\S]+admin_update_order_status_verified/.test(migration), "legacy status return type compatibility missing");
assert(/admin_update_order_complete_verified_v2[\\s\\S]+admin_update_order_complete_v3/.test(migration), "v2 does not redirect to v3");
assert(/admin_update_order_complete_verified\(p_payload jsonb\)[\\s\\S]+admin_update_order_complete_v3/.test(migration), "legacy complete RPC does not redirect to v3");
assert(service.includes('supabase.rpc("admin_update_order_complete_v3"'), "canonical frontend RPC missing");
assert(service.includes("inFlight"), "duplicate submission prevention missing");
assert(service.includes("bulkUpdateAdminOrders") && service.includes("restoreAdminOrder"), "shared CRUD client incomplete");
assert(!persistence.includes("admin_update_order_complete_verified_v2"), "complete editor still calls v2");
assert(!persistence.includes(".from(\"orders\")"), "complete editor has direct table fallback");
assert(statusClient.includes("updateAdminOrderStatus"), "quick status is not on canonical service");
assert(!statusClient.includes("admin_update_order_status_verified"), "quick status legacy RPC chain remains");
assert(modal.includes('data-admin-order-v3-status="true"'), "complete modal status selector missing");
assert(modal.includes("تم حفظ الطلب") && modal.includes("ملاحظة تحتاج مراجعة"), "warning success language missing");
assert(!/required=\{!personalOrder\}|aria-required="true"/.test(modal), "merchant/coupon blocking required flags remain");
assert(deletion.includes("softDeleteAdminOrder"), "normal delete is not soft deletion");
assert(!deletion.includes(".delete()"), "direct physical deletion fallback remains");
console.log(JSON.stringify({
  result: "PASS",
  canonicalRpc: "admin_update_order_complete_v3",
  merchantLinkNonBlocking: true,
  couponNonBlocking: true,
  secondaryWarnings: true,
  statusCorrection: true,
  sharedFrontendMutationLayer: true,
  softDelete: true,
  restore: true,
  bulkPartialResults: true,
  audit: true,
}, null, 2));
`,
);

const packagePath = "artifacts/day-night-delivery/package.json";
const packageJson = JSON.parse(read(packagePath));
packageJson.scripts ||= {};
packageJson.scripts["test:admin-order-crud-v3"] =
  "node scripts/admin-order-crud-v3-gate.mjs";
write(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

for (const gate of [
  "artifacts/day-night-delivery/scripts/admin-order-save-localization-gate.mjs",
  "artifacts/day-night-delivery/scripts/admin-order-lifecycle-final-gate.mjs",
  "artifacts/day-night-delivery/scripts/admin-complete-order-edit-gate.mjs",
  "artifacts/day-night-delivery/scripts/operations-order-control-gate.mjs",
]) {
  let content = read(gate);
  content = content.replaceAll("admin_update_order_complete_verified_v2", "admin_update_order_complete_v3");
  content = content.replaceAll("admin_update_order_complete_verified(?:_v2)?", "admin_update_order_complete_v3");
  content = content.replaceAll("admin_update_order_status_verified", "admin_update_order_complete_v3");
  write(gate, content);
}

console.log("Prepared canonical Admin order CRUD v3 files.");
