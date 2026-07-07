import { useEffect, useState } from "react";
import { CheckCircle, Loader2, PackagePlus, XCircle } from "lucide-react";
import { createAdminOrder, fetchMerchants, type AdminOrderInput } from "../../lib/adminData";
import type { Merchant } from "../../types";

const emptyOrder: AdminOrderInput = {
  merchant_id: "",
  customer_name: "",
  customer_phone: "",
  pickup_address: "",
  delivery_address: "",
  emirate: "Abu Dhabi",
  city: "Abu Dhabi",
  package_description: "",
  weight: 1,
  shipping_scope: "local",
  payment_method: "sender_pays",
  cod_amount: 0,
  delivery_fee: 0,
  notes: "",
  status: "pending",
  order_count: 1,
  pickup_city: "Abu Dhabi",
  delivery_city: "Abu Dhabi",
  receiver_name: "",
  receiver_phone: "",
  receiver_address: "",
  package_type: "Parcel",
};

const fields: Array<[keyof AdminOrderInput, string, string, string?]> = [
  ["customer_name", "اسم العميل", "Customer name"],
  ["customer_phone", "هاتف العميل", "Customer phone"],
  ["pickup_address", "عنوان الاستلام", "Pickup address"],
  ["delivery_address", "عنوان التسليم", "Delivery address"],
  ["emirate", "الإمارة", "Emirate"],
  ["city", "المدينة", "City"],
  ["package_description", "وصف الشحنة", "Package description"],
  ["weight", "الوزن", "Weight", "number"],
  ["shipping_scope", "النطاق", "Shipping scope"],
  ["payment_method", "الدفع", "Payment method"],
  ["cod_amount", "مبلغ COD", "COD amount", "number"],
  ["delivery_fee", "رسوم التوصيل", "Delivery fee", "number"],
  ["status", "الحالة", "Status"],
];

export default function AdminNewOrder({ isArabic, onSaved }: { isArabic: boolean; onSaved?: () => void }) {
  const [form, setForm] = useState<AdminOrderInput>(emptyOrder);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { void fetchMerchants().then(setMerchants).catch(() => setMerchants([])); }, []);

  function update(key: keyof AdminOrderInput, value: string) {
    setForm((current) => {
      const next = { ...current, [key]: key === "weight" || key === "cod_amount" || key === "delivery_fee" ? Number(value) : value };
      if (key === "city") next.delivery_city = value;
      if (key === "emirate") next.pickup_city = value;
      if (key === "customer_name") next.receiver_name = value;
      if (key === "customer_phone") next.receiver_phone = value;
      if (key === "delivery_address") next.receiver_address = value;
      if (key === "package_description") next.package_type = value || "Parcel";
      return next;
    });
  }

  async function submit() {
    setError(""); setSuccess("");
    if (!form.customer_name?.trim() || !form.customer_phone?.trim() || !form.delivery_address?.trim()) {
      setError(isArabic ? "اسم العميل والهاتف وعنوان التسليم مطلوبة." : "Customer name, phone, and delivery address are required.");
      return;
    }
    setSaving(true);
    try {
      const merchant = merchants.find((item) => item.id === form.merchant_id) || null;
      await createAdminOrder({ ...form, merchant, receiver_name: form.customer_name || form.receiver_name, receiver_phone: form.customer_phone || form.receiver_phone, receiver_address: form.delivery_address || form.receiver_address, pickup_city: form.emirate || form.pickup_city, delivery_city: form.city || form.delivery_city, package_type: form.package_description || form.package_type || "Parcel" });
      setForm(emptyOrder);
      setSuccess(isArabic ? "تم إنشاء الطلب وتحديث القائمة." : "Order created and the list was refreshed.");
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : (isArabic ? "تعذر إنشاء الطلب." : "Order could not be created."));
    } finally { setSaving(false); }
  }

  return (
    <section className="dn-admin-section-workspace" dir={isArabic ? "rtl" : "ltr"}>
      <header className="dn-admin-section-hero"><span>{isArabic ? "عمليات حية" : "Live operations"}</span><h1>{isArabic ? "إضافة طلب جديد" : "New Order"}</h1><p>{isArabic ? "نموذج آمن يحفظ الطلب في Supabase بالقيم الافتراضية المطلوبة." : "Safe Supabase-backed order form with required defaults."}</p></header>
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 sm:p-6 backdrop-blur-2xl">
        {success && <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-200"><CheckCircle className="h-4 w-4" />{success}</div>}
        {error && <div className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm font-bold text-rose-200"><XCircle className="h-4 w-4" />{error}</div>}
        <label className="mb-3 block text-xs font-black text-white/70 space-y-2"><span>{isArabic ? "التاجر" : "Merchant"}</span><select value={form.merchant_id || ""} onChange={(e) => update("merchant_id", e.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#061225]/80 px-4 py-3 text-white outline-none focus:border-brand-gold"><option value="">{isArabic ? "بدون تاجر محدد" : "No selected merchant"}</option>{merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.trade_name}</option>)}</select></label>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{fields.map(([key, ar, en, type]) => <label key={key} className="text-xs font-black text-white/70 space-y-2"><span>{isArabic ? ar : en}</span><input type={type || "text"} value={String(form[key] ?? "")} onChange={(e) => update(key, e.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#061225]/80 px-4 py-3 text-white outline-none focus:border-brand-gold" /></label>)}<label className="md:col-span-2 xl:col-span-3 text-xs font-black text-white/70 space-y-2"><span>{isArabic ? "ملاحظات" : "Notes"}</span><textarea value={form.notes || ""} onChange={(e) => update("notes", e.target.value)} className="min-h-28 w-full rounded-2xl border border-white/10 bg-[#061225]/80 px-4 py-3 text-white outline-none focus:border-brand-gold" /></label></div>
        <button type="button" onClick={() => void submit()} disabled={saving} className="mt-5 inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-brand-gold px-7 py-4 text-sm font-black text-brand-deep disabled:opacity-60"><PackagePlus className="h-4 w-4" />{saving && <Loader2 className="h-4 w-4 animate-spin" />}{isArabic ? "حفظ الطلب" : "Save order"}</button>
      </div>
    </section>
  );
}
