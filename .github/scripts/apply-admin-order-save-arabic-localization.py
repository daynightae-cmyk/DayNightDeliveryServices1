from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    print(f"PASS wrote {path}")


def replace_once(path: str, old: str, new: str, label: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    write(path, text.replace(old, new, 1))
    print(f"PASS {label}")


def regex_once(path: str, pattern: str, replacement: str, label: str, flags: int = re.S) -> None:
    text = read(path)
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one regex match, found {count}")
    write(path, next_text)
    print(f"PASS {label}")


DESTINATIONS = r'''export type InternationalDestination = {
  value: string;
  ar: string;
  en: string;
  aliases: readonly string[];
};

export const INTERNATIONAL_DESTINATIONS: readonly InternationalDestination[] = [
  {
    value: "SA",
    ar: "المملكة العربية السعودية",
    en: "Saudi Arabia",
    aliases: ["SA", "KSA", "Saudi", "Saudi Arabia", "السعودية", "المملكة العربية السعودية"],
  },
  {
    value: "KW",
    ar: "الكويت",
    en: "Kuwait",
    aliases: ["KW", "KWT", "Kuwait", "الكويت"],
  },
  {
    value: "BH",
    ar: "البحرين",
    en: "Bahrain",
    aliases: ["BH", "BHR", "Bahrain", "البحرين"],
  },
  {
    value: "OM",
    ar: "سلطنة عُمان",
    en: "Oman",
    aliases: ["OM", "OMN", "Oman", "عمان", "عُمان", "سلطنة عمان", "سلطنة عُمان"],
  },
  {
    value: "QA",
    ar: "قطر",
    en: "Qatar",
    aliases: ["QA", "QAT", "Qatar", "قطر"],
  },
  {
    value: "AE",
    ar: "الإمارات العربية المتحدة",
    en: "United Arab Emirates",
    aliases: ["AE", "ARE", "UAE", "Emirates", "United Arab Emirates", "الإمارات", "الإمارات العربية المتحدة"],
  },
  {
    value: "US",
    ar: "الولايات المتحدة الأمريكية",
    en: "United States",
    aliases: ["US", "USA", "United States", "United States of America", "الولايات المتحدة", "الولايات المتحدة الأمريكية"],
  },
  {
    value: "GB",
    ar: "المملكة المتحدة",
    en: "United Kingdom",
    aliases: ["GB", "GBR", "UK", "United Kingdom", "Britain", "المملكة المتحدة"],
  },
  {
    value: "EU",
    ar: "دول الاتحاد الأوروبي",
    en: "European Union",
    aliases: ["EU", "Europe", "European Union", "أوروبا", "الاتحاد الأوروبي", "دول الاتحاد الأوروبي"],
  },
  {
    value: "CA",
    ar: "كندا",
    en: "Canada",
    aliases: ["CA", "CAN", "Canada", "كندا"],
  },
  {
    value: "AU",
    ar: "أستراليا",
    en: "Australia",
    aliases: ["AU", "AUS", "Australia", "أستراليا"],
  },
  {
    value: "WORLD",
    ar: "باقي دول العالم",
    en: "Rest of the world",
    aliases: ["WORLD", "Worldwide", "Rest of world", "Rest of the world", "Global", "باقي دول العالم", "العالم"],
  },
] as const;

const clean = (value: unknown) => String(value ?? "").trim();
const aliasKey = (value: unknown) =>
  clean(value)
    .toLocaleLowerCase("en")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");

const DESTINATION_BY_ALIAS = new Map<string, InternationalDestination>();
for (const destination of INTERNATIONAL_DESTINATIONS) {
  for (const alias of [destination.value, destination.ar, destination.en, ...destination.aliases]) {
    DESTINATION_BY_ALIAS.set(aliasKey(alias), destination);
  }
}

export function internationalDestination(value: unknown) {
  return DESTINATION_BY_ALIAS.get(aliasKey(value)) || null;
}

export function isKnownInternationalDestination(value: unknown) {
  return Boolean(internationalDestination(value));
}

export function normalizeInternationalDestination(value: unknown, fallback = "") {
  const raw = clean(value);
  const destination = internationalDestination(raw);
  if (destination) return destination.value;
  return raw ? raw.toUpperCase() : fallback;
}

export function internationalDestinationLabel(value: unknown, isArabic: boolean) {
  const raw = clean(value);
  const destination = internationalDestination(raw);
  if (!destination) return raw || "—";
  return isArabic ? destination.ar : destination.en;
}
'''
write("artifacts/day-night-delivery/src/data/internationalDestinations.ts", DESTINATIONS)

# New-order form: one authoritative country catalogue and canonical stored codes.
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminNewOrderComplete.tsx",
    'import { UAE_LOCATIONS, getAreasForEmirate, getDefaultAreaForEmirate } from "../../data/uaeLocations";\n',
    'import { UAE_LOCATIONS, getAreasForEmirate, getDefaultAreaForEmirate } from "../../data/uaeLocations";\nimport { INTERNATIONAL_DESTINATIONS } from "../../data/internationalDestinations";\n',
    "new order imports authoritative international destinations",
)
regex_once(
    "artifacts/day-night-delivery/src/components/admin/AdminNewOrderComplete.tsx",
    r'const destinations = \[[\s\S]*?\] as const;\n\nconst PERSONAL_ORDER_OPTION',
    'const PERSONAL_ORDER_OPTION',
    "new order removes duplicate destination catalogue",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminNewOrderComplete.tsx",
    "{destinations.map((country) =>",
    "{INTERNATIONAL_DESTINATIONS.map((country) =>",
    "new order renders localized country names",
)

