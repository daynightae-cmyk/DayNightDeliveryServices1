import { useMemo, useState } from "react";
import { PackagePlus, Save } from "lucide-react";
import { calculateAdminOrderPrice, createAdminOrder, type AdminOrderInput } from "../../lib/adminData";
import type { Merchant, Order } from "../../types";

const emptyOrder: AdminOrderInput = {
  merchant: null, merchant_id: "", merchant_name: "", merchant_code: "", coupon_number: "", shipping_scope: "local", order_count: 1, pickup_city: "Abu Dhabi", delivery_city: "Dubai", destination_country: "SA", receiver_name: "", receiver_phone: "", receiver_address: "", package_type: "", package_description: "", weight: 1, payment_method: "sender_pays", cod_amount: "", notes: "", status: "pending",
};
const cities = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Al Ain"];
const destinations = ["SA", "KW", "BH", "OM", "QA", "WORLD", "USA", "UK", "EU"];
const inputClass = () => "w-full rounded-2xl border border-white/10 bg-brand-deep/70 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-brand-gold/60";

export default function AdminNewOrder({ isArabic, merchants, onSaved }: { isArabic: boolean; merchants: Merchant[]; onSaved?: (order: Order) => void }) {
  const [form, setForm] = useState<AdminOrderInput>(emptyOrder);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selectedMerchant = useMemo(() => merchants.find((m) => m.id === form.merchant_id) || null, [form.merchant_id, merchants]);
  const price = useMemo(() => calculateAdminOrderPrice({ ...form, merchant: selectedMerchant }), [form, selectedMerchant]);

  function setField<K extends keyof AdminOrderInput>(key: K, value: AdminOrderInput[K]) { setForm((prev) => ({ ...prev, [key]: value })); }
  function chooseMerchant(id: string) {
    const merchant = merchants.find((m) => m.id === id) || null;
    setForm((prev) => ({ ...prev, merchant, merchant_id: id, merchant_name: merchant?.trade_name || prev.merchant_name, merchant_code: merchant?.merchant_code || "", pickup_city: merchant?.city || merchant?.emirate || prev.pickup_city, payment_method: merchant?.default_payment_method || prev.payment_method }));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage(""); setError("");
    if ((!selectedMerchant && !(form.merchant_name || "").trim()) || !form.receiver_name.trim() || !form.receiver_phone.trim() || !form.receiver_address.trim() || !form.package_type.trim()) {
      setError(isArabic ? "بيانات التاجر والمستلم ومحتوى الشحنة مطلوبة." : "Merchant/sender, receiver, and package details are required."); return;
    }
    setSaving(true);
    try {
      const saved = await createAdminOrder({ ...form, merchant: selectedMerchant });
      setMessage(isArabic ? `تم إنشاء الطلب. التتبع: ${saved.invoice_number || saved.tracking_number || saved.id}` : `Order created. Tracking: ${saved.invoice_number || saved.tracking_number || saved.id}`);
      setForm({ ...emptyOrder, merchant_id: selectedMerchant?.id || "", merchant_name: selectedMerchant?.trade_name || "", merchant_code: selectedMerchant?.merchant_code || "", merchant: selectedMerchant });
      onSaved?.(saved);
    } catch (err) { setError(String((err as Error).message || err)); } finally { setSaving(false); }
  }

  return <form onSubmit={submit} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20" dir={isArabic ? "rtl" : "ltr"}>
    <div className="mb-5 flex items-center gap-3"><PackagePlus className="h-7 w-7 text-brand-gold" /><div><h2 className="text-xl font-black text-white">{isArabic ? "إضافة طلب حقيقي" : "Create live order"}</h2><p className="text-xs font-bold text-white/50">{isArabic ? "يحفظ في جدول orders ويعرض رقم التتبع بعد الحفظ." : "Saves to the orders table and returns the tracking reference."}</p></div></div>
    {message && <div className="mb-4 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm font-bold text-emerald-200">{message}</div>}
    {error && <div className="mb-4 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm font-bold text-rose-200">{error}</div>}
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      <label className="space-y-1 md:col-span-2"><span className="text-xs font-black text-white/60">{isArabic ? "التاجر" : "Merchant"}</span><select className={inputClass()} value={form.merchant_id || ""} onChange={(e) => chooseMerchant(e.target.value)}><option value="">{isArabic ? "اختر تاجر أو أدخل مرسل يدوي" : "Select merchant or enter sender"}</option>{merchants.map((m) => <option key={m.id} value={m.id}>{m.trade_name} — {m.phone}</option>)}</select></label>
      <label className="space-y-1"><span className="text-xs font-black text-white/60">{isArabic ? "اسم المرسل" : "Sender name"}</span><input className={inputClass()} value={form.merchant_name || ""} onChange={(e) => setField("merchant_name", e.target.value)} /></label>
      <label className="space-y-1"><span className="text-xs font-black text-white/60">Coupon</span><input dir="ltr" className={inputClass()} value={form.coupon_number || ""} onChange={(e) => setField("coupon_number", e.target.value)} /></label>
      <label className="space-y-1"><span className="text-xs font-black text-white/60">{isArabic ? "الاستلام" : "Pickup"}</span><select className={inputClass()} value={form.pickup_city} onChange={(e) => setField("pickup_city", e.target.value)}>{cities.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label className="space-y-1"><span className="text-xs font-black text-white/60">{isArabic ? "التسليم" : "Delivery"}</span><select className={inputClass()} value={form.delivery_city} onChange={(e) => setField("delivery_city", e.target.value)}>{cities.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label className="space-y-1"><span className="text-xs font-black text-white/60">{isArabic ? "النطاق" : "Scope"}</span><select className={inputClass()} value={form.shipping_scope} onChange={(e) => setField("shipping_scope", e.target.value as "local" | "international")}><option value="local">Local</option><option value="international">International</option></select></label>
      {form.shipping_scope === "international" && <label className="space-y-1"><span className="text-xs font-black text-white/60">{isArabic ? "الدولة" : "Destination"}</span><select className={inputClass()} value={form.destination_country || "SA"} onChange={(e) => setField("destination_country", e.target.value)}>{destinations.map((c) => <option key={c}>{c}</option>)}</select></label>}
      <label className="space-y-1"><span className="text-xs font-black text-white/60">{isArabic ? "اسم العميل" : "Customer"}</span><input className={inputClass()} value={form.receiver_name} onChange={(e) => setField("receiver_name", e.target.value)} /></label>
      <label className="space-y-1"><span className="text-xs font-black text-white/60">{isArabic ? "هاتف العميل" : "Phone"}</span><input dir="ltr" className={inputClass()} value={form.receiver_phone} onChange={(e) => setField("receiver_phone", e.target.value)} /></label>
      <label className="space-y-1 md:col-span-2"><span className="text-xs font-black text-white/60">{isArabic ? "عنوان التسليم" : "Delivery address"}</span><input className={inputClass()} value={form.receiver_address} onChange={(e) => setField("receiver_address", e.target.value)} /></label>
      <label className="space-y-1"><span className="text-xs font-black text-white/60">{isArabic ? "وصف الشحنة" : "Package"}</span><input className={inputClass()} value={form.package_type} onChange={(e) => { setField("package_type", e.target.value); setField("package_description", e.target.value); }} /></label>
      <label className="space-y-1"><span className="text-xs font-black text-white/60">{isArabic ? "العدد" : "Pieces"}</span><input type="number" min="1" className={inputClass()} value={form.order_count} onChange={(e) => setField("order_count", Number(e.target.value))} /></label>
      <label className="space-y-1"><span className="text-xs font-black text-white/60">{isArabic ? "الوزن" : "Weight"}</span><input type="number" min="1" className={inputClass()} value={form.weight || 1} onChange={(e) => setField("weight", Number(e.target.value))} /></label>
      <label className="space-y-1"><span className="text-xs font-black text-white/60">{isArabic ? "طريقة الدفع" : "Payment"}</span><select className={inputClass()} value={form.payment_method} onChange={(e) => setField("payment_method", e.target.value)}><option value="sender_pays">Sender pays</option><option value="receiver_pays">Receiver pays</option><option value="cod">COD</option></select></label>
      <label className="space-y-1"><span className="text-xs font-black text-white/60">COD</span><input type="number" min="0" className={inputClass()} value={form.cod_amount || ""} onChange={(e) => setField("cod_amount", e.target.value)} /></label>
      <label className="space-y-1"><span className="text-xs font-black text-white/60">{isArabic ? "الحالة" : "Status"}</span><select className={inputClass()} value={form.status || "pending"} onChange={(e) => setField("status", e.target.value)}><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="in_transit">In transit</option></select></label>
      <label className="space-y-1 md:col-span-2 xl:col-span-3"><span className="text-xs font-black text-white/60">{isArabic ? "ملاحظات" : "Notes"}</span><textarea className={`${inputClass()} min-h-24`} value={form.notes || ""} onChange={(e) => setField("notes", e.target.value)} /></label>
    </div>
    <div className="mt-5 flex flex-wrap items-center gap-3"><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-brand-gold px-5 py-3 text-sm font-black text-brand-deep disabled:opacity-60"><Save className="h-4 w-4" />{saving ? (isArabic ? "جاري الحفظ..." : "Saving...") : (isArabic ? "حفظ الطلب" : "Save order")}</button><span className="rounded-2xl border border-brand-sky/25 bg-brand-sky/10 px-4 py-3 text-xs font-black text-brand-sky">{isArabic ? "السعر" : "Price"}: {price.total.toFixed(2)} AED</span></div>
  </form>;
}
