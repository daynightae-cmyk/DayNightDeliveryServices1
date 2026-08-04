import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Save, UserRound } from "lucide-react";
import {
  UAE_LOCATIONS,
  type LocalizedOption,
  type UaeLocation,
} from "../../data/uaeLocations";
import { formatAdminMoney } from "../../lib/adminLocale";
import { adminOrderActionFeedback } from "../../lib/adminOrderActionFeedback";
import {
  PERSONAL_ORDER_DELIVERY_FEE,
  calculatePersonalOrderFinancials,
  createPersonalOpsOrder,
  type PersonalOrderInput,
} from "../../lib/personalOrderOperations";
import type { Order } from "../../types";

const otherAlAinArea: LocalizedOption = {
  value: "Other Al Ain Area",
  ar: "منطقة أخرى في العين",
  en: "Other Al Ain area",
};

const AL_AIN_AREAS: LocalizedOption[] = [
  { value: "Al Ain Central District", ar: "وسط مدينة العين", en: "Al Ain Central District" },
  { value: "Al Jimi", ar: "الجيمي", en: "Al Jimi" },
  { value: "Al Mutaredh", ar: "المطارد", en: "Al Mutaredh" },
  { value: "Al Muwaiji", ar: "المويجعي", en: "Al Muwaiji" },
  { value: "Al Hili", ar: "الهيلي", en: "Al Hili" },
  { value: "Al Foah", ar: "الفوعة", en: "Al Foah" },
  { value: "Al Towayya", ar: "الطوية", en: "Al Towayya" },
  { value: "Al Khabisi", ar: "الخبيصي", en: "Al Khabisi" },
  { value: "Al Markhaniya", ar: "المرخانية", en: "Al Markhaniya" },
  { value: "Al Qattara", ar: "القطارة", en: "Al Qattara" },
  { value: "Al Jahili", ar: "الجاهلي", en: "Al Jahili" },
  { value: "Al Sarooj", ar: "الصاروج", en: "Al Sarooj" },
  { value: "Al Kuwaitat", ar: "الكويتات", en: "Al Kuwaitat" },
  { value: "Al Niyadat", ar: "النيادات", en: "Al Niyadat" },
  { value: "Al Manaseer Al Ain", ar: "المناصير - العين", en: "Al Manaseer Al Ain" },
  { value: "Al Khalidiyah Al Ain", ar: "الخالدية - العين", en: "Al Khalidiyah Al Ain" },
  { value: "Al Bateen Al Ain", ar: "البطين - العين", en: "Al Bateen Al Ain" },
  { value: "Al Maqam", ar: "المقام", en: "Al Maqam" },
  { value: "Asharej", ar: "عشارج", en: "Asharej" },
  { value: "Falaj Hazza", ar: "فلج هزاع", en: "Falaj Hazza" },
  { value: "Zakher", ar: "زاخر", en: "Zakher" },
  { value: "Al Dhahir", ar: "الظاهر", en: "Al Dhahir" },
  { value: "Al Agabiyya", ar: "العقابية", en: "Al Agabiyya" },
  { value: "Al Masoudi", ar: "المسعودي", en: "Al Masoudi" },
  { value: "Al Muraijeb", ar: "المريجب", en: "Al Muraijeb" },
  { value: "Al Rawdah Al Ain", ar: "الروضة - العين", en: "Al Rawdah Al Ain" },
  { value: "Al Shuaibah", ar: "الشعيبة", en: "Al Shuaibah" },
  { value: "Al Noud", ar: "النود", en: "Al Noud" },
  { value: "Al Ain Industrial Area", ar: "العين الصناعية", en: "Al Ain Industrial Area" },
  { value: "Sanaiya Al Ain", ar: "الصناعية - العين", en: "Sanaiya Al Ain" },
  { value: "Al Ain Airport Area", ar: "منطقة مطار العين", en: "Al Ain Airport Area" },
  { value: "Al Ain Oasis", ar: "واحة العين", en: "Al Ain Oasis" },
  { value: "Jebel Hafeet", ar: "جبل حفيت", en: "Jebel Hafeet" },
  { value: "Green Mubazzarah", ar: "مبزرة الخضراء", en: "Green Mubazzarah" },
  { value: "Ain Al Fayda", ar: "عين الفايضة", en: "Ain Al Fayda" },
  { value: "Al Kharair", ar: "الخراير", en: "Al Kharair" },
  { value: "Al Amerah Al Ain", ar: "العامرة - العين", en: "Al Amerah Al Ain" },
  { value: "Al Yahar", ar: "اليحر", en: "Al Yahar" },
  { value: "Al Salamat", ar: "السلامات", en: "Al Salamat" },
  { value: "Mezyad", ar: "مزيد", en: "Mezyad" },
  { value: "Um Ghafa", ar: "أم غافة", en: "Um Ghafa" },
  { value: "Al Khaznah", ar: "الخزنة", en: "Al Khaznah" },
  { value: "Remah", ar: "رماح", en: "Remah" },
  { value: "Sweihan", ar: "سويحان", en: "Sweihan" },
  { value: "Nahil", ar: "ناهل", en: "Nahil" },
  { value: "Al Hayer", ar: "الهير", en: "Al Hayer" },
  { value: "Al Wagan", ar: "الوقن", en: "Al Wagan" },
  { value: "Al Qua'a", ar: "القوع", en: "Al Qua'a" },
  otherAlAinArea,
];