# Complete editor: professional localization, low-friction safe saves, exact country names.
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    '} from "../../data/uaeLocations";\nimport type { Merchant, Order } from "../../types";',
    '} from "../../data/uaeLocations";\nimport {\n  INTERNATIONAL_DESTINATIONS,\n  internationalDestinationLabel,\n  isKnownInternationalDestination,\n  normalizeInternationalDestination,\n} from "../../data/internationalDestinations";\nimport type { Merchant, Order } from "../../types";',
    "complete editor imports country localization",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    '    destination_country: order.destination_country || "SA",',
    '    destination_country: normalizeInternationalDestination(\n      order.destination_country || order.receiver_city || "SA",\n      "SA",\n    ),',
    "complete editor normalizes legacy country values",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    '    price_mode: personal ? "system" : manual ? "manual" : "system",\n    manual_delivery_price: personal\n      ? ""\n      : manual\n        ? numberOrBlank(order.manual_delivery_price ?? currentPrice)\n        : "",',
    '    // Existing orders open with their exact saved delivery value. This prevents a\n    // harmless customer/address edit from silently recalculating historical pricing.\n    price_mode: personal ? "system" : "manual",\n    manual_delivery_price: personal\n      ? ""\n      : numberOrBlank(order.manual_delivery_price ?? currentPrice),',
    "complete editor preserves saved financial values by default",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    'const orderReference = (order: Order) =>\n  order.tracking_number || order.invoice_number || order.coupon_number || order.id || "—";\n',
    '''const orderReference = (order: Order) =>
  order.tracking_number || order.invoice_number || order.coupon_number || order.id || "—";

const ORDER_STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  pending: { ar: "قيد الانتظار", en: "Pending" },
  review: { ar: "قيد المراجعة", en: "Under review" },
  under_review: { ar: "قيد المراجعة", en: "Under review" },
  confirmed: { ar: "تم التأكيد", en: "Confirmed" },
  assigned: { ar: "تم تعيين المندوب", en: "Driver assigned" },
  picked_up: { ar: "تم استلام الشحنة", en: "Picked up" },
  in_transit: { ar: "قيد النقل", en: "In transit" },
  out_for_delivery: { ar: "خرجت للتسليم", en: "Out for delivery" },
  delivered: { ar: "تم التسليم", en: "Delivered" },
  completed: { ar: "مكتمل", en: "Completed" },
  postponed: { ar: "مؤجل", en: "Postponed" },
  returned: { ar: "مرتجع", en: "Returned" },
  cancelled: { ar: "ملغي", en: "Cancelled" },
  canceled: { ar: "ملغي", en: "Cancelled" },
  failed: { ar: "تعذر التنفيذ", en: "Failed" },
};

function orderStatusLabel(value: unknown, isArabic: boolean) {
  const key = clean(value).toLowerCase().replace(/[\\s-]+/g, "_");
  const label = ORDER_STATUS_LABELS[key];
  return label ? (isArabic ? label.ar : label.en) : clean(value) || "—";
}

function paymentKey(value: unknown) {
  const key = clean(value || "cod").toLowerCase().replace(/[\\s-]+/g, "_");
  if (key === "merchant_pays") return "sender_pays";
  if (key === "cash") return "cod";
  if (["card", "bank_transfer", "wallet"].includes(key)) return "prepaid";
  return key;
}

function moneyDiffers(left: unknown, right: unknown) {
  const a = Number(left || 0);
  const b = Number(right || 0);
  return !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > 0.005;
}

function professionalEditError(detail: string, isArabic: boolean) {
  const reason = clean(detail).toLowerCase();
  if (/not_authenticated|jwt expired|invalid jwt|refresh_token|session/.test(reason)) {
    return isArabic
      ? "انتهت جلسة الإدارة. سجّل الدخول مرة أخرى، ثم افتح الطلب وأعد الحفظ. لم يُحفظ أي تعديل جزئي."
      : "The admin session expired. Sign in again, reopen the order, and save. No partial change was stored.";
  }
  if (/not_authorized|permission denied|row-level security|rls/.test(reason)) {
    return isArabic
      ? "لا يملك الحساب الحالي صلاحية تعديل هذا الطلب. استخدم حساب مدير أو دعم معتمد. لم يُحفظ أي تعديل جزئي."
      : "The current account is not authorized to edit this order. Use an approved admin or support account. No partial change was stored.";
  }
  if (/23505|duplicate key|unique constraint|coupon.*duplicate|duplicate.*coupon|already exists/.test(reason)) {
    return isArabic
      ? "رقم الكوبون مستخدم في طلب آخر. افتح الطلب الموجود أو أدخل رقم كوبون مختلفًا. لم يُحفظ أي تعديل جزئي."
      : "The coupon number is already used by another order. Open the existing order or enter a different coupon. No partial change was stored.";
  }
  if (/merchant_required|merchant_not_found|canonical_merchant|ownership.*conflict|merchant.*mismatch/.test(reason)) {
    return isArabic
      ? "تعذر اعتماد التاجر المختار أو مزامنة ملكية الطلب. راجع التاجر ثم أعد الحفظ. لم يُحفظ أي تعديل جزئي."
      : "The selected merchant could not be verified or synchronized. Review the merchant and save again. No partial change was stored.";
  }
  if (/complete_order_edit_created_invalid_fields|admin_order_validation_failed|required.*field/.test(reason)) {
    return isArabic
      ? "تتضمن بيانات الطلب حقولًا أساسية ناقصة. أكمل اسم المستلم وهاتفه ورقم الكوبون، ثم أعد الحفظ. لم يُحفظ أي تعديل جزئي."
      : "The order has missing core fields. Complete the recipient name, phone, and coupon number, then save again. No partial change was stored.";
  }
  if (/invalid_delivery_fee|invalid_manual_delivery_price|negative_financial|invalid_payment|financial.*mismatch/.test(reason)) {
    return isArabic
      ? "تعذر اعتماد القيم المالية. راجع قيمة البضاعة ورسوم التوصيل والخصم وطريقة التحصيل، ثم أعد الحفظ. لم يُحفظ أي تعديل جزئي."
      : "The financial values could not be verified. Review goods, delivery, discount, and payment method, then save again. No partial change was stored.";
  }
  if (/pgrst202|schema cache|could not find the function|runtime_missing|does not exist/.test(reason)) {
    return isArabic
      ? "خدمة حفظ التعديلات غير متاحة في نسخة قاعدة البيانات الحالية. حدّث الصفحة بعد اكتمال تحديث قاعدة البيانات. لم يُحفظ أي تعديل جزئي."
      : "The complete-save service is unavailable in the current database version. Refresh after the database update completes. No partial change was stored.";
  }
  if (/network|failed to fetch|timeout|connection/.test(reason)) {
    return isArabic
      ? "تعذر الاتصال بقاعدة البيانات. تحقق من الاتصال، ثم أعد المحاولة. لم يُحفظ أي تعديل جزئي."
      : "The database could not be reached. Check the connection and try again. No partial change was stored.";
  }
  return isArabic
    ? "تعذر حفظ التعديلات لأن قاعدة البيانات رفضت العملية. تم إلغاء العملية بالكامل دون حفظ جزئي. حدّث الصفحة ثم أعد المحاولة."
    : "The database rejected the update. The entire transaction was rolled back with no partial save. Refresh and try again.";
}
''',
    "complete editor adds professional status and error localization",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    '  const activeDeliveryFee = financials?.deliveryFee ?? 0;\n',
    '''  const activeDeliveryFee = financials?.deliveryFee ?? 0;
  const originalFinancials = financialsFromOrder(
    currentOrder as Order & Record<string, unknown>,
  );
  const financialChanged =
    !personalOrder &&
    (moneyDiffers(currentForm.goods_value, originalFinancials.goodsValue) ||
      moneyDiffers(activeDeliveryFee, originalFinancials.deliveryFee) ||
      moneyDiffers(currentForm.discount_amount, originalFinancials.discountAmount) ||
      currentForm.delivery_fee_mode !== originalFinancials.deliveryFeeMode ||
      paymentKey(currentForm.payment_method) !== paymentKey(currentOrder.payment_method));
  const sensitiveChange = merchantChanged || financialChanged;
  const normalizedDestination = normalizeInternationalDestination(
    currentForm.destination_country || currentForm.delivery_city || "SA",
    "SA",
  );
  const destinationIsKnown = isKnownInternationalDestination(normalizedDestination);
''',
    "complete editor detects sensitive changes and localized destination",
)
regex_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    r'    const missing = \[[\s\S]*?\n    \]\.filter\(Boolean\);',
    '''    const missing = [
      !personalOrder && !selectedMerchant ? (isArabic ? "التاجر" : "merchant") : "",
      !clean(currentForm.coupon_number) ? (isArabic ? "رقم الكوبون" : "coupon number") : "",
      personalOrder && !clean(currentForm.sender_name)
        ? isArabic
          ? "اسم المرسل"
          : "sender name"
        : "",
      !clean(currentForm.receiver_name) ? (isArabic ? "اسم المستلم" : "recipient name") : "",
      !clean(currentForm.receiver_phone) ? (isArabic ? "هاتف المستلم" : "recipient phone") : "",
      currentForm.goods_value === "" ? (isArabic ? "قيمة البضاعة" : "goods value") : "",
    ].filter(Boolean);''',
    "complete editor removes artificial historical-field blockers",
)
regex_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    r'    if \(clean\(editReason\)\.length < 6\) \{[\s\S]*?\n    \}\n    if \(!confirmed\) \{[\s\S]*?\n    \}',
    '''    if (sensitiveChange && clean(editReason).length < 6) {
      return isArabic
        ? "اكتب سببًا واضحًا للتعديل المالي أو نقل الطلب، على ألا يقل عن 6 أحرف."
        : "Enter a clear reason of at least 6 characters for the financial or merchant change.";
    }
    if (sensitiveChange && !confirmed) {
      return isArabic
        ? "أكد مراجعة أثر التعديل على التاجر والعميل والحسابات."
        : "Confirm that you reviewed the merchant, customer, and accounting impact.";
    }''',
    "complete editor requires audit confirmation only for sensitive changes",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    '        edit_reason: clean(editReason),',
    '        edit_reason:\n          clean(editReason) ||\n          (isArabic\n            ? "تحديث بيانات الطلب من لوحة الإدارة"\n            : "Order details updated from the admin panel"),',
    "complete editor supplies a professional default audit reason",
)
regex_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    r'    \} catch \(cause\) \{\n      const detail = opsErrorDetail\(cause\);\n      setError\([\s\S]*?\n      \);\n    \} finally \{',
    '''    } catch (cause) {
      const detail = opsErrorDetail(cause);
      console.error("DAY NIGHT complete order save rejected:", detail || cause);
      setError(professionalEditError(detail, isArabic));
    } finally {''',
    "complete editor shows professional save failures",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    '<b className="mt-1 block text-sm text-white">{order.status || "—"}</b>',
    '<b className="mt-1 block text-sm text-white">\n                {orderStatusLabel(order.status, isArabic)}\n              </b>',
    "complete editor localizes raw database status",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    '<span>{isArabic ? "اسم المرسل *" : "Sender name *"}</span>',
    '<span>\n                    {personalOrder\n                      ? isArabic\n                        ? "اسم المرسل *"\n                        : "Sender name *"\n                      : isArabic\n                        ? "اسم المرسل — يُستكمل تلقائيًا عند الحاجة"\n                        : "Sender name — completed automatically when needed"}\n                  </span>',
    "complete editor clarifies sender-name fallback",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    '                    className={inputClass()}\n                    required\n                  />\n                </label>\n                <label className={labelClass}>\n                  <span>{isArabic ? "هاتف المرسل *" : "Sender phone *"}</span>',
    '                    className={inputClass()}\n                    required={personalOrder}\n                  />\n                </label>\n                <label className={labelClass}>\n                  <span>{isArabic ? "هاتف المرسل — اختياري" : "Sender phone — optional"}</span>',
    "complete editor makes sender phone optional",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    '                    className={inputClass()}\n                    required\n                    dir="ltr"\n                    inputMode="tel"\n                  />\n                </label>\n              </div>\n\n              <div className="grid gap-3 sm:grid-cols-2">',
    '                    className={inputClass()}\n                    dir="ltr"\n                    inputMode="tel"\n                  />\n                </label>\n              </div>\n\n              <div className="grid gap-3 sm:grid-cols-2">',
    "complete editor removes native sender-phone requirement",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    '<span>{isArabic ? "عنوان الاستلام" : "Pickup address"}</span>',
    '<span>{isArabic ? "عنوان الاستلام التفصيلي — اختياري" : "Detailed pickup address — optional"}</span>',
    "complete editor labels pickup details optional",
)
regex_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    r'''              \) : \(\n                <label className=\{labelClass\}>\n                  <span>\{isArabic \? "دولة الوجهة" : "Destination country"\}</span>\n                  <input\n                    value=\{form\.destination_country \|\| ""\}\n                    onChange=\{\(event\) => setField\("destination_country", event\.target\.value\)\}\n                    className=\{inputClass\(\)\}\n                    placeholder=\{isArabic \? "الدولة" : "Country"\}\n                  />\n                </label>\n              \)\}''',
    '''              ) : (
                <label className={labelClass}>
                  <span>{isArabic ? "دولة الوجهة" : "Destination country"}</span>
                  <select
                    value={normalizedDestination}
                    onChange={(event) =>
                      setField(
                        "destination_country",
                        normalizeInternationalDestination(event.target.value, "SA"),
                      )
                    }
                    className={inputClass()}
                  >
                    {!destinationIsKnown && normalizedDestination && (
                      <option value={normalizedDestination}>
                        {internationalDestinationLabel(normalizedDestination, isArabic)}
                      </option>
                    )}
                    {INTERNATIONAL_DESTINATIONS.filter((country) => country.value !== "AE").map(
                      (country) => (
                        <option key={country.value} value={country.value}>
                          {isArabic ? country.ar : country.en}
                        </option>
                      ),
                    )}
                  </select>
                  <small className="text-[10px] font-bold text-white/40">
                    {isArabic
                      ? "يظهر اسم الدولة كاملًا، بينما يُحفظ رمزها القياسي داخليًا."
                      : "The full country name is shown while its standard code is stored internally."}
                  </small>
                </label>
              )}''',
    "complete editor replaces raw international code input with localized names",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    '<span>{isArabic ? "العنوان التفصيلي" : "Detailed address"}</span>',
    '<span>{isArabic ? "عنوان التسليم التفصيلي — اختياري" : "Detailed delivery address — optional"}</span>',
    "complete editor labels delivery details optional",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    '? "رقم الكوبون — اختياري"\n                      : "Coupon number — optional"',
    '? "رقم الكوبون *"\n                      : "Coupon number *"',
    "complete editor makes personal coupon visibly required",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    '                  required={!personalOrder}\n                  dir="ltr"\n                  data-admin-complete-order-coupon="true"',
    '                  required\n                  aria-required="true"\n                  dir="ltr"\n                  data-admin-complete-order-coupon="true"',
    "complete editor requires coupon for every order type",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    '<span>{isArabic ? "محتوى الشحنة *" : "Package content *"}</span>',
    '<span>{isArabic ? "محتوى الشحنة — اختياري" : "Package content — optional"}</span>',
    "complete editor labels package content optional",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    '                  className={inputClass()}\n                  required\n                />\n              </label>\n\n              <div className="grid gap-3 sm:grid-cols-2">\n                <label className={labelClass}>\n                  <span>{isArabic ? "عدد القطع / الطلبات"',
    '                  className={inputClass()}\n                />\n              </label>\n\n              <div className="grid gap-3 sm:grid-cols-2">\n                <label className={labelClass}>\n                  <span>{isArabic ? "عدد القطع / الطلبات"',
    "complete editor removes package native requirement",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    '              placeholder={isArabic ? "ملاحظات الطلب" : "Order notes"}',
    '              placeholder={isArabic ? "ملاحظات الطلب — اختياري" : "Order notes — optional"}',
    "complete editor labels notes optional",
)
regex_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    r'''                \{isArabic\n                  \? "سبب التعديل — إجباري وبيتسجل باسم المدير"\n                  : "Edit reason — required and attributed to the admin"\}''',
    '''                {sensitiveChange
                  ? isArabic
                    ? "سبب التعديل — إجباري للتعديلات المالية أو نقل الطلب"
                    : "Edit reason — required for financial or merchant changes"
                  : isArabic
                    ? "سبب التعديل — اختياري، ويُضاف وصف مهني تلقائيًا عند تركه فارغًا"
                    : "Edit reason — optional; a professional audit note is added automatically"}''',
    "complete editor professionalizes audit reason label",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    '                minLength={6}\n                maxLength={600}',
    '                minLength={sensitiveChange ? 6 : undefined}\n                maxLength={600}',
    "complete editor makes reason length conditional",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    '                required\n                data-admin-complete-order-reason="true"',
    '                required={sensitiveChange}\n                data-admin-complete-order-reason="true"',
    "complete editor makes audit reason conditionally required",
)
regex_once(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    r'''            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/15 p-4 text-xs font-bold leading-6 text-white/75">[\s\S]*?            </label>\n          </section>''',
    '''            {sensitiveChange && (
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/15 p-4 text-xs font-bold leading-6 text-white/75">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => {
                    setConfirmed(event.target.checked);
                    clearFeedback();
                  }}
                  className="mt-1 h-4 w-4 accent-[#d4af37]"
                  data-admin-complete-order-confirm="true"
                />
                <span>
                  {isArabic
                    ? "أؤكد أنني راجعت التاجر والعميل والكوبون والعنوان والقيم المالية، وأنني أوافق على مزامنة الملكية والكشوف وتسجيل القيم السابقة واللاحقة."
                    : "I confirm that I reviewed the merchant, customer, coupon, address, and financial values, and approve synchronization of ownership and ledgers with before/after audit records."}
                </span>
              </label>
            )}
          </section>''',
    "complete editor shows confirmation only for sensitive changes",
)

