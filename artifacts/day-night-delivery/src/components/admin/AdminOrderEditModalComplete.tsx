import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Bug,
  Calculator,
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  PackageCheck,
  Save,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { opsErrorDetail } from "../../lib/adminOperationsData";
import { formatAdminMoney } from "../../lib/adminLocale";
import {
  saveAdminLockedMerchantCoreEdit,
  saveAdminOrderEdit,
} from "../../lib/adminOrderEditPersistence";
import {
  calculateFinancialOpsOrder,
  type FinancialOpsOrderInput,
} from "../../lib/orderFinancialOperations";
import { financialsFromOrder } from "../../lib/orderFinancials";
import {
  UAE_LOCATIONS,
  getAreasForEmirate,
  getDefaultAreaForEmirate,
} from "../../data/uaeLocations";
import {
  INTERNATIONAL_DESTINATIONS,
  internationalDestinationLabel,
  isKnownInternationalDestination,
  normalizeInternationalDestination,
} from "../../data/internationalDestinations";
import type { Merchant, Order } from "../../types";
import { isPersonalAdminOrder } from "../../lib/adminOrderLogic";
import {
  PERSONAL_ORDER_DELIVERY_FEE,
  calculatePersonalOrderFinancials,
} from "../../lib/personalOrderOperations";
import AdminDeliveredFinancialAdjustment from "./AdminDeliveredFinancialAdjustment";

type Props = {
  order: Order | null;
  merchants: Merchant[];
  isArabic: boolean;
  open: boolean;
  onClose: () => void;
  onSaved?: (order: Order) => Promise<void> | void;
  onDeleted?: (reference: string) => Promise<void> | void;
};

const clean = (value: unknown) => String(value ?? "").trim();
const inputClass = () =>
  "w-full rounded-2xl border border-white/10 bg-[#06182d]/80 px-4 py-3.5 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition duration-200 placeholder:text-white/30 hover:border-white/20 focus:-translate-y-px focus:border-brand-gold/70 focus:bg-[#071c35] focus:ring-4 focus:ring-brand-gold/10 disabled:cursor-not-allowed disabled:opacity-45";
const labelClass =
  "block space-y-2 text-xs font-black tracking-[0.01em] text-white/65";
const sectionClass =
  "space-y-4 rounded-[1.65rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.055),rgba(2,18,38,0.66))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-sm sm:p-5";

const numberOrBlank = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
};

const orderReference = (order: Order) =>
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
  const key = clean(value).toLowerCase().replace(/[\s-]+/g, "_");
  const label = ORDER_STATUS_LABELS[key];
  return label ? (isArabic ? label.ar : label.en) : clean(value) || "—";
}

