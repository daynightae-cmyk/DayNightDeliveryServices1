import { useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Database,
  FileText,
  Landmark,
  Loader2,
  MapPin,
  PackagePlus,
  ReceiptText,
  Save,
  ScanLine,
  Store,
  WalletCards,
} from "lucide-react";
import { calculateOpsOrderPrice, opsErrorDetail, type OpsDataSource } from "../../lib/adminOperationsData";
import {
  calculateFinancialOpsOrder,
  createFinancialOpsOrder,
  type FinancialOpsOrderInput,
} from "../../lib/orderFinancialOperations";
import { calculateOrderFinancials, orderFinancialValidation } from "../../lib/orderFinancials";
import { createAdminCouponIntakeSession } from "../../lib/couponIntakeData";
import { UAE_LOCATIONS, getAreasForEmirate, getDefaultAreaForEmirate } from "../../data/uaeLocations";
import type { Merchant, Order } from "../../types";
import CouponPhotoIntake, { type CouponPhotoReview } from "../shared/CouponPhotoIntake";

const emptyOrder: FinancialOpsOrderInput = {
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
  payment_method: "cod",
  cod_amount: "",
  notes: "",
  status: "pending",
  price_mode: "system",
  manual_delivery_price: "",
  goods_value: "",
  discount_amount: 0,
  delivery_fee_mode: "customer_pays",
};

const destinations = ["SA", "KW", "BH", "OM", "QA", "WORLD", "USA", "UK", "EU", "Canada", "Australia"];
const clean = (value: unknown) => String(value ?? "").trim();
const inputClass = () =>
  "w-full rounded-2xl border border-brand-sky/20 bg-brand-deep/75 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-white/30 focus:border-brand-gold/70 focus:ring-2 focus:ring-brand-gold/15 disabled:cursor-not-allowed disabled:opacity-55";

function merchantOptionLabel(merchant: Merchant) {
  const owner = clean(merchant.owner_name);
  const store = clean(merchant.trade_name);
  const code = clean(merchant.merchant_code);
  if (owner && store) return `${owner} — ${store}${code ? ` — ${code}` : ""}`;
  return owner || store || code || merchant.id;
}

function matchMerchant(review: CouponPhotoReview, merchants: Merchant[]) {
  const haystack = review.result.rawText.toLowerCase().replace(/\s+/g, " ");
  return (
    merchants.find((merchant) =>
      [merchant.owner_name, merchant.trade_name, merchant.merchant_code, merchant.phone, merchant.email]
        .map((value) => clean(value).toLowerCase())
        .filter((value) => value.length >= 3)
        .some((value) => haystack.includes(value)),
    ) || null
  );
}

function sourceLabel(source: OpsDataSource | "pending" | "none", isArabic: boolean) {
  if (source === "rpc" || source === "db") return isArabic ? "تم الحفظ الحقيقي" : "Saved to production";
  if (source === "pending") return isArabic ? "تعديلات غير محفوظة" : "Unsaved changes";
  return isArabic ? "جاهز للحفظ" : "Ready to save";
}

