import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  LockKeyhole,
  Loader2,
  Pencil,
  Save,
  WalletCards,
  X,
} from "lucide-react";
import { calculateOpsOrderPrice, opsErrorDetail } from "../../lib/adminOperationsData";
import { saveAdminOrderEdit } from "../../lib/adminOrderEditPersistence";
import type { FinancialOpsOrderInput } from "../../lib/orderFinancialOperations";
import {
  calculateOrderFinancials,
  financialsFromOrder,
  orderFinancialValidation,
} from "../../lib/orderFinancials";
import {
  UAE_LOCATIONS,
  getAreasForEmirate,
  getDefaultAreaForEmirate,
} from "../../data/uaeLocations";
import type { Merchant, Order } from "../../types";

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
  "w-full rounded-xl border border-white/10 bg-brand-deep/75 px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-white/30 focus:border-brand-gold/60 disabled:cursor-not-allowed disabled:opacity-50";
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
  if (owner && store) return `${owner} — ${store}${code ? ` — ${code}` : ""}`;
  return owner || store || code || merchant.id;
}

function initialForm(order: Order, merchants: Merchant[]): FinancialOpsOrderInput {
  const merchant = merchants.find((item) => item.id === order.merchant_id) || null;
  const currentPrice = Number(order.delivery_fee || order.delivery_price || order.price || 0);
  const manual = order.price_source === "manual" || Number(order.manual_delivery_price || 0) > 0;
  const packageValue = clean(order.package_description || order.package_type);
  const finance = financialsFromOrder(order as Order & Record<string, unknown>);

  return {
    merchant,
    merchant_id: order.merchant_id || "",
    merchant_name: order.merchant_name || merchant?.trade_name || order.sender_name || "",
    merchant_code: order.merchant_code || merchant?.merchant_code || "",
    coupon_number: order.coupon_number || "",
    shipping_scope: order.shipping_scope === "international" ? "international" : "local",
    order_count: Math.max(1, Number(order.order_count || order.pieces || 1)),
    pickup_city: order.sender_city || merchant?.emirate || "Abu Dhabi",
    pickup_area: merchant?.city || "",
    pickup_street: order.sender_address || merchant?.pickup_address || merchant?.address || "",
    delivery_city: order.receiver_city || "Abu Dhabi",
    delivery_area: "",
    delivery_street: order.receiver_address || "",
    destination_country: order.destination_country || "SA",
    receiver_name: order.receiver_name || order.customer_name || "",
    receiver_phone: order.receiver_phone || order.customer_phone || "",
    receiver_address: order.receiver_address || "",
    package_type: packageValue,
    package_description: packageValue,
    weight: Math.max(0.1, Number(order.weight || 1)),
    payment_method: order.payment_method === "sender_pays" ? "merchant_pays" : order.payment_method || "cod",
    cod_amount: numberOrBlank(order.cod_amount),
    notes: order.notes || "",
    status: order.status || "pending",
    price_mode: manual ? "manual" : "system",
    manual_delivery_price: manual ? currentPrice : "",
    goods_value: finance.goodsValue,
    discount_amount: finance.discountAmount,
    delivery_fee_mode: finance.deliveryFeeMode,
  };
}

