import { useState, type FormEvent } from "react";
import { Building2, Save } from "lucide-react";
import { createMerchant, type MerchantInput } from "../../lib/adminData";
import type { Merchant } from "../../types";

const emptyMerchant: MerchantInput = {
  trade_name: "",
  owner_name: "",
  phone: "",
  alt_phone: "",
  email: "",
  emirate: "Abu Dhabi",
  city: "Abu Dhabi",
  address: "",
  pickup_address: "",
  license_number: "",
  trn: "",
  tax_number: "",
  logo_url: "",
  bank_name: "",
  iban: "",
  settlement_cycle: "weekly",
  commission_type: "fixed_delivery_fee",
  default_payment_method: "sender_pays",
  notes: "",
  status: "active",
};

const emirates = [
  { value: "Abu Dhabi", ar: "أبوظبي", en: "Abu Dhabi" },
  { value: "Dubai", ar: "دبي", en: "Dubai" },
  { value: "Sharjah", ar: "الشارقة", en: "Sharjah" },
  { value: "Ajman", ar: "عجمان", en: "Ajman" },
  { value: "Umm Al Quwain", ar: "أم القيوين", en: "Umm Al Quwain" },
  { value: "Ras Al Khaimah", ar: "رأس الخيمة", en: "Ras Al Khaimah" },
  { value: "Fujairah", ar: "الفجيرة", en: "Fujairah" },
];

const settlementOptions = [
  { value: "daily", ar: "يومي", en: "Daily" },
  { value: "weekly", ar: "أسبوعي", en: "Weekly" },
  { value: "monthly", ar: "شهري", en: "Monthly" },
  { value: "on_demand", ar: "عند الطلب", en: "On demand" },
];

const paymentOptions = [
  { value: "sender_pays", ar: "المرسل يدفع", en: "Sender pays" },
  { value: "receiver_pays", ar: "المستلم يدفع", en: "Receiver pays" },
  { value: "cod", ar: "تحصيل عند التسليم COD", en: "COD" },
];

const statusOptions = [
  { value: "active", ar: "نشط", en: "Active" },
  { value: "review", ar: "قيد المراجعة", en: "Review" },
  { value: "paused", ar: "متوقف مؤقتاً", en: "Paused" },
];

function inputClass() {
  return "w-full rounded-2xl border border-white/10 bg-brand-deep/70 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-brand-gold/60";
}

function cleanError(error: unknown, isArabic: boolean) {
  const message = String((error as Error)?.message || error || "");
  console.warn("Merchant save failed:", message);
  return isArabic
    ? "تعذر حفظ التاجر حالياً. راجع الصلاحيات أو الجداول بدون عرض تفاصيل تقنية للمستخدم."
    : "Could not save merchant right now. Check permissions or tables; technical details are hidden from the user.";
}

