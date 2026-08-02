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
import { saveAdminOrderEdit } from "../../lib/adminOrderEditPersistence";
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
    destination_country: order.destination_country || "SA",
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
    price_mode: personal ? "system" : manual ? "manual" : "system",
    manual_delivery_price: personal
      ? ""
      : manual
        ? numberOrBlank(order.manual_delivery_price ?? currentPrice)
        : "",
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
      !personalOrder && !clean(currentForm.coupon_number)
        ? isArabic
          ? "رقم الكوبون"
          : "coupon number"
        : "",
      !clean(currentForm.sender_name) ? (isArabic ? "اسم المرسل" : "sender name") : "",
      !clean(currentForm.sender_phone) ? (isArabic ? "هاتف المرسل" : "sender phone") : "",
      !clean(currentForm.receiver_name) ? (isArabic ? "اسم العميل" : "customer name") : "",
      !clean(currentForm.receiver_phone) ? (isArabic ? "هاتف العميل" : "customer phone") : "",
      !clean(currentForm.package_type) ? (isArabic ? "محتوى الشحنة" : "package content") : "",
      currentForm.goods_value === "" ? (isArabic ? "قيمة البضاعة" : "goods value") : "",
    ].filter(Boolean);

    if (missing.length) {
      return isArabic
        ? `الحقول المطلوبة: ${missing.join("، ")}`
        : `Required fields: ${missing.join(", ")}`;
    }
    if (clean(editReason).length < 6) {
      return isArabic
        ? "اكتب سبب واضح للتعديل لا يقل عن 6 أحرف؛ السبب بيتسجل في سجل التدقيق."
        : "Enter a clear edit reason of at least 6 characters; it is stored in the audit log.";
    }
    if (!confirmed) {
      return isArabic
        ? "أكد إنك راجعت تأثير التعديل على التاجر والعميل والحسابات."
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
      const result = await saveAdminOrderEdit({
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
        edit_reason: clean(editReason),
      });

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
          ? isArabic
            ? `تم تحديث بيانات الطلب الشخصي ${orderReference(result.row)}. الحساب المُرحّل اتساب محمي، واستخدم صندوق التصحيح المالي المنفصل لتغييره.`
            : `Personal order ${orderReference(result.row)} was updated. Posted financials remain protected and use the separate audited adjustment panel.`
          : isArabic
            ? `تم تحديث الطلب ${orderReference(result.row)} بالكامل وحفظه فعليًا. التاجر والكشوف والحسابات اتزامنوا بأمان.${auditSuffix}${fieldsSuffix}`
            : `Order ${orderReference(result.row)} was completely updated and verified. Merchant ownership, statements, and accounting were synchronized safely.${auditSuffix}${fieldsSuffix}`,
      );
      setConfirmed(false);
    } catch (cause) {
      const detail = opsErrorDetail(cause);
      setError(
        isArabic
          ? `تعذر تحديث الطلب. العملية اتلغت بالكامل ومفيش تعديل جزئي.${detail ? ` السبب: ${detail}` : ""}`
          : `The order update failed. The transaction was fully rolled back with no partial edit.${detail ? ` Reason: ${detail}` : ""}`,
      );
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
                  ? "رقم التتبع والفاتورة لا بيتغيروش من محرر البيانات."
                  : "Tracking and invoice identifiers are immutable here."}
              </span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
              <small className="text-[10px] font-black text-white/45">
                {isArabic ? "الحالة الحالية" : "Current status"}
              </small>
              <b className="mt-1 block text-sm text-white">{order.status || "—"}</b>
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
                  ? "كل عملية بتتسجل قبل/بعد باسم المدير وسبب التعديل."
                  : "Every save records actor, reason, and before/after values."}
              </span>
            </div>
          </div>

          {financialLocked && !personalOrder && (
            <div className="mb-4 flex gap-3 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-4 text-xs font-bold leading-6 text-cyan-50">
              <ShieldCheck className="h-5 w-5 shrink-0 text-brand-gold" />
              {isArabic
                ? "الطلب مُسلّم أو حسابه مُرحّل، لكن محرر الإدارة المُدقّق يسمح بتعديل التاجر والعميل والعنوان والشحنة والمبالغ. تغيير التاجر يزامن ملكية COD وكشف التاجر والقيود التابعة، والتعديل المالي بيتسجل قبل/بعد في عملية واحدة قابلة للمراجعة."
                : "This order is delivered or financially posted. The audited editor still permits merchant, customer, address, shipment, and financial changes. Merchant ownership dependencies and delivered accounting are synchronized atomically with before/after audit evidence."}
            </div>
          )}

          {merchantChanged && (
            <div className="mb-4 flex gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-xs font-bold leading-6 text-amber-100">
              <Store className="h-5 w-5 shrink-0" />
              {isArabic
                ? `أنت بتنقل الطلب من التاجر الحالي إلى ${merchantOptionLabel(selectedMerchant!)}. الحفظ مش هيتم إلا لو التاجر الجديد مرتبط ببوابة قانونية ومفيش تعارض ملكية في القيود التابعة.`
                : `You are moving this order to ${merchantOptionLabel(selectedMerchant!)}. Save is allowed only for a canonical portal-linked merchant with no dependent ownership conflict.`}
            </div>
          )}

          {personalFinancialLocked && (
            <div className="mb-4 flex gap-3 rounded-2xl border border-amber-300/35 bg-amber-300/10 p-4 text-xs font-bold leading-6 text-amber-100">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              {isArabic
                ? "الطلب الشخصي مُسلّم وحسابه مُرحّل. بيانات المرسل والعميل والعنوان والشحنة متاحة، أما المبالغ فتتعدل من صندوق التصحيح المالي المُدقّق الموجود تحت الرسالة دي."
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
                  <span>{isArabic ? "اسم المرسل *" : "Sender name *"}</span>
                  <input
                    value={form.sender_name || ""}
                    onChange={(event) => setField("sender_name", event.target.value)}
                    className={inputClass()}
                    required
                  />
                </label>
                <label className={labelClass}>
                  <span>{isArabic ? "هاتف المرسل *" : "Sender phone *"}</span>
                  <input
                    value={form.sender_phone || ""}
                    onChange={(event) => setField("sender_phone", event.target.value)}
                    className={inputClass()}
                    required
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
                <span>{isArabic ? "عنوان الاستلام" : "Pickup address"}</span>
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
                  <input
                    value={form.destination_country || ""}
                    onChange={(event) => setField("destination_country", event.target.value)}
                    className={inputClass()}
                    placeholder={isArabic ? "الدولة" : "Country"}
                  />
                </label>
              )}

              <label className={labelClass}>
                <span>{isArabic ? "العنوان التفصيلي" : "Detailed address"}</span>
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
                      ? "رقم الكوبون — اختياري"
                      : "Coupon number — optional"
                    : isArabic
                      ? "رقم الكوبون *"
                      : "Coupon number *"}
                </span>
                <input
                  value={form.coupon_number || ""}
                  onChange={(event) => setField("coupon_number", event.target.value)}
                  className={inputClass()}
                  required={!personalOrder}
                  dir="ltr"
                  data-admin-complete-order-coupon="true"
                />
              </label>

              <label className={labelClass}>
                <span>{isArabic ? "محتوى الشحنة *" : "Package content *"}</span>
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
                  required
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
              placeholder={isArabic ? "ملاحظات الطلب" : "Order notes"}
            />
            <label className={labelClass}>
              <span>
                {isArabic
                  ? "سبب التعديل — إجباري وبيتسجل باسم المدير"
                  : "Edit reason — required and attributed to the admin"}
              </span>
              <textarea
                rows={3}
                minLength={6}
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
                required
                data-admin-complete-order-reason="true"
              />
            </label>
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
                  ? "أؤكد إني راجعت التاجر الجديد، بيانات العميل، الكوبون، العنوان، الشحنة، وطريقة الحساب. فاهم إن النظام هيزامن الملكية والكشوف والقيود المالية ويسجل القيم قبل وبعد."
                  : "I confirm that I reviewed the merchant, customer, coupon, address, package, and accounting. The system will synchronize ownership dependencies and record before/after values."}
              </span>
            </label>
          </section>
        </div>

        <footer className="sticky bottom-0 z-20 shrink-0 border-t border-white/10 bg-[#06172c]/98 p-4 shadow-[0_-18px_35px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-[10px] font-bold leading-5 text-white/50">
              <Truck className="h-4 w-4 text-brand-gold" />
              {isArabic
                ? "الحفظ ذري: يا كل التعديلات تنجح وتتراجع من قاعدة البيانات، يا العملية كلها تتلغي من غير حفظ جزئي."
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