function Metric({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <span
      className={`rounded-xl border p-2 text-center text-[10px] font-bold ${
        accent
          ? "border-brand-gold/40 bg-brand-gold/10 text-brand-gold"
          : "border-white/10 text-white/70"
      }`}
    >
      {label}
      <b className="mt-1 block text-sm" dir="ltr">{value.toFixed(2)} AED</b>
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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !order) return;
    setForm(initialForm(order, merchants));
    setEditReason("");
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
  const pricing = useMemo(
    () => (form ? calculateOpsOrderPrice({ ...form, merchant: selectedMerchant }) : null),
    [form, selectedMerchant],
  );
  const financials = useMemo(() => {
    if (!form || !pricing) return null;
    try {
      return calculateOrderFinancials({
        goodsValue: form.goods_value,
        deliveryFee: pricing.total,
        discountAmount: form.discount_amount,
        deliveryFeeMode: form.delivery_fee_mode,
      });
    } catch {
      return null;
    }
  }, [form, pricing]);

  if (!open || !order || !form) return null;
  const currentOrder = order;
  const currentForm = form;
  const normalizedStatus = clean(order.status).toLowerCase().replace(/[\s-]+/g, "_");
  const financialLocked =
    Boolean(order.financial_posted_at) || ["delivered", "completed", "complete"].includes(normalizedStatus);

  function setField<K extends keyof FinancialOpsOrderInput>(key: K, value: FinancialOpsOrderInput[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setMessage("");
    setError("");
  }

  function chooseMerchant(id: string) {
    const merchant = merchants.find((item) => item.id === id) || null;
    setForm((current) =>
      current
        ? {
            ...current,
            merchant,
            merchant_id: merchant?.id || "",
            merchant_name: merchant?.trade_name || current.merchant_name,
            merchant_code: merchant?.merchant_code || "",
            pickup_city: merchant?.emirate || current.pickup_city,
            pickup_area: merchant?.city || current.pickup_area,
            pickup_street:
              merchant?.pickup_address || merchant?.address || current.pickup_street,
          }
        : current,
    );
  }

  function validate() {
    const missing = [
      !selectedMerchant ? (isArabic ? "التاجر" : "merchant") : "",
      !clean(currentForm.coupon_number) ? (isArabic ? "رقم الكوبون" : "coupon number") : "",
      !clean(currentForm.receiver_name) ? (isArabic ? "اسم العميل" : "customer name") : "",
      !clean(currentForm.receiver_phone) ? (isArabic ? "هاتف العميل" : "customer phone") : "",
      currentForm.goods_value === "" ? (isArabic ? "قيمة البضاعة" : "goods value") : "",
    ].filter(Boolean);
    if (missing.length) {
      return isArabic
        ? `الحقول المطلوبة: ${missing.join("، ")}`
        : `Required fields: ${missing.join(", ")}`;
    }
    if (
      currentForm.price_mode === "manual" &&
      (currentForm.manual_delivery_price === "" || Number(currentForm.manual_delivery_price) < 0)
    ) {
      return isArabic ? "أدخل رسوم توصيل يدوية صحيحة." : "Enter a valid manual delivery fee.";
    }
    const financeError = orderFinancialValidation({
      goodsValue: currentForm.goods_value,
      deliveryFee: pricing?.total,
      discountAmount: currentForm.discount_amount,
      deliveryFeeMode: currentForm.delivery_fee_mode,
    });
    if (financeError) {
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
    setMessage("");
    setError("");
    try {
      const originalPackage = clean(
        currentOrder.package_description || currentOrder.package_type,
      );
      const packageValue =
        clean(currentForm.package_description || currentForm.package_type) || originalPackage;
      const result = await saveAdminOrderEdit({
        ...currentForm,
        coupon_number: clean(currentForm.coupon_number),
        merchant: selectedMerchant,
        receiver_address: clean(currentForm.receiver_address),
        delivery_street: clean(currentForm.delivery_street),
        package_type: packageValue,
        package_description: packageValue,
        order: currentOrder,
        edit_reason:
          clean(editReason) ||
          (isArabic ? "تعديل بيانات الطلب والحساب" : "Updated order and financial breakdown"),
      });

      setMessage(
        result.financialsLocked
          ? isArabic
            ? `تم تحديث بيانات الطلب ${orderReference(result.row)}. بقيت القيم المالية المقفلة كما هي لحماية كشف التاجر.`
            : `Order ${orderReference(result.row)} details were updated. Locked financial values were preserved.`
          : isArabic
            ? `تم تحديث الطلب ${orderReference(result.row)} وحفظ البيانات فعليًا في قاعدة البيانات.`
            : `Order ${orderReference(result.row)} was updated and verified in the database.`,
      );
      window.dispatchEvent(
        new CustomEvent("dn-admin-orders-updated", {
          detail: { order: result.row, source: result.source },
        }),
      );
      await onSaved?.(result.row);
    } catch (cause) {
      const detail = opsErrorDetail(cause);
      setError(
        isArabic
          ? `تعذر تحديث الطلب.${detail ? ` السبب: ${detail}` : ""}`
          : `Could not update order.${detail ? ` Reason: ${detail}` : ""}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dn-admin-modal-backdrop" role="dialog" aria-modal="true" dir={isArabic ? "rtl" : "ltr"}>
      <form
        className="dn-admin-action-modal flex max-h-[94vh] !max-w-6xl flex-col overflow-hidden"
        onSubmit={save}
      >
        <header className="shrink-0">
          <div>
            <span>{isArabic ? "تعديل بيانات الطلب والحساب" : "Edit order and financials"}</span>
            <strong>{orderReference(order)}</strong>
          </div>
          <button type="button" onClick={onClose} aria-label={isArabic ? "إغلاق" : "Close"}>
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-4 pt-2 sm:px-2">
          {message && (
            <p className="dn-admin-modal-message sticky top-0 z-10">
              <CheckCircle2 className="h-4 w-4" />{message}
            </p>
          )}
          {error && (
            <p className="dn-admin-modal-message sticky top-0 z-10 border-rose-400/30 bg-rose-400/10 text-rose-100">
              <AlertTriangle className="h-4 w-4" />{error}
            </p>
          )}
          {financialLocked && (
            <div className="mb-4 flex gap-3 rounded-2xl border border-amber-300/35 bg-amber-300/10 p-4 text-xs font-bold leading-6 text-amber-100">
              <LockKeyhole className="h-5 w-5 shrink-0" />
              {isArabic
                ? "الطلب مُسلّم وحسابه مُرحّل. يمكنك تحديث اسم العميل والهاتف والعنوان والشحنة والملاحظات، لكن القيم المالية تظل مقفلة لحماية كشف التاجر وحساب الشركة."
                : "This order is delivered and financially posted. Customer, address, package, and notes remain editable, while financial values stay locked to protect the merchant statement."}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <h3 className="flex items-center gap-2 font-black text-brand-gold">
                <Pencil className="h-4 w-4" />
                {isArabic ? "بيانات الطلب الأساسية" : "Core order details"}
              </h3>
              <label className="block space-y-1 text-xs font-black text-white/65">
                <span>{isArabic ? "التاجر *" : "Merchant *"}</span>
                <select
                  value={form.merchant_id || ""}
                  onChange={(event) => chooseMerchant(event.target.value)}
                  className={inputClass()}
                  required
                  disabled={financialLocked}
                >
                  <option value="">{isArabic ? "اختر التاجر" : "Select merchant"}</option>
                  {merchants.map((merchant) => (
                    <option key={merchant.id} value={merchant.id}>
                      {merchantOptionLabel(merchant)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-xs font-black text-white/65">
                <span>{isArabic ? "رقم الكوبون *" : "Coupon number *"}</span>
                <input
                  value={form.coupon_number || ""}
                  onChange={(event) => setField("coupon_number", event.target.value)}
                  className={inputClass()}
                  required
                  dir="ltr"
                  disabled={financialLocked}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-xs font-black text-white/65">
                  <span>{isArabic ? "اسم العميل *" : "Customer name *"}</span>
                  <input
                    value={form.receiver_name}
                    onChange={(event) => setField("receiver_name", event.target.value)}
                    className={inputClass()}
                    required
                  />
                </label>
                <label className="block space-y-1 text-xs font-black text-white/65">
                  <span>{isArabic ? "هاتف العميل *" : "Customer phone *"}</span>
                  <input
                    value={form.receiver_phone}
                    onChange={(event) => setField("receiver_phone", event.target.value)}
                    className={inputClass()}
                    required
                    dir="ltr"
                  />
                </label>
              </div>
              <select
                value={form.shipping_scope}
                onChange={(event) =>
                  setField("shipping_scope", event.target.value as "local" | "international")
                }
                className={inputClass()}
                disabled={financialLocked}
              >
                <option value="local">{isArabic ? "داخل الإمارات" : "Within UAE"}</option>
                <option value="international">{isArabic ? "دولي" : "International"}</option>
              </select>
              {form.shipping_scope === "local" ? (
                <div className="grid gap-3 sm:grid-cols-2">
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
                    disabled={financialLocked}
                  >
                    {UAE_LOCATIONS.map((location) => (
                      <option key={location.value} value={location.value}>
                        {isArabic ? location.ar : location.en}
                      </option>
                    ))}
                  </select>
                  <select
                    value={form.delivery_area || ""}
                    onChange={(event) => setField("delivery_area", event.target.value)}
                    className={inputClass()}
                    disabled={financialLocked}
                  >
                    {deliveryAreas.map((area) => (
                      <option key={area.value} value={area.value}>
                        {isArabic ? area.ar : area.en}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <input
                  value={form.destination_country || ""}
                  onChange={(event) => setField("destination_country", event.target.value)}
                  className={inputClass()}
                  placeholder={isArabic ? "الدولة" : "Destination country"}
                  disabled={financialLocked}
                />
              )}
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
                placeholder={isArabic ? "العنوان التفصيلي" : "Detailed address"}
              />
            </section>

            <section className="space-y-3 rounded-2xl border border-brand-gold/25 bg-brand-gold/[0.045] p-4">
              <h3 className="flex items-center gap-2 font-black text-brand-gold">
                <WalletCards className="h-4 w-4" />
                {isArabic ? "الفصل المالي" : "Financial separation"}
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1 text-xs font-black text-white/65">
                  <span>{isArabic ? "قيمة البضاعة" : "Goods value"}</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.goods_value}
                    onChange={(event) => setField("goods_value", event.target.value)}
                    className={inputClass()}
                    disabled={financialLocked}
                  />
                </label>
                <label className="space-y-1 text-xs font-black text-white/65">
                  <span>{isArabic ? "الخصم" : "Discount"}</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.discount_amount ?? 0}
                    onChange={(event) => setField("discount_amount", event.target.value)}
                    className={inputClass()}
                    disabled={financialLocked}
                  />
                </label>
                <label className="space-y-1 text-xs font-black text-white/65">
                  <span>{isArabic ? "التوصيل" : "Delivery"}</span>
                  <div
                    className="rounded-xl border border-brand-sky/25 bg-brand-sky/8 px-3 py-3 text-sm font-black text-brand-sky"
                    dir="ltr"
                  >
                    {pricing?.total.toFixed(2)} AED
                  </div>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={financialLocked}
                  onClick={() => {
                    setField("price_mode", "system");
                    setField("manual_delivery_price", "");
                  }}
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
                  disabled={financialLocked}
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
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.manual_delivery_price ?? ""}
                  onChange={(event) => setField("manual_delivery_price", event.target.value)}
                  className={inputClass()}
                  disabled={financialLocked}
                />
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={financialLocked}
                  onClick={() => setField("delivery_fee_mode", "customer_pays")}
                  className={`rounded-xl border p-3 text-xs font-black ${
                    form.delivery_fee_mode === "customer_pays"
                      ? "border-brand-gold/45 bg-brand-gold/12 text-brand-gold"
                      : "border-white/10 text-white/55"
                  }`}
                >
                  {isArabic ? "التوصيل يُضاف على العميل" : "Customer pays delivery"}
                </button>
                <button
                  type="button"
                  disabled={financialLocked}
                  onClick={() => setField("delivery_fee_mode", "deduct_from_merchant")}
                  className={`rounded-xl border p-3 text-xs font-black ${
                    form.delivery_fee_mode === "deduct_from_merchant"
                      ? "border-brand-gold/45 bg-brand-gold/12 text-brand-gold"
                      : "border-white/10 text-white/55"
                  }`}
                >
                  {isArabic ? "التوصيل يُخصم من التاجر" : "Deduct from merchant"}
                </button>
              </div>
              {financials && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Metric label={isArabic ? "البضاعة" : "Goods"} value={financials.goodsValue} />
                  <Metric label={isArabic ? "التوصيل" : "Delivery"} value={financials.deliveryFee} />
                  <Metric label={isArabic ? "الخصم" : "Discount"} value={financials.discountAmount} />
                  <Metric label={isArabic ? "المطلوب من العميل" : "Customer total"} value={financials.customerTotal} accent />
                  <Metric label={financials.merchantDue < 0 ? (isArabic ? "مستحق على التاجر" : "Due from merchant") : (isArabic ? "مستحق للتاجر" : "Due to merchant")} value={Math.abs(financials.merchantDue)} />
                  <Metric label={isArabic ? "دخل داي نايت" : "DAY NIGHT revenue"} value={financials.companyRevenue} />
                </div>
              )}
              <select
                value={form.payment_method}
                onChange={(event) => setField("payment_method", event.target.value)}
                className={inputClass()}
                disabled={financialLocked}
              >
                <option value="cod">{isArabic ? "تحصيل من العميل عند التسليم" : "Collect on delivery"}</option>
                <option value="receiver_pays">{isArabic ? "مدفوع من المستلم" : "Receiver paid"}</option>
                <option value="merchant_pays">{isArabic ? "على حساب التاجر" : "Merchant account"}</option>
              </select>
            </section>
          </div>

          <section className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <h3 className="flex items-center gap-2 font-black text-brand-gold">
              <Calculator className="h-4 w-4" />
              {isArabic ? "تفاصيل التعديل" : "Edit details"}
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={form.package_type}
                onChange={(event) => {
                  setField("package_type", event.target.value);
                  setField("package_description", event.target.value);
                }}
                className={inputClass()}
                placeholder={isArabic ? "محتوى الشحنة" : "Package content"}
              />
              <input
                value={editReason}
                onChange={(event) => setEditReason(event.target.value)}
                className={inputClass()}
                placeholder={isArabic ? "سبب التعديل" : "Edit reason"}
              />
            </div>
            <textarea
              rows={3}
              value={form.notes || ""}
              onChange={(event) => setField("notes", event.target.value)}
              className={inputClass()}
              placeholder={isArabic ? "ملاحظات" : "Notes"}
            />
          </section>
        </div>

        <footer className="sticky bottom-0 z-20 shrink-0 border-t border-white/10 bg-[#06172c]/98 p-4 shadow-[0_-18px_35px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] font-bold leading-5 text-white/45">
              {isArabic
                ? "زر التحديث يحفظ في قاعدة البيانات، يتحقق من الصف المُعاد، ثم يُحدّث قائمة الطلبات تلقائيًا."
                : "Update saves to the database, verifies the returned row, and refreshes the order list automatically."}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={onClose} disabled={busy}>
                {isArabic ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={busy || !financials}
                className="!min-w-[190px] !bg-brand-gold !text-brand-deep disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {busy
                  ? isArabic
                    ? "جارٍ تحديث الطلب..."
                    : "Updating order..."
                  : isArabic
                    ? "تحديث الطلب الآن"
                    : "Update order now"}
              </button>
            </div>
          </div>
        </footer>
      </form>
    </div>
  );
}
