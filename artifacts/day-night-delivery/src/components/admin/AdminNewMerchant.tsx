import { useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Database,
  MapPin,
  Save,
  UserRound,
} from "lucide-react";
import {
  createOpsMerchant,
  type OpsDataSource,
  type OpsMerchantInput,
} from "../../lib/adminOperationsData";
import {
  UAE_LOCATIONS,
  getAreasForEmirate,
  getDefaultAreaForEmirate,
} from "../../data/uaeLocations";
import type { Merchant } from "../../types";

const emptyMerchant: OpsMerchantInput = {
  owner_name: "",
  trade_name: "",
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

function sourceLabel(
  source: OpsDataSource | "pending" | "none",
  isArabic: boolean,
) {
  if (source === "rpc")
    return isArabic
      ? "تم الحفظ عبر إجراء قاعدة البيانات الإنتاجي"
      : "Saved through production database procedure";
  if (source === "db")
    return isArabic
      ? "تم الحفظ مباشرة في جدول التجار"
      : "Saved directly to merchants table";
  if (source === "pending")
    return isArabic ? "بانتظار الحفظ" : "Waiting to save";
  return isArabic ? "لم يتم الحفظ بعد" : "Not saved yet";
}

function optionalLabel(label: string, isArabic: boolean) {
  return isArabic ? `${label} — اختياري` : `${label} — Optional`;
}

export default function AdminNewMerchant({
  isArabic,
  onSaved,
}: {
  isArabic: boolean;
  onSaved?: (merchant: Merchant) => void;
}) {
  const [form, setForm] = useState<OpsMerchantInput>(emptyMerchant);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [source, setSource] =
    useState<OpsDataSource | "pending" | "none">("none");

  const areas = useMemo(
    () => getAreasForEmirate(form.emirate),
    [form.emirate],
  );

  function setField<K extends keyof OpsMerchantInput>(
    key: K,
    value: OpsMerchantInput[K],
  ) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setSource("pending");
    setMessage("");
    setError("");
  }

  function chooseEmirate(value: string) {
    const firstArea = getDefaultAreaForEmirate(value);
    setForm((previous) => ({
      ...previous,
      emirate: value,
      city: firstArea,
      area: firstArea,
    }));
    setSource("pending");
  }

  function chooseArea(value: string) {
    setForm((previous) => ({ ...previous, city: value, area: value }));
    setSource("pending");
  }

  function validate() {
    const ownerName = String(form.owner_name || "").trim();
    const tradeName = String(form.trade_name || "").trim();
    const phone = String(form.phone || "").trim();
    const email = String(form.email || "").trim();

    if (!ownerName)
      return isArabic ? "اسم المالك مطلوب." : "Owner name is required.";
    if (!tradeName)
      return isArabic
        ? "اسم المتجر أو نوع النشاط مطلوب."
        : "Store name or business type is required.";
    if (!phone)
      return isArabic
        ? "رقم الهاتف الأساسي مطلوب."
        : "Primary phone is required.";
    if (!String(form.emirate || "").trim())
      return isArabic ? "الإمارة مطلوبة." : "Emirate is required.";
    if (!String(form.area || form.city || "").trim())
      return isArabic ? "المنطقة مطلوبة." : "Area is required.";
    if (email && !/^\S+@\S+\.\S+$/.test(email))
      return isArabic
        ? "صيغة البريد الإلكتروني غير صحيحة."
        : "Email format is invalid.";
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
      setMessage(
        isArabic
          ? `تم حفظ صاحب المتجر ${saved.owner_name || ""} وربط نشاط ${saved.trade_name} بقاعدة البيانات. الكود: ${saved.merchant_code || "بدون كود"}`
          : `Owner ${saved.owner_name || ""} and business ${saved.trade_name} were saved to the database. Code: ${saved.merchant_code || "no code"}`,
      );
      setForm(emptyMerchant);
      onSaved?.(saved);
    } catch (cause) {
      setSource("none");
      setError(String((cause as Error).message || cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-[2rem] border border-brand-sky/20 bg-white/[0.045] p-5 shadow-2xl shadow-black/20"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-gold/35 bg-brand-gold/10 text-brand-gold">
            <Building2 className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-xl font-black text-white">
              {isArabic
                ? "إضافة تاجر — اسم المالك أولاً"
                : "Create merchant — owner name first"}
            </h2>
            <p className="mt-1 max-w-3xl text-xs font-bold leading-6 text-white/55">
              {isArabic
                ? "الترتيب الصحيح: اسم المالك، ثم اسم المتجر أو نوع النشاط، ثم الهاتف والموقع. باقي البيانات اختيارية."
                : "Correct order: owner name, then store name or business type, followed by phone and location. All remaining fields are optional."}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-xs font-black text-emerald-200">
          <Database className="h-4 w-4" />
          {sourceLabel(source, isArabic)}
        </span>
      </div>

      {message && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm font-bold text-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm font-bold text-rose-200">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-brand-gold/20 bg-brand-gold/5 px-4 py-3">
        <p className="text-xs font-black text-brand-gold">
          {isArabic
            ? "البيانات الأساسية المطلوبة"
            : "Required core details"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-1">
          <span className="flex items-center gap-2 text-xs font-black text-white/60">
            <UserRound className="h-4 w-4 text-brand-gold" />
            {isArabic ? "اسم المالك *" : "Owner name *"}
          </span>
          <input
            className={inputClass()}
            value={form.owner_name || ""}
            onChange={(event) => setField("owner_name", event.target.value)}
            placeholder={isArabic ? "مثال: محمد أحمد" : "Example: Mohamed Ahmed"}
            required
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-black text-white/60">
            {isArabic
              ? "اسم المتجر أو نوع النشاط *"
              : "Store name or business type *"}
          </span>
          <input
            className={inputClass()}
            value={form.trade_name}
            onChange={(event) => setField("trade_name", event.target.value)}
            placeholder={
              isArabic
                ? "مثال: زهرة العود أو عطور"
                : "Example: Zahret Al Oud or Perfumes"
            }
            required
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-black text-white/60">
            {isArabic ? "الهاتف الأساسي *" : "Primary phone *"}
          </span>
          <input
            dir="ltr"
            className={inputClass()}
            value={form.phone}
            onChange={(event) => setField("phone", event.target.value)}
            required
          />
        </label>

        <div className="rounded-[1.5rem] border border-brand-gold/15 bg-brand-gold/5 p-3 md:col-span-2 xl:col-span-3">
          <p className="mb-3 flex items-center gap-2 text-xs font-black text-brand-gold">
            <MapPin className="h-4 w-4" />
            {isArabic
              ? "موقع التاجر والاستلام"
              : "Merchant and pickup location"}
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs font-black text-white/60">
                {isArabic ? "الإمارة *" : "Emirate *"}
              </span>
              <select
                className={inputClass()}
                value={form.emirate || "Abu Dhabi"}
                onChange={(event) => chooseEmirate(event.target.value)}
              >
                {UAE_LOCATIONS.map((location) => (
                  <option key={location.value} value={location.value}>
                    {isArabic ? location.ar : location.en}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-black text-white/60">
                {isArabic ? "المنطقة *" : "Area *"}
              </span>
              <select
                className={inputClass()}
                value={form.area || form.city || ""}
                onChange={(event) => chooseArea(event.target.value)}
              >
                {areas.map((area) => (
                  <option key={area.value} value={area.value}>
                    {isArabic ? area.ar : area.en}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-black text-white/60">
                {optionalLabel(
                  isArabic ? "الشارع أو الحي" : "Street or neighborhood",
                  isArabic,
                )}
              </span>
              <input
                className={inputClass()}
                value={form.street_details || ""}
                onChange={(event) =>
                  setField("street_details", event.target.value)
                }
              />
            </label>
          </div>
        </div>
      </div>

      <details className="mt-4 rounded-[1.5rem] border border-white/10 bg-black/10 p-4 text-white/70">
        <summary className="cursor-pointer text-sm font-black text-brand-gold">
          {isArabic
            ? "البيانات الاختيارية للتشغيل والحسابات"
            : "Optional operations and finance details"}
        </summary>
        <p className="mt-2 text-xs font-bold leading-6 text-white/45">
          {isArabic
            ? "يمكن ترك كل الخانات التالية فارغة واستكمالها لاحقاً من ملف التاجر."
            : "Every field below can be left empty and completed later from the merchant profile."}
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <input
            className={inputClass()}
            value={form.alt_phone || ""}
            onChange={(event) => setField("alt_phone", event.target.value)}
            placeholder={optionalLabel(
              isArabic ? "هاتف إضافي" : "Alternative phone",
              isArabic,
            )}
          />
          <input
            className={inputClass()}
            value={form.email || ""}
            onChange={(event) => setField("email", event.target.value)}
            placeholder={optionalLabel(
              isArabic ? "البريد الإلكتروني" : "Email",
              isArabic,
            )}
          />
          <input
            className={inputClass()}
            value={form.address || ""}
            onChange={(event) => setField("address", event.target.value)}
            placeholder={optionalLabel(
              isArabic ? "العنوان التفصيلي" : "Detailed address",
              isArabic,
            )}
          />
          <input
            className={inputClass()}
            value={form.pickup_address || ""}
            onChange={(event) =>
              setField("pickup_address", event.target.value)
            }
            placeholder={optionalLabel(
              isArabic ? "عنوان الاستلام" : "Pickup address",
              isArabic,
            )}
          />
          <input
            className={inputClass()}
            value={form.license_number || ""}
            onChange={(event) =>
              setField("license_number", event.target.value)
            }
            placeholder={optionalLabel(
              isArabic ? "الرخصة التجارية" : "Trade license",
              isArabic,
            )}
          />
          <input
            className={inputClass()}
            value={form.trn || ""}
            onChange={(event) => setField("trn", event.target.value)}
            placeholder={optionalLabel("TRN", isArabic)}
          />
          <input
            className={inputClass()}
            value={form.bank_name || ""}
            onChange={(event) => setField("bank_name", event.target.value)}
            placeholder={optionalLabel(
              isArabic ? "البنك" : "Bank",
              isArabic,
            )}
          />
          <input
            className={inputClass()}
            value={form.iban || ""}
            onChange={(event) => setField("iban", event.target.value)}
            placeholder={optionalLabel("IBAN", isArabic)}
          />
          <select
            className={inputClass()}
            value={form.settlement_cycle || ""}
            onChange={(event) =>
              setField("settlement_cycle", event.target.value)
            }
          >
            <option value="">
              {isArabic
                ? "دورة التسوية — اختياري"
                : "Settlement cycle — optional"}
            </option>
            {settlementOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {isArabic ? option.ar : option.en}
              </option>
            ))}
          </select>
          <select
            className={inputClass()}
            value={form.default_payment_method || ""}
            onChange={(event) =>
              setField("default_payment_method", event.target.value)
            }
          >
            <option value="">
              {isArabic
                ? "طريقة الدفع الافتراضية — اختياري"
                : "Default payment method — optional"}
            </option>
            {paymentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {isArabic ? option.ar : option.en}
              </option>
            ))}
          </select>
          <select
            className={inputClass()}
            value={form.status || "active"}
            onChange={(event) => setField("status", event.target.value)}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {isArabic ? option.ar : option.en}
              </option>
            ))}
          </select>
          <textarea
            rows={3}
            className={`${inputClass()} md:col-span-2 xl:col-span-3`}
            value={form.notes || ""}
            onChange={(event) => setField("notes", event.target.value)}
            placeholder={optionalLabel(
              isArabic ? "ملاحظات تشغيلية" : "Operations notes",
              isArabic,
            )}
          />
        </div>
      </details>

      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand-gold px-6 py-3 text-xs font-black text-brand-deep disabled:opacity-50"
        >
          {saving ? (
            <Database className="h-4 w-4 animate-pulse" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving
            ? isArabic
              ? "جارٍ الحفظ..."
              : "Saving..."
            : isArabic
              ? "حفظ صاحب المتجر"
              : "Save merchant owner"}
        </button>
      </div>
    </form>
  );
}
