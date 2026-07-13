import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, Building2, CheckCircle2, Database, MapPin, Save } from "lucide-react";
import { createOpsMerchant, type OpsDataSource, type OpsMerchantInput } from "../../lib/adminOperationsData";
import { UAE_LOCATIONS, getAreasForEmirate, getDefaultAreaForEmirate } from "../../data/uaeLocations";
import type { Merchant } from "../../types";

const emptyMerchant: OpsMerchantInput = {
  trade_name: "",
  owner_name: "",
  phone: "",
  alt_phone: "",
  email: "",
  emirate: "Abu Dhabi",
  city: "Mussafah",
  area: "Mussafah",
  street_details: "",
  address: "",
  pickup_address: "",
  license_number: "",
  trn: "",
  tax_number: "",
  logo_url: "",
  bank_name: "",
  iban: "",
  settlement_cycle: "",
  commission_type: "fixed_delivery_fee",
  default_payment_method: "",
  notes: "",
  status: "active",
};

const settlementOptions = [
  { value: "daily", ar: "يومي", en: "Daily" },
  { value: "weekly", ar: "أسبوعي", en: "Weekly" },
  { value: "monthly", ar: "شهري", en: "Monthly" },
  { value: "on_demand", ar: "عند الطلب", en: "On demand" },
];

const paymentOptions = [
  { value: "sender_pays", ar: "المرسل يدفع", en: "Sender pays" },
  { value: "receiver_pays", ar: "المستلم يدفع", en: "Receiver pays" },
  { value: "cod", ar: "تحصيل عند التسليم", en: "Collect on delivery" },
];

const statusOptions = [
  { value: "active", ar: "نشط", en: "Active" },
  { value: "review", ar: "قيد المراجعة", en: "Under review" },
  { value: "paused", ar: "متوقف مؤقتًا", en: "Paused" },
];

function inputClass() {
  return "w-full rounded-2xl border border-brand-sky/20 bg-brand-deep/75 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-white/30 focus:border-brand-gold/70 focus:ring-2 focus:ring-brand-gold/15";
}

function sourceLabel(source: OpsDataSource | "pending" | "none", isArabic: boolean) {
  if (source === "rpc") return isArabic ? "تم الحفظ عبر إجراء قاعدة البيانات الإنتاجي" : "Saved through production database procedure";
  if (source === "db") return isArabic ? "تم الحفظ مباشرة في جدول التجار" : "Saved directly to merchants table";
  if (source === "pending") return isArabic ? "بانتظار الحفظ" : "Waiting to save";
  return isArabic ? "لم يتم الحفظ بعد" : "Not saved yet";
}

function optionalLabel(label: string, isArabic: boolean) {
  return isArabic ? `${label} — اختياري` : `${label} — Optional`;
}

function optionLabel(option: { ar: string; en: string }, isArabic: boolean) {
  return isArabic ? option.ar : option.en;
}