# Professional Arabic wording throughout the complete editor.
modal_path = "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx"
modal_text = read(modal_path)
wording = {
    "الحساب المُرحّل اتساب محمي": "ظل الحساب المُرحَّل محميًا",
    "التاجر والكشوف والحسابات اتزامنوا بأمان": "تمت مزامنة التاجر والكشوف والحسابات بأمان",
    "رقم التتبع والفاتورة لا بيتغيروش من محرر البيانات.": "لا يمكن تغيير رقم التتبع أو رقم الفاتورة من محرر البيانات.",
    "كل عملية بتتسجل قبل/بعد باسم المدير وسبب التعديل.": "تُسجَّل كل عملية بالقيم السابقة واللاحقة واسم المسؤول وسبب التعديل.",
    "التعديل المالي بيتسجل قبل/بعد في عملية واحدة قابلة للمراجعة.": "يُسجَّل التعديل المالي بالقيم السابقة واللاحقة ضمن عملية واحدة قابلة للمراجعة.",
    "أنت بتنقل الطلب من التاجر الحالي إلى": "أنت تنقل الطلب من التاجر الحالي إلى",
    "الحفظ مش هيتم إلا لو التاجر الجديد مرتبط ببوابة قانونية ومفيش تعارض ملكية في القيود التابعة.": "لن يتم الحفظ إلا بعد التحقق من التاجر الجديد وعدم وجود تعارض في ملكية القيود التابعة.",
    "أما المبالغ فتتعدل من صندوق التصحيح المالي المُدقّق الموجود تحت الرسالة دي.": "أما المبالغ فتُعدَّل من خلال لوحة التصحيح المالي المُدقَّق أدناه.",
    "الحفظ ذري: يا كل التعديلات تنجح وتتراجع من قاعدة البيانات، يا العملية كلها تتلغي من غير حفظ جزئي.": "الحفظ ذري: إما أن تُعتمد جميع التعديلات وسجل التدقيق معًا، أو تُلغى العملية بالكامل دون حفظ جزئي.",
    "سبب التعديل — إجباري وبيتسجل باسم المدير": "سبب التعديل — إجباري ويُسجَّل باسم المسؤول",
}
for old, new in wording.items():
    modal_text = modal_text.replace(old, new)
