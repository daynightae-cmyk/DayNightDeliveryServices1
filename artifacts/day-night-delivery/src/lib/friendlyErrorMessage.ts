export type FriendlyErrorContext =
  | "order"
  | "merchant"
  | "employee"
  | "driver"
  | "payroll"
  | "customer"
  | "operation"
  | "generic";

export type FriendlyErrorKind =
  | "duplicate"
  | "required"
  | "permission"
  | "not_found"
  | "database_update"
  | "linked_record"
  | "invalid"
  | "network"
  | "unknown";

export type FriendlyErrorResult = {
  message: string;
  kind: FriendlyErrorKind;
  matched: boolean;
};

type ErrorRecord = Record<string, unknown>;

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function collectErrorText(value: unknown, depth = 0, seen = new WeakSet<object>()): string[] {
  if (depth > 3 || value === null || value === undefined) return [];
  if (typeof value === "string" || typeof value === "number") return [clean(value)];
  if (value instanceof Error) {
    const record = value as Error & ErrorRecord;
    return [
      clean(value.message),
      clean(record.code),
      clean(record.details),
      clean(record.hint),
      clean(record.constraint),
      clean(record.dbDetail),
      clean(record.error),
    ].filter(Boolean);
  }
  if (typeof value !== "object") return [clean(value)].filter(Boolean);
  if (seen.has(value)) return [];
  seen.add(value);
  const record = value as ErrorRecord;
  return [
    clean(record.message),
    clean(record.code),
    clean(record.details),
    clean(record.hint),
    clean(record.constraint),
    clean(record.dbDetail),
    clean(record.error),
    ...Object.values(record).flatMap((entry) => collectErrorText(entry, depth + 1, seen)),
  ].filter(Boolean);
}

function errorText(error: unknown) {
  return Array.from(new Set(collectErrorText(error))).join(" | ");
}

