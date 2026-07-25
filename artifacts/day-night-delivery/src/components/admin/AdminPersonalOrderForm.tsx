import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Loader2, PackagePlus, Save, UserRound } from "lucide-react";
import { UAE_LOCATIONS, getAreasForEmirate, getDefaultAreaForEmirate } from "../../data/uaeLocations";
import { opsErrorDetail } from "../../lib/adminOperationsData";
import {
  PERSONAL_ORDER_DELIVERY_FEE,
  calculatePersonalOrderFinancials,
  createPersonalOpsOrder,
  type PersonalOrderInput,
} from "../../lib/personalOrderOperations";
import type { Order } from "../../types";

const emptyForm: PersonalOrderInput = {
  reference: "",
  sender_name: "",
  sender_phone: "",
  pickup_city: "Abu Dhabi",
  pickup_area: "Mussafah",
  pickup_street: "",
  receiver_name: "",
  receiver_phone: "",
  delivery_city: "Abu Dhabi",
  delivery_area: "Al Shahama",
  delivery_street: "",
  package_type: "",
  goods_value: "",
  discount_amount: "",
  payment_method: "cod",
  notes: "",
};

const inputClass = "w-full rounded-2xl border border-brand-sky/20 bg-[#06172c] px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-white/35 focus:border-brand-gold/65";

