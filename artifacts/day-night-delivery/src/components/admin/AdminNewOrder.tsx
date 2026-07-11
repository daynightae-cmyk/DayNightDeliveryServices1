import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Database, PackagePlus, ReceiptText, Save } from "lucide-react";
import {
  calculateOpsOrderPrice,
  createOpsOrder,
  type OpsDataSource,
  type OpsOrderInput,
} from "../../lib/adminOperationsData";
import type { Merchant, Order } from "../../types";

const emptyOrder: OpsOrderInput = {
  merchant: null,
  merchant_id: "",
  merchant_name: "",
  merchant_code: "",
  coupon_number: "",
  shipping_scope: "local",
  order_count: 1,
  pickup_city: "Abu Dhabi",
  delivery_city: "Dubai",
  destination_country: "SA",
  receiver_name: "",
  receiver_phone: "",
  receiver_address: "",
  package_type: "",
  package_description: "",
  weight: 1,
  payment_method: "sender_pays",
  cod_amount: "",
  notes: "",
  status: "pending",
};

const cities = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah", "Al Ain", "Western Region"];
const destinations = ["SA", "KW", "BH", "OM", "QA", "WORLD", "USA", "UK", "EU", "Canada", "Australia"];

function inputClass() {
  return "w-full rounded-2xl border border-brand-sky/20 bg-brand-deep/75 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-white/30 focus:border-brand-gold/70 focus:ring-2 focus:ring-brand-gold/15";
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function sourceLabel(source: OpsDataSource | "pending" | "none", isArabic: boolean) {
  if (source === "rpc") return isArabic ? "تم عبر RPC الإنتاجي" : "Saved through production RPC";
  if (source === "db") return isArabic ? "تم عبر جدول orders مباشرة" : "Saved directly to orders table";
  if (source === "pending") return isArabic ? "جاهز للحفظ الحقيقي" : "Ready for live save";
  return isArabic ? "بانتظار الحفظ" : "Not saved yet";
}

export default function AdminNewOrder({
  isArabic,
  merchants,
  onSaved,
}: {
  isArabic: boolean;
  merchants: Merchant[];
  onSaved?: (order: Order) => void;
}) {
  const [form, setForm] = useState<OpsOrderInput>(emptyOrder);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [source, setSource] = useState<OpsDataSource | "pending" | "none">("none");

  const selectedMerchant = useMemo(
    () => merchants.find((merchant) => merchant.id === form.merchant_id) || null,
    [form.merchant_id, merchants],
  );

  const price = useMemo(
    () => calculateOpsOrderPrice({ ...form, merchant: selectedMerchant }),
    [form, selectedMerchant],
  );

  function setField<K extends keyof OpsOrderInput>(key: K, value: OpsOrderInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSource("pending");
  }

  function chooseMerchant(id: string) {
    const merchant = merchants.find((item) => item.id === id) || null;
    setForm((prev) => ({
      ...prev,
      merchant,
      merchant_id: id,
      merchant_name: merchant?.trade_name || prev.merchant_name,
      merchant_code: merchant?.merchant_code || "",
      pickup_city: merchant?.city || merchant?.emirate || prev.pickup_city,
      payment_method: merchant?.default_payment_method || prev.payment_method,
    }));
    setSource("pending");
  }

  function validate() {
    const missing = [
      !selectedMerchant && !clean(form.merchant_name) ? (isArabic ? "التاجر / المرسل" : "merchant / sender") : "",
      !clean(form.receiver_name) ? (isArabic ? "اسم العميل" : "receiver name") : "",
      !clean(form.receiver_phone) ? (isArabic ? "هاتف العميل" : "receiver phone") : "",
      !clean(form.receiver_address) ? (isArabic ? "عنوان التسليم" : "delivery address") : "",
      !clean(form.package_type) ? (isArabic ? "وصف الشحنة" : "package description") : "",
    ].filter(Boolean);

    if (missing.length) {
      return isArabic ? `حقول مطلوبة: ${missing.join("، ")}` : `Required fields: ${missing.join(", ")}`;
    }

    if (form.payment_method === "cod" && Number(form.cod_amount || 0) <= 0) {
      return isArabic ? "عند اختيار COD يجب إدخال مبلغ التحصيل." : "COD amount is required when payment method is COD.";
    }

    return "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const result = await createOpsOrder({ ...form, merchant: selectedMerchant });
      const saved = result.row;
      const tracking = saved.tracking_number || saved.invoice_number || saved.id;
      setSource(result.source);
      setMessage(isArabic ? `تم إنشاء الطلب الحقيقي. رقم التتبع: ${tracking}` : `Live order created. Tracking: ${tracking}`);
      setForm({
        ...emptyOrder,
        merchant_id: selectedMerchant?.id || "",
        merchant_name: selectedMerchant?.trade_name || "",
        merchant_code: selectedMerchant?.merchant_code || "",
        merchant: selectedMerchant,
      });
      onSaved?.(saved);
    } catch (err) {
      setSource("none");
      setError(String((err as Error).message || err));
    } finally {
      setSaving(false);
    }
  }

  const labels = {
    title: isArabic ? "إضافة طلب إنتاجي متصل بقاعدة البيانات" : "Create production DB-backed order",
    hint: isArabic
      ? "لا يتم إنشاء أي طلب وهمي. الحفظ يتم عبر RPC إنتاجي أو إدخال مباشر في جدول orders بعد تطبيق migration."
      : "No fake orders are created. Saves through the production RPC or direct orders insert after the migration is applied.",
    merchant: isArabic ? "التاجر" : "Merchant",
    sender: isArabic ? "اسم المرسل" : "Sender name",
    coupon: isArabic ? "رقم الكوبون / المرجع" : "Coupon / reference",
    pickup: isArabic ? "مدينة الاستلام" : "Pickup city",
    delivery: isArabic ? "مدينة التسليم" : "Delivery city",
    scope: isArabic ? "النطاق" : "Scope",
    destination: isArabic ? "دولة الشحن الدولي" : "International destination",
    receiver: isArabic ? "اسم العميل" : "Receiver name",
    phone: isArabic ? "هاتف العميل" : "Receiver phone",
    address: isArabic ? "عنوان التسليم" : "Delivery address",
    package: isArabic ? "محتوى الشحنة" : "Package content",
    pieces: isArabic ? "عدد القطع" : "Pieces",
    weight: isArabic ? "الوزن" : "Weight",
    payment: isArabic ? "طريقة الدفع" : "Payment method",
    status: isArabic ? "حالة البداية" : "Initial status",
    notes: isArabic ? "ملاحظات تشغيلية" : "Operations notes",
    save: saving ? (isArabic ? "جاري الحفظ الحقيقي..." : "Saving live...") : (isArabic ? "حفظ الطلب في قاعدة البيانات" : "Save order to database"),
  };

  return (
    <form onSubmit={submit} className="rounded-[2rem] border border-brand-sky/20 bg-white/[0.045] p-5 shadow-2xl shadow-black/20" dir={isArabic ? "rtl" : "ltr"}>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-gold/35 bg-brand-gold/10 text-brand-gold">
            <PackagePlus className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-xl font-black text-white">{labels.title}</h2>
            <p className="mt-1 max-w-3xl text-xs font-bold leading-6 text-white/55">{labels.hint}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-xs font-black text-emerald-200">
          <Database className="h-4 w-4" />
          {sourceLabel(source, isArabic)}
        </span>
      </div>

      {message && <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm font-bold text-emerald-200"><CheckCircle2 className="h-4 w-4" />{message}</div>}
      {error && <div className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm font-bold text-rose-200"><AlertTriangle className="h-4 w-4" />{error}</div>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-1 md:col-span-2">
          <span className="text-xs font-black text-white/60">{labels.merchant}</span>
          <select className={inputClass()} value={form.merchant_id || ""} onChange={(event) => chooseMerchant(event.target.value)}>
            <option value="">{isArabic ? "اختر تاجر من جدول merchants أو أدخل مرسل يدوي" : "Select from merchants table or enter sender manually"}</option>
            {merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.trade_name} — {merchant.phone}</option>)}
          </select>
        </label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.sender}</span><input className={inputClass()} value={form.merchant_name || ""} onChange={(event) => setField("merchant_name", event.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.coupon}</span><input dir="ltr" className={inputClass()} value={form.coupon_number || ""} onChange={(event) => setField("coupon_number", event.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.pickup}</span><select className={inputClass()} value={form.pickup_city} onChange={(event) => setField("pickup_city", event.target.value)}>{cities.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.delivery}</span><select className={inputClass()} value={form.delivery_city} onChange={(event) => setField("delivery_city", event.target.value)}>{cities.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.scope}</span><select className={inputClass()} value={form.shipping_scope} onChange={(event) => setField("shipping_scope", event.target.value as "local" | "international")}><option value="local">{isArabic ? "محلي داخل الإمارات" : "Local UAE"}</option><option value="international">{isArabic ? "دولي" : "International"}</option></select></label>
        {form.shipping_scope === "international" && <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.destination}</span><select className={inputClass()} value={form.destination_country || "SA"} onChange={(event) => setField("destination_country", event.target.value)}>{destinations.map((country) => <option key={country} value={country}>{country}</option>)}</select></label>}
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.receiver}</span><input className={inputClass()} value={form.receiver_name} onChange={(event) => setField("receiver_name", event.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.phone}</span><input dir="ltr" className={inputClass()} value={form.receiver_phone} onChange={(event) => setField("receiver_phone", event.target.value)} /></label>
        <label className="space-y-1 md:col-span-2"><span className="text-xs font-black text-white/60">{labels.address}</span><input className={inputClass()} value={form.receiver_address} onChange={(event) => setField("receiver_address", event.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.package}</span><input className={inputClass()} value={form.package_type} onChange={(event) => { setField("package_type", event.target.value); setField("package_description", event.target.value); }} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.pieces}</span><input type="number" min="1" className={inputClass()} value={form.order_count} onChange={(event) => setField("order_count", Number(event.target.value))} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.weight}</span><input type="number" min="1" step="0.1" className={inputClass()} value={form.weight || 1} onChange={(event) => setField("weight", Number(event.target.value))} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.payment}</span><select className={inputClass()} value={form.payment_method} onChange={(event) => setField("payment_method", event.target.value)}><option value="sender_pays">{isArabic ? "المرسل يدفع" : "Sender pays"}</option><option value="receiver_pays">{isArabic ? "المستلم يدفع" : "Receiver pays"}</option><option value="cod">COD</option></select></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">COD</span><input type="number" min="0" className={inputClass()} value={form.cod_amount || ""} onChange={(event) => setField("cod_amount", event.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.status}</span><select className={inputClass()} value={form.status || "pending"} onChange={(event) => setField("status", event.target.value)}><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="in_transit">In transit</option></select></label>
        <label className="space-y-1 md:col-span-2 xl:col-span-3"><span className="text-xs font-black text-white/60">{labels.notes}</span><textarea className={`${inputClass()} min-h-24`} value={form.notes || ""} onChange={(event) => setField("notes", event.target.value)} /></label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-brand-gold px-5 py-3 text-sm font-black text-brand-deep transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
          <Save className="h-4 w-4" />
          {labels.save}
        </button>
        <span className="inline-flex items-center gap-2 rounded-2xl border border-brand-sky/25 bg-brand-sky/10 px-4 py-3 text-xs font-black text-brand-sky">
          <ReceiptText className="h-4 w-4" />
          {isArabic ? "السعر الإنتاجي" : "Production price"}: {price.total.toFixed(2)} AED
        </span>
      </div>
    </form>
  );
}