write(modal_path, modal_text)
print("PASS complete editor uses professional Arabic wording")

# Persistence: use corrected RPC, preserve exact destination codes, require personal coupon.
replace_once(
    "artifacts/day-night-delivery/src/lib/adminOrderEditPersistence.ts",
    'import type { Order } from "../types";\n',
    'import type { Order } from "../types";\nimport { normalizeInternationalDestination } from "../data/internationalDestinations";\n',
    "edit persistence imports destination normalizer",
)
regex_once(
    "artifacts/day-night-delivery/src/lib/adminOrderEditPersistence.ts",
    r'const receiverCity = isInternational\n    \? clean\(input\.destination_country \|\| input\.delivery_city \|\| "WORLD"\)\n    : clean\(input\.delivery_city \|\| "Abu Dhabi"\);',
    'const receiverCity = isInternational\n    ? normalizeInternationalDestination(\n        input.destination_country || input.delivery_city || "WORLD",\n        "WORLD",\n      )\n    : clean(input.delivery_city || "Abu Dhabi");',
    "edit persistence normalizes core international destination",
)
regex_once(
    "artifacts/day-night-delivery/src/lib/adminOrderEditPersistence.ts",
    r'const receiverCity = isInternational\n    \? clean\(input\.destination_country \|\| input\.delivery_city \|\| "WORLD"\)\n    : clean\(input\.delivery_city \|\| "Abu Dhabi"\);',
    'const receiverCity = isInternational\n    ? normalizeInternationalDestination(\n        input.destination_country || input.delivery_city || "WORLD",\n        "WORLD",\n      )\n    : clean(input.delivery_city || "Abu Dhabi");',
    "edit persistence normalizes full international destination",
)
replace_once(
    "artifacts/day-night-delivery/src/lib/adminOrderEditPersistence.ts",
    'function personalCorePatch(input: FinancialOpsOrderUpdateInput) {\n  const receiverCity = clean(input.delivery_city || "Abu Dhabi");',
    'function personalCorePatch(input: FinancialOpsOrderUpdateInput) {\n  const couponNumber = clean(input.coupon_number);\n  if (!couponNumber) throw new Error("coupon_number_required_for_personal_order");\n  const receiverCity = clean(input.delivery_city || "Abu Dhabi");',
    "personal edit runtime requires coupon",
)
replace_once(
    "artifacts/day-night-delivery/src/lib/adminOrderEditPersistence.ts",
    '    coupon_number: clean(input.coupon_number) || null,',
    '    coupon_number: couponNumber,',
    "personal edit always persists coupon",
)
regex_once(
    "artifacts/day-night-delivery/src/lib/adminOrderEditPersistence.ts",
    r'''  const \{ data, error \} = await supabase\.rpc\("admin_update_order_complete_verified", \{\n    p_payload: \{[\s\S]*?\n    \},\n  \}\);\n  if \(error\) throw error;''',
    '''  const args = {
    p_payload: {
      order_id: orderId,
      patch,
      financials: {
        goods_value: financials.goodsValue,
        delivery_fee: financials.deliveryFee,
        discount_amount: financials.discountAmount,
        delivery_fee_mode: financials.deliveryFeeMode,
      },
      reason,
    },
  };

  let { data, error } = await supabase.rpc(
    "admin_update_order_complete_verified_v2",
    args,
  );
  if (error && isMissingCompleteEditRuntime(error)) {
    const compatibility = await supabase.rpc(
      "admin_update_order_complete_verified",
      args,
    );
    data = compatibility.data;
    error = compatibility.error;
  }
  if (error) throw error;''',
    "edit persistence calls corrected complete-save RPC with compatibility fallback",
)