export default function AdminNewMerchant({ isArabic, onSaved }: { isArabic: boolean; onSaved?: (merchant: Merchant) => void }) {
  const [form, setForm] = useState<OpsMerchantInput>(emptyMerchant);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [source, setSource] = useState<OpsDataSource | "pending" | "none">("none");

  const areas = useMemo(() => getAreasForEmirate(form.emirate), [form.emirate]);

  function setField<K extends keyof OpsMerchantInput>(key: K, value: OpsMerchantInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSource("pending");
  }

  function chooseEmirate(value: string) {
    const firstArea = getDefaultAreaForEmirate(value);
    setForm((prev) => ({ ...prev, emirate: value, city: firstArea, area: firstArea }));
    setSource("pending");
  }

  function chooseArea(value: string) {
    setForm((prev) => ({ ...prev, city: value, area: value }));
    setSource("pending");
  }

  function validate() {
    const email = String(form.email || "").trim();
    if (!form.trade_name.trim()) return isArabic ? "اسم المتجر مطلوب." : "Trade name is required.";
    if (!form.phone.trim()) return isArabic ? "رقم الهاتف الأساسي مطلوب." : "Primary phone is required.";
    if (!String(form.emirate || "").trim()) return isArabic ? "الإمارة مطلوبة." : "Emirate is required.";
    if (!String(form.area || form.city || "").trim()) return isArabic ? "المنطقة مطلوبة." : "Area is required.";
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return isArabic ? "صيغة البريد الإلكتروني غير صحيحة." : "Email format is invalid.";
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
      const result = await createOpsMerchant(form);
      const saved = result.row;
      setSource(result.source);
      setMessage(isArabic ? `تم حفظ التاجر وربطه بقاعدة البيانات: ${saved.trade_name} · ${saved.merchant_code || "بدون كود"}` : `Live merchant saved and linked to database: ${saved.trade_name} · ${saved.merchant_code || "no code"}`);
      setForm(emptyMerchant);
      onSaved?.(saved);
    } catch (err) {
      setSource("none");
      setError(String((err as Error).message || err));
    } finally {
      setSaving(false);
    }
  }

  const labels = {
    title: isArabic ? "إضافة تاجر إنتاجي متصل بقاعدة البيانات" : "Create live database-backed merchant",
    hint: isArabic
      ? "المطلوب فقط: اسم المتجر والهاتف الأساسي والإمارة والمنطقة. باقي بيانات التاجر المالية والتشغيلية اختيارية بالكامل."
      : "Required only: trade name, primary phone, emirate, and area. All other finance and operations fields are optional.",
    save: saving ? (isArabic ? "جارٍ الحفظ في قاعدة البيانات..." : "Saving to database...") : (isArabic ? "حفظ التاجر في قاعدة البيانات" : "Save merchant to database"),
    requiredSection: isArabic ? "بيانات أساسية مطلوبة" : "Required core details",
    optionalSection: isArabic ? "بيانات اختيارية للتشغيل والحسابات" : "Optional operations and finance details",
    optionalHint: isArabic
      ? "يمكن ترك هذه الخانات فارغة الآن واستكمالها لاحقًا من ملف التاجر. لا يتم منع حفظ التاجر بسببها."
      : "These fields can be left empty now and completed later from the merchant profile. They do not block saving.",
    tradeName: isArabic ? "اسم المتجر *" : "Trade name *",
    owner: isArabic ? "اسم المالك" : "Owner name",
    phone: isArabic ? "الهاتف الأساسي *" : "Primary phone *",
    altPhone: optionalLabel(isArabic ? "هاتف إضافي" : "Alt phone", isArabic),
    email: optionalLabel(isArabic ? "البريد الإلكتروني" : "Email", isArabic),
    emirate: isArabic ? "الإمارة *" : "Emirate *",
    area: isArabic ? "المنطقة *" : "Area *",
    streetDetails: optionalLabel(isArabic ? "الشارع أو الحي أو رقم الفيلا" : "Street, neighborhood, or villa", isArabic),
    address: optionalLabel(isArabic ? "العنوان التفصيلي" : "Detailed address", isArabic),
    pickupAddress: optionalLabel(isArabic ? "عنوان الاستلام" : "Pickup address", isArabic),
    license: optionalLabel(isArabic ? "الرخصة التجارية" : "Trade license", isArabic),
    bank: optionalLabel(isArabic ? "البنك" : "Bank", isArabic),
    settlement: optionalLabel(isArabic ? "دورة التسوية" : "Settlement cycle", isArabic),
    settlementDefault: isArabic ? "اختياري — الافتراضي: أسبوعي" : "Optional — default: Weekly",
    defaultPayment: optionalLabel(isArabic ? "طريقة الدفع الافتراضية" : "Default payment method", isArabic),
    defaultPaymentDefault: isArabic ? "اختياري — الافتراضي: المرسل يدفع" : "Optional — default: Sender pays",
    status: isArabic ? "حالة الحساب" : "Account status",
    notes: optionalLabel(isArabic ? "ملاحظات تشغيلية" : "Operations notes", isArabic),
    logo: optionalLabel(isArabic ? "رابط الشعار" : "Logo URL", isArabic),
    trn: optionalLabel("TRN", isArabic),
    iban: optionalLabel("IBAN", isArabic),
  };

  return (
    <form onSubmit={submit} className="rounded-[2rem] border border-brand-sky/20 bg-white/[0.045] p-5 shadow-2xl shadow-black/20" dir={isArabic ? "rtl" : "ltr"}>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-gold/35 bg-brand-gold/10 text-brand-gold">
            <Building2 className="h-6 w-6" />
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

      <div className="mb-4 rounded-2xl border border-brand-gold/20 bg-brand-gold/5 px-4 py-3">
        <p className="text-xs font-black text-brand-gold">{labels.requiredSection}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.tradeName}</span><input className={inputClass()} value={form.trade_name} onChange={(event) => setField("trade_name", event.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.owner}</span><input className={inputClass()} value={form.owner_name || ""} onChange={(event) => setField("owner_name", event.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.phone}</span><input dir="ltr" className={inputClass()} value={form.phone} onChange={(event) => setField("phone", event.target.value)} /></label>

        <div className="rounded-[1.5rem] border border-brand-gold/15 bg-brand-gold/5 p-3 md:col-span-2 xl:col-span-3">
          <p className="mb-3 flex items-center gap-2 text-xs font-black text-brand-gold"><MapPin className="h-4 w-4" />{isArabic ? "موقع التاجر والاستلام" : "Merchant and pickup location"}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.emirate}</span><select className={inputClass()} value={form.emirate || "Abu Dhabi"} onChange={(event) => chooseEmirate(event.target.value)}>{UAE_LOCATIONS.map((item) => <option key={item.value} value={item.value}>{optionLabel(item, isArabic)}</option>)}</select></label>
            <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.area}</span><select className={inputClass()} value={form.area || form.city || ""} onChange={(event) => chooseArea(event.target.value)}>{areas.map((area) => <option key={area.value} value={area.value}>{optionLabel(area, isArabic)}</option>)}</select></label>
            <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.streetDetails}</span><input className={inputClass()} value={form.street_details || ""} onChange={(event) => setField("street_details", event.target.value)} placeholder={isArabic ? "شارع، حي، بناية، فيلا" : "Street, district, building, villa"} /></label>
          </div>
        </div>

        <label className="space-y-1 md:col-span-2"><span className="text-xs font-black text-white/60">{labels.address}</span><input className={inputClass()} value={form.address || ""} onChange={(event) => setField("address", event.target.value)} /></label>
      </div>

      <div className="my-5 rounded-2xl border border-brand-sky/15 bg-brand-deep/35 px-4 py-3">
        <p className="text-xs font-black text-brand-gold">{labels.optionalSection}</p>
        <p className="mt-1 text-[11px] font-bold leading-5 text-white/45">{labels.optionalHint}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.altPhone}</span><input dir="ltr" className={inputClass()} value={form.alt_phone || ""} onChange={(event) => setField("alt_phone", event.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.email}</span><input dir="ltr" className={inputClass()} value={form.email || ""} onChange={(event) => setField("email", event.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.logo}</span><input dir="ltr" className={inputClass()} value={form.logo_url || ""} onChange={(event) => setField("logo_url", event.target.value)} /></label>
        <label className="space-y-1 md:col-span-2"><span className="text-xs font-black text-white/60">{labels.pickupAddress}</span><input className={inputClass()} value={form.pickup_address || ""} onChange={(event) => setField("pickup_address", event.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.license}</span><input className={inputClass()} value={form.license_number || ""} onChange={(event) => setField("license_number", event.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.trn}</span><input className={inputClass()} value={form.trn || ""} onChange={(event) => { setField("trn", event.target.value); setField("tax_number", event.target.value); }} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.iban}</span><input dir="ltr" className={inputClass()} value={form.iban || ""} onChange={(event) => setField("iban", event.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.bank}</span><input className={inputClass()} value={form.bank_name || ""} onChange={(event) => setField("bank_name", event.target.value)} /></label>

        <label className="space-y-1">
          <span className="text-xs font-black text-white/60">{labels.settlement}</span>
          <select className={inputClass()} value={form.settlement_cycle || ""} onChange={(event) => setField("settlement_cycle", event.target.value)}>
            <option value="">{labels.settlementDefault}</option>
            {settlementOptions.map((item) => <option key={item.value} value={item.value}>{optionLabel(item, isArabic)}</option>)}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-black text-white/60">{labels.defaultPayment}</span>
          <select className={inputClass()} value={form.default_payment_method || ""} onChange={(event) => setField("default_payment_method", event.target.value)}>
            <option value="">{labels.defaultPaymentDefault}</option>
            {paymentOptions.map((item) => <option key={item.value} value={item.value}>{optionLabel(item, isArabic)}</option>)}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-black text-white/60">{labels.status}</span>
          <select className={inputClass()} value={form.status || "active"} onChange={(event) => setField("status", event.target.value)}>
            {statusOptions.map((item) => <option key={item.value} value={item.value}>{optionLabel(item, isArabic)}</option>)}
          </select>
        </label>

        <label className="space-y-1 md:col-span-2 xl:col-span-3"><span className="text-xs font-black text-white/60">{labels.notes}</span><textarea className={`${inputClass()} min-h-24`} value={form.notes || ""} onChange={(event) => setField("notes", event.target.value)} /></label>
      </div>

      <button type="submit" disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-brand-gold px-5 py-3 text-sm font-black text-brand-deep transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
        <Save className="h-4 w-4" />
        {labels.save}
      </button>
    </form>
  );
}
