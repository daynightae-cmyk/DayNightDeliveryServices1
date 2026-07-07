import { useState } from "react";
import { CheckCircle, Loader2, Store, XCircle } from "lucide-react";
import { createMerchant, type MerchantInput } from "../../lib/adminData";

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

const fields: Array<[keyof MerchantInput, string, string, string?]> = [
  ["trade_name", "اسم التاجر", "Trade name"],
  ["owner_name", "اسم المالك", "Owner name"],
  ["phone", "الهاتف", "Phone"],
  ["alt_phone", "هاتف بديل", "Alt phone"],
  ["email", "البريد الإلكتروني", "Email", "email"],
  ["emirate", "الإمارة", "Emirate"],
  ["city", "المدينة", "City"],
  ["address", "العنوان", "Address"],
  ["pickup_address", "عنوان الاستلام", "Pickup address"],
  ["license_number", "رقم الرخصة", "License number"],
  ["trn", "TRN", "TRN"],
  ["tax_number", "الرقم الضريبي", "Tax number"],
  ["logo_url", "رابط الشعار", "Logo URL", "url"],
  ["bank_name", "اسم البنك", "Bank name"],
  ["iban", "IBAN", "IBAN"],
  ["settlement_cycle", "دورة التسوية", "Settlement cycle"],
  ["commission_type", "نوع العمولة", "Commission type"],
  ["default_payment_method", "طريقة الدفع الافتراضية", "Default payment method"],
  ["status", "الحالة", "Status"],
];

export default function AdminNewMerchant({ isArabic, onSaved }: { isArabic: boolean; onSaved?: () => void }) {
  const [form, setForm] = useState<MerchantInput>(emptyMerchant);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  function update(key: keyof MerchantInput, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    setError("");
    setSuccess("");
    if (!form.trade_name.trim() || !form.phone.trim()) {
      setError(isArabic ? "اسم التاجر ورقم الهاتف مطلوبان." : "Trade name and phone are required.");
      return;
    }
    setSaving(true);
    try {
      await createMerchant(form);
      setForm(emptyMerchant);
      setSuccess(isArabic ? "تم حفظ التاجر وتحديث القائمة." : "Merchant saved and the list was refreshed.");
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : (isArabic ? "تعذر حفظ التاجر." : "Merchant could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="dn-admin-section-workspace" dir={isArabic ? "rtl" : "ltr"}>
      <header className="dn-admin-section-hero"><span>{isArabic ? "قاعدة البيانات الحية" : "Live database"}</span><h1>{isArabic ? "إضافة تاجر جديد" : "New Merchant"}</h1><p>{isArabic ? "نموذج آمن يحفظ التاجر في Supabase ويحدّث لوحة الإدارة مباشرة." : "Safe Supabase-backed form that refreshes the admin panel after saving."}</p></header>
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 sm:p-6 backdrop-blur-2xl">
        {success && <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-200"><CheckCircle className="h-4 w-4" />{success}</div>}
        {error && <div className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm font-bold text-rose-200"><XCircle className="h-4 w-4" />{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {fields.map(([key, ar, en, type]) => <label key={key} className="text-xs font-black text-white/70 space-y-2"><span>{isArabic ? ar : en}</span><input type={type || "text"} value={String(form[key] || "")} onChange={(e) => update(key, e.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#061225]/80 px-4 py-3 text-white outline-none focus:border-brand-gold" dir={key === "email" || key === "iban" || key === "logo_url" ? "ltr" : undefined} /></label>)}
          <label className="md:col-span-2 xl:col-span-3 text-xs font-black text-white/70 space-y-2"><span>{isArabic ? "ملاحظات" : "Notes"}</span><textarea value={form.notes || ""} onChange={(e) => update("notes", e.target.value)} className="min-h-28 w-full rounded-2xl border border-white/10 bg-[#061225]/80 px-4 py-3 text-white outline-none focus:border-brand-gold" /></label>
        </div>
        <button type="button" onClick={() => void submit()} disabled={saving} className="mt-5 inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-brand-gold px-7 py-4 text-sm font-black text-brand-deep disabled:opacity-60"><Store className="h-4 w-4" />{saving && <Loader2 className="h-4 w-4 animate-spin" />}{isArabic ? "حفظ التاجر" : "Save merchant"}</button>
      </div>
    </section>
  );
}
