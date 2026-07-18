import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Loader2,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  calculateMerchantStatementNet,
  calculateOpsOrderPrice,
  deleteOpsOrder,
  opsErrorDetail,
  updateOpsOrder,
  type OpsOrderInput,
} from "../../lib/adminOperationsData";
import { UAE_LOCATIONS } from "../../data/uaeLocations";
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
  total?: number | string | null;
  total_price?: number | string | null;
  amount?: number | string | null;
  pickup_city?: string | null;
  pickup_area?: string | null;
  delivery_city?: string | null;
  delivery_area?: string | null;
  assigned_driver_id?: string | null;
  driver_id?: string | null;
};

const DELETE_STATUSES = new Set([
  "pending",
  "review",
  "confirmed",
  "cancelled",
  "returned",
]);
const clean = (value: unknown) => String(value ?? "").trim();
const normalizeStatus = (value: unknown) =>
  clean(value).toLowerCase().replace(/[\s-]+/g, "_");
const orderReference = (order: Order) =>
  order.tracking_number ||
  order.invoice_number ||
  order.coupon_number ||
  order.id ||
  "—";
const inputClass = () =>
  "w-full rounded-xl border border-white/10 bg-brand-deep/75 px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-white/30 focus:border-brand-gold/60";
const numberOrBlank = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
};
const deliveryPrice = (order: ExtendedOrder) =>
  Number(
    order.delivery_price ||
      order.price ||
      order.total ||
      order.total_price ||
      order.amount ||
      0,
  );

function merchantOptionLabel(merchant: Merchant) {
  const owner = clean(merchant.owner_name);
  const store = clean(merchant.trade_name);
  const code = clean(merchant.merchant_code);
  if (owner && store) return `${owner} — ${store}${code ? ` — ${code}` : ""}`;
  return owner || store || code || merchant.id;
}

function optionalPackageValue(value: unknown) {
  const normalized = clean(value);
  return normalized.toLowerCase() === "shipment" ? "" : normalized;
}

function initialForm(order: Order, merchants: Merchant[]): OpsOrderInput {
  const row = order as ExtendedOrder;
  const merchant = merchants.find((item) => item.id === order.merchant_id) || null;
  const manual =
    row.price_source === "manual" || Number(row.manual_delivery_price || 0) > 0;
  const packageValue = optionalPackageValue(
    order.package_type || order.package_description,
  );

  return {
    merchant,
    merchant_id: order.merchant_id || "",
    merchant_name:
      order.merchant_name || merchant?.trade_name || order.sender_name || "",
    merchant_code: order.merchant_code || merchant?.merchant_code || "",
    coupon_number: order.coupon_number || "",
    shipping_scope:
      order.shipping_scope === "international" ? "international" : "local",
    order_count: Math.max(1, Number(order.order_count || order.pieces || 1)),
    pickup_city:
      order.sender_city || clean(row.pickup_city) || merchant?.emirate || "Abu Dhabi",
    pickup_area: clean(row.pickup_area || merchant?.city),
    pickup_street:
      order.sender_address || merchant?.pickup_address || merchant?.address || "",
    delivery_city:
      order.receiver_city || clean(row.delivery_city) || "Abu Dhabi",
    delivery_area: clean(row.delivery_area),
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
        : order.payment_method || "merchant_pays",
    cod_amount: numberOrBlank(order.cod_amount),
    notes: order.notes || "",
    status: order.status || "pending",
    price_mode: manual ? "manual" : "system",
    manual_delivery_price: manual ? deliveryPrice(row) : "",
  };
}

