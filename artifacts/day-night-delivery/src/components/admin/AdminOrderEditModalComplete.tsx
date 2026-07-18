import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, Calculator, CheckCircle2, Loader2, Pencil, Save, X } from "lucide-react";
import {
  calculateMerchantStatementNet,
  calculateOpsOrderPrice,
  opsErrorDetail,
  updateOpsOrder,
  type OpsOrderInput,
} from "../../lib/adminOperationsData";
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

type ExtendedOrder = Order & {
  price_source?: string | null;
  manual_delivery_price?: number | string | null;
  pickup_city?: string | null;
  pickup_area?: string | null;
  delivery_city?: string | null;
  delivery_area?: string | null;
};

const clean = (value: unknown) => String(value ?? "").trim();
const inputClass = () =>
  "w-full rounded-xl border border-white/10 bg-brand-deep/75 px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-white/30 focus:border-brand-gold/60";
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

function initialForm(order: Order, merchants: Merchant[]): OpsOrderInput {
  const row = order as ExtendedOrder;
  const merchant = merchants.find((item) => item.id === order.merchant_id) || null;
  const currentPrice = Number(order.delivery_price || order.price || 0);
  const manual = row.price_source === "manual" || Number(row.manual_delivery_price || 0) > 0;
  const packageValue = clean(order.package_description || order.package_type);

  return {
    merchant,
    merchant_id: order.merchant_id || "",
    merchant_name: order.merchant_name || merchant?.trade_name || order.sender_name || "",
    merchant_code: order.merchant_code || merchant?.merchant_code || "",
    coupon_number: order.coupon_number || "",
    shipping_scope: order.shipping_scope === "international" ? "international" : "local",
    order_count: Math.max(1, Number(order.order_count || order.pieces || 1)),
    pickup_city: order.sender_city || clean(row.pickup_city) || merchant?.emirate || "Abu Dhabi",
    pickup_area: clean(row.pickup_area || merchant?.city),
    pickup_street: order.sender_address || merchant?.pickup_address || merchant?.address || "",
    delivery_city: order.receiver_city || clean(row.delivery_city) || "Abu Dhabi",
    delivery_area: clean(row.delivery_area),
    delivery_street: order.receiver_address || "",
    destination_country: order.destination_country || "SA",
    receiver_name: order.receiver_name || order.customer_name || "",
    receiver_phone: order.receiver_phone || order.customer_phone || "",
    receiver_address: order.receiver_address || "",
    package_type: packageValue,
    package_description: packageValue,
    weight: Math.max(0.1, Number(order.weight || 1)),
    payment_method: order.payment_method === "sender_pays" ? "merchant_pays" : order.payment_method || "merchant_pays",
    cod_amount: numberOrBlank(order.cod_amount),
    notes: order.notes || "",
    status: order.status || "pending",
    price_mode: manual ? "manual" : "system",
    manual_delivery_price: manual ? currentPrice : "",
  };
}