# Preserve original database diagnostics, then let UI translate them professionally.
replace_once(
    "artifacts/day-night-delivery/src/lib/adminOperationsData.ts",
    'import { createDayNightInvoiceNumber } from "./printableDocuments";\n',
    'import { createDayNightInvoiceNumber } from "./printableDocuments";\nimport { currentUiIsArabic, friendlyDatabaseErrorMessage } from "./friendlyErrorMessage";\n',
    "admin operations imports professional database messages",
)
regex_once(
    "artifacts/day-night-delivery/src/lib/adminOperationsData.ts",
    r'export function opsErrorDetail\(error: unknown\) \{[\s\S]*?\n\}\n\nfunction operationsError\(error: unknown, fallback: string\) \{[\s\S]*?\n\}\n\nasync function rpcOne',
    '''export function opsErrorDetail(error: unknown) {
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

  return technicalDetail || friendlyDatabaseErrorMessage(error, currentUiIsArabic(), "operation");
}

function operationsError(error: unknown, fallback: string) {
  const technicalDetail = opsErrorDetail(error);
  if (technicalDetail) console.warn("Admin operations DB detail:", technicalDetail);

  const wrapped = new Error(
    friendlyDatabaseErrorMessage(error, currentUiIsArabic(), "operation", fallback),
  ) as Error & { dbDetail?: string; cause?: unknown };
  wrapped.dbDetail = technicalDetail;
  wrapped.cause = error;
  return wrapped;
}

async function rpcOne''',
    "admin operations preserves original database diagnostics",
)