export default function AdminPersonalOrderForm({
  isArabic,
  onSaved,
}: {
  isArabic: boolean;
  onSaved?: (order: Order) => Promise<void> | void;
}) {
  const [form, setForm] = useState<PersonalOrderInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pickupAreas = useMemo(() => getAreasForEmirate(form.pickup_city), [form.pickup_city]);
  const deliveryAreas = useMemo(() => getAreasForEmirate(form.delivery_city), [form.delivery_city]);
  const financials = useMemo(() => {
    try {
      return calculatePersonalOrderFinancials({ goodsValue: form.goods_value, discountAmount: form.discount_amount });
    } catch {
      return null;
    }
  }, [form.discount_amount, form.goods_value]);

  function field<K extends keyof PersonalOrderInput>(key: K, value: PersonalOrderInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const missing = [
      !form.sender_name.trim() ? (isArabic ? "اسم المرسل" : "sender name") : "",
      !form.sender_phone.trim() ? (isArabic ? "هاتف المرسل" : "sender phone") : "",
      !form.receiver_name.trim() ? (isArabic ? "اسم المستلم" : "recipient name") : "",
      !form.receiver_phone.trim() ? (isArabic ? "هاتف المستلم" : "recipient phone") : "",
      !form.pickup_street.trim() ? (isArabic ? "عنوان الاستلام" : "pickup address") : "",
      !form.delivery_street.trim() ? (isArabic ? "عنوان التسليم" : "delivery address") : "",
      form.goods_value === "" ? (isArabic ? "قيمة البضاعة" : "goods value") : "",
    ].filter(Boolean);
    if (missing.length) {
      setError(isArabic ? `الحقول المطلوبة: ${missing.join("، ")}` : `Required fields: ${missing.join(", ")}`);
      return;
    }
    if (!financials) {
      setError(isArabic ? "الخصم لا يمكن أن يتجاوز قيمة البضاعة والتوصيل." : "Discount cannot exceed goods plus delivery.");
      return;
    }

    setSaving(true);
    try {
      const result = await createPersonalOpsOrder(form);
      const ref = result.row.tracking_number || result.row.invoice_number || result.row.id;
      setMessage(
        isArabic
? `تم إنشاء الطلب الشخصي ${ref} بدون تاجر. التوصيل ثابت ${PERSONAL_ORDER_DELIVERY_FEE.toFixed(2)} درهم، والمطلوب من العميل ${financials.customerTotal.toFixed(2)} درهم.`
: `Personal order ${ref} was created without a merchant. Delivery is fixed at ${PERSONAL_ORDER_DELIVERY_FEE.toFixed(2)} AED and customer total is ${financials.customerTotal.toFixed(2)} AED.`,
      );
      setForm(emptyForm);
      window.dispatchEvent(new CustomEvent("dn-admin-orders-updated", { detail: { order: result.row, source: result.source } }));
      await onSaved?.(result.row);
    } catch (cause) {
      const detail = opsErrorDetail(cause);
      setError(
        isArabic
? `تعذر إنشاء الطلب الشخصي الحقيقي.${detail ? ` السبب: ${detail}` : ""}`
: `The personal order could not be created.${detail ? ` Reason: ${detail}` : ""}`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="dn-personal-order-form rounded-[28px] border border-brand-gold/30 bg-gradient-to-br from-[#07172c] to-[#0b3155] p-5 shadow-2xl" dir={isArabic ? "rtl" : "ltr"}>
      <header className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
<span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gold text-[#07172c]"><UserRound className="h-6 w-6" /></span>
<div>
  <h2 className="text-xl font-black text-white">{isArabic ? "إنشاء طلب شخصي بدون تاجر" : "Create a personal order without merchant"}</h2>
  <p className="mt-1 text-xs font-bold leading-6 text-white/60">{isArabic ? "طلب مباشر بين مرسل ومستلم. لا يُنشأ حساب تاجر، ورسوم التوصيل ثابتة 25 درهم." : "Direct sender-to-recipient order. No merchant ledger is created and delivery is fixed at 25 AED."}</p>
</div>
        </div>
        <div className="rounded-2xl border border-brand-gold/30 bg-brand-gold/10 px-5 py-3 text-center">
<small className="block text-[10px] font-black text-white/55">{isArabic ? "سعر التوصيل الثابت" : "Fixed delivery fee"}</small>
<strong className="text-2xl font-black text-brand-gold" dir="ltr">25.00 AED</strong>
        </div>
      </header>

      {error && <p className="mb-4 flex gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-xs font-bold text-rose-100"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</p>}
      {message && <p className="mb-4 flex gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-xs font-bold text-emerald-100"><CheckCircle2 className="h-4 w-4 shrink-0" />{message}</p>}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="space-y-3 rounded-3xl border border-white/10 bg-black/10 p-4">
<h3 className="font-black text-brand-gold">{isArabic ? "بيانات المرسل والاستلام" : "Sender and pickup"}</h3>
<div className="grid gap-3 sm:grid-cols-2">
  <input value={form.sender_name} onChange={(e) => field("sender_name", e.target.value)} className={inputClass} placeholder={isArabic ? "اسم المرسل *" : "Sender name *"} />
  <input value={form.sender_phone} onChange={(e) => field("sender_phone", e.target.value)} className={inputClass} placeholder={isArabic ? "هاتف المرسل *" : "Sender phone *"} dir="ltr" />
</div>
<div className="grid gap-3 sm:grid-cols-2">
  <select value={form.pickup_city} onChange={(e) => setForm((current) => ({ ...current, pickup_city: e.target.value, pickup_area: getDefaultAreaForEmirate(e.target.value) }))} className={inputClass}>{UAE_LOCATIONS.map((item) => <option key={item.value} value={item.value}>{isArabic ? item.ar : item.en}</option>)}</select>
  <select value={form.pickup_area || ""} onChange={(e) => field("pickup_area", e.target.value)} className={inputClass}>{pickupAreas.map((item) => <option key={item.value} value={item.value}>{isArabic ? item.ar : item.en}</option>)}</select>
</div>
<textarea rows={3} value={form.pickup_street} onChange={(e) => field("pickup_street", e.target.value)} className={inputClass} placeholder={isArabic ? "عنوان الاستلام التفصيلي *" : "Detailed pickup address *"} />
        </section>

        <section className="space-y-3 rounded-3xl border border-white/10 bg-black/10 p-4">
<h3 className="font-black text-brand-gold">{isArabic ? "بيانات المستلم والتسليم" : "Recipient and delivery"}</h3>
<div className="grid gap-3 sm:grid-cols-2">
  <input value={form.receiver_name} onChange={(e) => field("receiver_name", e.target.value)} className={inputClass} placeholder={isArabic ? "اسم المستلم *" : "Recipient name *"} />
  <input value={form.receiver_phone} onChange={(e) => field("receiver_phone", e.target.value)} className={inputClass} placeholder={isArabic ? "هاتف المستلم *" : "Recipient phone *"} dir="ltr" />
</div>
<div className="grid gap-3 sm:grid-cols-2">
  <select value={form.delivery_city} onChange={(e) => setForm((current) => ({ ...current, delivery_city: e.target.value, delivery_area: getDefaultAreaForEmirate(e.target.value) }))} className={inputClass}>{UAE_LOCATIONS.map((item) => <option key={item.value} value={item.value}>{isArabic ? item.ar : item.en}</option>)}</select>
  <select value={form.delivery_area || ""} onChange={(e) => field("delivery_area", e.target.value)} className={inputClass}>{deliveryAreas.map((item) => <option key={item.value} value={item.value}>{isArabic ? item.ar : item.en}</option>)}</select>
</div>
<textarea rows={3} value={form.delivery_street} onChange={(e) => field("delivery_street", e.target.value)} className={inputClass} placeholder={isArabic ? "عنوان التسليم التفصيلي *" : "Detailed delivery address *"} />
        </section>
      </div>

      <section className="mt-4 grid gap-3 rounded-3xl border border-white/10 bg-black/10 p-4 md:grid-cols-2 xl:grid-cols-4">
        <input value={form.reference || ""} onChange={(e) => field("reference", e.target.value)} className={inputClass} placeholder={isArabic ? "مرجع اختياري — يُولد تلقائيًا" : "Optional reference — auto generated"} dir="ltr" />
        <input value={form.package_type} onChange={(e) => field("package_type", e.target.value)} className={inputClass} placeholder={isArabic ? "محتوى الشحنة" : "Package content"} />
        <input type="number" min={0} step="0.01" value={form.goods_value} onChange={(e) => field("goods_value", e.target.value)} className={inputClass} placeholder={isArabic ? "قيمة البضاعة *" : "Goods value *"} />
        <input type="number" min={0} step="0.01" value={form.discount_amount || ""} onChange={(e) => field("discount_amount", e.target.value)} className={inputClass} placeholder={isArabic ? "خصم اختياري" : "Optional discount"} />
        <select value={form.payment_method} onChange={(e) => field("payment_method", e.target.value)} className={inputClass}>
<option value="cod">{isArabic ? "تحصيل من المستلم عند التسليم" : "Collect from recipient on delivery"}</option>
<option value="prepaid">{isArabic ? "مدفوع مسبقًا" : "Prepaid"}</option>
<option value="receiver_pays">{isArabic ? "على حساب المستلم" : "Receiver pays"}</option>
        </select>
        <textarea rows={2} value={form.notes || ""} onChange={(e) => field("notes", e.target.value)} className={`${inputClass} md:col-span-2`} placeholder={isArabic ? "ملاحظات الطلب" : "Order notes"} />
        <div className="rounded-2xl border border-brand-sky/25 bg-brand-sky/10 p-3 text-center">
<small className="block text-[10px] font-black text-white/55">{isArabic ? "المطلوب من العميل" : "Customer total"}</small>
<strong className="text-xl font-black text-brand-sky" dir="ltr">{financials ? financials.customerTotal.toFixed(2) : "—"} AED</strong>
        </div>
        <button type="submit" disabled={saving || !financials} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-brand-gold px-5 font-black text-[#07172c] disabled:opacity-45">
{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
{saving ? (isArabic ? "جارٍ الحفظ..." : "Saving...") : (isArabic ? "إنشاء الطلب الشخصي" : "Create personal order")}
        </button>
      </section>
    </form>
  );
}