function extractedDuplicate(raw: string) {
  const keyValue = raw.match(/Key\s*\(([^)]+)\)\s*=\s*\(([^)]+)\)\s+already exists/i);
  if (keyValue) return { field: clean(keyValue[1]), value: clean(keyValue[2]) };

  const constraint = raw.match(/constraint\s+["']?([a-zA-Z0-9_.-]+)["']?/i)?.[1] || "";
  const fieldFromConstraint = constraint
    .replace(/^(public\.)?/i, "")
    .replace(/(_key|_unique|_uniq|_idx)$/i, "")
    .split("_")
    .slice(1)
    .join("_");
  return { field: fieldFromConstraint, value: "" };
}

function safeValue(value: string) {
  if (!value || value.length > 80) return "";
  if (/^[0-9a-f]{8}-[0-9a-f-]{20,}$/i.test(value)) return "";
  if (/password|secret|token/i.test(value)) return "";
  return value;
}

function quotedValue(value: string, isArabic: boolean) {
  const safe = safeValue(value);
  if (!safe) return "";
  return isArabic ? ` «${safe}»` : ` “${safe}”`;
}

function duplicateMessage(field: string, value: string, raw: string, isArabic: boolean, context: FriendlyErrorContext) {
  const haystack = `${field} ${raw}`.toLowerCase();
  const shown = quotedValue(value, isArabic);

  if (/coupon|coupon_number|رقم الكوبون/.test(haystack)) {
    return isArabic
      ? `رقم الكوبون${shown} مسجل بالفعل على طلب موجود. افتح الطلب السابق أو استخدم رقم كوبون مختلفًا.`
      : `Coupon number${shown} is already registered on an existing order. Open the existing order or use a different coupon number.`;
  }
  if (/tracking|tracking_number|tracking_code/.test(haystack)) {
    return isArabic
      ? `رقم التتبع${shown} مستخدم بالفعل. أعد الحفظ ليُنشئ النظام رقم تتبع جديدًا تلقائيًا.`
      : `Tracking number${shown} is already in use. Save again and the system will generate a new tracking number automatically.`;
  }
  if (/invoice|invoice_number/.test(haystack)) {
    return isArabic
      ? `رقم الفاتورة${shown} مستخدم بالفعل. سيُنشئ النظام رقمًا جديدًا عند إعادة الحفظ.`
      : `Invoice number${shown} is already in use. The system will generate a new one when you save again.`;
  }
  if (/driver_profile|driver.*employee|employee.*driver/.test(haystack)) {
    return isArabic
      ? "هذا المندوب مرتبط بالفعل ببطاقة موظف موجودة. افتح بطاقة الموظف الحالية بدل إنشاء بطاقة جديدة."
      : "This driver is already linked to an existing employee card. Open the current employee card instead of creating another one.";
  }
  if (/employee_code|staff_code/.test(haystack)) {
    return isArabic
      ? `كود الموظف${shown} مستخدم بالفعل.`
      : `Employee code${shown} is already in use.`;
  }
  if (/identity|emirates_id|national_id|id_number/.test(haystack)) {
    return isArabic
      ? `رقم الهوية${shown} مسجل بالفعل لشخص موجود.`
      : `Identity number${shown} is already registered to an existing person.`;
  }
  if (/passport/.test(haystack)) {
    return isArabic
      ? `رقم جواز السفر${shown} مسجل بالفعل.`
      : `Passport number${shown} is already registered.`;
  }
  if (/phone|mobile|telephone|contact_number/.test(haystack)) {
    const subjectAr = context === "employee" ? "موظف" : context === "merchant" ? "تاجر" : context === "driver" ? "مندوب" : "سجل";
    const subjectEn = context === "employee" ? "employee" : context === "merchant" ? "merchant" : context === "driver" ? "driver" : "record";
    return isArabic
      ? `رقم الهاتف${shown} مسجل بالفعل لدى ${subjectAr} موجود.`
      : `Phone number${shown} is already registered to an existing ${subjectEn}.`;
  }
  if (/email|mail_address/.test(haystack)) {
    const subjectAr = context === "employee" ? "موظف" : context === "merchant" ? "تاجر" : context === "driver" ? "مندوب" : "حساب";
    const subjectEn = context === "employee" ? "employee" : context === "merchant" ? "merchant" : context === "driver" ? "driver" : "account";
    return isArabic
      ? `البريد الإلكتروني${shown} مستخدم بالفعل في ${subjectAr} موجود.`
      : `Email address${shown} is already used by an existing ${subjectEn}.`;
  }
  if (/merchant_code|shop_code|store_code/.test(haystack)) {
    return isArabic ? `كود التاجر${shown} مستخدم بالفعل.` : `Merchant code${shown} is already in use.`;
  }
  if (/trade_name|store_name|business_name/.test(haystack)) {
    return isArabic ? `اسم المتجر${shown} مسجل بالفعل.` : `Store name${shown} is already registered.`;
  }
  if (/license|licence/.test(haystack)) {
    return isArabic ? `رقم الرخصة${shown} مسجل بالفعل.` : `License number${shown} is already registered.`;
  }
  if (/\btrn\b|tax_number|tax_registration/.test(haystack)) {
    return isArabic ? `الرقم الضريبي${shown} مسجل بالفعل.` : `Tax registration number${shown} is already registered.`;
  }
  if (/iban|bank_account/.test(haystack)) {
    return isArabic ? `رقم الحساب البنكي${shown} مسجل بالفعل.` : `Bank account${shown} is already registered.`;
  }
  if (/reference_number|payroll.*reference/.test(haystack)) {
    return isArabic
      ? `الرقم المرجعي${shown} مستخدم بالفعل في حركة مالية سابقة.`
      : `Reference number${shown} is already used by a previous financial entry.`;
  }
  if (/employee|staff/.test(haystack) || context === "employee") {
    return isArabic
      ? "هذا الموظف مسجل بالفعل. ابحث عنه في دليل الموظفين بدل إنشاء بطاقة جديدة."
      : "This employee is already registered. Find the existing card in the employee directory instead of creating another one.";
  }
  if (/merchant|shop|store/.test(haystack) || context === "merchant") {
    return isArabic
      ? "هذا التاجر مسجل بالفعل. افتح ملف التاجر الموجود بدل إنشاء ملف جديد."
      : "This merchant is already registered. Open the existing merchant profile instead of creating another one.";
  }
  if (/order/.test(haystack) || context === "order") {
    return isArabic
      ? "هذا الطلب أو أحد أرقامه مسجل بالفعل. افتح الطلب الموجود أو غيّر الرقم المتكرر."
      : "This order or one of its reference numbers already exists. Open the existing order or change the duplicated number.";
  }
  return isArabic
    ? "هذه البيانات مسجلة بالفعل. راجع السجل الموجود بدل إنشاء سجل جديد."
    : "These details are already registered. Open the existing record instead of creating a new one.";
}

function fallbackMessage(isArabic: boolean, context: FriendlyErrorContext, fallback?: string) {
  const messages: Record<FriendlyErrorContext, [string, string]> = {
    order: ["تعذر حفظ الطلب الآن. راجع البيانات وأعد المحاولة.", "The order could not be saved. Review the details and try again."],
    merchant: ["تعذر حفظ بيانات التاجر. راجع البيانات وأعد المحاولة.", "The merchant could not be saved. Review the details and try again."],
    employee: ["تعذر حفظ بيانات الموظف أو حركة الراتب. راجع البيانات وأعد المحاولة.", "The employee or payroll change could not be saved. Review the details and try again."],
    driver: ["تعذر حفظ بيانات المندوب. راجع البيانات وأعد المحاولة.", "The driver could not be saved. Review the details and try again."],
    payroll: ["تعذر حفظ الحركة المالية. راجع البيانات وأعد المحاولة.", "The payroll entry could not be saved. Review the details and try again."],
    customer: ["تعذر حفظ بيانات العميل. راجع البيانات وأعد المحاولة.", "The customer could not be saved. Review the details and try again."],
    operation: ["تعذر تنفيذ العملية الآن. راجع البيانات وأعد المحاولة.", "The operation could not be completed. Review the details and try again."],
    generic: ["تعذر إتمام العملية. راجع البيانات وأعد المحاولة.", "The action could not be completed. Review the details and try again."],
  };
  if (!isArabic && clean(fallback) && !/sqlstate|constraint|duplicate key|schema cache/i.test(clean(fallback))) {
    return clean(fallback);
  }
  return messages[context]?.[isArabic ? 0 : 1] || messages.generic[isArabic ? 0 : 1];
}

export function currentUiIsArabic() {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  return root.dir === "rtl" || root.lang.toLowerCase().startsWith("ar") || document.body?.dir === "rtl";
}

export function friendlyDatabaseError(
  error: unknown,
  isArabic: boolean,
  context: FriendlyErrorContext = "generic",
  fallback?: string,
): FriendlyErrorResult {
  const raw = errorText(error);
  const normalized = raw.toLowerCase();

  const duplicate = /23505|duplicate key|unique constraint|already exists|already registered|already linked|_key\b|_unique\b/.test(normalized);
  if (duplicate) {
    const parsed = extractedDuplicate(raw);
    return {
      message: duplicateMessage(parsed.field, parsed.value, raw, isArabic, context),
      kind: "duplicate",
      matched: true,
    };
  }

  if (/driver_already_linked_to_employee/.test(normalized)) {
    return {
      message: isArabic
        ? "هذا المندوب مرتبط بالفعل ببطاقة موظف موجودة."
        : "This driver is already linked to an existing employee card.",
      kind: "duplicate",
      matched: true,
    };
  }
  if (/employee_name_required/.test(normalized)) {
    return { message: isArabic ? "اسم الموظف مطلوب." : "Employee name is required.", kind: "required", matched: true };
  }
  if (/employee_phone_required/.test(normalized)) {
    return { message: isArabic ? "رقم هاتف الموظف مطلوب." : "Employee phone is required.", kind: "required", matched: true };
  }
  if (/recipient_name_required|receiver_name_required/.test(normalized)) {
    return { message: isArabic ? "اسم المستلم مطلوب." : "Recipient name is required.", kind: "required", matched: true };
  }
  if (/recipient_phone_required|receiver_phone_required/.test(normalized)) {
    return { message: isArabic ? "رقم هاتف المستلم مطلوب." : "Recipient phone is required.", kind: "required", matched: true };
  }
  if (/delivery_city_required/.test(normalized)) {
    return { message: isArabic ? "إمارة أو مدينة التسليم مطلوبة." : "Delivery emirate or city is required.", kind: "required", matched: true };
  }
  if (/delivery_address_required/.test(normalized)) {
    return { message: isArabic ? "عنوان التسليم مطلوب." : "Delivery address is required.", kind: "required", matched: true };
  }
  if (/merchant_required/.test(normalized)) {
    return { message: isArabic ? "اختر التاجر قبل حفظ الطلب." : "Select a merchant before saving the order.", kind: "required", matched: true };
  }
  if (/merchant_not_found_or_inactive|merchant_profile_not_found|merchant_account_not_active/.test(normalized)) {
    return {
      message: isArabic ? "التاجر المحدد غير موجود أو حسابه غير نشط." : "The selected merchant does not exist or is not active.",
      kind: "not_found",
      matched: true,
    };
  }
  if (/invalid_employee_payroll_snapshot/.test(normalized)) {
    return {
      message: isArabic ? "تعذر قراءة بطاقة الراتب بأمان. حدّث الصفحة ثم أعد المحاولة." : "The payroll card could not be read safely. Refresh and try again.",
      kind: "invalid",
      matched: true,
    };
  }
  if (/salary_effective_date_before_latest/.test(normalized)) {
    return {
      message: isArabic ? "تاريخ الراتب أقدم من آخر تعديل راتب محفوظ." : "The salary date is earlier than the latest saved revision.",
      kind: "invalid",
      matched: true,
    };
  }
  if (/payroll_note_required/.test(normalized)) {
    return { message: isArabic ? "اكتب سبب الحركة المالية بوضوح." : "Add a clear reason for the payroll entry.", kind: "required", matched: true };
  }
  if (/invalid_payroll_amount/.test(normalized)) {
    return { message: isArabic ? "قيمة الحركة يجب أن تكون أكبر من صفر." : "The payroll amount must be greater than zero.", kind: "invalid", matched: true };
  }
  if (/not_authorized|not_authenticated|permission denied|row-level|rls|42501/.test(normalized)) {
    return {
      message: isArabic ? "لا تملك صلاحية تنفيذ هذه العملية بهذا الحساب." : "This account does not have permission to perform this action.",
      kind: "permission",
      matched: true,
    };
  }
  if (/does not exist|schema cache|pgrst202|pgrst204|undefined function|undefined table|42p01|42883/.test(normalized)) {
    return {
      message: isArabic ? "تحديث قاعدة البيانات المطلوب لهذه الخدمة لم يُفعّل بعد." : "The database update required for this feature has not been activated yet.",
      kind: "database_update",
      matched: true,
    };
  }
  if (/23503|foreign key|still referenced|linked orders|cannot delete.*linked/.test(normalized)) {
    return {
      message: isArabic ? "لا يمكن حذف هذا السجل لأنه مرتبط ببيانات أخرى. أوقفه أو عدّله بدل الحذف." : "This record cannot be deleted because other data is linked to it. Pause or edit it instead.",
      kind: "linked_record",
      matched: true,
    };
  }
  if (/23502|not-null|null value in column/.test(normalized)) {
    return {
      message: isArabic ? "أحد الحقول المطلوبة فارغ. أكمل البيانات ثم أعد الحفظ." : "A required field is empty. Complete the details and save again.",
      kind: "required",
      matched: true,
    };
  }
  if (/23514|check constraint|invalid input syntax|22p02|invalid.*format/.test(normalized)) {
    return {
      message: isArabic ? "إحدى القيم المدخلة غير صحيحة. راجع الأرقام والاختيارات ثم أعد الحفظ." : "One of the entered values is invalid. Review the numbers and selections, then save again.",
      kind: "invalid",
      matched: true,
    };
  }
  if (/failed to fetch|networkerror|network error|load failed|timeout|timed out|offline/.test(normalized)) {
    return {
      message: isArabic ? "تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة." : "The server could not be reached. Check your internet connection and try again.",
      kind: "network",
      matched: true,
    };
  }

  return {
    message: fallbackMessage(isArabic, context, fallback),
    kind: "unknown",
    matched: false,
  };
}

export function friendlyDatabaseErrorMessage(
  error: unknown,
  isArabic: boolean,
  context: FriendlyErrorContext = "generic",
  fallback?: string,
) {
  return friendlyDatabaseError(error, isArabic, context, fallback).message;
}