export default function AdminNewMerchant({ isArabic, onSaved }: { isArabic: boolean; onSaved?: (merchant: Merchant) => void }) {
  const [form, setForm] = useState<MerchantInput>(emptyMerchant);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function setField<K extends keyof MerchantInput>(key: K, value: MerchantInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!form.trade_name.trim() || !form.phone.trim()) {
      setError(isArabic ? "اسم التاجر ورقم الهاتف مطلوبان." : "Trade name and phone are required.");
      return;
    }

    setSaving(true);
    try {
      const saved = await createMerchant(form);
      setMessage(isArabic ? `تم حفظ التاجر ${saved.merchant_code || ""}` : `Merchant saved ${saved.merchant_code || ""}`);
      setForm(emptyMerchant);
      onSaved?.(saved);
    } catch (err) {
      setError(cleanError(err, isArabic));
    } finally {
      setSaving(false);
    }
  }

  const labels = {
    title: isArabic ? "إضافة تاجر حقيقي" : "Create live merchant",
    hint: isArabic
      ? "يحفظ مباشرة في جدول التجار مع حماية البيانات الحساسة داخل الإدارة."
      : "Saves directly to the merchants table with sensitive data kept in admin-only views.",
    save: saving ? (isArabic ? "جاري الحفظ..." : "Saving...") : (isArabic ? "حفظ التاجر" : "Save merchant"),
    tradeName: isArabic ? "اسم المتجر *" : "Trade name *",
    owner: isArabic ? "اسم المالك" : "Owner",
    phone: isArabic ? "الهاتف *" : "Phone *",
    altPhone: isArabic ? "هاتف إضافي" : "Alt phone",
    email: isArabic ? "البريد الإلكتروني" : "Email",
    emirate: isArabic ? "الإمارة" : "Emirate",
    city: isArabic ? "المدينة" : "City",
    address: isArabic ? "العنوان" : "Address",
    pickupAddress: isArabic ? "عنوان الاستلام" : "Pickup address",
    license: isArabic ? "الرخصة التجارية (محمي)" : "License (protected)",
    bank: isArabic ? "البنك" : "Bank",
    settlement: isArabic ? "دورة التسوية" : "Settlement",
    defaultPayment: isArabic ? "الدفع الافتراضي" : "Default payment",
    status: isArabic ? "الحالة" : "Status",
    notes: isArabic ? "ملاحظات" : "Notes",
    logo: isArabic ? "الشعار (اختياري)" : "Logo URL (optional)",
  };

  return (
    <form onSubmit={submit} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20" dir={isArabic ? "rtl" : "ltr"}>
      <div className="mb-5 flex items-center gap-3">
        <Building2 className="h-7 w-7 text-brand-gold" />
        <div>
          <h2 className="text-xl font-black text-white">{labels.title}</h2>
          <p className="text-xs font-bold text-white/50">{labels.hint}</p>
        </div>
      </div>

      {message && <div className="mb-4 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm font-bold text-emerald-200">{message}</div>}
      {error && <div className="mb-4 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm font-bold text-rose-200">{error}</div>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.tradeName}</span><input className={inputClass()} value={form.trade_name} onChange={(e) => setField("trade_name", e.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.owner}</span><input className={inputClass()} value={form.owner_name || ""} onChange={(e) => setField("owner_name", e.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.phone}</span><input dir="ltr" className={inputClass()} value={form.phone} onChange={(e) => setField("phone", e.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.altPhone}</span><input dir="ltr" className={inputClass()} value={form.alt_phone || ""} onChange={(e) => setField("alt_phone", e.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.email}</span><input dir="ltr" className={inputClass()} value={form.email || ""} onChange={(e) => setField("email", e.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.logo}</span><input dir="ltr" className={inputClass()} value={form.logo_url || ""} onChange={(e) => setField("logo_url", e.target.value)} /></label>

        <label className="space-y-1">
          <span className="text-xs font-black text-white/60">{labels.emirate}</span>
          <select className={inputClass()} value={form.emirate || ""} onChange={(e) => setField("emirate", e.target.value)}>
            {emirates.map((item) => <option key={item.value} value={item.value}>{isArabic ? item.ar : item.en}</option>)}
          </select>
        </label>

        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.city}</span><input className={inputClass()} value={form.city || ""} onChange={(e) => setField("city", e.target.value)} /></label>
        <label className="space-y-1 md:col-span-2"><span className="text-xs font-black text-white/60">{labels.address}</span><input className={inputClass()} value={form.address || ""} onChange={(e) => setField("address", e.target.value)} /></label>
        <label className="space-y-1 md:col-span-2"><span className="text-xs font-black text-white/60">{labels.pickupAddress}</span><input className={inputClass()} value={form.pickup_address || ""} onChange={(e) => setField("pickup_address", e.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-brand-gold">{labels.license}</span><input className={inputClass()} value={form.license_number || ""} onChange={(e) => setField("license_number", e.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-brand-gold">TRN</span><input className={inputClass()} value={form.trn || ""} onChange={(e) => { setField("trn", e.target.value); setField("tax_number", e.target.value); }} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-brand-gold">IBAN</span><input dir="ltr" className={inputClass()} value={form.iban || ""} onChange={(e) => setField("iban", e.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.bank}</span><input className={inputClass()} value={form.bank_name || ""} onChange={(e) => setField("bank_name", e.target.value)} /></label>

        <label className="space-y-1">
          <span className="text-xs font-black text-white/60">{labels.settlement}</span>
          <select className={inputClass()} value={form.settlement_cycle || "weekly"} onChange={(e) => setField("settlement_cycle", e.target.value)}>
            {settlementOptions.map((item) => <option key={item.value} value={item.value}>{isArabic ? item.ar : item.en}</option>)}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-black text-white/60">{labels.defaultPayment}</span>
          <select className={inputClass()} value={form.default_payment_method || "sender_pays"} onChange={(e) => setField("default_payment_method", e.target.value)}>
            {paymentOptions.map((item) => <option key={item.value} value={item.value}>{isArabic ? item.ar : item.en}</option>)}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-black text-white/60">{labels.status}</span>
          <select className={inputClass()} value={form.status || "active"} onChange={(e) => setField("status", e.target.value)}>
            {statusOptions.map((item) => <option key={item.value} value={item.value}>{isArabic ? item.ar : item.en}</option>)}
          </select>
        </label>

        <label className="space-y-1 md:col-span-2 xl:col-span-3"><span className="text-xs font-black text-white/60">{labels.notes}</span><textarea className={`${inputClass()} min-h-24`} value={form.notes || ""} onChange={(e) => setField("notes", e.target.value)} /></label>
      </div>

      <button type="submit" disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-brand-gold px-5 py-3 text-sm font-black text-brand-deep disabled:opacity-60">
        <Save className="h-4 w-4" />
        {labels.save}
      </button>
    </form>
  );
}
