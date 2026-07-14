import { useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileText,
  MapPin,
  PackagePlus,
  ReceiptText,
  Save,
  ScanLine,
  ShieldCheck,
  Store,
} from "lucide-react";
import {
  calculateMerchantStatementNet,
  calculateOpsOrderPrice,
  createOpsOrder,
  type OpsDataSource,
  type OpsOrderInput,
} from "../../lib/adminOperationsData";
import { createAdminCouponIntakeSession } from "../../lib/couponIntakeData";
import { UAE_LOCATIONS, getAreasForEmirate, getDefaultAreaForEmirate } from "../../data/uaeLocations";
import type { Merchant, Order } from "../../types";
import CouponPhotoIntake, { type CouponPhotoReview } from "../shared/CouponPhotoIntake";

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
  delivery_city: "Dubai",
  delivery_area: "Deira",
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
};

const destinations = ["SA", "KW", "BH", "OM", "QA", "WORLD", "USA", "UK", "EU", "Canada", "Australia"];
const paymentOptions = [
  { value: "merchant_pays", ar: "التاجر يتحمل رسوم التوصيل", en: "Merchant pays delivery fee" },
  { value: "receiver_pays", ar: "المستلم يدفع رسوم التوصيل", en: "Receiver pays delivery fee" },
  { value: "cod", ar: "تحصيل من العميل عند التسليم", en: "Collect from customer on delivery" },
];
const statusOptions = [
  { value: "pending", ar: "قيد الانتظار", en: "Pending" },
  { value: "review", ar: "قيد المراجعة", en: "Under review" },
  { value: "confirmed", ar: "تم التأكيد", en: "Confirmed" },
];

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function inputClass() {
  return "w-full rounded-2xl border border-brand-sky/20 bg-brand-deep/75 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-white/30 focus:border-brand-gold/70 focus:ring-2 focus:ring-brand-gold/15";
}

function money(value: number, isArabic: boolean) {
  return isArabic ? `${value.toFixed(2)} درهم` : `${value.toFixed(2)} AED`;
}

function sourceLabel(source: OpsDataSource | "pending" | "none", isArabic: boolean) {
  if (source === "rpc") return isArabic ? "تم الحفظ عبر RPC الإنتاجي" : "Saved through production RPC";
  if (source === "db") return isArabic ? "تم الحفظ مباشرة في قاعدة البيانات" : "Saved directly to the database";
  if (source === "pending") return isArabic ? "بيانات تحتاج حفظ" : "Unsaved changes";
  return isArabic ? "لم يتم الحفظ بعد" : "Not saved yet";
}

function matchMerchant(review: CouponPhotoReview, merchants: Merchant[]) {
  const haystack = review.result.rawText.toLowerCase().replace(/\s+/g, " ");
  return merchants.find((merchant) =>
    [merchant.trade_name, merchant.merchant_code, merchant.phone, merchant.email]
      .map((value) => clean(value).toLowerCase())
      .filter((value) => value.length >= 3)
      .some((value) => haystack.includes(value)),
  ) || null;
}

