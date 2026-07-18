import { useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Database,
  FileText,
  MapPin,
  PackagePlus,
  Save,
  ScanLine,
  ShieldCheck,
  Store,
} from "lucide-react";
import {
  calculateMerchantStatementNet,
  calculateOpsOrderPrice,
  createOpsOrder,
  opsErrorDetail,
  type OpsDataSource,
  type OpsOrderInput,
} from "../../lib/adminOperationsData";
import { createAdminCouponIntakeSession } from "../../lib/couponIntakeData";
import {
  UAE_LOCATIONS,
  getAreasForEmirate,
  getDefaultAreaForEmirate,
} from "../../data/uaeLocations";
import type { Merchant, Order } from "../../types";
import CouponPhotoIntake, {
  type CouponPhotoReview,
} from "../shared/CouponPhotoIntake";

const emptyOrder: OpsOrderInput = {
  merchant: null,
  merchant_id: "",
  merchant_name: "",
  merchant_code: "",
  coupon_number: "",
  shipping_scope: "local",
  order_count: 1,
  pickup_city: "Abu Dhabi",
  pickup_area: "Mussafah",
  pickup_street: "",
  delivery_city: "Abu Dhabi",
  delivery_area: "Al Shahama",
  delivery_street: "",
  destination_country: "SA",
  receiver_name: "",
  receiver_phone: "",
  receiver_address: "",
  package_type: "",
  package_description: "",
  weight: 1,
  payment_method: "merchant_pays",
  cod_amount: "",
  notes: "",
  status: "pending",
  price_mode: "system",
  manual_delivery_price: "",
};

const destinations = [
  "SA",
  "KW",
  "BH",
  "OM",
  "QA",
  "WORLD",
  "USA",
  "UK",
  "EU",
  "Canada",
  "Australia",
];

const paymentOptions = [
  {
    value: "merchant_pays",
    ar: "التاجر يتحمل رسوم التوصيل",
    en: "Merchant pays delivery fee",
  },
  {
    value: "receiver_pays",
    ar: "المستلم يدفع رسوم التوصيل",
    en: "Receiver pays delivery fee",
  },
  {
    value: "cod",
    ar: "تحصيل من العميل عند التسليم",
    en: "Collect from customer on delivery",
  },
];

const clean = (value: unknown) => String(value ?? "").trim();
const inputClass = () =>
  "w-full rounded-2xl border border-brand-sky/20 bg-brand-deep/75 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-white/30 focus:border-brand-gold/70 focus:ring-2 focus:ring-brand-gold/15";
const money = (value: number, isArabic: boolean) =>
  isArabic ? `${value.toFixed(2)} درهم` : `${value.toFixed(2)} AED`;

function sourceLabel(
  source: OpsDataSource | "pending" | "none",
  isArabic: boolean,
) {
  if (source === "rpc" || source === "db")
    return isArabic ? "تم الحفظ الحقيقي" : "Saved to production";
  if (source === "pending")
    return isArabic ? "تعديلات غير محفوظة" : "Unsaved changes";
  return isArabic ? "جاهز للحفظ" : "Ready to save";
}

function merchantOptionLabel(merchant: Merchant, isArabic: boolean) {
  const owner = clean(merchant.owner_name);
  const store = clean(merchant.trade_name);
  const code = clean(merchant.merchant_code);
  if (owner && store) {
    return isArabic
      ? `${owner} — ${store}${code ? ` — ${code}` : ""}`
      : `${owner} — ${store}${code ? ` — ${code}` : ""}`;
  }
  return owner || store || code || merchant.id;
}

function matchMerchant(review: CouponPhotoReview, merchants: Merchant[]) {
  const haystack = review.result.rawText.toLowerCase().replace(/\s+/g, " ");
  return (
    merchants.find((merchant) =>
      [
        merchant.owner_name,
        merchant.trade_name,
        merchant.merchant_code,
        merchant.phone,
        merchant.email,
      ]
        .map((value) => clean(value).toLowerCase())
        .filter((value) => value.length >= 3)
        .some((value) => haystack.includes(value)),
    ) || null
  );
}

