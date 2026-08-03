from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PERSISTENCE = ROOT / "artifacts/day-night-delivery/src/lib/adminOrderEditPersistence.ts"
MODAL = ROOT / "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx"

persistence = PERSISTENCE.read_text(encoding="utf-8")

anchor = '''export async function saveAdminOrderEdit(
  input: FinancialOpsOrderUpdateInput,
): Promise<AdminOrderEditSaveResult> {
'''

insert = '''export async function saveAdminLockedMerchantCoreEdit(
  input: FinancialOpsOrderUpdateInput,
): Promise<AdminOrderEditSaveResult> {
  if (isPersonalAdminOrder(input.order)) {
    throw new Error("locked_merchant_core_edit_received_personal_order");
  }
  if (!financialsAreLocked(input.order)) {
    throw new Error("locked_merchant_core_edit_requires_delivered_or_posted_order");
  }

  const currentMerchantId = clean(input.order.merchant_id);
  const selectedMerchantId = clean(input.merchant?.id);
  if (!selectedMerchantId || selectedMerchantId !== currentMerchantId) {
    throw new Error("locked_order_merchant_change_requires_complete_audited_edit");
  }

  const row = await updateWithPatch(input, corePatch(input));
  return { row, source: "db", financialsLocked: true };
}

export async function saveAdminOrderEdit(
  input: FinancialOpsOrderUpdateInput,
): Promise<AdminOrderEditSaveResult> {
'''

if anchor not in persistence:
    raise SystemExit("saveAdminOrderEdit anchor not found")
persistence = persistence.replace(anchor, insert, 1)
PERSISTENCE.write_text(persistence, encoding="utf-8")

modal = MODAL.read_text(encoding="utf-8")
modal = modal.replace(
    'import { saveAdminOrderEdit } from "../../lib/adminOrderEditPersistence";',
    'import {\n  saveAdminLockedMerchantCoreEdit,\n  saveAdminOrderEdit,\n} from "../../lib/adminOrderEditPersistence";',
    1,
)

old_save = '''      const result = await saveAdminOrderEdit({
        ...currentForm,
        coupon_number: clean(currentForm.coupon_number),
        merchant: personalOrder ? null : selectedMerchant,
        sender_name: clean(currentForm.sender_name),
        sender_phone: clean(currentForm.sender_phone),
        receiver_address: clean(currentForm.receiver_address),
        delivery_street: clean(currentForm.delivery_street),
        package_type: packageValue,
        package_description: packageValue,
        order: currentOrder,
        edit_reason:
          clean(editReason) ||
          (isArabic
            ? "تحديث بيانات الطلب من لوحة الإدارة"
            : "Order details updated from the admin panel"),
      });
'''

new_save = '''      const saveInput = {
        ...currentForm,
        coupon_number: clean(currentForm.coupon_number),
        merchant: personalOrder ? null : selectedMerchant,
        sender_name: clean(currentForm.sender_name),
        sender_phone: clean(currentForm.sender_phone),
        receiver_address: clean(currentForm.receiver_address),
        delivery_street: clean(currentForm.delivery_street),
        package_type: packageValue,
        package_description: packageValue,
        order: currentOrder,
        edit_reason:
          clean(editReason) ||
          (isArabic
            ? "تحديث بيانات الطلب من لوحة الإدارة"
            : "Order details updated from the admin panel"),
      };
      const result =
        financialLocked && !personalOrder && !sensitiveChange
          ? await saveAdminLockedMerchantCoreEdit(saveInput)
          : await saveAdminOrderEdit(saveInput);
'''

if old_save not in modal:
    raise SystemExit("complete save block not found")
modal = modal.replace(old_save, new_save, 1)

old_message = '''        result.financialsLocked
          ? isArabic
            ? `تم تحديث بيانات الطلب الشخصي ${orderReference(result.row)}. ظل الحساب المُرحَّل محميًا، واستخدم صندوق التصحيح المالي المنفصل لتغييره.`
            : `Personal order ${orderReference(result.row)} was updated. Posted financials remain protected and use the separate audited adjustment panel.`
          : isArabic
'''
new_message = '''        result.financialsLocked
          ? personalOrder
            ? isArabic
              ? `تم تحديث بيانات الطلب الشخصي ${orderReference(result.row)}. ظل الحساب المُرحَّل محميًا، واستخدم صندوق التصحيح المالي المنفصل لتغييره.`
              : `Personal order ${orderReference(result.row)} was updated. Posted financials remain protected and use the separate audited adjustment panel.`
            : isArabic
              ? `تم تحديث بيانات الطلب ${orderReference(result.row)} وحفظها فعليًا. ظل الحساب المُرحَّل بقيمة ${originalFinancials.deliveryFee.toFixed(2)} درهم محميًا دون إعادة ترحيل أو تغيير.`
              : `Order ${orderReference(result.row)} details were saved. Posted financials remained protected without reposting or recalculation.`
          : isArabic
'''
if old_message not in modal:
    raise SystemExit("locked success message block not found")
modal = modal.replace(old_message, new_message, 1)

financial_error_anchor = '''  if (/invalid_delivery_fee|invalid_manual_delivery_price|negative_financial|invalid_payment|financial.*mismatch/.test(reason)) {
    return isArabic
      ? "تعذر اعتماد القيم المالية. راجع قيمة البضاعة ورسوم التوصيل والخصم وطريقة التحصيل، ثم أعد الحفظ. لم يُحفظ أي تعديل جزئي."
      : "The financial values could not be verified. Review goods, delivery, discount, and payment method, then save again. No partial change was stored.";
  }
'''
financial_error_insert = financial_error_anchor + '''  if (/financials_locked|delivered settlements are locked|posted financials|financial.*posted/.test(reason)) {
    return isArabic
      ? "الطلب مُسلّم أو مُرحّل ماليًا. احفظ بيانات العميل والعنوان والشحنة دون تغيير المبالغ، واستخدم صندوق التصحيح المالي المُدقّق عند تعديل الحسابات. لم يُحفظ أي تعديل جزئي."
      : "The order is delivered or financially posted. Save customer, address, and package details without changing money fields, and use the audited financial adjustment panel for accounting changes. No partial change was stored.";
  }
'''
if financial_error_anchor not in modal:
    raise SystemExit("financial error mapping anchor not found")
modal = modal.replace(financial_error_anchor, financial_error_insert, 1)

MODAL.write_text(modal, encoding="utf-8")
print("PASS: delivered-order core edits now bypass posted financial rewrites")
