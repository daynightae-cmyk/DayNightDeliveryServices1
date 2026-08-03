import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  FileText,
  Loader2,
  PackageCheck,
  Save,
  ShieldCheck,
  Store,
  Truck,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { opsErrorDetail } from "../../lib/adminOperationsData";
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
  "w-full rounded-xl border border-white/10 bg-brand-deep/75 px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-white/30 focus:border-brand-gold/60 focus:ring-2 focus:ring-brand-gold/10 disabled:cursor-not-allowed disabled:opacity-45";
const labelClass = "block space-y-1 text-xs font-black text-white/65";
const sectionClass =
  "space-y-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4";

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
    ? "تعذر حفظ التعديلات لأن قاعدة البيانات رفضت العملية. تم إلغاء العملية بالكامل دون حفظ جزئي. حدّث الصفحة ثم أعد المحاولة."
    : "The database rejected the update. The entire transaction was rolled back with no partial save. Refresh and try again.";
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
  accent = false,
}: {
  label: string;
  value: number;
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
      <b className="mt-1 block text-sm" dir="ltr">
        {Math.abs(value).toFixed(2)} AED
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
  const [editReason, setEditReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const personalOrder = Boolean(order && isPersonalAdminOrder(order));

  useEffect(() => {
    if (!open || !order) return;
    setForm(initialForm(order, merchants));
    setEditReason("");
    setConfirmed(false);
    setBusy(false);
    setMessage("");
    setError("");
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
    if (sensitiveChange && clean(editReason).length < 6) {
      return isArabic
        ? "اكتب سببًا واضحًا للتعديل المالي أو نقل الطلب، على ألا يقل عن 6 أحرف."
        : "Enter a clear reason of at least 6 characters for the financial or merchant change.";
    }
    if (sensitiveChange && !confirmed) {
      return isArabic
        ? "أكد مراجعة أثر التعديل على التاجر والعميل والحسابات."
        : "Confirm that you reviewed the merchant, customer, and accounting impact.";
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
      setConfirmed(false);
    } catch (cause) {
      const detail = opsErrorDetail(cause);
      console.error("DAY NIGHT complete order save rejected:", detail || cause);
      setError(professionalEditError(detail, isArabic));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="dn-admin-modal-backdrop"
      role="dialog"
      aria-modal="true"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <form
        className="dn-admin-action-modal flex h-[96dvh] max-h-[96dvh] !max-w-7xl flex-col overflow-hidden"
        onSubmit={save}
      >
        <header className="shrink-0">
          <div>
            <span>
              {isArabic
                ? "محرر الطلب الكامل المُدقّق"
                : "Audited complete order editor"}
            </span>
            <strong>{orderReference(order)}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy || !financials}
              className="!inline-flex !items-center !gap-2 !bg-brand-gold !text-brand-deep disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {busy
                ? isArabic
                  ? "جارٍ الحفظ الذري..."
                  : "Saving atomically..."
                : isArabic
                  ? "حفظ كل التعديلات"
                  : "Save all changes"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={isArabic ? "إغلاق" : "Close"}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-4 pt-2 sm:px-2">
          {message && (
            <p className="dn-admin-modal-message sticky top-0 z-30">
              <CheckCircle2 className="h-4 w-4" />
              {message}
            </p>
          )}
          {error && (
            <p className="dn-admin-modal-message sticky top-0 z-30 border-rose-400/30 bg-rose-400/10 text-rose-100">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </p>
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
                    dir="ltr"
                  >
                    {activeDeliveryFee.toFixed(2)} AED
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
                  <Metric label={isArabic ? "البضاعة" : "Goods"} value={financials.goodsValue} />
                  <Metric label={isArabic ? "التوصيل" : "Delivery"} value={financials.deliveryFee} />
                  <Metric label={isArabic ? "الخصم" : "Discount"} value={financials.discountAmount} />
                  <Metric
                    label={isArabic ? "المطلوب من العميل" : "Customer total"}
                    value={financials.customerTotal}
                    accent
                  />
                  <Metric
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
                  <Metric
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
            <label className={labelClass}>
              <span>
                {sensitiveChange
                  ? isArabic
                    ? "سبب التعديل — إجباري للتعديلات المالية أو نقل الطلب"
                    : "Edit reason — required for financial or merchant changes"
                  : isArabic
                    ? "سبب التعديل — اختياري، ويُضاف وصف مهني تلقائيًا عند تركه فارغًا"
                    : "Edit reason — optional; a professional audit note is added automatically"}
              </span>
              <textarea
                rows={3}
                minLength={sensitiveChange ? 6 : undefined}
                maxLength={600}
                value={editReason}
                onChange={(event) => {
                  setEditReason(event.target.value);
                  clearFeedback();
                }}
                className={inputClass()}
                placeholder={
                  isArabic
                    ? "مثال: نقل الطلب للتاجر الصحيح بعد مراجعة الكود، وتصحيح عنوان العميل وقيمة التوصيل."
                    : "Example: Moved the order to the verified merchant and corrected customer address and delivery fee."
                }
                required={sensitiveChange}
                data-admin-complete-order-reason="true"
              />
            </label>
            {sensitiveChange && (
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
          </section>
        </div>

        <footer className="sticky bottom-0 z-20 shrink-0 border-t border-white/10 bg-[#06172c]/98 p-4 shadow-[0_-18px_35px_rgba(0,0,0,0.35)] backdrop-blur-xl">
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
                className="!min-w-[220px] !bg-brand-gold !text-brand-deep disabled:opacity-40"
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