export default function AdminNewOrderFlexible({
  isArabic,
  merchants,
  onSaved,
}: {
  isArabic: boolean;
  merchants: Merchant[];
  onSaved?: (order: Order) => void;
}) {
  const [form, setForm] = useState<OpsOrderInput>(emptyOrder);
  const [entryMode, setEntryMode] = useState<"manual" | "coupon">("manual");
  const [couponReview, setCouponReview] =
    useState<CouponPhotoReview | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [intakeKey, setIntakeKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [source, setSource] =
    useState<OpsDataSource | "pending" | "none">("none");

  const selectedMerchant = useMemo(
    () => merchants.find((merchant) => merchant.id === form.merchant_id) || null,
    [form.merchant_id, merchants],
  );
  const pickupAreas = useMemo(
    () => getAreasForEmirate(form.pickup_city),
    [form.pickup_city],
  );
  const deliveryAreas = useMemo(
    () => getAreasForEmirate(form.delivery_city),
    [form.delivery_city],
  );
  const price = useMemo(
    () => calculateOpsOrderPrice({ ...form, merchant: selectedMerchant }),
    [form, selectedMerchant],
  );
  const settlement = useMemo(
    () => calculateMerchantStatementNet({ ...form, merchant: selectedMerchant }),
    [form, selectedMerchant],
  );

  function setField<K extends keyof OpsOrderInput>(
    key: K,
    value: OpsOrderInput[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setSource("pending");
    setMessage("");
    setError("");
  }

  function chooseMerchant(id: string) {
    const merchant = merchants.find((item) => item.id === id) || null;
    setForm((current) => ({
      ...current,
      merchant,
      merchant_id: merchant?.id || "",
      merchant_name: merchant?.trade_name || "",
      merchant_code: merchant?.merchant_code || "",
      pickup_city: merchant?.emirate || current.pickup_city,
      pickup_area: merchant?.city || current.pickup_area,
      pickup_street:
        merchant?.pickup_address || merchant?.address || current.pickup_street,
      payment_method:
        merchant?.default_payment_method || current.payment_method,
    }));
    setSource("pending");
    setMessage("");
    setError("");
  }

  function applyCouponReview(review: CouponPhotoReview) {
    const imported = review.result.fields;
    const merchant = matchMerchant(review, merchants);
    setCouponReview(review);
    setReviewConfirmed(false);
    setForm((current) => ({
      ...current,
      ...imported,
      merchant: merchant || current.merchant,
      merchant_id: merchant?.id || current.merchant_id,
      merchant_name:
        merchant?.trade_name || imported.merchant_name || current.merchant_name,
      merchant_code:
        merchant?.merchant_code || imported.merchant_code || current.merchant_code,
      receiver_address: clean(
        imported.receiver_address ||
          imported.delivery_street ||
          current.receiver_address,
      ),
      package_type: clean(imported.package_type || current.package_type),
      package_description: clean(
        imported.package_description ||
          imported.package_type ||
          current.package_description,
      ),
      notes: [
        clean(current.notes),
        clean(imported.notes),
        `Coupon OCR ${review.result.source}; confidence ${review.confidence}%`,
      ]
        .filter(Boolean)
        .join(" | "),
    }));
    setSource("pending");
  }

  function validate() {
    const missing = [
      !selectedMerchant ? (isArabic ? "التاجر" : "merchant") : "",
      !clean(form.receiver_name)
        ? isArabic
          ? "اسم المستلم"
          : "receiver name"
        : "",
      !clean(form.receiver_phone)
        ? isArabic
          ? "هاتف المستلم"
          : "receiver phone"
        : "",
    ].filter(Boolean);

    if (missing.length) {
      return isArabic
        ? `الحقول الأساسية المطلوبة: ${missing.join("، ")}`
        : `Required core fields: ${missing.join(", ")}`;
    }

    if (
      form.price_mode === "manual" &&
      (form.manual_delivery_price === "" ||
        !Number.isFinite(Number(form.manual_delivery_price)) ||
        Number(form.manual_delivery_price) < 0)
    ) {
      return isArabic
        ? "أدخل سعراً يدوياً صحيحاً أو استخدم سعر النظام."
        : "Enter a valid manual price or use system pricing.";
    }

    if (form.payment_method === "cod" && Number(form.cod_amount || 0) <= 0) {
      return isArabic
        ? "مبلغ التحصيل مطلوب عند اختيار COD."
        : "COD amount is required.";
    }

    if (entryMode === "coupon" && couponReview && !reviewConfirmed) {
      return isArabic
        ? "أكد المراجعة اليدوية قبل الحفظ."
        : "Confirm manual review before saving.";
    }

    return "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const validation = validate();
    if (validation) return setError(validation);

    setSaving(true);
    try {
      const result = await createOpsOrder({
        ...form,
        merchant: selectedMerchant,
        receiver_address: clean(form.receiver_address),
        delivery_street: clean(form.delivery_street),
        package_type: clean(form.package_type) || "Shipment",
        package_description:
          clean(form.package_description) || clean(form.package_type) || "Shipment",
      });
      const saved = result.row;
      const reference = clean(
        saved.tracking_number || saved.invoice_number || saved.id,
      );
      let auditSuffix = "";

      if (couponReview) {
        const audit = await createAdminCouponIntakeSession({
          review: couponReview,
          orderReference: reference,
          merchantId: selectedMerchant?.id || form.merchant_id,
        });
        if (audit.warning) {
          auditSuffix = isArabic
            ? ` ملاحظة الأرشفة: ${audit.warning}`
            : ` Archive note: ${audit.warning}`;
        }
      }

      setSource(result.source);
      setMessage(
        isArabic
          ? `تم حفظ الطلب وربطه بصاحب المتجر ${selectedMerchant?.owner_name || selectedMerchant?.trade_name || ""}. رقم التتبع: ${reference}. السعر: ${price.total.toFixed(2)} درهم.${auditSuffix}`
          : `Order saved and linked to ${selectedMerchant?.owner_name || selectedMerchant?.trade_name || "merchant"}. Tracking: ${reference}. Price: ${price.total.toFixed(2)} AED.${auditSuffix}`,
      );
      onSaved?.(saved);
      setForm({
        ...emptyOrder,
        merchant: selectedMerchant,
        merchant_id: selectedMerchant?.id || "",
        merchant_name: selectedMerchant?.trade_name || "",
        merchant_code: selectedMerchant?.merchant_code || "",
        pickup_city: selectedMerchant?.emirate || emptyOrder.pickup_city,
        pickup_area: selectedMerchant?.city || emptyOrder.pickup_area,
        pickup_street:
          selectedMerchant?.pickup_address || selectedMerchant?.address || "",
        payment_method:
          selectedMerchant?.default_payment_method || emptyOrder.payment_method,
      });
      setCouponReview(null);
      setReviewConfirmed(false);
      setIntakeKey((value) => value + 1);
    } catch (cause) {
      const detail = opsErrorDetail(cause);
      setSource("none");
      setError(
        isArabic
          ? `تعذر حفظ الطلب الحقيقي.${detail ? ` السبب: ${detail}` : ""}`
          : `The real order could not be saved.${detail ? ` Reason: ${detail}` : ""}`,
      );
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
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-gold/35 bg-brand-gold/10 text-brand-gold">
            <PackagePlus className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-xl font-black text-white">
              {isArabic
                ? "إضافة طلب مرن — 3 بيانات فقط مطلوبة"
                : "Flexible order — only 3 fields required"}
            </h2>
            <p className="mt-1 max-w-3xl text-xs font-bold leading-6 text-white/55">
              {isArabic
                ? "المطلوب فقط: التاجر، اسم المستلم، والهاتف. العنوان التفصيلي ومحتوى الشحنة وباقي التفاصيل اختيارية بالكامل."
                : "Only merchant, receiver name, and phone are required. Detailed address, package content, and all other details are optional."}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 self-start rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-xs font-black text-emerald-200">
          <Database className="h-4 w-4" />
          {sourceLabel(source, isArabic)}
        </span>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-brand-deep/55 p-2">
        <button
          type="button"
          onClick={() => setEntryMode("manual")}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black ${entryMode === "manual" ? "bg-brand-gold text-brand-deep" : "text-white/65"}`}
        >
          <FileText className="h-4 w-4" />
          {isArabic ? "إدخال يدوي سريع" : "Quick manual"}
        </button>
        <button
          type="button"
          onClick={() => setEntryMode("coupon")}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black ${entryMode === "coupon" ? "bg-brand-gold text-brand-deep" : "text-white/65"}`}
        >
          <ScanLine className="h-4 w-4" />
          {isArabic ? "كوبون بالتصوير" : "Coupon photo"}
        </button>
      </div>

      {entryMode === "coupon" && (
        <div className="mb-5 space-y-3">
          <CouponPhotoIntake
            key={intakeKey}
            isArabic={isArabic}
            mode="admin"
            onReview={applyCouponReview}
            onClear={() => {
              setCouponReview(null);
              setReviewConfirmed(false);
            }}
          />
          {couponReview && (
            <label className="flex gap-3 rounded-2xl border border-brand-gold/25 bg-brand-gold/5 p-4 text-xs font-bold text-white/75">
              <input
                type="checkbox"
                checked={reviewConfirmed}
                onChange={(event) => setReviewConfirmed(event.target.checked)}
                className="h-4 w-4 accent-amber-400"
              />
              {isArabic
                ? "راجعت اسم المستلم والهاتف والبيانات المستخرجة."
                : "I reviewed the receiver name, phone, and extracted data."}
            </label>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 flex gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-xs font-bold text-rose-100">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 flex gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-xs font-bold text-emerald-100">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-brand-deep/35 p-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-white">
            <Store className="h-4 w-4 text-brand-gold" />
            {isArabic ? "صاحب المتجر — مطلوب" : "Merchant owner — required"}
          </h3>
          <select
            value={form.merchant_id || ""}
            onChange={(event) => chooseMerchant(event.target.value)}
            className={inputClass()}
            required
          >
            <option value="">
              {isArabic ? "ابحث واختر باسم المالك" : "Find and select by owner name"}
            </option>
            {merchants.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchantOptionLabel(merchant, isArabic)}
              </option>
            ))}
          </select>
          {selectedMerchant && (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs font-bold text-emerald-100">
              <strong>
                {selectedMerchant.owner_name || selectedMerchant.trade_name || "—"}
              </strong>
              <span className="block opacity-70">
                {selectedMerchant.trade_name || "—"} · {selectedMerchant.phone || "—"}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-brand-deep/35 p-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-white">
            <MapPin className="h-4 w-4 text-brand-gold" />
            {isArabic ? "المستلم — الاسم والهاتف فقط مطلوبان" : "Receiver — only name and phone required"}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.receiver_name}
              onChange={(event) => setField("receiver_name", event.target.value)}
              placeholder={isArabic ? "اسم المستلم *" : "Receiver name *"}
              className={inputClass()}
              required
            />
            <input
              value={form.receiver_phone}
              onChange={(event) => setField("receiver_phone", event.target.value)}
              placeholder={isArabic ? "هاتف المستلم *" : "Receiver phone *"}
              className={inputClass()}
              dir="ltr"
              required
            />
          </div>
          <select
            value={form.shipping_scope}
            onChange={(event) =>
              setField(
                "shipping_scope",
                event.target.value as "local" | "international",
              )
            }
            className={inputClass()}
          >
            <option value="local">
              {isArabic ? "داخل الإمارات" : "Within UAE"}
            </option>
            <option value="international">
              {isArabic ? "شحن دولي" : "International"}
            </option>
          </select>
          {form.shipping_scope === "international" ? (
            <select
              value={form.destination_country || "SA"}
              onChange={(event) =>
                setField("destination_country", event.target.value)
              }
              className={inputClass()}
            >
              {destinations.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={form.delivery_city}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    delivery_city: event.target.value,
                    delivery_area: getDefaultAreaForEmirate(event.target.value),
                  }))
                }
                className={inputClass()}
              >
                {UAE_LOCATIONS.map((location) => (
                  <option key={location.value} value={location.value}>
                    {isArabic ? location.ar : location.en}
                  </option>
                ))}
              </select>
              <select
                value={form.delivery_area || ""}
                onChange={(event) =>
                  setField("delivery_area", event.target.value)
                }
                className={inputClass()}
              >
                {deliveryAreas.map((area) => (
                  <option key={area.value} value={area.value}>
                    {isArabic ? area.ar : area.en}
                  </option>
                ))}
              </select>
            </div>
          )}
          <input
            value={form.delivery_street || form.receiver_address}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                delivery_street: event.target.value,
                receiver_address: event.target.value,
              }))
            }
            placeholder={
              isArabic
                ? "العنوان التفصيلي — اختياري"
                : "Detailed address — optional"
            }
            className={inputClass()}
          />
        </div>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-brand-deep/35 p-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-white">
            <Calculator className="h-4 w-4 text-brand-gold" />
            {isArabic ? "السعر والدفع" : "Price & payment"}
          </h3>
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 p-2">
            <button
              type="button"
              onClick={() => {
                setField("price_mode", "system");
                setField("manual_delivery_price", "");
              }}
              className={`rounded-xl px-4 py-3 text-xs font-black ${form.price_mode !== "manual" ? "bg-brand-gold text-brand-deep" : "text-white/65"}`}
            >
              {isArabic
                ? `سعر النظام ${price.systemTotal.toFixed(2)}`
                : `System ${price.systemTotal.toFixed(2)}`}
            </button>
            <button
              type="button"
              onClick={() => setField("price_mode", "manual")}
              className={`rounded-xl px-4 py-3 text-xs font-black ${form.price_mode === "manual" ? "bg-brand-gold text-brand-deep" : "text-white/65"}`}
            >
              {isArabic ? "سعر يدوي" : "Manual price"}
            </button>
          </div>
          {form.price_mode === "manual" && (
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.manual_delivery_price ?? ""}
              onChange={(event) =>
                setField("manual_delivery_price", event.target.value)
              }
              placeholder={isArabic ? "اكتب السعر اليدوي" : "Manual price"}
              className={inputClass()}
            />
          )}
          <select
            value={form.payment_method}
            onChange={(event) =>
              setField("payment_method", event.target.value)
            }
            className={inputClass()}
          >
            {paymentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {isArabic ? option.ar : option.en}
              </option>
            ))}
          </select>
          {form.payment_method === "cod" && (
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.cod_amount ?? ""}
              onChange={(event) => setField("cod_amount", event.target.value)}
              placeholder={isArabic ? "مبلغ التحصيل COD *" : "COD amount *"}
              className={inputClass()}
            />
          )}

          <details className="rounded-2xl border border-white/10 bg-black/10 p-4 text-white/70">
            <summary className="cursor-pointer text-xs font-black text-brand-gold">
              {isArabic ? "البيانات الاختيارية" : "Optional details"}
            </summary>
            <div className="mt-4 space-y-3">
              <input
                value={form.coupon_number || ""}
                onChange={(event) =>
                  setField("coupon_number", event.target.value)
                }
                placeholder={
                  isArabic ? "رقم الكوبون — اختياري" : "Coupon — optional"
                }
                className={inputClass()}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={form.pickup_city}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      pickup_city: event.target.value,
                      pickup_area: getDefaultAreaForEmirate(event.target.value),
                    }))
                  }
                  className={inputClass()}
                >
                  {UAE_LOCATIONS.map((location) => (
                    <option key={location.value} value={location.value}>
                      {isArabic ? location.ar : location.en}
                    </option>
                  ))}
                </select>
                <select
                  value={form.pickup_area || ""}
                  onChange={(event) =>
                    setField("pickup_area", event.target.value)
                  }
                  className={inputClass()}
                >
                  {pickupAreas.map((area) => (
                    <option key={area.value} value={area.value}>
                      {isArabic ? area.ar : area.en}
                    </option>
                  ))}
                </select>
              </div>
              <input
                value={form.pickup_street || ""}
                onChange={(event) =>
                  setField("pickup_street", event.target.value)
                }
                placeholder={
                  isArabic
                    ? "تفاصيل الاستلام — اختياري"
                    : "Pickup details — optional"
                }
                className={inputClass()}
              />
              <input
                value={form.package_type}
                onChange={(event) => {
                  setField("package_type", event.target.value);
                  setField("package_description", event.target.value);
                }}
                placeholder={
                  isArabic
                    ? "محتوى الشحنة — اختياري"
                    : "Package content — optional"
                }
                className={inputClass()}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="number"
                  min={1}
                  value={form.order_count}
                  onChange={(event) =>
                    setField(
                      "order_count",
                      Math.max(1, Number(event.target.value) || 1),
                    )
                  }
                  placeholder={isArabic ? "القطع" : "Pieces"}
                  className={inputClass()}
                />
                <input
                  type="number"
                  min={0.1}
                  step="0.1"
                  value={form.weight || 1}
                  onChange={(event) =>
                    setField(
                      "weight",
                      Math.max(0.1, Number(event.target.value) || 1),
                    )
                  }
                  placeholder={isArabic ? "الوزن" : "Weight"}
                  className={inputClass()}
                />
              </div>
              <textarea
                rows={3}
                value={form.notes || ""}
                onChange={(event) => setField("notes", event.target.value)}
                placeholder={
                  isArabic ? "ملاحظات — اختيارية" : "Notes — optional"
                }
                className={inputClass()}
              />
            </div>
          </details>
        </div>

        <aside className="space-y-3 rounded-[1.5rem] border border-brand-gold/25 bg-brand-gold/5 p-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-brand-gold">
            <ShieldCheck className="h-4 w-4" />
            {isArabic ? "المراجعة النهائية" : "Final review"}
          </h3>
          <div className="rounded-2xl border border-white/10 bg-brand-deep/70 p-3">
            <span className="text-[11px] font-bold text-white/50">
              {form.price_mode === "manual"
                ? isArabic
                  ? "السعر اليدوي"
                  : "Manual price"
                : isArabic
                  ? "سعر النظام"
                  : "System price"}
            </span>
            <strong className="mt-1 block text-xl text-white">
              {money(price.total, isArabic)}
            </strong>
            {form.price_mode === "manual" && (
              <small className="text-white/45">
                {isArabic
                  ? `مرجع النظام ${money(price.systemTotal, true)}`
                  : `System reference ${money(price.systemTotal, false)}`}
              </small>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 bg-brand-deep/70 p-3">
            <span className="text-[11px] font-bold text-white/50">
              {isArabic ? "تحصيل العميل" : "Customer collection"}
            </span>
            <strong className="mt-1 block text-lg text-white">
              {money(settlement.collectionAmount, isArabic)}
            </strong>
          </div>
          <div
            className={`rounded-2xl border p-3 ${settlement.merchantNet < 0 ? "border-rose-400/25 bg-rose-400/10 text-rose-100" : "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"}`}
          >
            <span className="text-[11px] font-bold opacity-70">
              {isArabic ? "صافي التاجر" : "Merchant net"}
            </span>
            <strong className="mt-1 block text-lg">
              {money(settlement.merchantNet, isArabic)}
            </strong>
          </div>
        </aside>
      </section>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-bold text-white/45">
          {isArabic
            ? "يمكن حفظ الطلب بدون عنوان تفصيلي وبدون محتوى شحنة. النظام يستخدم الإمارة والمنطقة كمرجع تشغيل أساسي."
            : "The order can be saved without a detailed address or package content. Emirate and area remain the operational reference."}
        </p>
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
              ? "حفظ الطلب الحقيقي"
              : "Save real order"}
        </button>
      </div>
    </form>
  );
}