const PERSONAL_ORDER_LOCATIONS: UaeLocation[] = UAE_LOCATIONS.flatMap((location) => {
  if (location.value !== "Abu Dhabi") return [location];
  return [
    {
      ...location,
      areas: location.areas.filter((area) => area.value !== "Al Ain"),
    },
    {
      value: "Al Ain",
      ar: "العين",
      en: "Al Ain",
      areas: AL_AIN_AREAS,
    },
  ];
});

function getPersonalAreas(location: string | undefined) {
  return (
    PERSONAL_ORDER_LOCATIONS.find((item) => item.value === location)?.areas ||
    PERSONAL_ORDER_LOCATIONS[0].areas
  );
}

function getPersonalDefaultArea(location: string | undefined) {
  return getPersonalAreas(location)[0]?.value || "";
}

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

const inputClass =
  "w-full rounded-2xl border border-brand-sky/20 bg-[#06172c] px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-white/35 focus:border-brand-gold/65";

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
  const pickupAreas = useMemo(() => getPersonalAreas(form.pickup_city), [form.pickup_city]);
  const deliveryAreas = useMemo(
    () => getPersonalAreas(form.delivery_city),
    [form.delivery_city],
  );
  const financials = useMemo(() => {
    try {
      return calculatePersonalOrderFinancials({
        goodsValue: form.goods_value,
        discountAmount: form.discount_amount,
      });
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
    if (!financials) {
      setError(
        isArabic
          ? "راجع القيم المالية. يمكن إنشاء الطلب بقيمة صفر، لكن لا يمكن أن يتجاوز الخصم الإجمالي."
          : "Review the financial values. Zero-value orders are allowed, but discount cannot exceed the total.",
      );
      return;
    }

    setSaving(true);
    try {
      const result = await createPersonalOpsOrder(form);
      const ref = result.row.tracking_number || result.row.invoice_number || result.row.id;
      const warningCodes = (result.warnings || [])
        .map((warning) => String(warning.code || ""))
        .filter(Boolean);
      const warningSuffix = warningCodes.length
        ? isArabic
          ? ` تم حفظ الطلب، وتوجد ملاحظة تحتاج مراجعة دون إلغاء الحفظ: ${warningCodes.join("، ")}.`
          : ` Saved with non-blocking review notes: ${warningCodes.join(", ")}.`
        : "";
      setMessage(
        isArabic
          ? `تم إنشاء الطلب الشخصي ${ref} بدون تاجر. التوصيل ثابت ${PERSONAL_ORDER_DELIVERY_FEE.toFixed(2)} درهم، والمطلوب من العميل ${financials.customerTotal.toFixed(2)} درهم.${warningSuffix}`
          : `Personal order ${ref} was created without a merchant. Delivery is fixed at ${PERSONAL_ORDER_DELIVERY_FEE.toFixed(2)} AED and customer total is ${financials.customerTotal.toFixed(2)} AED.${warningSuffix}`,
      );
      setForm(emptyForm);
      window.setTimeout(() => {
        document.querySelector<HTMLInputElement>("[data-admin-personal-coupon=\"true\"]")?.focus();
      }, 0);
      window.dispatchEvent(
        new CustomEvent("dn-admin-orders-updated", {
          detail: { order: result.row, source: result.source },
        }),
      );
      await onSaved?.(result.row);
    } catch (cause) {
      const feedback = adminOrderActionFeedback(cause, isArabic, "create");
      setError(`${feedback.message} ${isArabic ? "رمز العملية" : "Operation code"}: ${feedback.code}`);
      console.error("DAY NIGHT personal order creation rejected:", feedback.diagnostic || cause);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      data-admin-personal-order-form="true"
      onSubmit={submit}
      className="dn-personal-order-form rounded-[28px] border border-brand-gold/30 bg-gradient-to-br from-[#07172c] to-[#0b3155] p-5 shadow-2xl"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <header className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gold text-[#07172c]">
            <UserRound className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-xl font-black text-white">
              {isArabic ? "إنشاء طلب شخصي بدون تاجر" : "Create a personal order without merchant"}
            </h2>
            <p className="mt-1 text-xs font-bold leading-6 text-white/60">
              {isArabic
                ? "طلب مباشر صالح بدون تاجر. يمكن ترك الكوبون وبيانات الربط غير المكتملة للمراجعة لاحقًا، ورسوم التوصيل ثابتة 25 درهم."
                : "Valid direct order without merchant. Coupon and incomplete relationship data can be reviewed later; delivery is fixed at 25 AED."}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-brand-gold/30 bg-brand-gold/10 px-5 py-3 text-center">
          <small className="block text-[10px] font-black text-white/55">
            {isArabic ? "سعر التوصيل الثابت" : "Fixed delivery fee"}
          </small>
          <strong
            className="text-2xl font-black text-brand-gold"
            dir={isArabic ? "rtl" : "ltr"}
          >
            {formatAdminMoney(PERSONAL_ORDER_DELIVERY_FEE, isArabic)}
          </strong>
        </div>
      </header>

      {error && (
        <p className="mb-4 flex gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-xs font-bold text-rose-100">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
      {message && (
        <p className="mb-4 flex gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-xs font-bold text-emerald-100">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {message}
        </p>
      )}

      <section className="mb-4 rounded-3xl border border-brand-gold/25 bg-brand-gold/5 p-4">
        <label className="grid gap-2 text-xs font-black text-white/70">
          <span>{isArabic ? "رقم الكوبون — اختياري ويمكن مراجعته لاحقًا" : "Coupon number — optional and reviewable later"}</span>
          <input
            data-admin-next-order-focus="true"
            data-admin-personal-coupon="true"
            value={form.reference || ""}
            onChange={(event) => field("reference", event.target.value)}
            className={inputClass}
            placeholder={
              isArabic
                ? "أدخل رقم الكوبون الإجباري — رقم التتبع يُولد تلقائيًا"
                : "Enter the required coupon number — tracking is generated automatically"
            }
            dir="ltr"
            autoComplete="off"
          />
        </label>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="space-y-3 rounded-3xl border border-white/10 bg-black/10 p-4">
          <h3 className="font-black text-brand-gold">
            {isArabic ? "بيانات المرسل والاستلام" : "Sender and pickup"}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              data-admin-personal-sender-name="true"
              value={form.sender_name}
              onChange={(event) => field("sender_name", event.target.value)}
              className={inputClass}
              placeholder={isArabic ? "اسم المرسل *" : "Sender name *"}
            />
            <input
              data-admin-personal-sender-phone="true"
              value={form.sender_phone}
              onChange={(event) => field("sender_phone", event.target.value)}
              className={inputClass}
              placeholder={isArabic ? "هاتف المرسل — اختياري" : "Sender phone — optional"}
              dir="ltr"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-[11px] font-black text-white/55">
              <span>{isArabic ? "الإمارة / العين" : "Emirate / Al Ain"}</span>
              <select
                value={form.pickup_city}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    pickup_city: event.target.value,
                    pickup_area: getPersonalDefaultArea(event.target.value),
                  }))
                }
                className={inputClass}
              >
                {PERSONAL_ORDER_LOCATIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {isArabic ? item.ar : item.en}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[11px] font-black text-white/55">
              <span>{isArabic ? "منطقة الاستلام" : "Pickup area"}</span>
              <select
                value={form.pickup_area || ""}
                onChange={(event) => field("pickup_area", event.target.value)}
                className={inputClass}
              >
                {pickupAreas.map((item) => (
                  <option key={item.value} value={item.value}>
                    {isArabic ? item.ar : item.en}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <textarea
            data-admin-personal-pickup-address="true"
            rows={3}
            value={form.pickup_street}
            onChange={(event) => field("pickup_street", event.target.value)}
            className={inputClass}
            placeholder={isArabic ? "عنوان الاستلام التفصيلي — اختياري" : "Detailed pickup address — optional"}
          />
        </section>

        <section className="space-y-3 rounded-3xl border border-white/10 bg-black/10 p-4">
          <h3 className="font-black text-brand-gold">
            {isArabic ? "بيانات المستلم والتسليم" : "Recipient and delivery"}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              data-admin-personal-receiver-name="true"
              value={form.receiver_name}
              onChange={(event) => field("receiver_name", event.target.value)}
              className={inputClass}
              placeholder={isArabic ? "اسم المستلم *" : "Recipient name *"}
            />
            <input
              data-admin-personal-receiver-phone="true"
              value={form.receiver_phone}
              onChange={(event) => field("receiver_phone", event.target.value)}
              className={inputClass}
              placeholder={isArabic ? "هاتف المستلم *" : "Recipient phone *"}
              dir="ltr"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-[11px] font-black text-white/55">
              <span>{isArabic ? "الإمارة / العين" : "Emirate / Al Ain"}</span>
              <select
                value={form.delivery_city}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    delivery_city: event.target.value,
                    delivery_area: getPersonalDefaultArea(event.target.value),
                  }))
                }
                className={inputClass}
              >
                {PERSONAL_ORDER_LOCATIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {isArabic ? item.ar : item.en}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[11px] font-black text-white/55">
              <span>{isArabic ? "منطقة التسليم" : "Delivery area"}</span>
              <select
                value={form.delivery_area || ""}
                onChange={(event) => field("delivery_area", event.target.value)}
                className={inputClass}
              >
                {deliveryAreas.map((item) => (
                  <option key={item.value} value={item.value}>
                    {isArabic ? item.ar : item.en}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <textarea
            data-admin-personal-delivery-address="true"
            rows={3}
            value={form.delivery_street}
            onChange={(event) => field("delivery_street", event.target.value)}
            className={inputClass}
            placeholder={isArabic ? "عنوان التسليم التفصيلي — اختياري" : "Detailed delivery address — optional"}
          />
        </section>
      </div>

      <section className="mt-4 grid gap-3 rounded-3xl border border-white/10 bg-black/10 p-4 md:grid-cols-2 xl:grid-cols-4">
        <input
          value={form.package_type}
          onChange={(event) => field("package_type", event.target.value)}
          className={inputClass}
          placeholder={isArabic ? "محتوى الشحنة" : "Package content"}
        />
        <input
          data-admin-personal-goods-value="true"
          type="number"
          min={0}
          step="0.01"
          value={form.goods_value}
          onChange={(event) => field("goods_value", event.target.value)}
          className={inputClass}
          placeholder={isArabic ? "قيمة البضاعة *" : "Goods value *"}
        />
        <input
          type="number"
          min={0}
          step="0.01"
          value={form.discount_amount || ""}
          onChange={(event) => field("discount_amount", event.target.value)}
          className={inputClass}
          placeholder={isArabic ? "خصم اختياري" : "Optional discount"}
        />
        <select
          value={form.payment_method}
          onChange={(event) => field("payment_method", event.target.value)}
          className={inputClass}
        >
          <option value="cod">
            {isArabic ? "تحصيل من المستلم عند التسليم" : "Collect from recipient on delivery"}
          </option>
          <option value="prepaid">{isArabic ? "مدفوع مسبقًا" : "Prepaid"}</option>
          <option value="receiver_pays">
            {isArabic ? "على حساب المستلم" : "Receiver pays"}
          </option>
        </select>
        <textarea
          rows={2}
          value={form.notes || ""}
          onChange={(event) => field("notes", event.target.value)}
          className={`${inputClass} md:col-span-2`}
          placeholder={isArabic ? "ملاحظات الطلب — اختياري" : "Order notes — optional"}
        />
        <div className="rounded-2xl border border-brand-sky/25 bg-brand-sky/10 p-3 text-center">
          <small className="block text-[10px] font-black text-white/55">
            {isArabic ? "المطلوب من العميل" : "Customer total"}
          </small>
          <strong className="text-xl font-black text-brand-sky" dir="ltr">
            {financials ? financials.customerTotal.toFixed(2) : "—"} AED
          </strong>
        </div>
        <button
          data-admin-personal-order-save="true"
          type="submit"
          disabled={saving || !financials}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-brand-gold px-5 font-black text-[#07172c] disabled:opacity-45"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {saving
            ? isArabic
              ? "جارٍ الحفظ..."
              : "Saving..."
            : isArabic
              ? "إنشاء الطلب الشخصي"
              : "Create personal order"}
        </button>
      </section>
    </form>
  );
}