# Vite plugin must not rewrite the now-authoritative source implementation.
replace_once(
    "artifacts/day-night-delivery/scripts/friendly-error-message-plugin.ts",
    'name: "day-night-friendly-error-messages-v2"',
    'name: "day-night-friendly-error-messages-v5"',
    "friendly message plugin version",
)
regex_once(
    "artifacts/day-night-delivery/scripts/friendly-error-message-plugin.ts",
    r'''      if \(normalized\.endsWith\("/src/lib/adminOperationsData\.ts"\)\) \{[\s\S]*?\n      \}\n\n      if \(normalized\.endsWith\("/src/components/admin/AdminOrderEditModalComplete\.tsx"\)\)''',
    '''      if (normalized.endsWith("/src/lib/adminOperationsData.ts")) {
        return null;
      }

      if (normalized.endsWith("/src/components/admin/AdminOrderEditModalComplete.tsx"))''',
    "friendly plugin leaves admin operations source authoritative",
)
regex_once(
    "artifacts/day-night-delivery/scripts/friendly-error-message-plugin.ts",
    r'''      if \(normalized\.endsWith\("/src/components/admin/AdminOrderEditModalComplete\.tsx"\)\) \{[\s\S]*?\n      \}\n\n      if \(normalized\.endsWith\("/src/components/admin/AdminNewMerchant\.tsx"\)\)''',
    '''      if (normalized.endsWith("/src/components/admin/AdminOrderEditModalComplete.tsx")) {
        return null;
      }

      if (normalized.endsWith("/src/components/admin/AdminNewMerchant.tsx"))''',
    "friendly plugin leaves professional editor messages authoritative",
)

# Export and generic route localization must understand exact ISO country codes.
replace_once(
    "artifacts/day-night-delivery/src/lib/exportLocalization.ts",
    'import type { Order } from "../types";\n',
    'import type { Order } from "../types";\nimport { internationalDestinationLabel, isKnownInternationalDestination } from "../data/internationalDestinations";\n',
    "export localization imports country names",
)
replace_once(
    "artifacts/day-night-delivery/src/lib/exportLocalization.ts",
    '  if (!text) return EMPTY;\n  if (language !== "ar" || !/[A-Za-z]/.test(text)) return text;',
    '  if (!text) return EMPTY;\n  if (isKnownInternationalDestination(text)) {\n    return internationalDestinationLabel(text, language === "ar");\n  }\n  if (language !== "ar" || !/[A-Za-z]/.test(text)) return text;',
    "export localization translates country codes before transliteration",
)

# International orders workspace: never render raw KW/SA codes to users or PDFs.
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminInternationalOrdersWorkspace.tsx",
    'import type { AdminPdfPayload } from "../../lib/adminPdfExport";\n',
    'import type { AdminPdfPayload } from "../../lib/adminPdfExport";\nimport { internationalDestinationLabel, isKnownInternationalDestination } from "../../data/internationalDestinations";\n',
    "international workspace imports destination localization",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminInternationalOrdersWorkspace.tsx",
    'function statusLabel(value: unknown, isArabic: boolean) {',
    '''function destinationLabel(order: Order, isArabic: boolean) {
  const raw = clean(order.destination_country || order.receiver_city);
  if (isKnownInternationalDestination(raw)) {
    return internationalDestinationLabel(raw, isArabic);
  }
  return raw || "—";
}

function statusLabel(value: unknown, isArabic: boolean) {''',
    "international workspace adds destination display helper",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminInternationalOrdersWorkspace.tsx",
    'route: `${clean(order.sender_city) || "—"} → ${clean(order.receiver_city || order.destination_country) || "—"}`,',
    'route: `${clean(order.sender_city) || "—"} → ${destinationLabel(order, isArabic)}`,',
    "international PDF localizes destination country",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminInternationalOrdersWorkspace.tsx",
    '{clean(order.receiver_city || order.destination_country) || "—"}</span>',
    '{destinationLabel(order, isArabic)}</span>',
    "international queue localizes destination country",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminInternationalOrdersWorkspace.tsx",
    '{clean(selectedOrder.receiver_city || selectedOrder.destination_country) || "—"}</b>',
    '{destinationLabel(selectedOrder, isArabic)}</b>',
    "international selected shipment localizes destination country",
)