function paymentKey(value: unknown) {
  const key = clean(value || "cod").toLowerCase().replace(/[\s-]+/g, "_");
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

function safeEditDiagnostic(detail: string) {
  return clean(detail)
    .replace(/bearer\s+[a-z0-9._~-]+/gi, "Bearer [hidden]")
    .replace(/eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+/gi, "[token hidden]")
    .replace(/https?:\/\/[^\s|]+/gi, "[endpoint]")
    .replace(/\s+/g, " ")
    .slice(0, 700);
}

function editErrorReference(detail: string) {
  const reason = clean(detail).toLowerCase();
  const databaseCode = reason.match(
    /\b(?:pgrst\d{3}|(?:22|23|25|28|40|42|53|55|57|58)[0-9a-z]{3})\b/i,
  )?.[0];
  const symbolicCode = reason.match(
    /\b(?:admin|order|merchant|financial|coupon|delivery|complete)_[a-z0-9_]{3,}\b/i,
  )?.[0];
  return clean(databaseCode || symbolicCode || "ORDER_SAVE_REJECTED").toUpperCase();
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
  if (/admin_edit_reason_required_min_6|reason.*minimum|reason.*required/.test(reason)) {
    return isArabic
      ? "سبب التعديل مطلوب لهذه العملية ويجب أن يكون واضحًا وألا يقل عن 6 أحرف. لم يُحفظ أي تعديل جزئي."
      : "A clear edit reason of at least 6 characters is required. No partial change was stored.";
  }
  if (/23502|null value.*violates|not-null constraint/.test(reason)) {
    return isArabic
      ? "يوجد حقل أساسي لم تصل قيمته إلى قاعدة البيانات. راجع الحقول الإلزامية الموضحة داخل الكارت ثم أعد الحفظ. لم يُحفظ أي تعديل جزئي."
      : "A required database field is missing. Review the required fields shown in the editor and save again. No partial change was stored.";
  }
  if (/23503|foreign key|violates foreign key/.test(reason)) {
    return isArabic
      ? "يرتبط الطلب بسجل غير صالح أو محذوف، مثل التاجر أو الحساب المرتبط. أعد اختيار السجل الصحيح ثم احفظ. لم يُحفظ أي تعديل جزئي."
      : "The order references an invalid or deleted related record. Select the correct merchant or linked record and save again. No partial change was stored.";
  }
  if (/23514|check constraint|violates check/.test(reason)) {
    return isArabic
      ? "إحدى القيم تخالف قاعدة تشغيل معتمدة في النظام. راجع المبالغ وطريقة التحصيل وحالة الطلب، وسيظهر رمز القاعدة في التفاصيل التشخيصية. لم يُحفظ أي تعديل جزئي."
      : "A value violates an approved business rule. Review the amounts, payment method, and order state. The rule code is shown in diagnostics. No partial change was stored.";
  }
  if (/22p02|invalid input syntax|invalid text representation/.test(reason)) {
    return isArabic
      ? "تنسيق إحدى القيم غير صحيح، مثل رقم أو معرّف أو رمز دولة. صحح القيمة الموضحة ثم أعد الحفظ. لم يُحفظ أي تعديل جزئي."
      : "A value has an invalid format, such as a number, identifier, or country code. Correct it and save again. No partial change was stored.";
  }
  if (/40001|40p01|serialization|deadlock|concurrent update|concurrent modification/.test(reason)) {
    return isArabic
      ? "تم تعديل الطلب من عملية أخرى في اللحظة نفسها. أغلق الكارت وافتح الطلب مجددًا للحصول على أحدث نسخة، ثم أعد الحفظ. لم يُحفظ أي تعديل جزئي."
      : "Another operation changed the order at the same time. Reopen the order to load the latest version, then save again. No partial change was stored.";
  }
  if (/pgrst116|order_not_found|no rows|returned no rows/.test(reason)) {
    return isArabic
      ? "لم تعد الطلبية موجودة بالمرجع الحالي أو لم يعد الحساب مخولًا لقراءتها. حدّث قائمة الطلبات ثم افتحها من جديد. لم يُحفظ أي تعديل جزئي."
      : "The order no longer exists under this reference or is no longer readable by this account. Refresh the order list and reopen it. No partial change was stored.";
  }
  if (/readback.*mismatch|verification_failed|returned_no_order|returned no order/.test(reason)) {
    return isArabic
      ? "نفذت قاعدة البيانات العملية لكن التحقق النهائي من القيم المحفوظة لم يطابق الطلب. أُلغيت العملية للحماية، ويظهر رمز التحقق داخل التفاصيل."
      : "The database operation ran, but saved-value verification did not match. The transaction was rolled back for safety; see the diagnostic code.";
  }
  if (/locked_order_merchant_change_requires_complete_audited_edit/.test(reason)) {
    return isArabic
      ? "لا يمكن نقل طلب مُسلّم إلى تاجر آخر عبر تعديل البيانات العادي. اكتب سبب النقل وأكد المراجعة ليُنفذ النقل المالي المُدقّق. لم يُحفظ أي تعديل جزئي."
      : "A delivered order cannot be moved to another merchant through a core-data edit. Enter a reason and confirm the audited financial transfer. No partial change was stored.";
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
  if (/financials_locked|delivered settlements are locked|posted financials|financial.*posted/.test(reason)) {
    return isArabic
      ? "الطلب مُسلّم أو مُرحّل ماليًا. احفظ بيانات العميل والعنوان والشحنة دون تغيير المبالغ، واستخدم صندوق التصحيح المالي المُدقّق عند تعديل الحسابات. لم يُحفظ أي تعديل جزئي."
      : "The order is delivered or financially posted. Save customer, address, and package details without changing money fields, and use the audited financial adjustment panel for accounting changes. No partial change was stored.";
  }
  if (
    /pgrst202|runtime_missing|could not find the function (public\.)?admin_update_order_(complete_verified(_v2)?|with_financials)|function (public\.)?admin_update_order_(complete_verified(_v2)?|with_financials).*does not exist/.test(
      reason,
    )
  ) {
    return isArabic
      ? "خدمة حفظ التعديلات غير متاحة حاليًا بسبب عدم اكتمال مكوّن قاعدة البيانات المسؤول عن الحفظ. لم يُحفظ أي تعديل جزئي."
      : "The order-save database component is currently unavailable. No partial change was stored.";
  }
  if (/network|failed to fetch|timeout|connection/.test(reason)) {
    return isArabic
      ? "تعذر الاتصال بقاعدة البيانات. تحقق من الاتصال، ثم أعد المحاولة. لم يُحفظ أي تعديل جزئي."
      : "The database could not be reached. Check the connection and try again. No partial change was stored.";
  }
  return isArabic
    ? "رفضت قاعدة البيانات العملية لسبب لم يُصنَّف بعد. ستجد رمز الرد والتفصيل التشخيصي الدقيق داخل بطاقة الخطأ أدناه. أُلغيت العملية بالكامل دون حفظ جزئي."
    : "The database rejected the update for an unclassified reason. The exact response code and diagnostic detail are shown below. The transaction rolled back with no partial save.";
}

function merchantOptionLabel(merchant: Merchant) {
  const owner = clean(merchant.owner_name);
  const store = clean(merchant.trade_name);
  const code = clean(merchant.merchant_code);
  const phone = clean(merchant.phone);
  return [owner, store, code, phone].filter(Boolean).join(" — ") || merchant.id;
}

function initialForm(order: Order, merchants: Merchant[]): FinancialOpsOrderInput {
  const personal = isPersonalAdminOrder(order);
  const merchant = merchants.find((item) => item.id === order.merchant_id) || null;
  const currentPrice = Number(order.delivery_fee || order.delivery_price || order.price || 0);
  const manual = order.price_source === "manual" || order.manual_delivery_price !== null && order.manual_delivery_price !== undefined;
  const packageValue = clean(order.package_description || order.package_type);
  const finance = financialsFromOrder(order as Order & Record<string, unknown>);

  return {
    merchant,
    merchant_id: order.merchant_id || "",
    merchant_name: order.merchant_name || merchant?.trade_name || order.sender_name || "",
    merchant_code: order.merchant_code || merchant?.merchant_code || "",
    sender_name: order.sender_name || merchant?.trade_name || "",
    sender_phone: order.sender_phone || merchant?.phone || "",
    coupon_number: order.coupon_number || "",
    shipping_scope: order.shipping_scope === "international" ? "international" : "local",
    order_count: Math.max(1, Number(order.order_count || order.pieces || 1)),
    pickup_city: order.sender_city || order.sender_emirate || merchant?.emirate || "Abu Dhabi",
    pickup_area: order.sender_area || merchant?.city || "",
    pickup_street: order.sender_address || merchant?.pickup_address || merchant?.address || "",
    delivery_city: order.receiver_city || order.receiver_emirate || "Abu Dhabi",
    delivery_area: order.receiver_area || "",
    delivery_street: order.receiver_address || "",
    destination_country: normalizeInternationalDestination(
      order.destination_country || order.receiver_city || "SA",
      "SA",
    ),
    receiver_name: order.receiver_name || order.customer_name || "",
    receiver_phone: order.receiver_phone || order.customer_phone || "",
    receiver_address: order.receiver_address || "",
    package_type: packageValue,
    package_description: packageValue,
    weight: Math.max(0.1, Number(order.weight || 1)),
    payment_method:
      order.payment_method === "sender_pays"
        ? "merchant_pays"
        : order.payment_method || "cod",
    cod_amount: numberOrBlank(order.cod_amount),
    notes: order.notes || "",
    status: order.status || "pending",
    // Existing orders open with their exact saved delivery value. This prevents a
    // harmless customer/address edit from silently recalculating historical pricing.
    price_mode: personal ? "system" : "manual",
    manual_delivery_price: personal
      ? ""
      : numberOrBlank(order.manual_delivery_price ?? currentPrice),
    goods_value: finance.goodsValue,
    discount_amount: finance.discountAmount,
    delivery_fee_mode: personal ? "customer_pays" : finance.deliveryFeeMode,
  };
}

function Metric({
  label,
  value,
  isArabic,
  accent = false,
}: {
  label: string;
  value: number;
  isArabic: boolean;
  accent?: boolean;
}) {
  return (
    <span
      className={`rounded-xl border p-2 text-center text-[10px] font-bold ${
        accent
          ? "border-brand-gold/40 bg-brand-gold/10 text-brand-gold"
          : "border-white/10 bg-black/10 text-white/70"
      }`}
    >
      {label}
      <b className="mt-1 block text-sm" dir={isArabic ? "rtl" : "ltr"}>
        {formatAdminMoney(value, isArabic, { absolute: true })}
      </b>
    </span>
  );
}

export default function AdminOrderEditModalComplete({
  order,
  merchants,
  isArabic,
  open,
  onClose,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FinancialOpsOrderInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [errorReference, setErrorReference] = useState("");
  const [errorDiagnostic, setErrorDiagnostic] = useState("");
  const personalOrder = Boolean(order && isPersonalAdminOrder(order));

  useEffect(() => {
    if (!open || !order) return;
    setForm(initialForm(order, merchants));
    setBusy(false);
    setMessage("");
    setError("");
    setErrorReference("");
    setErrorDiagnostic("");
  }, [merchants, open, order]);

  const selectedMerchant = useMemo(
    () => merchants.find((merchant) => merchant.id === form?.merchant_id) || null,
    [form?.merchant_id, merchants],
  );
  const deliveryAreas = useMemo(
    () => getAreasForEmirate(form?.delivery_city || "Abu Dhabi"),
    [form?.delivery_city],
  );
  const pickupAreas = useMemo(
    () => getAreasForEmirate(form?.pickup_city || "Abu Dhabi"),
    [form?.pickup_city],
  );

  const financials = useMemo(() => {
    if (!form) return null;
    try {
      if (personalOrder) {
        return calculatePersonalOrderFinancials({
          goodsValue: form.goods_value,
          discountAmount: form.discount_amount,
          deliveryFee: PERSONAL_ORDER_DELIVERY_FEE,
        });
      }
      if (!selectedMerchant) return null;
      return calculateFinancialOpsOrder({ ...form, merchant: selectedMerchant });
    } catch {
      return null;
    }
  }, [form, personalOrder, selectedMerchant]);

  if (!open || !order || !form) return null;

  const currentOrder = order;
  const currentForm = form;
  const normalizedStatus = clean(order.status).toLowerCase().replace(/[\s-]+/g, "_");
  const financialLocked =
    Boolean(order.financial_posted_at) ||
    ["delivered", "completed", "complete"].includes(normalizedStatus);
  const personalFinancialLocked = personalOrder && financialLocked;
  const merchantChanged =
    !personalOrder && clean(selectedMerchant?.id) !== clean(order.merchant_id);
  const activeDeliveryFee = financials?.deliveryFee ?? 0;
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

  function clearFeedback() {
    setMessage("");
    setError("");
    setErrorReference("");
    setErrorDiagnostic("");
  }

  function setField<K extends keyof FinancialOpsOrderInput>(
    key: K,
    value: FinancialOpsOrderInput[K],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    clearFeedback();
  }

  function chooseMerchant(id: string) {
    const merchant = merchants.find((item) => item.id === id) || null;
    setForm((current) =>
      current
        ? {
            ...current,
            merchant,
            merchant_id: merchant?.id || "",
            merchant_name: merchant?.trade_name || "",
            merchant_code: merchant?.merchant_code || "",
            sender_name: merchant?.trade_name || current.sender_name,
            sender_phone: merchant?.phone || current.sender_phone,
            pickup_city: merchant?.emirate || current.pickup_city,
            pickup_area: merchant?.city || current.pickup_area,
            pickup_street:
              merchant?.pickup_address || merchant?.address || current.pickup_street,
          }
        : current,
    );
    clearFeedback();
  }

  function validate() {
    const missing = [
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
    ].filter(Boolean);

    if (missing.length) {
      return isArabic
        ? `الحقول المطلوبة: ${missing.join("، ")}`
        : `Required fields: ${missing.join(", ")}`;
    }
    if (
      !personalOrder &&
      currentForm.price_mode === "manual" &&
      (currentForm.manual_delivery_price === "" ||
        Number(currentForm.manual_delivery_price) < 0)
    ) {
      return isArabic
        ? "أدخل رسوم توصيل يدوية صحيحة. الصفر له قاعدة 25 درهم على حساب التاجر."
        : "Enter a valid manual delivery fee. Explicit zero applies the 25 AED merchant-debit rule.";
    }
    if (!financials) {
      return isArabic
        ? "راجع قيمة البضاعة والتوصيل والخصم وطريقة تحمل الرسوم."
        : "Check goods, delivery, discount, and fee mode.";
    }
    return "";
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validate();
    if (validation) {
      setError(validation);
      setErrorReference("FORM_VALIDATION");
      setErrorDiagnostic("");
      return;
    }

    setBusy(true);
    clearFeedback();
    try {
      const originalPackage = clean(
        currentOrder.package_description || currentOrder.package_type,
      );
      const packageValue =
        clean(currentForm.package_description || currentForm.package_type) ||
        originalPackage;
      const automaticEditReason = isArabic
        ? merchantChanged && financialChanged
          ? "تعديل إداري تلقائي موثّق: تحديث التاجر والقيم المالية"
          : merchantChanged
            ? "تعديل إداري تلقائي موثّق: تحديث التاجر وربط ملكية الطلب"
            : financialChanged
              ? "تعديل إداري تلقائي موثّق: تحديث القيم المالية والتحصيل"
              : "تعديل إداري تلقائي موثّق: تحديث بيانات الطلب"
        : merchantChanged && financialChanged
          ? "Automatic audited admin edit: merchant and financial values updated"
          : merchantChanged
            ? "Automatic audited admin edit: merchant ownership updated"
            : financialChanged
              ? "Automatic audited admin edit: financial and collection values updated"
              : "Automatic audited admin edit: order details updated";
      const saveInput = {
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
        edit_reason: automaticEditReason,
      };
      const result =
        financialLocked && !personalOrder && !sensitiveChange
          ? await saveAdminLockedMerchantCoreEdit(saveInput)
          : await saveAdminOrderEdit(saveInput);

      window.dispatchEvent(
        new CustomEvent("dn-admin-orders-updated", {
          detail: {
            order: result.row,
            source: result.source,
            auditId: result.auditId,
          },
        }),
      );
      await onSaved?.(result.row);

      const auditSuffix = result.auditId
        ? isArabic
          ? ` رقم سجل التدقيق: ${result.auditId}`
          : ` Audit: ${result.auditId}`
        : "";
      const fieldsSuffix = result.changedFields?.length
        ? isArabic
          ? ` الحقول المتغيرة: ${result.changedFields.join("، ")}.`
          : ` Changed fields: ${result.changedFields.join(", ")}.`
        : "";
      setMessage(
        result.financialsLocked
          ? personalOrder
            ? isArabic
              ? `تم تحديث بيانات الطلب الشخصي ${orderReference(result.row)}. ظل الحساب المُرحَّل محميًا، واستخدم صندوق التصحيح المالي المنفصل لتغييره.`
              : `Personal order ${orderReference(result.row)} was updated. Posted financials remain protected and use the separate audited adjustment panel.`
            : isArabic
              ? `تم تحديث بيانات الطلب ${orderReference(result.row)} وحفظها فعليًا. ظل الحساب المُرحَّل بقيمة ${originalFinancials.deliveryFee.toFixed(2)} درهم محميًا دون إعادة ترحيل أو تغيير.`
              : `Order ${orderReference(result.row)} details were saved. Posted financials remained protected without reposting or recalculation.`
          : isArabic
            ? `تم تحديث الطلب ${orderReference(result.row)} بالكامل وحفظه فعليًا. تمت مزامنة التاجر والكشوف والحسابات بأمان.${auditSuffix}${fieldsSuffix}`
            : `Order ${orderReference(result.row)} was completely updated and verified. Merchant ownership, statements, and accounting were synchronized safely.${auditSuffix}${fieldsSuffix}`,
      );
    } catch (cause) {
      const detail = opsErrorDetail(cause);
      console.error("DAY NIGHT complete order save rejected:", detail || cause);
      setError(professionalEditError(detail, isArabic));
      setErrorReference(editErrorReference(detail));
      setErrorDiagnostic(safeEditDiagnostic(detail));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="dn-admin-modal-backdrop !bg-[radial-gradient(circle_at_top,rgba(20,91,139,0.22),rgba(1,7,18,0.88)_46%,rgba(0,3,10,0.96))] !p-2 backdrop-blur-md sm:!p-5"
      role="dialog"
      aria-modal="true"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <form
        className="dn-admin-action-modal relative flex h-[95dvh] max-h-[95dvh] !max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-cyan-200/20 !bg-[linear-gradient(155deg,rgba(7,29,54,0.98),rgba(2,16,34,0.99)_52%,rgba(5,25,47,0.98))] shadow-[0_38px_120px_rgba(0,0,0,0.72),0_0_0_1px_rgba(255,255,255,0.03)] ring-1 ring-white/5"
        onSubmit={save}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -start-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-24 top-1/3 h-80 w-80 rounded-full bg-brand-gold/8 blur-3xl"
        />
        <header className="relative z-20 flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#06182d]/82 px-4 py-3 shadow-[0_14px_36px_rgba(0,0,0,0.22)] backdrop-blur-2xl sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-brand-gold/35 bg-brand-gold/10 text-brand-gold shadow-[0_0_28px_rgba(212,175,55,0.12)]">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-brand-gold/75">
                {isArabic ? "تعديل آمن ومُدقّق" : "Secure audited edit"}
              </span>
              <strong className="mt-1 block truncate text-sm font-black text-white sm:text-base" dir="ltr">
                {orderReference(order)}
              </strong>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy || !financials}
              className="!inline-flex !items-center !gap-2 !rounded-2xl !bg-brand-gold !px-4 !py-3 !text-xs !font-black !text-brand-deep shadow-[0_12px_30px_rgba(212,175,55,0.18)] transition hover:!-translate-y-0.5 disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {busy
                ? isArabic
                  ? "جارٍ الحفظ..."
                  : "Saving..."
                : isArabic
                  ? "حفظ التعديلات"
                  : "Save changes"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={isArabic ? "إغلاق" : "Close"}
              className="!grid !h-11 !w-11 !place-items-center !rounded-2xl !border !border-white/10 !bg-white/5 !p-0 !text-white/70 transition hover:!border-rose-300/30 hover:!bg-rose-400/10 hover:!text-rose-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="relative z-10 min-h-0 flex-1 scroll-smooth overflow-y-auto px-2 pb-5 pt-3 sm:px-5 sm:pt-4">
          {message && (
            <section className="sticky top-0 z-40 mb-4 overflow-hidden rounded-[1.4rem] border border-emerald-300/30 bg-[linear-gradient(135deg,rgba(6,78,59,0.9),rgba(3,35,39,0.96))] p-4 text-emerald-50 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-emerald-200/25 bg-emerald-300/10">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <strong className="block text-sm font-black">
                    {isArabic ? "تم حفظ الطلب بنجاح" : "Order saved successfully"}
                  </strong>
                  <p className="mt-1 text-xs font-bold leading-6 text-emerald-50/85">{message}</p>
                </div>
              </div>
            </section>
          )}
          {error && (
            <section className="sticky top-0 z-40 mb-4 overflow-hidden rounded-[1.4rem] border border-rose-300/35 bg-[linear-gradient(135deg,rgba(88,17,38,0.94),rgba(37,9,25,0.97))] p-4 text-rose-50 shadow-[0_20px_60px_rgba(0,0,0,0.38)] backdrop-blur-xl" data-admin-order-error-card="true">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-rose-200/25 bg-rose-300/10 shadow-[0_0_26px_rgba(251,113,133,0.12)]">
                  <Bug className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm font-black">
                      {isArabic ? "تعذر حفظ تعديلات الطلب" : "Order changes were not saved"}
                    </strong>
                    <code
                      className="rounded-full border border-rose-200/20 bg-black/20 px-3 py-1 text-[10px] font-black tracking-wide text-rose-100"
                      dir="ltr"
                      data-admin-error-reference="true"
                    >
                      {errorReference || "ORDER_SAVE_REJECTED"}
                    </code>
                  </div>
                  <p className="mt-2 text-xs font-bold leading-6 text-rose-50/90">{error}</p>
                </div>
              </div>
              {errorDiagnostic && (
                <details className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <summary className="cursor-pointer text-[11px] font-black text-rose-100/85">
                    {isArabic ? "عرض السبب التشخيصي الدقيق" : "Show exact diagnostic reason"}
                  </summary>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
                    <code
                      className="min-w-0 flex-1 break-all rounded-xl border border-white/10 bg-black/30 p-3 text-[10px] font-bold leading-5 text-white/65"
                      dir="ltr"
                    >
                      {errorDiagnostic}
                    </code>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText(`${errorReference}: ${errorDiagnostic}`)}
                      className="!inline-flex !items-center !justify-center !gap-2 !rounded-xl !border !border-white/10 !bg-white/5 !px-3 !py-2 !text-[10px] !font-black !text-white/75"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {isArabic ? "نسخ التشخيص" : "Copy diagnostic"}
                    </button>
                  </div>
                </details>
              )}
            </section>
          )}

          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
              <small className="text-[10px] font-black text-white/45">
                {isArabic ? "هوية الطلب المحمية" : "Protected order identity"}
              </small>
              <b className="mt-1 block text-sm text-white" dir="ltr">
                {orderReference(order)}
              </b>
              <span className="mt-1 block text-[10px] text-white/40">
                {isArabic
                  ? "لا يمكن تغيير رقم التتبع أو رقم الفاتورة من محرر البيانات."
                  : "Tracking and invoice identifiers are immutable here."}
              </span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
              <small className="text-[10px] font-black text-white/45">
                {isArabic ? "الحالة الحالية" : "Current status"}
              </small>
              <b className="mt-1 block text-sm text-white">
                {orderStatusLabel(order.status, isArabic)}
              </b>
              <span className="mt-1 block text-[10px] text-white/40">
                {isArabic
                  ? "تغيير الحالة أو التراجع عن التسليم له مسار تشغيل منفصل."
                  : "Status changes and delivery reversal use the dedicated workflow."}
              </span>
            </div>
            <div className="rounded-2xl border border-brand-gold/25 bg-brand-gold/[0.06] p-3">
              <small className="text-[10px] font-black text-brand-gold/75">
                {isArabic ? "نطاق الصلاحية" : "Edit authority"}
              </small>
              <b className="mt-1 block text-sm text-brand-gold">
                {personalOrder
                  ? isArabic
                    ? "طلب شخصي"
                    : "Personal order"
                  : isArabic
                    ? "تعديل شامل مع تدقيق"
                    : "Complete audited edit"}
              </b>
              <span className="mt-1 block text-[10px] text-white/50">
                {isArabic
                  ? "تُسجَّل كل عملية بالقيم السابقة واللاحقة واسم المسؤول وسبب التعديل."
                  : "Every save records actor, reason, and before/after values."}
              </span>
            </div>
          </div>

          {financialLocked && !personalOrder && (
            <div className="mb-4 flex gap-3 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-4 text-xs font-bold leading-6 text-cyan-50">
              <ShieldCheck className="h-5 w-5 shrink-0 text-brand-gold" />
              {isArabic
                ? "الطلب مُسلّم أو حسابه مُرحّل، لكن محرر الإدارة المُدقّق يسمح بتعديل التاجر والعميل والعنوان والشحنة والمبالغ. تغيير التاجر يزامن ملكية COD وكشف التاجر والقيود التابعة، ويُسجَّل التعديل المالي بالقيم السابقة واللاحقة ضمن عملية واحدة قابلة للمراجعة."
                : "This order is delivered or financially posted. The audited editor still permits merchant, customer, address, shipment, and financial changes. Merchant ownership dependencies and delivered accounting are synchronized atomically with before/after audit evidence."}
            </div>
          )}

          {merchantChanged && (
            <div className="mb-4 flex gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-xs font-bold leading-6 text-amber-100">
              <Store className="h-5 w-5 shrink-0" />
              {isArabic
                ? `أنت تنقل الطلب من التاجر الحالي إلى ${merchantOptionLabel(selectedMerchant!)}. لن يتم الحفظ إلا بعد التحقق من التاجر الجديد وعدم وجود تعارض في ملكية القيود التابعة.`
                : `You are moving this order to ${merchantOptionLabel(selectedMerchant!)}. Save is allowed only for a canonical portal-linked merchant with no dependent ownership conflict.`}
            </div>
          )}

          {personalFinancialLocked && (
            <div className="mb-4 flex gap-3 rounded-2xl border border-amber-300/35 bg-amber-300/10 p-4 text-xs font-bold leading-6 text-amber-100">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              {isArabic
                ? "الطلب الشخصي مُسلّم وحسابه مُرحّل. بيانات المرسل والعميل والعنوان والشحنة متاحة، أما المبالغ فتُعدَّل من خلال لوحة التصحيح المالي المُدقَّق أدناه."
                : "This personal order is delivered and posted. Sender, customer, address, and package fields remain editable; use the audited financial adjustment panel below for money changes."}
            </div>
          )}

          {personalFinancialLocked && (
            <AdminDeliveredFinancialAdjustment
              order={currentOrder}
              isArabic={isArabic}
              onSaved={onSaved}
            />
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <section className={sectionClass}>
              <h3 className="flex items-center gap-2 font-black text-brand-gold">
                <Store className="h-4 w-4" />
                {isArabic ? "التاجر والمرسل" : "Merchant and sender"}
              </h3>

              <label className={labelClass}>
                <span>
                  {personalOrder
                    ? isArabic
                      ? "نوع الطلب"
                      : "Order type"
                    : isArabic
                      ? "التاجر القانوني *"
                      : "Canonical merchant *"}
                </span>
                <select
                  value={form.merchant_id || ""}
                  onChange={(event) => chooseMerchant(event.target.value)}
                  className={inputClass()}
                  required={!personalOrder}
                  disabled={personalOrder}
                  data-admin-complete-order-merchant="true"
                >
                  <option value="">
                    {personalOrder
                      ? isArabic
                        ? "طلب شخصي بدون تاجر"
                        : "Personal order without merchant"
                      : isArabic
                        ? "اختر التاجر"
                        : "Select merchant"}
                  </option>
                  {merchants.map((merchant) => (
                    <option key={merchant.id} value={merchant.id}>
                      {merchantOptionLabel(merchant)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>
                  <span>
                    {personalOrder
                      ? isArabic
                        ? "اسم المرسل *"
                        : "Sender name *"
                      : isArabic
                        ? "اسم المرسل — يُستكمل تلقائيًا عند الحاجة"
                        : "Sender name — completed automatically when needed"}
                  </span>
                  <input
                    value={form.sender_name || ""}
                    onChange={(event) => setField("sender_name", event.target.value)}
                    className={inputClass()}
                    required={personalOrder}
                  />
                </label>
                <label className={labelClass}>
                  <span>{isArabic ? "هاتف المرسل — اختياري" : "Sender phone — optional"}</span>
                  <input
                    value={form.sender_phone || ""}
                    onChange={(event) => setField("sender_phone", event.target.value)}
                    className={inputClass()}
                    dir="ltr"
                    inputMode="tel"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>
                  <span>{isArabic ? "إمارة الاستلام" : "Pickup emirate"}</span>
                  <select
                    value={form.pickup_city || "Abu Dhabi"}
                    onChange={(event) =>
                      setForm((current) =>
                        current
                          ? {
                              ...current,
                              pickup_city: event.target.value,
                              pickup_area: getDefaultAreaForEmirate(event.target.value),
                            }
                          : current,
                      )
                    }
                    className={inputClass()}
                  >
                    {UAE_LOCATIONS.map((location) => (
                      <option key={location.value} value={location.value}>
                        {isArabic ? location.ar : location.en}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  <span>{isArabic ? "منطقة الاستلام" : "Pickup area"}</span>
                  <select
                    value={form.pickup_area || ""}
                    onChange={(event) => setField("pickup_area", event.target.value)}
                    className={inputClass()}
                  >
                    <option value="">{isArabic ? "اختر المنطقة" : "Select area"}</option>
                    {pickupAreas.map((area) => (
                      <option key={area.value} value={area.value}>
                        {isArabic ? area.ar : area.en}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className={labelClass}>
                <span>{isArabic ? "عنوان الاستلام التفصيلي — اختياري" : "Detailed pickup address — optional"}</span>
                <textarea
                  rows={3}
                  value={form.pickup_street || ""}
                  onChange={(event) => setField("pickup_street", event.target.value)}
                  className={inputClass()}
                  placeholder={isArabic ? "الشارع، المبنى، المعلم" : "Street, building, landmark"}
                />
              </label>
            </section>

            <section className={sectionClass}>
              <h3 className="flex items-center gap-2 font-black text-brand-gold">
                <UserRound className="h-4 w-4" />
                {isArabic ? "العميل ووجهة التسليم" : "Customer and destination"}
              </h3>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>
                  <span>{isArabic ? "اسم العميل *" : "Customer name *"}</span>
                  <input
                    value={form.receiver_name}
                    onChange={(event) => setField("receiver_name", event.target.value)}
                    className={inputClass()}
                    required
                  />
                </label>
                <label className={labelClass}>
                  <span>{isArabic ? "هاتف العميل *" : "Customer phone *"}</span>
                  <input
                    value={form.receiver_phone}
                    onChange={(event) => setField("receiver_phone", event.target.value)}
                    className={inputClass()}
                    required
                    dir="ltr"
                    inputMode="tel"
                  />
                </label>
              </div>

              <label className={labelClass}>
                <span>{isArabic ? "نطاق الشحن" : "Shipping scope"}</span>
                <select
                  value={form.shipping_scope}
                  onChange={(event) =>
                    setField(
                      "shipping_scope",
                      event.target.value as "local" | "international",
                    )
                  }
                  className={inputClass()}
                >
                  <option value="local">
                    {isArabic ? "داخل الإمارات" : "Within UAE"}
                  </option>
                  <option value="international">
                    {isArabic ? "دولي" : "International"}
                  </option>
                </select>
              </label>

              {form.shipping_scope === "local" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={labelClass}>
                    <span>{isArabic ? "إمارة التسليم" : "Delivery emirate"}</span>
                    <select
                      value={form.delivery_city}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? {
                                ...current,
                                delivery_city: event.target.value,
                                delivery_area: getDefaultAreaForEmirate(event.target.value),
                              }
                            : current,
                        )
                      }
                      className={inputClass()}
                    >
                      {UAE_LOCATIONS.map((location) => (
                        <option key={location.value} value={location.value}>
                          {isArabic ? location.ar : location.en}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    <span>{isArabic ? "منطقة التسليم" : "Delivery area"}</span>
                    <select
                      value={form.delivery_area || ""}
                      onChange={(event) => setField("delivery_area", event.target.value)}
                      className={inputClass()}
                    >
                      <option value="">{isArabic ? "اختر المنطقة" : "Select area"}</option>
                      {deliveryAreas.map((area) => (
                        <option key={area.value} value={area.value}>
                          {isArabic ? area.ar : area.en}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : (
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
              )}

              <label className={labelClass}>
                <span>{isArabic ? "عنوان التسليم التفصيلي — اختياري" : "Detailed delivery address — optional"}</span>
                <textarea
                  rows={3}
                  value={form.delivery_street || form.receiver_address}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            delivery_street: event.target.value,
                            receiver_address: event.target.value,
                          }
                        : current,
                    )
                  }
                  className={inputClass()}
                  placeholder={isArabic ? "الشارع، المبنى، الفيلا أو الشقة، المعلم" : "Street, building, villa/apartment, landmark"}
                />
              </label>
            </section>

            <section className={sectionClass}>
              <h3 className="flex items-center gap-2 font-black text-brand-gold">
                <PackageCheck className="h-4 w-4" />
                {isArabic ? "بيانات الشحنة والكوبون" : "Package and coupon"}
              </h3>

              <label className={labelClass}>
                <span>
                  {personalOrder
                    ? isArabic
                      ? "رقم الكوبون *"
                      : "Coupon number *"
                    : isArabic
                      ? "رقم الكوبون *"
                      : "Coupon number *"}
                </span>
                <input
                  value={form.coupon_number || ""}
                  onChange={(event) => setField("coupon_number", event.target.value)}
                  className={inputClass()}
                  required
                  aria-required="true"
                  dir="ltr"
                  data-admin-complete-order-coupon="true"
                />
              </label>

              <label className={labelClass}>
                <span>{isArabic ? "محتوى الشحنة — اختياري" : "Package content — optional"}</span>
                <input
                  value={form.package_type}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            package_type: event.target.value,
                            package_description: event.target.value,
                          }
                        : current,
                    )
                  }
                  className={inputClass()}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>
                  <span>{isArabic ? "عدد القطع / الطلبات" : "Pieces / order count"}</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={form.order_count}
                    onChange={(event) => setField("order_count", Number(event.target.value))}
                    className={inputClass()}
                    dir="ltr"
                  />
                </label>
                <label className={labelClass}>
                  <span>{isArabic ? "الوزن بالكيلو" : "Weight in kg"}</span>
                  <input
                    type="number"
                    min={0.1}
                    step="0.1"
                    value={form.weight ?? 1}
                    onChange={(event) => setField("weight", Number(event.target.value))}
                    className={inputClass()}
                    dir="ltr"
                  />
                </label>
              </div>
            </section>

            <section className={`${sectionClass} border-brand-gold/25 bg-brand-gold/[0.045]`}>
              <h3 className="flex items-center gap-2 font-black text-brand-gold">
                <WalletCards className="h-4 w-4" />
                {isArabic ? "الحسابات والتحصيل" : "Accounting and collection"}
              </h3>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className={labelClass}>
                  <span>{isArabic ? "قيمة البضاعة" : "Goods value"}</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.goods_value}
                    onChange={(event) => setField("goods_value", event.target.value)}
                    className={inputClass()}
                    disabled={personalFinancialLocked}
                    dir="ltr"
                  />
                </label>
                <label className={labelClass}>
                  <span>{isArabic ? "الخصم" : "Discount"}</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.discount_amount ?? 0}
                    onChange={(event) => setField("discount_amount", event.target.value)}
                    className={inputClass()}
                    disabled={personalFinancialLocked}
                    dir="ltr"
                  />
                </label>
                <div className={labelClass}>
                  <span>{isArabic ? "رسوم التوصيل الفعلية" : "Effective delivery fee"}</span>
                  <div
                    className="rounded-xl border border-brand-sky/25 bg-brand-sky/10 px-3 py-3 text-sm font-black text-brand-sky"
                    dir={isArabic ? "rtl" : "ltr"}
                  >
                    {formatAdminMoney(activeDeliveryFee, isArabic)}
                  </div>
                </div>
              </div>

              {!personalOrder && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setForm((current) =>
                          current
                            ? {
                                ...current,
                                price_mode: "system",
                                manual_delivery_price: "",
                              }
                            : current,
                        )
                      }
                      className={`rounded-xl px-3 py-3 text-xs font-black ${
                        form.price_mode !== "manual"
                          ? "bg-brand-gold text-brand-deep"
                          : "border border-white/10 text-white"
                      }`}
                    >
                      {isArabic ? "سعر النظام" : "System price"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setField("price_mode", "manual")}
                      className={`rounded-xl px-3 py-3 text-xs font-black ${
                        form.price_mode === "manual"
                          ? "bg-brand-gold text-brand-deep"
                          : "border border-white/10 text-white"
                      }`}
                    >
                      {isArabic ? "توصيل يدوي" : "Manual delivery"}
                    </button>
                  </div>
                  {form.price_mode === "manual" && (
                    <label className={labelClass}>
                      <span>
                        {isArabic
                          ? "سعر التوصيل اليدوي — الصفر يعني 25 درهم تُخصم من التاجر"
                          : "Manual delivery — zero means a 25 AED merchant debit"}
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.manual_delivery_price ?? ""}
                        onChange={(event) =>
                          setField("manual_delivery_price", event.target.value)
                        }
                        className={inputClass()}
                        dir="ltr"
                      />
                    </label>
                  )}
                </>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={personalFinancialLocked}
                  onClick={() => setField("delivery_fee_mode", "customer_pays")}
                  className={`rounded-xl border p-3 text-xs font-black ${
                    form.delivery_fee_mode === "customer_pays"
                      ? "border-brand-gold/45 bg-brand-gold/12 text-brand-gold"
                      : "border-white/10 text-white/55"
                  } disabled:opacity-40`}
                >
                  {isArabic ? "التوصيل يُضاف على العميل" : "Customer pays delivery"}
                </button>
                <button
                  type="button"
                  disabled={personalFinancialLocked}
                  onClick={() => setField("delivery_fee_mode", "deduct_from_merchant")}
                  className={`rounded-xl border p-3 text-xs font-black ${
                    form.delivery_fee_mode === "deduct_from_merchant"
                      ? "border-brand-gold/45 bg-brand-gold/12 text-brand-gold"
                      : "border-white/10 text-white/55"
                  } disabled:opacity-40`}
                >
                  {isArabic ? "التوصيل يُخصم من التاجر" : "Deduct from merchant"}
                </button>
              </div>

              <label className={labelClass}>
                <span>{isArabic ? "طريقة التحصيل" : "Payment method"}</span>
                <select
                  value={form.payment_method}
                  onChange={(event) => setField("payment_method", event.target.value)}
                  className={inputClass()}
                  disabled={personalFinancialLocked}
                >
                  <option value="cod">
                    {isArabic ? "تحصيل من العميل عند التسليم" : "Collect on delivery"}
                  </option>
                  <option value="receiver_pays">
                    {isArabic ? "مدفوع من المستلم" : "Receiver paid"}
                  </option>
                  {!personalOrder && (
                    <option value="merchant_pays">
                      {isArabic ? "على حساب التاجر" : "Merchant account"}
                    </option>
                  )}
                  <option value="prepaid">
                    {isArabic ? "مدفوع مسبقًا" : "Prepaid"}
                  </option>
                </select>
              </label>

              {financials && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Metric isArabic={isArabic} label={isArabic ? "البضاعة" : "Goods"} value={financials.goodsValue} />
                  <Metric isArabic={isArabic} label={isArabic ? "التوصيل" : "Delivery"} value={financials.deliveryFee} />
                  <Metric isArabic={isArabic} label={isArabic ? "الخصم" : "Discount"} value={financials.discountAmount} />
                  <Metric isArabic={isArabic}
                    label={isArabic ? "المطلوب من العميل" : "Customer total"}
                    value={financials.customerTotal}
                    accent
                  />
                  <Metric isArabic={isArabic}
                    label={
                      financials.merchantDue < 0
                        ? isArabic
                          ? "مستحق على التاجر"
                          : "Due from merchant"
                        : isArabic
                          ? "مستحق للتاجر"
                          : "Due to merchant"
                    }
                    value={financials.merchantDue}
                  />
                  <Metric isArabic={isArabic}
                    label={isArabic ? "دخل داي نايت" : "DAY NIGHT revenue"}
                    value={financials.companyRevenue}
                  />
                </div>
              )}
            </section>
          </div>

          <section className="mt-4 space-y-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.035] p-4">
            <h3 className="flex items-center gap-2 font-black text-brand-gold">
              <FileText className="h-4 w-4" />
              {isArabic ? "الملاحظات والتدقيق" : "Notes and audit"}
            </h3>
            <textarea
              rows={3}
              value={form.notes || ""}
              onChange={(event) => setField("notes", event.target.value)}
              className={inputClass()}
              placeholder={isArabic ? "ملاحظات الطلب — اختياري" : "Order notes — optional"}
            />
            <div
              className="flex items-start gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4 text-xs font-bold leading-6 text-emerald-50/85"
              data-admin-automatic-audit-reason="true"
            >
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-gold" />
              <span>
                {isArabic
                  ? "لا تحتاج إلى كتابة سبب أو تفعيل تأكيد إضافي. ينشئ النظام وصف تدقيق مهنيًا تلقائيًا وفق الحقول التي غيّرتها، ثم يحفظ القيم السابقة واللاحقة واسم المسؤول."
                  : "No manual reason or extra confirmation is required. The system automatically creates a professional audit description from the changed fields and records before/after values with the acting administrator."}
              </span>
            </div>
          </section>
        </div>

        <footer className="relative z-20 shrink-0 border-t border-white/10 bg-[linear-gradient(180deg,rgba(5,22,43,0.92),rgba(3,15,31,0.99))] p-4 shadow-[0_-24px_60px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:px-6">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-[10px] font-bold leading-5 text-white/50">
              <Truck className="h-4 w-4 text-brand-gold" />
              {isArabic
                ? "الحفظ ذري: إما أن تُعتمد جميع التعديلات وسجل التدقيق معًا، أو تُلغى العملية بالكامل دون حفظ جزئي."
                : "Save is atomic: every change and audit succeeds together, or the entire transaction rolls back with no partial edit."}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={onClose} disabled={busy}>
                {isArabic ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={busy || !financials}
                className="!min-w-[220px] !rounded-2xl !bg-brand-gold !px-5 !py-3.5 !font-black !text-brand-deep shadow-[0_14px_34px_rgba(212,175,55,0.2)] transition hover:!-translate-y-0.5 disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {busy
                  ? isArabic
                    ? "جارٍ تحديث الطلب والكشوف..."
                    : "Updating order and ledgers..."
                  : isArabic
                    ? "حفظ واعتماد التعديلات"
                    : "Save and audit changes"}
              </button>
            </div>
          </div>
        </footer>
      </form>
    </div>
  );
}
