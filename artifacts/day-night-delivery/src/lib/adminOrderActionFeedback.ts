type AdminOrderAction = "create" | "delete" | "status" | "save";

const clean = (value: unknown) => String(value ?? "").trim();

function detailFrom(error: unknown) {
  if (!error || typeof error !== "object") return clean(error);
  const record = error as Record<string, unknown>;
  return [record.code, record.message, record.details, record.hint]
    .map(clean)
    .filter(Boolean)
    .join(" | ");
}

function safeDiagnostic(value: string) {
  return clean(value)
    .replace(/bearer\s+[a-z0-9._~-]+/gi, "Bearer [hidden]")
    .replace(/eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+/gi, "[token hidden]")
    .replace(/https?:\/\/[^\s|]+/gi, "[endpoint]")
    .replace(/\s+/g, " ")
    .slice(0, 520);
}

function feedbackCode(detail: string) {
  const databaseCode = detail.match(
    /(?:pgrst\d{3}|(?:22|23|25|28|40|42|53|55|57|58)[0-9a-z]{3})/i,
  )?.[0];
  const symbolicCode = detail.match(
    /(?:admin|order|merchant|financial|coupon|delivery|complete|status|delete)_[a-z0-9_]{3,}/i,
  )?.[0];
  return clean(databaseCode || symbolicCode || "ORDER_OPERATION_REJECTED").toUpperCase();
}

export function adminOrderActionFeedback(
  error: unknown,
  isArabic: boolean,
  action: AdminOrderAction,
) {
  const diagnostic = safeDiagnostic(detailFrom(error));
  const reason = diagnostic.toLowerCase();
  const code = feedbackCode(diagnostic);

  const actionAr = action === "create" ? "إنشاء الطلب" : action === "delete" ? "حذف الطلب" : action === "status" ? "تحديث حالة الطلب" : "حفظ الطلب";
  const actionEn = action === "create" ? "create the order" : action === "delete" ? "delete the order" : action === "status" ? "update the order status" : "save the order";

  let message = isArabic
    ? `تعذر ${actionAr}. لم يُحفظ أي تغيير جزئي.`
    : `Could not ${actionEn}. No partial change was stored.`;

  if (/jwt expired|invalid jwt|not_authenticated|refresh_token|session/.test(reason)) {
    message = isArabic
      ? "انتهت جلسة الإدارة. سجّل الدخول مجددًا ثم أعد العملية؛ لم يُحفظ أي تغيير جزئي."
      : "The admin session expired. Sign in again and retry; no partial change was stored.";
  } else if (/23505|duplicate key|unique constraint|coupon.*duplicate|duplicate.*coupon/.test(reason)) {
    message = isArabic
      ? "رقم الكوبون مستخدم بالفعل في طلب آخر. افتح الطلب الموجود أو أدخل رقمًا جديدًا."
      : "The coupon number is already used by another order. Open the existing order or enter a new number.";
  } else if (/23502|null value.*violates|not-null constraint|required/.test(reason)) {
    message = isArabic
      ? "يوجد حقل إلزامي ناقص. راجع الحقول المعلّمة بعلامة النجمة ثم أعد العملية."
      : "A required field is missing. Review the fields marked with an asterisk and retry.";
  } else if (/23503|foreign key|merchant.*not.*found|invalid_merchant|merchant_link/.test(reason)) {
    message = isArabic
      ? "التاجر أو السجل المرتبط بالطلب غير صالح أو لم يعد موجودًا. أعد اختيار السجل الصحيح."
      : "The merchant or related order record is invalid or no longer exists. Select the correct record.";
  } else if (/23514|check constraint|financial.*mismatch|invalid_delivery_fee|negative_financial/.test(reason)) {
    message = isArabic
      ? "إحدى القيم تخالف قاعدة تشغيل أو حساب معتمدة. راجع المبالغ وطريقة التحصيل وحالة الطلب."
      : "A value violates an approved business or financial rule. Review amounts, collection method, and status.";
  } else if (/financials_locked|posted financial|delivered settlements are locked/.test(reason)) {
    message = isArabic
      ? "الطلب مُسلّم أو مُرحّل ماليًا. عدّل البيانات العادية دون تغيير الحسابات، واستخدم التصحيح المالي المُدقّق للمبالغ."
      : "The order is delivered or financially posted. Edit ordinary details without changing accounting, and use the audited financial adjustment for amounts.";
  } else if (/permission denied|not_authorized|row-level security|rls/.test(reason)) {
    message = isArabic
      ? "الحساب الحالي لا يملك صلاحية تنفيذ هذه العملية. استخدم حساب مدير أو دعم معتمد."
      : "The current account is not authorized for this operation. Use an approved admin or support account.";
  } else if (/failed to fetch|network|timeout|connection|offline/.test(reason)) {
    message = isArabic
      ? "تعذر الوصول إلى قاعدة البيانات. تحقق من الاتصال ثم أعد المحاولة؛ لم يُحفظ أي تغيير جزئي."
      : "The database could not be reached. Check the connection and retry; no partial change was stored.";
  } else if (/40001|40p01|serialization|deadlock|concurrent/.test(reason)) {
    message = isArabic
      ? "تم تعديل الطلب من عملية أخرى في اللحظة نفسها. افتح أحدث نسخة من الطلب ثم أعد العملية."
      : "Another operation changed the order at the same time. Reopen the latest order version and retry.";
  } else if (/pgrst116|order_not_found|returned no rows|no rows/.test(reason)) {
    message = isArabic
      ? "لم يعد الطلب موجودًا بالمرجع الحالي أو لم يعد متاحًا لهذا الحساب. حدّث القائمة ثم افتحه من جديد."
      : "The order no longer exists under this reference or is no longer available to this account. Refresh and reopen it.";
  }

  return { code, diagnostic, message };
}