# Tracking actions: localized selectors and professional error output.
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminInternationalOrderTrackingActions.tsx",
    'import type { AdminPdfPayload } from "../../lib/adminPdfExport";\n',
    'import type { AdminPdfPayload } from "../../lib/adminPdfExport";\nimport {\n  INTERNATIONAL_DESTINATIONS,\n  internationalDestinationLabel,\n  normalizeInternationalDestination,\n} from "../../data/internationalDestinations";\n',
    "international tracking actions import country localization",
)
regex_once(
    "artifacts/day-night-delivery/src/components/admin/AdminInternationalOrderTrackingActions.tsx",
    r'function canonicalCountry\(value: unknown\) \{[\s\S]*?\n\}',
    'function canonicalCountry(value: unknown) {\n  return normalizeInternationalDestination(value, "SA");\n}',
    "international tracking actions normalize all supported countries",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminInternationalOrderTrackingActions.tsx",
    'route: `${clean(order.sender_city) || "—"} → ${clean(order.receiver_city || order.destination_country) || "—"}`,',
    'route: `${clean(order.sender_city) || "—"} → ${internationalDestinationLabel(\n        order.destination_country || order.receiver_city,\n        isArabic,\n      )}`,',
    "international tracking PDF localizes destination country",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminInternationalOrderTrackingActions.tsx",
    '        destination_country: clean(form.destinationCountry),',
    '        destination_country: normalizeInternationalDestination(form.destinationCountry, "SA"),',
    "international tracking stores canonical destination code",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminInternationalOrderTrackingActions.tsx",
    '      setError(isArabic ? `تعذر حفظ رقم التتبع: ${message}` : `Unable to save tracking number: ${message}`);',
    '      console.error("DAY NIGHT tracking registration rejected:", message);\n      setError(\n        isArabic\n          ? "تعذر حفظ رقم التتبع الدولي. راجع رقم البوليصة وبيانات الدولة، ثم أعد المحاولة."\n          : "The international tracking number could not be saved. Review the AWB and country details, then try again.",\n      );',
    "international tracking hides raw technical literals from Arabic UI",
)
regex_once(
    "artifacts/day-night-delivery/src/components/admin/AdminInternationalOrderTrackingActions.tsx",
    r'''            <label>\n              <span>\{isArabic \? "دولة المنشأ" : "Origin country"\}</span>\n              <input dir="ltr" maxLength=\{3\} value=\{form\.originCountry\} onChange=\{\(event\) => setForm\(\{ \.\.\.form, originCountry: event\.target\.value\.toUpperCase\(\) \}\)\} />\n            </label>''',
    '''            <label>
              <span>{isArabic ? "دولة المنشأ" : "Origin country"}</span>
              <select
                value={normalizeInternationalDestination(form.originCountry, "AE")}
                onChange={(event) => setForm({ ...form, originCountry: event.target.value })}
              >
                {INTERNATIONAL_DESTINATIONS.map((country) => (
                  <option key={country.value} value={country.value}>
                    {isArabic ? country.ar : country.en}
                  </option>
                ))}
              </select>
            </label>''',
    "tracking editor localizes origin country",
)
regex_once(
    "artifacts/day-night-delivery/src/components/admin/AdminInternationalOrderTrackingActions.tsx",
    r'''            <label>\n              <span>\{isArabic \? "دولة الوجهة" : "Destination country"\}</span>\n              <input dir="ltr" maxLength=\{3\} value=\{form\.destinationCountry\} onChange=\{\(event\) => setForm\(\{ \.\.\.form, destinationCountry: event\.target\.value\.toUpperCase\(\) \}\)\} placeholder="SA" />\n            </label>''',
    '''            <label>
              <span>{isArabic ? "دولة الوجهة" : "Destination country"}</span>
              <select
                value={normalizeInternationalDestination(form.destinationCountry, "SA")}
                onChange={(event) => setForm({ ...form, destinationCountry: event.target.value })}
              >
                {INTERNATIONAL_DESTINATIONS.filter((country) => country.value !== "AE").map(
                  (country) => (
                    <option key={country.value} value={country.value}>
                      {isArabic ? country.ar : country.en}
                    </option>
                  ),
                )}
              </select>
            </label>''',
    "tracking editor localizes destination country",
)

# Standalone international tracking launcher: localized order labels, routes and selectors.
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminInternationalTrackingLauncher.tsx",
    'import { fetchAdminOrders } from "../../lib/adminData";\n',
    'import { fetchAdminOrders } from "../../lib/adminData";\nimport {\n  INTERNATIONAL_DESTINATIONS,\n  internationalDestinationLabel,\n  normalizeInternationalDestination,\n} from "../../data/internationalDestinations";\n',
    "international tracking launcher imports country localization",
)
regex_once(
    "artifacts/day-night-delivery/src/components/admin/AdminInternationalTrackingLauncher.tsx",
    r'function countryCode\(value: unknown\) \{[\s\S]*?\n\}',
    'function countryCode(value: unknown) {\n  return normalizeInternationalDestination(value);\n}',
    "international launcher normalizes supported country aliases",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminInternationalTrackingLauncher.tsx",
    '<option key={order.id} value={order.id}>دولي · {orderReference(order)} · {order.sender_city || "—"} → {order.receiver_city || order.destination_country || "—"}</option>',
    '<option key={order.id} value={order.id}>\n                          {arabic ? "دولي" : "International"} · {orderReference(order)} · {order.sender_city || "—"} → {internationalDestinationLabel(order.destination_country || order.receiver_city, arabic)}\n                        </option>',
    "international launcher localizes order destination options",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminInternationalTrackingLauncher.tsx",
    '<option key={order.id} value={order.id}>نظام · {orderReference(order)} · {order.sender_city || "—"} → {order.receiver_city || "—"}</option>',
    '<option key={order.id} value={order.id}>\n                          {arabic ? "طلب محلي" : "Local order"} · {orderReference(order)} · {order.sender_city || "—"} → {order.receiver_city || "—"}\n                        </option>',
    "international launcher professionalizes local order option",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminInternationalTrackingLauncher.tsx",
    '<label><span>{arabic ? "دولة المنشأ" : "Origin country"}</span><input dir="ltr" maxLength={3} value={form.origin_country} onChange={(event) => setForm({ ...form, origin_country: event.target.value.toUpperCase() })} /></label>',
    '<label><span>{arabic ? "دولة المنشأ" : "Origin country"}</span><select value={normalizeInternationalDestination(form.origin_country, "AE")} onChange={(event) => setForm({ ...form, origin_country: event.target.value })}>{INTERNATIONAL_DESTINATIONS.map((country) => <option key={country.value} value={country.value}>{arabic ? country.ar : country.en}</option>)}</select></label>',
    "international launcher localizes origin selector",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminInternationalTrackingLauncher.tsx",
    '<label><span>{arabic ? "دولة الوجهة" : "Destination country"}</span><input dir="ltr" maxLength={3} value={form.destination_country} onChange={(event) => setForm({ ...form, destination_country: event.target.value.toUpperCase() })} placeholder="SA" /></label>',
    '<label><span>{arabic ? "دولة الوجهة" : "Destination country"}</span><select value={normalizeInternationalDestination(form.destination_country, "SA")} onChange={(event) => setForm({ ...form, destination_country: event.target.value })}>{INTERNATIONAL_DESTINATIONS.filter((country) => country.value !== "AE").map((country) => <option key={country.value} value={country.value}>{arabic ? country.ar : country.en}</option>)}</select></label>',
    "international launcher localizes destination selector",
)
replace_once(
    "artifacts/day-night-delivery/src/components/admin/AdminInternationalTrackingLauncher.tsx",
    '<span>{shipment.destination_city || shipment.destination_country || "—"}</span>',
    '<span>{shipment.destination_city || internationalDestinationLabel(shipment.destination_country, arabic)}</span>',
    "international launcher localizes shipment card destination",
)

