import { useState } from "react";
import { Building2, Save } from "lucide-react";
import { createMerchant, type MerchantInput } from "../../lib/adminData";
import type { Merchant } from "../../types";

const emptyMerchant: MerchantInput = {
  trade_name: "", owner_name: "", phone: "", alt_phone: "", email: "", emirate: "Abu Dhabi", city: "Abu Dhabi", address: "", pickup_address: "",
  license_number: "", trn: "", tax_number: "", logo_url: "", bank_name: "", iban: "", settlement_cycle: "weekly", commission_type: "fixed_delivery_fee",
  default_payment_method: "sender_pays", notes: "", status: "active",
};

const emirates = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];

function inputClass() {
  return "w-full rounded-2xl border border-white/10 bg-brand-deep/70 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-brand-gold/60";
}

export default function AdminNewMerchant({ isArabic, onSaved }: { isArabic: boolean; onSaved?: (merchant: Merchant) => void }) {
  const [form, setForm] = useState<MerchantInput>(emptyMerchant);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function setField<K extends keyof MerchantInput>(key: K, value: MerchantInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
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
      setError(String((err as Error).message || err));
    } finally {
      setSaving(false);
    }
  }

  const labels = {
    title: isArabic ? "إضافة تاجر حقيقي" : "Create live merchant",
    hint: isArabic ? "يحفظ مباشرة في جدول merchants مع حماية البيانات الحساسة داخل الإدارة." : "Saves directly to the merchants table with sensitive data kept in admin-only views.",
    save: saving ? (isArabic ? "جاري الحفظ..." : "Saving...") : (isArabic ? "حفظ التاجر" : "Save merchant"),
  };

  return (
    <form onSubmit={submit} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20" dir={isArabic ? "rtl" : "ltr"}>
      <div className="mb-5 flex items-center gap-3"><Building2 className="h-7 w-7 text-brand-gold" /><div><h2 className="text-xl font-black text-white">{labels.title}</h2><p className="text-xs font-bold text-white/50">{labels.hint}</p></div></div>
      {message && <div className="mb-4 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm font-bold text-emerald-200">{message}</div>}
      {error && <div className="mb-4 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm font-bold text-rose-200">{error}</div>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{isArabic ? "اسم المتجر *" : "Trade name *"}</span><input className={inputClass()} value={form.trade_name} onChange={(e) => setField("trade_name", e.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{isArabic ? "اسم المالك" : "Owner"}</span><input className={inputClass()} value={form.owner_name || ""} onChange={(e) => setField("owner_name", e.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{isArabic ? "الهاتف *" : "Phone *"}</span><input dir="ltr" className={inputClass()} value={form.phone} onChange={(e) => setField("phone", e.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{isArabic ? "هاتف إضافي" : "Alt phone"}</span><input dir="ltr" className={inputClass()} value={form.alt_phone || ""} onChange={(e) => setField("alt_phone", e.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">Email</span><input dir="ltr" className={inputClass()} value={form.email || ""} onChange={(e) => setField("email", e.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{isArabic ? "الإمارة" : "Emirate"}</span><select className={inputClass()} value={form.emirate || ""} onChange={(e) => setField("emirate", e.target.value)}>{emirates.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{isArabic ? "المدينة" : "City"}</span><input className={inputClass()} value={form.city || ""} onChange={(e) => setField("city", e.target.value)} /></label>
        <label className="space-y-1 md:col-span-2"><span className="text-xs font-black text-white/60">{isArabic ? "العنوان" : "Address"}</span><input className={inputClass()} value={form.address || ""} onChange={(e) => setField("address", e.target.value)} /></label>
        <label className="space-y-1 md:col-span-2"><span className="text-xs font-black text-white/60">{isArabic ? "عنوان الاستلام" : "Pickup address"}</span><input className={inputClass()} value={form.pickup_address || ""} onChange={(e) => setField("pickup_address", e.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-brand-gold">{isArabic ? "الرخصة (محمي)" : "License (protected)"}</span><input className={inputClass()} value={form.license_number || ""} onChange={(e) => setField("license_number", e.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-brand-gold">TRN</span><input className={inputClass()} value={form.trn || ""} onChange={(e) => { setField("trn", e.target.value); setField("tax_number", e.target.value); }} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-brand-gold">IBAN</span><input dir="ltr" className={inputClass()} value={form.iban || ""} onChange={(e) => setField("iban", e.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{isArabic ? "البنك" : "Bank"}</span><input className={inputClass()} value={form.bank_name || ""} onChange={(e) => setField("bank_name", e.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{isArabic ? "دورة التسوية" : "Settlement"}</span><select className={inputClass()} value={form.settlement_cycle || "weekly"} onChange={(e) => setField("settlement_cycle", e.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="on_demand">On demand</option></select></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{isArabic ? "الدفع الافتراضي" : "Default payment"}</span><select className={inputClass()} value={form.default_payment_method || "sender_pays"} onChange={(e) => setField("default_payment_method", e.target.value)}><option value="sender_pays">Sender pays</option><option value="receiver_pays">Receiver pays</option><option value="cod">COD</option></select></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{isArabic ? "الحالة" : "Status"}</span><select className={inputClass()} value={form.status || "active"} onChange={(e) => setField("status", e.target.value)}><option value="active">Active</option><option value="review">Review</option><option value="paused">Paused</option></select></label>
        <label className="space-y-1 md:col-span-2 xl:col-span-3"><span className="text-xs font-black text-white/60">{isArabic ? "ملاحظات" : "Notes"}</span><textarea className={`${inputClass()} min-h-24`} value={form.notes || ""} onChange={(e) => setField("notes", e.target.value)} /></label>
      </div>
      <button type="submit" disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-brand-gold px-5 py-3 text-sm font-black text-brand-deep disabled:opacity-60"><Save className="h-4 w-4" />{labels.save}</button>
    </form>
  );
}