export default function AdminOrderEditModal({
  order,
  merchants,
  isArabic,
  open,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const [form, setForm] = useState<OpsOrderInput | null>(null);
  const [editReason, setEditReason] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState<"save" | "delete" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !order) return;
    setForm(initialForm(order, merchants));
    setEditReason("");
    setDeleteReason("");
    setDeleteOpen(false);
    setBusy("");
    setMessage("");
    setError("");
  }, [merchants, open, order]);

  const selectedMerchant = useMemo(
    () => merchants.find((merchant) => merchant.id === form?.merchant_id) || null,
    [form?.merchant_id, merchants],
  );
  const price = useMemo(
    () => (form ? calculateOpsOrderPrice({ ...form, merchant: selectedMerchant }) : null),
    [form, selectedMerchant],
  );
  const settlement = useMemo(
    () =>
      form
        ? calculateMerchantStatementNet({ ...form, merchant: selectedMerchant })
        : null,
    [form, selectedMerchant],
  );

  if (!open || !order || !form) return null;

  const row = order as ExtendedOrder;
  const assignedDriver =
    row.assigned_driver_id || row.driver_id || order.driver_code || order.driver_name;
  const canDelete =
    DELETE_STATUSES.has(normalizeStatus(order.status)) && !assignedDriver;

  function setField<K extends keyof OpsOrderInput>(
    key: K,
    value: OpsOrderInput[K],
  ) {
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
              merchant?.pickup_address ||
              merchant?.address ||
              current.pickup_street,
            payment_method:
              merchant?.default_payment_method || current.payment_method,
          }
        : current,
    );
    setMessage("");
    setError("");
  }

  function validate() {
    const missing = [
      !selectedMerchant ? (isArabic ? "التاجر" : "merchant") : "",
      !clean(form.receiver_name)
        ? isArabic
          ? "اسم المستلم"
          : "receiver name"
        : "",
      !clean(form.receiver_phone)
        ? isArabic
          ? "هاتف المستلم"
          : "receiver phone"
        : "",
    ].filter(Boolean);

    if (missing.length) {
      return isArabic
        ? `الحقول الأساسية المطلوبة: ${missing.join("، ")}`
        : `Required core fields: ${missing.join(", ")}`;
    }

    if (
      form.price_mode === "manual" &&
      (form.manual_delivery_price === "" ||
        !Number.isFinite(Number(form.manual_delivery_price)) ||
        Number(form.manual_delivery_price) < 0)
    ) {
      return isArabic
        ? "أدخل سعراً يدوياً صحيحاً."
        : "Enter a valid manual price.";
    }

    if (form.payment_method === "cod" && Number(form.cod_amount || 0) <= 0) {
      return isArabic
        ? "مبلغ التحصيل مطلوب عند اختيار COD."
        : "COD amount is required.";
    }

    return "";
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validate();
    if (validation) return setError(validation);

    setBusy("save");
    setMessage("");
    setError("");
    try {
      const result = await updateOpsOrder({
        ...form,
        merchant: selectedMerchant,
        receiver_address: clean(form.receiver_address),
        delivery_street: clean(form.delivery_street),
        package_type: clean(form.package_type) || "Shipment",
        package_description:
          clean(form.package_description) || clean(form.package_type) || "Shipment",
        order,
        edit_reason:
          clean(editReason) ||
          (isArabic ? "تعديل من لوحة الإدارة" : "Updated from admin panel"),
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
      setBusy("");
    }
  }

  async function removeOrder() {
    if (!canDelete) {
      setError(
        isArabic
          ? "لا يمكن حذف طلب مُرسل لمندوب أو داخل التنفيذ/تم التسليم. ألغِ الإسناد وغيّر الحالة أولاً."
          : "Assigned, active, or delivered orders cannot be deleted. Unassign and change status first.",
      );
      return;
    }
    if (clean(deleteReason).length < 4) {
      setError(
        isArabic ? "اكتب سبب الحذف بوضوح." : "Enter a clear deletion reason.",
      );
      return;
    }

    setBusy("delete");
    setMessage("");
    setError("");
    try {
      const result = await deleteOpsOrder(order, deleteReason);
      if (!result.deleted) throw new Error("delete_not_confirmed");
      await onDeleted?.(result.reference);
      window.dispatchEvent(new CustomEvent("dn-admin-orders-updated"));
      onClose();
    } catch (cause) {
      const detail = opsErrorDetail(cause);
      setError(
        isArabic
          ? `تعذر حذف الطلب.${detail ? ` السبب: ${detail}` : ""}`
          : `Could not delete order.${detail ? ` Reason: ${detail}` : ""}`,
      );
    } finally {
      setBusy("");
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
        className="dn-admin-action-modal max-h-[92vh] !max-w-4xl overflow-y-auto"
        onSubmit={save}
      >
        <header>
          <div>
            <span>{isArabic ? "تعديل الطلب المرن" : "Flexible order editor"}</span>
            <strong>{orderReference(order)}</strong>
          </div>
          <button type="button" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </header>

        {message && (
          <p className="dn-admin-modal-message">
            <CheckCircle2 className="h-4 w-4" />
            {message}
          </p>
        )}
        {error && (
          <p className="dn-admin-modal-message">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <h3 className="flex items-center gap-2 font-black text-brand-gold">
              <Pencil className="h-4 w-4" />
              {isArabic ? "التاجر والمستلم" : "Merchant & receiver"}
            </h3>
            <label>
              {isArabic ? "صاحب المتجر — مطلوب" : "Merchant owner — required"}
              <select
                value={form.merchant_id || ""}
                onChange={(event) => chooseMerchant(event.target.value)}
                className={inputClass()}
                required
              >
                <option value="">
                  {isArabic
                    ? "ابحث واختر باسم المالك"
                    : "Find and select by owner name"}
                </option>
                {merchants.map((merchant) => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchantOptionLabel(merchant)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                {isArabic ? "اسم المستلم *" : "Receiver name *"}
                <input
                  value={form.receiver_name}
                  onChange={(event) =>
                    setField("receiver_name", event.target.value)
                  }
                  className={inputClass()}
                  required
                />
              </label>
              <label>
                {isArabic ? "هاتف المستلم *" : "Receiver phone *"}
                <input
                  value={form.receiver_phone}
                  onChange={(event) =>
                    setField("receiver_phone", event.target.value)
                  }
                  className={inputClass()}
                  dir="ltr"
                  required
                />
              </label>
            </div>
            <label>
              {isArabic ? "نوع الشحن" : "Shipping scope"}
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
              <label>
                {isArabic ? "إمارة التسليم" : "Delivery emirate"}
                <select
                  value={form.delivery_city}
                  onChange={(event) =>
                    setField("delivery_city", event.target.value)
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
            ) : (
              <label>
                {isArabic ? "الدولة" : "Destination country"}
                <input
                  value={form.destination_country || ""}
                  onChange={(event) =>
                    setField("destination_country", event.target.value)
                  }
                  className={inputClass()}
                />
              </label>
            )}
            <label>
              {isArabic
                ? "العنوان التفصيلي — اختياري"
                : "Detailed address — optional"}
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
              />
            </label>
          </section>

          <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <h3 className="flex items-center gap-2 font-black text-brand-gold">
              <Calculator className="h-4 w-4" />
              {isArabic ? "السعر والشحنة" : "Price & shipment"}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setField("price_mode", "system");
                  setField("manual_delivery_price", "");
                }}
                className={`rounded-xl px-3 py-3 text-xs font-black ${form.price_mode !== "manual" ? "bg-brand-gold text-brand-deep" : "border border-white/10 text-white"}`}
              >
                {isArabic ? "سعر النظام" : "System price"}
              </button>
              <button
                type="button"
                onClick={() => setField("price_mode", "manual")}
                className={`rounded-xl px-3 py-3 text-xs font-black ${form.price_mode === "manual" ? "bg-brand-gold text-brand-deep" : "border border-white/10 text-white"}`}
              >
                {isArabic ? "سعر يدوي" : "Manual price"}
              </button>
            </div>
            {form.price_mode === "manual" && (
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.manual_delivery_price ?? ""}
                onChange={(event) =>
                  setField("manual_delivery_price", event.target.value)
                }
                className={inputClass()}
                placeholder={isArabic ? "السعر اليدوي" : "Manual price"}
              />
            )}
            <label>
              {isArabic
                ? "محتوى الشحنة — اختياري"
                : "Package content — optional"}
              <input
                value={form.package_type}
                onChange={(event) => {
                  setField("package_type", event.target.value);
                  setField("package_description", event.target.value);
                }}
                className={inputClass()}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                {isArabic ? "عدد القطع" : "Pieces"}
                <input
                  type="number"
                  min={1}
                  value={form.order_count}
                  onChange={(event) =>
                    setField(
                      "order_count",
                      Math.max(1, Number(event.target.value) || 1),
                    )
                  }
                  className={inputClass()}
                />
              </label>
              <label>
                {isArabic ? "الوزن" : "Weight"}
                <input
                  type="number"
                  min={0.1}
                  step="0.1"
                  value={form.weight || 1}
                  onChange={(event) =>
                    setField(
                      "weight",
                      Math.max(0.1, Number(event.target.value) || 1),
                    )
                  }
                  className={inputClass()}
                />
              </label>
            </div>
            <label>
              {isArabic ? "طريقة الدفع" : "Payment method"}
              <select
                value={form.payment_method}
                onChange={(event) =>
                  setField("payment_method", event.target.value)
                }
                className={inputClass()}
              >
                <option value="merchant_pays">
                  {isArabic ? "التاجر يتحمل الرسوم" : "Merchant pays"}
                </option>
                <option value="receiver_pays">
                  {isArabic ? "المستلم يدفع" : "Receiver pays"}
                </option>
                <option value="cod">
                  {isArabic ? "تحصيل عند التسليم" : "COD"}
                </option>
              </select>
            </label>
            {form.payment_method === "cod" && (
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.cod_amount ?? ""}
                onChange={(event) =>
                  setField("cod_amount", event.target.value)
                }
                className={inputClass()}
                placeholder={isArabic ? "مبلغ التحصيل" : "COD amount"}
              />
            )}
            <label>
              {isArabic ? "ملاحظات — اختيارية" : "Notes — optional"}
              <textarea
                rows={3}
                value={form.notes || ""}
                onChange={(event) => setField("notes", event.target.value)}
                className={inputClass()}
              />
            </label>
            <label>
              {isArabic ? "سبب التعديل — اختياري" : "Edit reason — optional"}
              <input
                value={editReason}
                onChange={(event) => setEditReason(event.target.value)}
                className={inputClass()}
              />
            </label>

            {price && settlement && (
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                <span className="rounded-xl border border-white/10 p-2">
                  {isArabic ? "السعر" : "Price"}
                  <b className="block">{price.total.toFixed(2)}</b>
                </span>
                <span className="rounded-xl border border-white/10 p-2">
                  COD
                  <b className="block">{settlement.collectionAmount.toFixed(2)}</b>
                </span>
                <span className="rounded-xl border border-white/10 p-2">
                  {isArabic ? "صافي التاجر" : "Merchant net"}
                  <b className="block">{settlement.merchantNet.toFixed(2)}</b>
                </span>
              </div>
            )}
          </section>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <button
            type="button"
            onClick={() => setDeleteOpen((value) => !value)}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-400/30 px-4 py-3 text-xs font-black text-rose-200"
          >
            <Trash2 className="h-4 w-4" />
            {isArabic ? "حذف الطلب" : "Delete order"}
          </button>
          {deleteOpen && (
            <div className="mt-3 space-y-3">
              <textarea
                rows={3}
                value={deleteReason}
                onChange={(event) => setDeleteReason(event.target.value)}
                className={inputClass()}
                placeholder={isArabic ? "سبب الحذف — مطلوب" : "Deletion reason — required"}
              />
              <button
                type="button"
                disabled={busy === "delete" || !canDelete}
                onClick={() => void removeOrder()}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-3 text-xs font-black text-white disabled:opacity-50"
              >
                {busy === "delete" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {isArabic ? "تأكيد الحذف الآمن" : "Confirm safe deletion"}
              </button>
            </div>
          )}
        </div>

        <footer>
          <button type="button" onClick={onClose}>
            {isArabic ? "إغلاق" : "Close"}
          </button>
          <button type="submit" disabled={busy === "save"}>
            {busy === "save" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {busy === "save"
              ? isArabic
                ? "جارٍ الحفظ..."
                : "Saving..."
              : isArabic
                ? "حفظ التعديلات"
                : "Save changes"}
          </button>
        </footer>
      </form>
    </div>
  );
}