# Targeted source gate kept in the repository.
GATE = r'''import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");
const expect = (source, pattern, label) => {
  if (!pattern.test(source)) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
};
const reject = (source, pattern, label) => {
  if (pattern.test(source)) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
};

const modal = read("src/components/admin/AdminOrderEditModalComplete.tsx");
const persistence = read("src/lib/adminOrderEditPersistence.ts");
const destinations = read("src/data/internationalDestinations.ts");
const workspace = read("src/components/admin/AdminInternationalOrdersWorkspace.tsx");
const trackingActions = read("src/components/admin/AdminInternationalOrderTrackingActions.tsx");
const launcher = read("src/components/admin/AdminInternationalTrackingLauncher.tsx");
const exportLocalization = read("src/lib/exportLocalization.ts");
const plugin = read("scripts/friendly-error-message-plugin.ts");

expect(destinations, /value: "KW"[\s\S]*ar: "الكويت"/, "Kuwait has a full Arabic label");
expect(destinations, /value: "SA"[\s\S]*ar: "المملكة العربية السعودية"/, "Saudi Arabia has a professional Arabic label");
expect(destinations, /normalizeInternationalDestination/, "country values are canonicalized");
expect(modal, /INTERNATIONAL_DESTINATIONS[\s\S]*دولة الوجهة/, "edit modal uses localized country selector");
reject(modal, /value=\{form\.destination_country \|\| ""\}[\s\S]{0,180}<input/, "edit modal does not expose a raw country-code text input");
expect(modal, /!clean\(currentForm\.coupon_number\)/, "every edited order requires a coupon");
reject(modal, /رقم الكوبون — اختياري/, "personal edit no longer marks coupon optional");
expect(modal, /هاتف المرسل — اختياري/, "sender phone is explicitly optional");
expect(modal, /sensitiveChange && !confirmed/, "confirmation is limited to sensitive changes");
expect(modal, /تحديث بيانات الطلب من لوحة الإدارة/, "ordinary edits receive an automatic audit reason");
expect(modal, /orderStatusLabel\(order\.status, isArabic\)/, "raw database status is localized");
reject(modal, /(اتلغت|مفيش|بيتسجل|بتتسجل|مش هيتم|الرسالة دي|اتساب|اتزامنوا)/, "complete editor contains no colloquial failure wording");
expect(persistence, /admin_update_order_complete_verified_v2/, "save calls corrected complete-edit RPC");
expect(persistence, /coupon_number_required_for_personal_order/, "personal edit rejects a missing coupon");
expect(persistence, /normalizeInternationalDestination/, "edit persistence stores canonical country values");
expect(workspace, /destinationLabel\(order, isArabic\)/, "international queue localizes country names");
expect(trackingActions, /INTERNATIONAL_DESTINATIONS/, "tracking action editor uses country-name selectors");
expect(launcher, /internationalDestinationLabel/, "tracking launcher localizes countries");
expect(exportLocalization, /isKnownInternationalDestination\(text\)/, "PDF/export localization handles ISO country codes");
expect(plugin, /day-night-friendly-error-messages-v5/, "build plugin uses the authoritative professional source");
reject(plugin, /complete order save exact rejection messages/, "build plugin no longer overwrites editor messages");

for (const migration of [
  "../../../supabase/migrations/20260802102000_admin_complete_order_legacy_validation_hotfix.sql",
  "../../../supabase/migrations/20260802103000_admin_complete_order_sender_identity_fallback.sql",
  "../../../supabase/migrations/20260802104000_admin_complete_order_save_compatibility_alias.sql",
]) {
  if (!fs.existsSync(path.resolve(ROOT, migration))) throw new Error(`FAIL missing reviewed migration ${migration}`);
}

console.log("DAY NIGHT admin order save and Arabic localization gate PASSED");
'''
write("artifacts/day-night-delivery/scripts/admin-order-save-localization-gate.mjs", GATE)

package_path = "artifacts/day-night-delivery/package.json"
package_data = json.loads(read(package_path))
package_data["scripts"]["admin-order-save-localization:gate"] = (
    "node scripts/admin-order-save-localization-gate.mjs"
)
production_gate = package_data["scripts"]["production:gate"]
if "admin-order-save-localization-gate.mjs" not in production_gate:
    package_data["scripts"]["production:gate"] = (
        production_gate + " && node scripts/admin-order-save-localization-gate.mjs"
    )
write(package_path, json.dumps(package_data, ensure_ascii=False, indent=2) + "\n")
print("PASS package scripts include the order-save localization gate")

print("All guarded admin order save and Arabic localization patches completed.")