export default function AdminOrderEditModalComplete({
  order,
  merchants,
  isArabic,
  open,
  onClose,
  onSaved,
}: Props) {
  const [form, setForm] = useState<OpsOrderInput | null>(null);
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
  const price = useMemo(
    () => (form ? calculateOpsOrderPrice({ ...form, merchant: selectedMerchant }) : null),
    [form, selectedMerchant],
  );
  const settlement = useMemo(
    () => (form ? calculateMerchantStatementNet({ ...form, merchant: selectedMerchant }) : null),
    [form, selectedMerchant],
  );

  if (!open || !order || !form) return null;
  const currentOrder = order;
  const currentForm = form;

  function setField<K extends keyof OpsOrderInput>(key: K, value: OpsOrderInput[K]) {
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
            pickup_street: merchant?.pickup_address || merchant?.address || current.pickup_street,
            payment_method: merchant?.default_payment_method || current.payment_method,
          }
        : current,
    );
  }

  function validate() {
    const missing = [
      !selectedMerchant ? (isArabic ? "التاجر" : "merchant") : "",
      !clean(currentForm.coupon_number) ? (isArabic ? "رقم الكوبون" : "coupon number") : "",
      !clean(currentForm.receiver_name) ? (isArabic ? "اسم المستلم" : "receiver name") : "",
      !clean(currentForm.receiver_phone) ? (isArabic ? "هاتف المستلم" : "receiver phone") : "",
    ].filter(Boolean);

    if (missing.length) {
      return isArabic
        ? `الحقول الأساسية المطلوبة: ${missing.join("، ")}`
        : `Required core fields: ${missing.join(", ")}`;
    }
    if (
      currentForm.price_mode === "manual" &&
      (currentForm.manual_delivery_price === "" ||
        !Number.isFinite(Number(currentForm.manual_delivery_price)) ||
        Number(currentForm.manual_delivery_price) < 0)
    ) {
      return isArabic ? "أدخل سعراً يدوياً صحيحاً." : "Enter a valid manual price.";
    }
    if (currentForm.payment_method === "cod" && Number(currentForm.cod_amount || 0) <= 0) {
      return isArabic ? "مبلغ التحصيل مطلوب عند اختيار COD." : "COD amount is required.";
    }
    return "";
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validate();
    if (validation) return setError(validation);

    setBusy(true);
    setMessage("");
    setError("");
    try {
      const originalPackage = clean(currentOrder.package_description || currentOrder.package_type);
      const packageValue = clean(currentForm.package_description || currentForm.package_type) || originalPackage;
      const result = await updateOpsOrder({
        ...currentForm,
        coupon_number: clean(currentForm.coupon_number),
        merchant: selectedMerchant,
        receiver_address: clean(currentForm.receiver_address),
        delivery_street: clean(currentForm.delivery_street),
        package_type: packageValue,
        package_description: packageValue,
        order: currentOrder,
        edit_reason: clean(editReason) || (isArabic ? "تعديل من لوحة الإدارة" : "Updated from admin panel"),
      });
      setMessage(
        isArabic
          ? `تم حفظ تعديلات الطلب ${orderReference(result.row)} بنجاح.`
          : `Order ${orderReference(result.row)} updated successfully.`,
      );
      await onSaved?.(result.row);
      window.dispatchEvent(new CustomEvent("dn-admin-orders-updated"));
    } catch (cause) {
      const detail = opsErrorDetail(cause);
      setError(
        isArabic
          ? `تعذر تعديل الطلب.${detail ? ` السبب: ${detail}` : ""}`
          : `Could not update order.${detail ? ` Reason: ${detail}` : ""}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dn-admin-modal-backdrop" role="dialog" aria-modal="true" dir={isArabic ? "rtl" : "ltr"}>
      <form className="dn-admin-action-modal max-h-[92vh] !max-w-5xl overflow-y-auto" onSubmit={save}>
        <header>
          <div>
            <span>{isArabic ? "تعديل بيانات الطلب" : "Edit order data"}</span>
            <strong>{orderReference(order)}</strong>
          </div>
          <button type="button" onClick={onClose}><X className="h-4 w-4" /></button>
        </header>

        {message && <p className="dn-admin-modal-message"><CheckCircle2 className="h-4 w-4" />{message}</p>}
        {error && <p className="dn-admin-modal-message"><AlertTriangle className="h-4 w-4" />{error}</p>}

        <div className="mb-4 rounded-2xl border border-brand-gold/25 bg-brand-gold/5 p-4 text-xs font-bold leading-6 text-white/70">
          {isArabic
            ? "الإجباري فقط: التاجر، رقم الكوبون، اسم المستلم، وهاتف المستلم. العنوان التفصيلي ومحتوى الشحنة والوزن والملاحظات اختيارية."
            : "Only merchant, coupon number, receiver name, and receiver phone are required. Detailed address, package content, weight, and notes are optional."}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <h3 className="flex items-center gap-2 font-black text-brand-gold"><Pencil className="h-4 w-4" />{isArabic ? "البيانات الأساسية" : "Core details"}</h3>
            <label className="block space-y-1 text-xs font-black text-white/65">
              <span>{isArabic ? "صاحب المتجر *" : "Merchant *"}</span>
              <select value={form.merchant_id || ""} onChange={(event) => chooseMerchant(event.target.value)} className={inputClass()} required>
                <option value="">{isArabic ? "اختر التاجر" : "Select merchant"}</option>
                {merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchantOptionLabel(merchant)}</option>)}
              </select>
            </label>
            <label className="block space-y-1 text-xs font-black text-white/65">
              <span>{isArabic ? "رقم الكوبون *" : "Coupon number *"}</span>
              <input value={form.coupon_number || ""} onChange={(event) => setField("coupon_number", event.target.value)} className={inputClass()} required dir="ltr" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-xs font-black text-white/65"><span>{isArabic ? "اسم المستلم *" : "Receiver name *"}</span><input value={form.receiver_name} onChange={(event) => setField("receiver_name", event.target.value)} className={inputClass()} required /></label>
              <label className="block space-y-1 text-xs font-black text-white/65"><span>{isArabic ? "هاتف المستلم *" : "Receiver phone *"}</span><input value={form.receiver_phone} onChange={(event) => setField("receiver_phone", event.target.value)} className={inputClass()} required dir="ltr" /></label>
            </div>
            <label className="block space-y-1 text-xs font-black text-white/65">
              <span>{isArabic ? "نوع الشحن" : "Shipping scope"}</span>
              <select value={form.shipping_scope} onChange={(event) => setField("shipping_scope", event.target.value as "local" | "international")} className={inputClass()}>
                <option value="local">{isArabic ? "داخل الإمارات" : "Within UAE"}</option>
                <option value="international">{isArabic ? "دولي" : "International"}</option>
              </select>
            </label>
            {form.shipping_scope === "local" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={form.delivery_city} onChange={(event) => setForm((current) => current ? { ...current, delivery_city: event.target.value, delivery_area: getDefaultAreaForEmirate(event.target.value) } : current)} className={inputClass()}>
                  {UAE_LOCATIONS.map((location) => <option key={location.value} value={location.value}>{isArabic ? location.ar : location.en}</option>)}
                </select>
                <select value={form.delivery_area || ""} onChange={(event) => setField("delivery_area", event.target.value)} className={inputClass()}>
                  {deliveryAreas.map((area) => <option key={area.value} value={area.value}>{isArabic ? area.ar : area.en}</option>)}
                </select>
              </div>
            ) : (
              <input value={form.destination_country || ""} onChange={(event) => setField("destination_country", event.target.value)} className={inputClass()} placeholder={isArabic ? "الدولة" : "Destination country"} />
            )}
            <label className="block space-y-1 text-xs font-black text-white/65"><span>{isArabic ? "العنوان التفصيلي — اختياري" : "Detailed address — optional"}</span><textarea rows={3} value={form.delivery_street || form.receiver_address} onChange={(event) => setForm((current) => current ? { ...current, delivery_street: event.target.value, receiver_address: event.target.value } : current)} className={inputClass()} /></label>
          </section>

          <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <h3 className="flex items-center gap-2 font-black text-brand-gold"><Calculator className="h-4 w-4" />{isArabic ? "السعر والتفاصيل الاختيارية" : "Price & optional details"}</h3>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setField("price_mode", "system"); setField("manual_delivery_price", ""); }} className={`rounded-xl px-3 py-3 text-xs font-black ${form.price_mode !== "manual" ? "bg-brand-gold text-brand-deep" : "border border-white/10 text-white"}`}>{isArabic ? "سعر النظام" : "System price"}</button>
              <button type="button" onClick={() => setField("price_mode", "manual")} className={`rounded-xl px-3 py-3 text-xs font-black ${form.price_mode === "manual" ? "bg-brand-gold text-brand-deep" : "border border-white/10 text-white"}`}>{isArabic ? "سعر يدوي" : "Manual price"}</button>
            </div>
            {form.price_mode === "manual" && <input type="number" min={0} step="0.01" value={form.manual_delivery_price ?? ""} onChange={(event) => setField("manual_delivery_price", event.target.value)} className={inputClass()} placeholder={isArabic ? "السعر اليدوي" : "Manual price"} />}
            <label className="block space-y-1 text-xs font-black text-white/65"><span>{isArabic ? "محتوى الشحنة — اختياري" : "Package content — optional"}</span><input value={form.package_type} onChange={(event) => { setField("package_type", event.target.value); setField("package_description", event.target.value); }} className={inputClass()} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-xs font-black text-white/65"><span>{isArabic ? "عدد القطع" : "Pieces"}</span><input type="number" min={1} value={form.order_count} onChange={(event) => setField("order_count", Math.max(1, Number(event.target.value) || 1))} className={inputClass()} /></label>
              <label className="block space-y-1 text-xs font-black text-white/65"><span>{isArabic ? "الوزن — اختياري" : "Weight — optional"}</span><input type="number" min={0.1} step="0.1" value={form.weight || 1} onChange={(event) => setField("weight", Math.max(0.1, Number(event.target.value) || 1))} className={inputClass()} /></label>
            </div>
            <select value={form.payment_method} onChange={(event) => setField("payment_method", event.target.value)} className={inputClass()}>
              <option value="merchant_pays">{isArabic ? "التاجر يتحمل رسوم التوصيل" : "Merchant pays delivery fee"}</option>
              <option value="receiver_pays">{isArabic ? "المستلم يدفع رسوم التوصيل" : "Receiver pays delivery fee"}</option>
              <option value="cod">{isArabic ? "تحصيل عند التسليم" : "COD"}</option>
            </select>
            {form.payment_method === "cod" && <input type="number" min={0} step="0.01" value={form.cod_amount ?? ""} onChange={(event) => setField("cod_amount", event.target.value)} className={inputClass()} placeholder={isArabic ? "مبلغ التحصيل *" : "COD amount *"} required />}
            <label className="block space-y-1 text-xs font-black text-white/65"><span>{isArabic ? "ملاحظات — اختيارية" : "Notes — optional"}</span><textarea rows={3} value={form.notes || ""} onChange={(event) => setField("notes", event.target.value)} className={inputClass()} /></label>
            <label className="block space-y-1 text-xs font-black text-white/65"><span>{isArabic ? "سبب التعديل — اختياري" : "Edit reason — optional"}</span><input value={editReason} onChange={(event) => setEditReason(event.target.value)} className={inputClass()} /></label>
            {price && settlement && <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold"><span className="rounded-xl border border-white/10 p-2">{isArabic ? "التوصيل" : "Delivery"}<b className="block">{price.total.toFixed(2)}</b></span><span className="rounded-xl border border-white/10 p-2">COD<b className="block">{settlement.collectionAmount.toFixed(2)}</b></span><span className="rounded-xl border border-white/10 p-2">{isArabic ? "صافي التاجر" : "Merchant net"}<b className="block">{settlement.merchantNet.toFixed(2)}</b></span></div>}
          </section>
        </div>

        <footer>
          <button type="button" onClick={onClose}>{isArabic ? "إغلاق" : "Close"}</button>
          <button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? (isArabic ? "جارٍ الحفظ..." : "Saving...") : (isArabic ? "حفظ التعديلات" : "Save changes")}</button>
        </footer>
      </form>
    </div>
  );
}
