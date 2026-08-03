import type { Plugin } from "vite";

function replaceRequired(
  source: string,
  pattern: string | RegExp,
  replacement: string,
  label: string,
) {
  const next = source.replace(pattern, replacement);
  if (next === source) {
    throw new Error(`DAY NIGHT friendly error plugin could not apply: ${label}`);
  }
  return next;
}

function addImport(source: string, marker: string, statement: string, label: string) {
  if (source.includes(statement)) return source;
  return replaceRequired(source, marker, `${statement}\n${marker}`, label);
}

export function friendlyErrorMessagePlugin(): Plugin {
  return {
    name: "day-night-friendly-error-messages-v4",
    enforce: "pre",
    transform(source, id) {
      const normalized = id.replace(/\\/g, "/").split("?")[0];

      if (normalized.endsWith("/src/lib/adminOperationsData.ts")) {
        let code = addImport(
          source,
          'import { createDayNightInvoiceNumber } from "./printableDocuments";',
          'import { currentUiIsArabic, friendlyDatabaseErrorMessage } from "./friendlyErrorMessage";',
          "admin operations friendly-error import",
        );

        code = replaceRequired(
          code,
          /export function opsErrorDetail\(error: unknown\) \{[\s\S]*?\n\}\n\nfunction operationsError\(error: unknown, fallback: string\) \{[\s\S]*?\n\}\n\nasync function rpcOne/,
          `export function opsErrorDetail(error: unknown) {
  const record = error as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
    constraint?: string;
    dbDetail?: string;
    cause?: unknown;
  };
  const cause = record?.cause as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
    constraint?: string;
    dbDetail?: string;
  } | undefined;
  const technicalDetail = [
    record?.dbDetail,
    record?.message,
    record?.details,
    record?.hint,
    record?.code,
    record?.constraint,
    cause?.dbDetail,
    cause?.message,
    cause?.details,
    cause?.hint,
    cause?.code,
    cause?.constraint,
  ]
    .map(clean)
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(" | ");

  if (technicalDetail) return technicalDetail;
  return friendlyDatabaseErrorMessage(error, currentUiIsArabic(), "operation");
}

function operationsError(error: unknown, fallback: string) {
  const record = error as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
    constraint?: string;
    dbDetail?: string;
  };
  const technicalDetail = [
    record?.dbDetail,
    record?.message,
    record?.details,
    record?.hint,
    record?.code,
    record?.constraint,
  ]
    .map(clean)
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(" | ");

  if (technicalDetail) console.warn("Admin operations DB detail:", technicalDetail);

  const wrapped = new Error(
    friendlyDatabaseErrorMessage(error, currentUiIsArabic(), "operation", fallback),
  ) as Error & { dbDetail?: string; cause?: unknown };
  wrapped.dbDetail = technicalDetail;
  wrapped.cause = error;
  return wrapped;
}

async function rpcOne`,
          "admin operations technical-to-friendly error conversion",
        );
        return { code, map: null };
      }

      if (normalized.endsWith("/src/lib/adminOrderEditPersistence.ts")) {
        const code = replaceRequired(
          source,
          'supabase.rpc("admin_update_order_complete_verified", {',
          'supabase.rpc("admin_update_order_complete_verified_v2", {',
          "complete order Save corrected RPC route",
        );
        return { code, map: null };
      }

      if (normalized.endsWith("/src/components/admin/AdminOrderEditModalComplete.tsx")) {
        const code = replaceRequired(
          source,
          /    \} catch \(cause\) \{\n      const detail = opsErrorDetail\(cause\);\n      setError\(\n        isArabic\n          \? `تعذر تحديث الطلب\. العملية اتلغت بالكامل ومفيش تعديل جزئي\.\$\{detail \? ` السبب: \$\{detail\}` : ""\}`\n          : `The order update failed\. The transaction was fully rolled back with no partial edit\.\$\{detail \? ` Reason: \$\{detail\}` : ""\}`,\n      \);\n    \} finally \{/,
          `    } catch (cause) {
      const detail = opsErrorDetail(cause);
      const reason = clean(detail).toLowerCase();
      let saveError = "";

      if (/not_authenticated|jwt expired|invalid jwt|refresh_token|session/.test(reason)) {
        saveError = isArabic
          ? "انتهت جلسة الإدارة. سجّل الدخول مرة أخرى ثم افتح الطلب واضغط حفظ. لم يحدث أي تعديل جزئي."
          : "The admin session expired. Sign in again, reopen the order, and save. No partial change was made.";
      } else if (/not_authorized|permission denied|row-level security|rls/.test(reason)) {
        saveError = isArabic
          ? "حسابك لا يملك صلاحية تعديل هذا الطلب. استخدم حساب مدير أو دعم معتمد. لم يحدث أي تعديل جزئي."
          : "Your account is not authorized to edit this order. Use an approved admin or support account. No partial change was made.";
      } else if (/23505|duplicate key|unique constraint|coupon.*duplicate|duplicate.*coupon|already exists/.test(reason)) {
        saveError = isArabic
          ? "رقم الكوبون مستخدم بالفعل على طلب آخر. افتح الطلب الموجود أو اكتب رقم كوبون مختلفًا. لم يحدث أي تعديل جزئي."
          : "The coupon number is already used by another order. Open the existing order or enter a different coupon. No partial change was made.";
      } else if (/canonical_merchant_not_found|merchant_required|merchant.*portal|portal.*merchant|merchant_not_found/.test(reason)) {
        saveError = isArabic
          ? "التاجر المختار غير مرتبط بحساب بوابة قانوني. اربط حساب التاجر أولًا أو اختر تاجرًا مرتبطًا، ثم احفظ. لم يحدث أي تعديل جزئي."
          : "The selected merchant is not linked to a canonical portal account. Link the merchant first or select a linked merchant, then save. No partial change was made.";
      } else if (/ownership.*conflict|dependency.*conflict|merchant.*mismatch|readback_mismatch/.test(reason)) {
        saveError = isArabic
          ? "يوجد تعارض في ملكية الطلب أو قيوده التابعة. راجع التاجر الحالي وكشف COD ثم أعد الحفظ. لم يحدث أي تعديل جزئي."
          : "There is an ownership conflict in the order or its dependent ledgers. Review the current merchant and COD statement, then save again. No partial change was made.";
      } else if (/invalid_delivery_fee|invalid_manual_delivery_price|negative_financial_value|invalid_price_source|invalid_payment_method|invalid_delivery_fee_mode|financial_order_update_readback_mismatch/.test(reason)) {
        saveError = isArabic
          ? "القيم المالية غير صالحة أو لم تُحفظ كما أُدخلت. راجع قيمة البضاعة والتوصيل والخصم وطريقة التحصيل، ثم اضغط حفظ. لم يحدث أي تعديل جزئي."
          : "The financial values are invalid or were not stored as entered. Review goods, delivery, discount, and payment method, then save. No partial change was made.";
      } else if (/complete_order_edit_created_invalid_fields|admin_order_validation_failed/.test(reason)) {
        saveError = isArabic
          ? "التعديل سيجعل بيانات الطلب الأساسية ناقصة. أكمل اسم وهاتف المرسل والمستلم والعنوان ومحتوى الشحنة، ثم اضغط حفظ. لم يحدث أي تعديل جزئي. السبب الفني: " + detail
          : "The edit would leave required order details incomplete. Complete sender, recipient, address, and package details, then save. No partial change was made. Technical reason: " + detail;
      } else if (/admin_edit_reason_required_min_6/.test(reason)) {
        saveError = isArabic
          ? "اكتب سببًا واضحًا للتعديل لا يقل عن 6 أحرف، ثم اضغط حفظ."
          : "Enter a clear edit reason of at least 6 characters, then save.";
      } else if (/order_not_found/.test(reason)) {
        saveError = isArabic
          ? "الطلب لم يعد موجودًا في قاعدة البيانات. حدّث قائمة الطلبات وابحث عنه من جديد."
          : "The order no longer exists in the database. Refresh the order list and search again.";
      } else if (/pgrst202|schema cache|could not find the function|runtime_missing|does not exist/.test(reason)) {
        saveError = isArabic
          ? "خدمة حفظ التعديلات الكاملة غير متاحة في نسخة قاعدة البيانات الحالية. حدّث الصفحة بعد اكتمال نشر قاعدة البيانات. لم يحدث أي تعديل جزئي."
          : "The complete-save service is not available in the current database version. Refresh after the database deployment completes. No partial change was made.";
      } else {
        saveError = isArabic
          ? "لم يتم حفظ الطلب لأن قاعدة البيانات رفضت العملية. لم يحدث أي تعديل جزئي. السبب الفني الأصلي: " + detail
          : "The database rejected the save. No partial change was made. Original technical reason: " + detail;
      }

      setError(saveError);
    } finally {`,
          "complete order save exact rejection messages",
        );
        return { code, map: null };
      }

      if (normalized.endsWith("/src/components/admin/AdminNewMerchant.tsx")) {
        let code = addImport(
          source,
          'import type { Merchant } from "../../types";',
          'import { friendlyDatabaseErrorMessage } from "../../lib/friendlyErrorMessage";',
          "new merchant friendly-error import",
        );
        code = replaceRequired(
          code,
          '      setError(String((cause as Error).message || cause));',
          '      setError(friendlyDatabaseErrorMessage(cause, isArabic, "merchant"));',
          "new merchant duplicate and validation message",
        );
        return { code, map: null };
      }

      if (normalized.endsWith("/src/lib/adminEmployees.ts")) {
        let code = addImport(
          source,
          'import { supabase } from "../supabase";',
          'import { friendlyDatabaseErrorMessage } from "./friendlyErrorMessage";',
          "employee friendly-error import",
        );
        code = replaceRequired(
          code,
          /export function employeeErrorMessage\(error: unknown, isArabic: boolean\) \{[\s\S]*?\n\}\s*$/,
          `export function employeeErrorMessage(error: unknown, isArabic: boolean) {
  return friendlyDatabaseErrorMessage(error, isArabic, "employee");
}
`,
          "employee duplicate and payroll error translation",
        );
        return { code, map: null };
      }

      return null;
    },
  };
}