export default function AdminNewOrder({
  isArabic,
  merchants,
  onSaved,
}: {
  isArabic: boolean;
  merchants: Merchant[];
  onSaved?: (order: Order) => void;
}) {
  const [form, setForm] = useState<OpsOrderInput>(emptyOrder);
  const [entryMode, setEntryMode] = useState<"manual" | "coupon">("coupon");
  const [couponReview, setCouponReview] = useState<CouponPhotoReview | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [intakeKey, setIntakeKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [source, setSource] = useState<OpsDataSource | "pending" | "none">("none");

  const selectedMerchant = useMemo(
    () => merchants.find((merchant) => merchant.id === form.merchant_id) || null,
    [form.merchant_id, merchants],
  );
  const pickupAreas = useMemo(() => getAreasForEmirate(form.pickup_city), [form.pickup_city]);
  const deliveryAreas = useMemo(() => getAreasForEmirate(form.delivery_city), [form.delivery_city]);
  const price = useMemo(() => calculateOpsOrderPrice({ ...form, merchant: selectedMerchant }), [form, selectedMerchant]);
  const settlement = useMemo(() => calculateMerchantStatementNet({ ...form, merchant: selectedMerchant }), [form, selectedMerchant]);
  const couponPriceMismatch = couponReview?.extractedDeliveryFee !== null
    && couponReview?.extractedDeliveryFee !== undefined
    && Math.abs(couponReview.extractedDeliveryFee - price.total) > 0.01;

  function setField<K extends keyof OpsOrderInput>(key: K, value: OpsOrderInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSource("pending");
  }

  function chooseMerchant(id: string) {
    const merchant = merchants.find((item) => item.id === id) || null;
    setForm((current) => ({
      ...current,
      merchant,
      merchant_id: merchant?.id || "",
      merchant_name: merchant?.trade_name || current.merchant_name,
      merchant_code: merchant?.merchant_code || "",
      pickup_city: merchant?.emirate || current.pickup_city,
      pickup_area: merchant?.city || current.pickup_area,
      pickup_street: merchant?.pickup_address || merchant?.address || current.pickup_street,
      payment_method: merchant?.default_payment_method || current.payment_method,
    }));
    setSource("pending");
  }

  function applyCouponReview(review: CouponPhotoReview) {
    const imported = review.result.fields;
    const merchant = matchMerchant(review, merchants);
    const auditNote = isArabic
      ? `مصدر الطلب: كوبون مصور (${review.result.source})، ثقة القراءة ${review.confidence}%، والمراجعة اليدوية مطلوبة.`
      : `Order source: coupon image (${review.result.source}), extraction confidence ${review.confidence}%, manual review required.`;
    setCouponReview(review);
    setReviewConfirmed(false);
    setEntryMode("coupon");
    setForm((current) => ({
      ...current,
      ...imported,
      merchant: merchant || current.merchant,
      merchant_id: merchant?.id || current.merchant_id,
      merchant_name: merchant?.trade_name || imported.merchant_name || current.merchant_name,
      merchant_code: merchant?.merchant_code || imported.merchant_code || current.merchant_code,
      receiver_address: clean(imported.receiver_address || imported.delivery_street || current.receiver_address),
      package_description: clean(imported.package_description || imported.package_type || current.package_description),
      notes: [clean(current.notes), clean(imported.notes), auditNote].filter(Boolean).join("\n"),
    }));
    setSource("pending");
    setMessage("");
    setError("");
  }

  function clearCouponReview() {
    setCouponReview(null);
    setReviewConfirmed(false);
  }

  function validate() {
    const missing = [
      !selectedMerchant && !clean(form.merchant_name) ? (isArabic ? "التاجر أو اسم المرسل" : "merchant or sender name") : "",
      !clean(form.pickup_city) ? (isArabic ? "إمارة الاستلام" : "pickup emirate") : "",
      !clean(form.delivery_city) ? (isArabic ? "إمارة التسليم" : "delivery emirate") : "",
      !clean(form.receiver_name) ? (isArabic ? "اسم المستلم" : "receiver name") : "",
      !clean(form.receiver_phone) ? (isArabic ? "هاتف المستلم" : "receiver phone") : "",
      !clean(form.receiver_address) && !clean(form.delivery_street) ? (isArabic ? "عنوان التسليم" : "delivery address") : "",
      !clean(form.package_type) ? (isArabic ? "محتوى الشحنة" : "package content") : "",
    ].filter(Boolean);
    if (missing.length) return isArabic ? `حقول مطلوبة: ${missing.join("، ")}` : `Required fields: ${missing.join(", ")}`;
    if (form.payment_method === "cod" && Number(form.cod_amount || 0) <= 0) {
      return isArabic ? "مبلغ التحصيل مطلوب عند اختيار COD." : "A collection amount is required for COD.";
    }
    if (entryMode === "coupon" && couponReview && !reviewConfirmed) {
      return isArabic ? "راجع البيانات المستخرجة ثم فعّل تأكيد المراجعة اليدوية قبل الحفظ." : "Review the extracted fields and confirm manual review before saving.";
    }
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
      const result = await createOpsOrder({ ...form, merchant: selectedMerchant });
      const saved = result.row;
      const tracking = clean(saved.tracking_number || saved.invoice_number || saved.id);
      let auditSuffix = "";

      if (couponReview) {
        const audit = await createAdminCouponIntakeSession({
          review: couponReview,
          orderReference: tracking,
          merchantId: selectedMerchant?.id || form.merchant_id,
        });
        if (audit.warning) {
          auditSuffix = isArabic ? ` تم إنشاء الطلب، لكن ملاحظة الأرشفة: ${audit.warning}` : ` Order created; archive note: ${audit.warning}`;
        } else if (audit.id) {
          auditSuffix = isArabic ? " وتم حفظ جلسة الكوبون وصورته في سجل التدقيق." : " Coupon session and image were saved to the audit trail.";
        }
      }

      setSource(result.source);
      setMessage(
        isArabic
          ? `تم إنشاء الطلب الحقيقي. رقم التتبع: ${tracking}.${auditSuffix}`
          : `Real order created. Tracking: ${tracking}.${auditSuffix}`,
      );
      onSaved?.(saved);
      setForm({ ...emptyOrder, merchant: selectedMerchant, merchant_id: selectedMerchant?.id || "", merchant_name: selectedMerchant?.trade_name || "", merchant_code: selectedMerchant?.merchant_code || "" });
      setCouponReview(null);
      setReviewConfirmed(false);
      setIntakeKey((value) => value + 1);
    } catch (cause) {
      console.warn("Admin coupon order creation failed:", cause);
      setSource("none");
      setError(isArabic ? "تعذر إنشاء الطلب الحقيقي. تأكد من migration وصلاحيات الأدمن ثم حاول مجدداً." : "The real order could not be created. Confirm the migration and admin permissions, then retry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-[2rem] border border-brand-sky/20 bg-white/[0.045] p-5 shadow-2xl shadow-black/20" dir={isArabic ? "rtl" : "ltr"}>
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-gold/35 bg-brand-gold/10 text-brand-gold"><PackagePlus className="h-6 w-6" /></span>
          <div>
            <h2 className="text-xl font-black text-white">{isArabic ? "إضافة طلب جديد — يدوي أو بالكوبون المصور" : "New order — manual or coupon photo"}</h2>
            <p className="mt-1 max-w-3xl text-xs font-bold leading-6 text-white/55">{isArabic ? "الكوبون يملأ البيانات مبدئياً فقط. راجع الحقول وسعر النظام قبل إنشاء الطلب الحقيقي." : "The coupon only prefills preliminary data. Review all fields and the system price before creating the real order."}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 self-start rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-xs font-black text-emerald-200"><Database className="h-4 w-4" />{sourceLabel(source, isArabic)}</span>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-brand-deep/55 p-2" role="tablist">
        <button type="button" role="tab" aria-selected={entryMode === "coupon"} onClick={() => setEntryMode("coupon")} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black transition ${entryMode === "coupon" ? "bg-brand-gold text-brand-deep" : "text-white/65 hover:bg-white/5 hover:text-white"}`}><ScanLine className="h-4 w-4" />{isArabic ? "إدخال الكوبون بالتصوير" : "Coupon photo intake"}</button>
        <button type="button" role="tab" aria-selected={entryMode === "manual"} onClick={() => setEntryMode("manual")} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black transition ${entryMode === "manual" ? "bg-brand-gold text-brand-deep" : "text-white/65 hover:bg-white/5 hover:text-white"}`}><FileText className="h-4 w-4" />{isArabic ? "إدخال يدوي" : "Manual entry"}</button>
      </div>

      {entryMode === "coupon" && (
        <div className="mb-5 space-y-3">
          <CouponPhotoIntake key={intakeKey} isArabic={isArabic} mode="admin" onReview={applyCouponReview} onClear={clearCouponReview} />
          {couponReview && (
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-brand-gold/25 bg-brand-gold/5 p-4 text-xs font-bold leading-6 text-white/75">
              <input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-amber-400" />
              <span><strong className="text-brand-gold">{isArabic ? "تأكيد المراجعة اليدوية:" : "Manual review confirmation:"}</strong> {isArabic ? "راجعت الاسم والهاتف والعنوان والتحصيل، وأفهم أن OCR وQR قد يخطئان." : "I reviewed the name, phone, address, and COD amount, and understand that OCR/QR can be inaccurate."}</span>
            </label>
          )}
        </div>
      )}

      {couponPriceMismatch && couponReview?.extractedDeliveryFee !== null && (
        <div className="mb-5 flex items-start gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-xs font-bold leading-6 text-amber-100"><AlertTriangle className="mt-1 h-4 w-4 shrink-0" />{isArabic ? `سعر الكوبون ${couponReview.extractedDeliveryFee.toFixed(2)} درهم يختلف عن سعر النظام ${price.total.toFixed(2)} درهم. يعتمد الحفظ على سعر النظام بعد المراجعة.` : `Coupon price ${couponReview.extractedDeliveryFee.toFixed(2)} AED differs from system price ${price.total.toFixed(2)} AED. Saving uses the reviewed system price.`}</div>
      )}

      {error && <div className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-xs font-bold leading-6 text-rose-100">{error}</div>}
      {message && <div className="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-xs font-bold leading-6 text-emerald-100">{message}</div>}

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-brand-deep/35 p-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-white"><Store className="h-4 w-4 text-brand-gold" />{isArabic ? "التاجر والاستلام" : "Merchant & pickup"}</h3>
          <select value={form.merchant_id || ""} onChange={(event) => chooseMerchant(event.target.value)} className={inputClass()}><option value="">{isArabic ? "اختر تاجراً أو اكتب اسم المرسل" : "Select merchant or enter sender name"}</option>{merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.trade_name || merchant.owner_name || merchant.merchant_code || merchant.id}</option>)}</select>
          <input value={form.merchant_name || ""} onChange={(event) => setField("merchant_name", event.target.value)} placeholder={isArabic ? "اسم المرسل أو المتجر" : "Sender or store name"} className={inputClass()} />
          <input value={form.coupon_number || ""} onChange={(event) => setField("coupon_number", event.target.value)} placeholder={isArabic ? "رقم الكوبون أو المرجع" : "Coupon or reference"} className={inputClass()} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select value={form.pickup_city} onChange={(event) => setForm((current) => ({ ...current, pickup_city: event.target.value, pickup_area: getDefaultAreaForEmirate(event.target.value) }))} className={inputClass()}>{UAE_LOCATIONS.map((location) => <option key={location.value} value={location.value}>{isArabic ? location.ar : location.en}</option>)}</select>
            <select value={form.pickup_area || ""} onChange={(event) => setField("pickup_area", event.target.value)} className={inputClass()}>{pickupAreas.map((area) => <option key={area.value} value={area.value}>{isArabic ? area.ar : area.en}</option>)}</select>
          </div>
          <input value={form.pickup_street || ""} onChange={(event) => setField("pickup_street", event.target.value)} placeholder={isArabic ? "عنوان الاستلام التفصيلي" : "Detailed pickup address"} className={inputClass()} />
        </div>

        <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-brand-deep/35 p-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-white"><MapPin className="h-4 w-4 text-brand-gold" />{isArabic ? "المستلم والتسليم" : "Receiver & delivery"}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><input value={form.receiver_name} onChange={(event) => setField("receiver_name", event.target.value)} placeholder={isArabic ? "اسم المستلم" : "Receiver name"} className={inputClass()} /><input value={form.receiver_phone} onChange={(event) => setField("receiver_phone", event.target.value)} placeholder={isArabic ? "هاتف المستلم" : "Receiver phone"} className={inputClass()} dir="ltr" /></div>
          <select value={form.shipping_scope} onChange={(event) => setField("shipping_scope", event.target.value as "local" | "international")} className={inputClass()}><option value="local">{isArabic ? "داخل الإمارات" : "Within UAE"}</option><option value="international">{isArabic ? "شحن دولي" : "International"}</option></select>
          {form.shipping_scope === "international" ? <select value={form.destination_country || "SA"} onChange={(event) => setField("destination_country", event.target.value)} className={inputClass()}>{destinations.map((country) => <option key={country} value={country}>{country}</option>)}</select> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><select value={form.delivery_city} onChange={(event) => setForm((current) => ({ ...current, delivery_city: event.target.value, delivery_area: getDefaultAreaForEmirate(event.target.value) }))} className={inputClass()}>{UAE_LOCATIONS.map((location) => <option key={location.value} value={location.value}>{isArabic ? location.ar : location.en}</option>)}</select><select value={form.delivery_area || ""} onChange={(event) => setField("delivery_area", event.target.value)} className={inputClass()}>{deliveryAreas.map((area) => <option key={area.value} value={area.value}>{isArabic ? area.ar : area.en}</option>)}</select></div>}
          <input value={form.delivery_street || form.receiver_address} onChange={(event) => { setField("delivery_street", event.target.value); setField("receiver_address", event.target.value); }} placeholder={isArabic ? "عنوان التسليم التفصيلي" : "Detailed delivery address"} className={inputClass()} />
        </div>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-brand-deep/35 p-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-white"><ReceiptText className="h-4 w-4 text-brand-gold" />{isArabic ? "الشحنة والدفع" : "Shipment & payment"}</h3>
          <input value={form.package_type} onChange={(event) => { setField("package_type", event.target.value); setField("package_description", event.target.value); }} placeholder={isArabic ? "محتوى الشحنة" : "Package content"} className={inputClass()} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><input type="number" min={1} value={form.order_count} onChange={(event) => setField("order_count", Math.max(1, Number(event.target.value) || 1))} placeholder={isArabic ? "القطع" : "Pieces"} className={inputClass()} /><input type="number" min={1} step="0.1" value={form.weight || 1} onChange={(event) => setField("weight", Math.max(1, Number(event.target.value) || 1))} placeholder={isArabic ? "الوزن" : "Weight"} className={inputClass()} /><select value={form.status || "pending"} onChange={(event) => setField("status", event.target.value)} className={inputClass()}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{isArabic ? option.ar : option.en}</option>)}</select></div>
          <select value={form.payment_method} onChange={(event) => setField("payment_method", event.target.value)} className={inputClass()}>{paymentOptions.map((option) => <option key={option.value} value={option.value}>{isArabic ? option.ar : option.en}</option>)}</select>
          {form.payment_method === "cod" && <input type="number" min={0} step="0.01" value={form.cod_amount ?? ""} onChange={(event) => setField("cod_amount", event.target.value)} placeholder={isArabic ? "مبلغ التحصيل COD" : "COD collection amount"} className={inputClass()} />}
          <textarea rows={3} value={form.notes || ""} onChange={(event) => setField("notes", event.target.value)} placeholder={isArabic ? "ملاحظات تشغيلية" : "Operations notes"} className={inputClass()} />
        </div>

        <aside className="space-y-3 rounded-[1.5rem] border border-brand-gold/25 bg-brand-gold/5 p-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-brand-gold"><ShieldCheck className="h-4 w-4" />{isArabic ? "مراجعة النظام" : "System review"}</h3>
          <div className="rounded-2xl border border-white/10 bg-brand-deep/70 p-3"><span className="text-[11px] font-bold text-white/50">{isArabic ? "سعر النظام" : "System price"}</span><strong className="mt-1 block text-xl text-white">{money(price.total, isArabic)}</strong></div>
          <div className="rounded-2xl border border-white/10 bg-brand-deep/70 p-3"><span className="text-[11px] font-bold text-white/50">{isArabic ? "تحصيل العميل" : "Customer collection"}</span><strong className="mt-1 block text-lg text-white">{money(settlement.collectionAmount, isArabic)}</strong></div>
          <div className={`rounded-2xl border p-3 ${settlement.merchantNet < 0 ? "border-rose-400/25 bg-rose-400/10 text-rose-100" : "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"}`}><span className="text-[11px] font-bold opacity-70">{isArabic ? "صافي التاجر" : "Merchant net"}</span><strong className="mt-1 block text-lg">{money(settlement.merchantNet, isArabic)}</strong></div>
          {couponReview && <div className="rounded-2xl border border-brand-sky/20 bg-brand-sky/5 p-3 text-xs font-bold leading-6 text-white/70">{isArabic ? `مصدر الكوبون: ${couponReview.result.source} · ثقة ${couponReview.confidence}%` : `Coupon source: ${couponReview.result.source} · ${couponReview.confidence}% confidence`}</div>}
        </aside>
      </section>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-bold leading-6 text-white/45">{isArabic ? "لا يتم إنشاء نجاح وهمي. يجب أن يعود رقم تتبع حقيقي من Supabase قبل تأكيد الحفظ." : "No fake success is shown. Supabase must return a real tracking reference before save confirmation."}</p>
        <button type="submit" disabled={saving} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand-gold px-6 py-3 text-xs font-black text-brand-deep transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Database className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />}{saving ? (isArabic ? "جارٍ إنشاء الطلب الحقيقي..." : "Creating real order...") : (isArabic ? "إنشاء الطلب من البيانات المراجعة" : "Create order from reviewed data")}</button>
      </div>
    </form>
  );
}