function FinancialMetric({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${accent ? "border-brand-gold/40 bg-brand-gold/10" : "border-white/10 bg-black/10"}`}>
      <span className="block text-[10px] font-black text-white/50">{label}</span>
      <strong className={`mt-1 block text-lg font-black ${accent ? "text-brand-gold" : "text-white"}`} dir="ltr">{value.toFixed(2)} AED</strong>
    </div>
  );
}

export default function AdminNewOrderComplete({
  isArabic,
  merchants,
  onSaved,
}: {
  isArabic: boolean;
  merchants: Merchant[];
  onSaved?: (order: Order) => void;
}) {
  const [form, setForm] = useState<FinancialOpsOrderInput>(emptyOrder);
  const [entryMode, setEntryMode] = useState<"manual" | "coupon">("manual");
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
  const deliveryAreas = useMemo(() => getAreasForEmirate(form.delivery_city), [form.delivery_city]);
  const pricing = useMemo(
    () => calculateOpsOrderPrice({ ...form, merchant: selectedMerchant }),
    [form, selectedMerchant],
  );
  const financials = useMemo(() => {
    try {
      return calculateOrderFinancials({
        goodsValue: form.goods_value,
        deliveryFee: pricing.total,
        discountAmount: form.discount_amount,
        deliveryFeeMode: form.delivery_fee_mode,
      });
    } catch {
      return null;
    }
  }, [form.goods_value, form.discount_amount, form.delivery_fee_mode, pricing.total]);

  function setField<K extends keyof FinancialOpsOrderInput>(key: K, value: FinancialOpsOrderInput[K]) {
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
      pickup_street: merchant?.pickup_address || merchant?.address || current.pickup_street,
    }));
    setSource("pending");
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
      merchant_name: merchant?.trade_name || imported.merchant_name || current.merchant_name,
      merchant_code: merchant?.merchant_code || imported.merchant_code || current.merchant_code,
      coupon_number: clean(imported.coupon_number || current.coupon_number),
      receiver_address: clean(imported.receiver_address || imported.delivery_street || current.receiver_address),
      delivery_street: clean(imported.delivery_street || imported.receiver_address || current.delivery_street),
      package_type: clean(imported.package_type || current.package_type),
      package_description: clean(imported.package_description || imported.package_type || current.package_description),
      notes: [clean(current.notes), clean(imported.notes), `Coupon OCR ${review.result.source}; confidence ${review.confidence}%`]
        .filter(Boolean)
        .join(" | "),
    }));
    setSource("pending");
  }

  function validate() {
    const missing = [
      !selectedMerchant ? (isArabic ? "التاجر" : "merchant") : "",
      !clean(form.coupon_number) ? (isArabic ? "رقم الكوبون" : "coupon number") : "",
      !clean(form.receiver_name) ? (isArabic ? "اسم العميل" : "customer name") : "",
      !clean(form.receiver_phone) ? (isArabic ? "رقم هاتف العميل" : "customer phone") : "",
      form.shipping_scope === "local" && !clean(form.delivery_city) ? (isArabic ? "الإمارة" : "emirate") : "",
      form.shipping_scope === "local" && !clean(form.delivery_area) ? (isArabic ? "المنطقة" : "area") : "",
      form.goods_value === "" ? (isArabic ? "قيمة البضاعة" : "goods value") : "",
    ].filter(Boolean);
    if (missing.length) {
      return isArabic ? `الحقول المطلوبة: ${missing.join("، ")}` : `Required fields: ${missing.join(", ")}`;
    }
    if (
      form.price_mode === "manual" &&
      (form.manual_delivery_price === "" || !Number.isFinite(Number(form.manual_delivery_price)) || Number(form.manual_delivery_price) < 0)
    ) {
      return isArabic ? "أدخل رسوم توصيل يدوية صحيحة أو استخدم سعر النظام." : "Enter a valid manual delivery fee or use system pricing.";
    }
    const financialError = orderFinancialValidation({
      goodsValue: form.goods_value,
      deliveryFee: pricing.total,
      discountAmount: form.discount_amount,
      deliveryFeeMode: form.delivery_fee_mode,
    });
    if (financialError === "discount_exceeds_customer_total" || financialError === "discount_exceeds_goods_value") {
      return isArabic ? "قيمة الخصم أكبر من المبلغ الذي يمكن خصمه في طريقة التحصيل المختارة." : "The discount exceeds the allowed amount for this settlement mode.";
    }
    if (financialError) return isArabic ? "راجع قيمة البضاعة ورسوم التوصيل والخصم." : "Check goods value, delivery fee, and discount.";
    if (entryMode === "coupon" && couponReview && !reviewConfirmed) {
      return isArabic ? "أكد المراجعة اليدوية قبل الحفظ." : "Confirm manual review before saving.";
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
      const packageValue = clean(form.package_description || form.package_type);
      const calculated = calculateFinancialOpsOrder({ ...form, merchant: selectedMerchant });
      const result = await createFinancialOpsOrder({
        ...form,
        coupon_number: clean(form.coupon_number),
        merchant: selectedMerchant,
        receiver_address: clean(form.receiver_address),
        delivery_street: clean(form.delivery_street),
        package_type: packageValue || "Shipment",
        package_description: packageValue || "Shipment",
      });
      const saved = result.row;
      const reference = clean(saved.tracking_number || saved.invoice_number || saved.id);
      let auditSuffix = "";
      if (couponReview) {
        const audit = await createAdminCouponIntakeSession({
          review: couponReview,
          orderReference: reference,
          merchantId: selectedMerchant?.id || form.merchant_id,
        });
        if (audit.warning) auditSuffix = isArabic ? ` ملاحظة الأرشفة: ${audit.warning}` : ` Archive note: ${audit.warning}`;
      }
      setSource(result.source);
      setMessage(
        isArabic
          ? `تم حفظ الطلب. الكوبون ${form.coupon_number} — المطلوب من العميل ${calculated.customerTotal.toFixed(2)} درهم — مستحق التاجر ${calculated.merchantDue.toFixed(2)} درهم — دخل داي نايت ${calculated.companyRevenue.toFixed(2)} درهم.${auditSuffix}`
          : `Order saved. Coupon ${form.coupon_number} — customer total ${calculated.customerTotal.toFixed(2)} AED — merchant due ${calculated.merchantDue.toFixed(2)} AED — DAY NIGHT revenue ${calculated.companyRevenue.toFixed(2)} AED.${auditSuffix}`,
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
        pickup_street: selectedMerchant?.pickup_address || selectedMerchant?.address || "",
      });
      setCouponReview(null);
      setReviewConfirmed(false);
      setIntakeKey((value) => value + 1);
    } catch (cause) {
      const detail = opsErrorDetail(cause);
      setSource("none");
      setError(
        isArabic
          ? `تعذر حفظ الطلب المالي الحقيقي.${detail ? ` السبب: ${detail}` : ""}`
          : `The real financial order could not be saved.${detail ? ` Reason: ${detail}` : ""}`,
      );
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
            <h2 className="text-xl font-black text-white">{isArabic ? "إضافة طلب — فصل مالي كامل من لحظة الإدخال" : "New order — complete financial separation at entry"}</h2>
            <p className="mt-1 max-w-3xl text-xs font-bold leading-6 text-white/55">
              {isArabic
                ? "أدخل الكوبون والهاتف والإمارة والمنطقة وقيمة البضاعة. رسوم التوصيل تُحسب حسب المنطقة، ثم يحسب النظام الخصم والإجمالي ومستحق التاجر ودخل داي نايت فوراً."
                : "Enter coupon, phone, emirate, area, and goods value. Delivery is priced by area, then discount, customer total, merchant due, and DAY NIGHT revenue are calculated immediately."}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 self-start rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-xs font-black text-emerald-200"><Database className="h-4 w-4" />{sourceLabel(source, isArabic)}</span>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-brand-deep/55 p-2">
        <button type="button" onClick={() => setEntryMode("manual")} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black ${entryMode === "manual" ? "bg-brand-gold text-brand-deep" : "text-white/65"}`}><FileText className="h-4 w-4" />{isArabic ? "إدخال يدوي" : "Manual entry"}</button>
        <button type="button" onClick={() => setEntryMode("coupon")} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black ${entryMode === "coupon" ? "bg-brand-gold text-brand-deep" : "text-white/65"}`}><ScanLine className="h-4 w-4" />{isArabic ? "كوبون بالتصوير" : "Coupon photo"}</button>
      </div>

      {entryMode === "coupon" && <div className="mb-5 space-y-3"><CouponPhotoIntake key={intakeKey} isArabic={isArabic} mode="admin" onReview={applyCouponReview} onClear={() => { setCouponReview(null); setReviewConfirmed(false); }} />{couponReview && <label className="flex gap-3 rounded-2xl border border-brand-gold/25 bg-brand-gold/5 p-4 text-xs font-bold text-white/75"><input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} className="h-4 w-4 accent-amber-400" />{isArabic ? "راجعت رقم الكوبون واسم العميل والهاتف والبيانات المستخرجة." : "I reviewed the coupon number, customer name, phone, and extracted data."}</label>}</div>}

      {error && <div className="mb-4 flex gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-xs font-bold text-rose-100"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
      {message && <div className="mb-4 flex gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-xs font-bold text-emerald-100"><CheckCircle2 className="h-4 w-4 shrink-0" />{message}</div>}

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-brand-deep/35 p-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-white"><Store className="h-4 w-4 text-brand-gold" />{isArabic ? "التاجر والكوبون" : "Merchant and coupon"}</h3>
          <select value={form.merchant_id || ""} onChange={(event) => chooseMerchant(event.target.value)} className={inputClass()} required><option value="">{isArabic ? "اختر التاجر *" : "Select merchant *"}</option>{merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchantOptionLabel(merchant)}</option>)}</select>
          <input value={form.coupon_number || ""} onChange={(event) => setField("coupon_number", event.target.value)} placeholder={isArabic ? "رقم الكوبون *" : "Coupon number *"} className={inputClass()} required dir="ltr" />
        </div>

        <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-brand-deep/35 p-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-white"><MapPin className="h-4 w-4 text-brand-gold" />{isArabic ? "بيانات العميل ومكان التسليم" : "Customer and delivery location"}</h3>
          <div className="grid gap-3 sm:grid-cols-2"><input value={form.receiver_name} onChange={(event) => setField("receiver_name", event.target.value)} placeholder={isArabic ? "اسم العميل *" : "Customer name *"} className={inputClass()} required /><input value={form.receiver_phone} onChange={(event) => setField("receiver_phone", event.target.value)} placeholder={isArabic ? "رقم تليفون العميل *" : "Customer phone *"} className={inputClass()} required dir="ltr" /></div>
          <select value={form.shipping_scope} onChange={(event) => setField("shipping_scope", event.target.value as "local" | "international")} className={inputClass()}><option value="local">{isArabic ? "داخل الإمارات" : "Within UAE"}</option><option value="international">{isArabic ? "شحن دولي" : "International"}</option></select>
          {form.shipping_scope === "international" ? <select value={form.destination_country || "SA"} onChange={(event) => setField("destination_country", event.target.value)} className={inputClass()}>{destinations.map((country) => <option key={country} value={country}>{country}</option>)}</select> : <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1"><span className="text-[10px] font-black text-white/50">{isArabic ? "الإمارة *" : "Emirate *"}</span><select value={form.delivery_city} onChange={(event) => setForm((current) => ({ ...current, delivery_city: event.target.value, delivery_area: getDefaultAreaForEmirate(event.target.value) }))} className={inputClass()}>{UAE_LOCATIONS.map((location) => <option key={location.value} value={location.value}>{isArabic ? location.ar : location.en}</option>)}</select></label><label className="space-y-1"><span className="text-[10px] font-black text-white/50">{isArabic ? "المنطقة *" : "Area *"}</span><select value={form.delivery_area || ""} onChange={(event) => setField("delivery_area", event.target.value)} className={inputClass()}>{deliveryAreas.map((area) => <option key={area.value} value={area.value}>{isArabic ? area.ar : area.en}</option>)}</select></label></div>}
          <input value={form.delivery_street || form.receiver_address} onChange={(event) => setForm((current) => ({ ...current, delivery_street: event.target.value, receiver_address: event.target.value }))} placeholder={isArabic ? "العنوان التفصيلي — اختياري" : "Detailed address — optional"} className={inputClass()} />
        </div>
      </section>

      <section className="mt-4 rounded-[1.7rem] border border-brand-gold/30 bg-[linear-gradient(135deg,rgba(212,175,55,0.11),rgba(11,95,255,0.08),rgba(3,18,38,0.55))] p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="flex items-center gap-2 text-base font-black text-white"><WalletCards className="h-5 w-5 text-brand-gold" />{isArabic ? "التقسيم المالي للطلب" : "Order financial breakdown"}</h3><p className="mt-1 text-xs font-bold text-white/50">{isArabic ? "هذه القيم تُثبت عند إنشاء الطلب، وعند التسليم يتم ترحيلها للحسابات دون إعادة إدخال." : "These values are fixed at order creation; delivery posts the same snapshot without re-entry."}</p></div>
          <span className="rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 py-1 text-[10px] font-black text-brand-gold">{isArabic ? "حساب تلقائي مباشر" : "Live automatic calculation"}</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <label className="space-y-2"><span className="flex items-center gap-2 text-xs font-black text-white"><ReceiptText className="h-4 w-4 text-brand-sky" />{isArabic ? "قيمة البضاعة *" : "Goods value *"}</span><input type="number" min={0} step="0.01" value={form.goods_value} onChange={(event) => setField("goods_value", event.target.value)} placeholder="100.00" className={inputClass()} required /><small className="text-[10px] font-bold text-white/40">{isArabic ? "ثمن منتجات التاجر" : "Merchant product value"}</small></label>
          <label className="space-y-2"><span className="flex items-center gap-2 text-xs font-black text-white"><Calculator className="h-4 w-4 text-brand-sky" />{isArabic ? "قيمة التوصيل" : "Delivery fee"}</span><div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 p-2"><button type="button" onClick={() => { setField("price_mode", "system"); setField("manual_delivery_price", ""); }} className={`rounded-xl px-3 py-2 text-[10px] font-black ${form.price_mode !== "manual" ? "bg-brand-gold text-brand-deep" : "text-white/65"}`}>{isArabic ? `النظام ${pricing.systemTotal.toFixed(2)}` : `System ${pricing.systemTotal.toFixed(2)}`}</button><button type="button" onClick={() => setField("price_mode", "manual")} className={`rounded-xl px-3 py-2 text-[10px] font-black ${form.price_mode === "manual" ? "bg-brand-gold text-brand-deep" : "text-white/65"}`}>{isArabic ? "يدوي" : "Manual"}</button></div>{form.price_mode === "manual" ? <input type="number" min={0} step="0.01" value={form.manual_delivery_price ?? ""} onChange={(event) => setField("manual_delivery_price", event.target.value)} placeholder="30.00" className={inputClass()} /> : <div className="rounded-2xl border border-brand-sky/20 bg-brand-sky/5 px-4 py-3 text-lg font-black text-brand-sky" dir="ltr">{pricing.total.toFixed(2)} AED</div>}</label>
          <label className="space-y-2"><span className="flex items-center gap-2 text-xs font-black text-white"><Landmark className="h-4 w-4 text-brand-sky" />{isArabic ? "الخصم" : "Discount"}</span><input type="number" min={0} step="0.01" value={form.discount_amount ?? 0} onChange={(event) => setField("discount_amount", event.target.value)} placeholder="0.00" className={inputClass()} /><small className="text-[10px] font-bold text-white/40">{isArabic ? "يخصم من المبلغ ومستحق التاجر" : "Reduces total and merchant due"}</small></label>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setField("delivery_fee_mode", "customer_pays")} className={`rounded-2xl border p-4 text-start transition ${form.delivery_fee_mode === "customer_pays" ? "border-brand-gold/55 bg-brand-gold/15 text-brand-gold" : "border-white/10 bg-black/10 text-white/60"}`}><strong className="block text-xs font-black">{isArabic ? "رسوم التوصيل تُضاف على العميل" : "Customer pays delivery fee"}</strong><small className="mt-1 block text-[10px] font-bold opacity-70">{isArabic ? "الإجمالي = البضاعة + التوصيل − الخصم" : "Total = goods + delivery − discount"}</small></button>
          <button type="button" onClick={() => setField("delivery_fee_mode", "deduct_from_merchant")} className={`rounded-2xl border p-4 text-start transition ${form.delivery_fee_mode === "deduct_from_merchant" ? "border-brand-gold/55 bg-brand-gold/15 text-brand-gold" : "border-white/10 bg-black/10 text-white/60"}`}><strong className="block text-xs font-black">{isArabic ? "رسوم التوصيل تُخصم من مستحق التاجر" : "Deduct delivery from merchant"}</strong><small className="mt-1 block text-[10px] font-bold opacity-70">{isArabic ? "العميل يدفع البضاعة بعد الخصم، والتوصيل يخصم من التاجر" : "Customer pays discounted goods; delivery is deducted from merchant"}</small></button>
        </div>

        {financials ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><FinancialMetric label={isArabic ? "قيمة البضاعة" : "Goods"} value={financials.goodsValue} /><FinancialMetric label={isArabic ? "التوصيل" : "Delivery"} value={financials.deliveryFee} /><FinancialMetric label={isArabic ? "الخصم" : "Discount"} value={financials.discountAmount} /><FinancialMetric label={isArabic ? "المطلوب من العميل" : "Customer total"} value={financials.customerTotal} accent /><FinancialMetric label={isArabic ? "مستحق التاجر" : "Merchant due"} value={financials.merchantDue} /><FinancialMetric label={isArabic ? "دخل داي نايت" : "DAY NIGHT revenue"} value={financials.companyRevenue} /></div> : <div className="mt-4 rounded-2xl border border-rose-400/25 bg-rose-400/8 p-3 text-xs font-bold text-rose-100">{isArabic ? "راجع الخصم والقيم المالية لإظهار الإجمالي." : "Check the discount and financial values to display totals."}</div>}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-brand-deep/35 p-4">
          <h3 className="text-sm font-black text-white">{isArabic ? "طريقة التحصيل والتفاصيل" : "Collection method and details"}</h3>
          <select value={form.payment_method} onChange={(event) => setField("payment_method", event.target.value)} className={inputClass()}><option value="cod">{isArabic ? "تحصيل المبلغ النهائي من العميل عند التسليم" : "Collect final total from customer on delivery"}</option><option value="receiver_pays">{isArabic ? "مدفوع من المستلم" : "Receiver paid"}</option><option value="merchant_pays">{isArabic ? "مدفوع أو مسجل على حساب التاجر" : "Paid/charged to merchant account"}</option></select>
          <details className="rounded-2xl border border-white/10 bg-black/10 p-4 text-white/70"><summary className="cursor-pointer text-xs font-black text-brand-gold">{isArabic ? "بيانات الشحنة الاختيارية" : "Optional shipment details"}</summary><div className="mt-4 space-y-3"><input value={form.package_type} onChange={(event) => { setField("package_type", event.target.value); setField("package_description", event.target.value); }} placeholder={isArabic ? "محتوى الشحنة" : "Package content"} className={inputClass()} /><div className="grid gap-3 sm:grid-cols-2"><input type="number" min={1} value={form.order_count} onChange={(event) => setField("order_count", Math.max(1, Number(event.target.value) || 1))} placeholder={isArabic ? "عدد القطع" : "Pieces"} className={inputClass()} /><input type="number" min={0.1} step="0.1" value={form.weight || 1} onChange={(event) => setField("weight", Math.max(0.1, Number(event.target.value) || 1))} placeholder={isArabic ? "الوزن" : "Weight"} className={inputClass()} /></div><textarea rows={3} value={form.notes || ""} onChange={(event) => setField("notes", event.target.value)} placeholder={isArabic ? "ملاحظات" : "Notes"} className={inputClass()} /></div></details>
        </div>

        <aside className="flex flex-col justify-between rounded-[1.5rem] border border-brand-gold/25 bg-brand-gold/5 p-4 text-xs font-bold text-white/70"><div><h3 className="text-sm font-black text-brand-gold">{isArabic ? "تأكيد الحساب" : "Calculation confirmation"}</h3><p className="mt-3 leading-6">{isArabic ? "عند الحفظ تُسجل كل القيم داخل الطلب. عند تغيير الحالة إلى تم التسليم سيؤكد النظام التحصيل ويرحّل مستحق التاجر ودخل الشركة مرة واحدة فقط." : "Saving records every value on the order. Marking it delivered confirms collection and posts merchant/company entries exactly once."}</p>{financials && <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4"><span className="block text-white/45">{isArabic ? "الإجمالي النهائي المطلوب" : "Final customer total"}</span><strong className="mt-1 block text-3xl font-black text-brand-gold" dir="ltr">{financials.customerTotal.toFixed(2)} AED</strong></div>}</div><button type="submit" disabled={saving || !financials} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-gold px-4 py-4 text-sm font-black text-brand-deep disabled:opacity-60">{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}{saving ? (isArabic ? "جارٍ الحفظ..." : "Saving...") : (isArabic ? "حفظ الطلب والحساب" : "Save order and financials")}</button></aside>
      </section>
    </form>
  );
}
