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
import { calculateOpsOrderPrice, type OpsDataSource } from "../../lib/adminOperationsData";
import { formatAdminMoney } from "../../lib/adminLocale";
import { adminOrderActionFeedback } from "../../lib/adminOrderActionFeedback";
import {
  calculateFinancialOpsOrder,
  createFinancialOpsOrder,
  type FinancialOpsOrderInput,
} from "../../lib/orderFinancialOperations";
import { orderFinancialValidation } from "../../lib/orderFinancials";
import { createAdminCouponIntakeSession } from "../../lib/couponIntakeData";
import { UAE_LOCATIONS, getAreasForEmirate, getDefaultAreaForEmirate } from "../../data/uaeLocations";
import { INTERNATIONAL_DESTINATIONS } from "../../data/internationalDestinations";
import type { Merchant, Order } from "../../types";
import CouponPhotoIntake, { type CouponPhotoReview } from "../shared/CouponPhotoIntake";
import AdminPersonalOrderForm from "./AdminPersonalOrderForm";

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
  discount_amount: "",
  delivery_fee_mode: "customer_pays",
};

const PERSONAL_ORDER_OPTION = "__personal_order__";
type OrderOwnerMode = "merchant" | "personal";

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

function freshOrderForMerchant(merchant: Merchant | null): FinancialOpsOrderInput {
  return {
    ...emptyOrder,
    merchant,
    merchant_id: merchant?.id || "",
    merchant_name: merchant?.trade_name || "",
    merchant_code: merchant?.merchant_code || "",
    pickup_city: merchant?.emirate || emptyOrder.pickup_city,
    pickup_area: merchant?.city || emptyOrder.pickup_area,
    pickup_street: merchant?.pickup_address || merchant?.address || "",
  };
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

function merchantSettlement(value: number, isArabic: boolean) {
  return value < 0
    ? {
        label: isArabic ? "مستحق على التاجر" : "Merchant debit",
        amount: value,
      }
    : {
        label: isArabic ? "مستحق للتاجر" : "Due to merchant",
        amount: value,
      };
}

type FinancialMetricTone = "neutral" | "gold" | "danger";

  function signedAdminMoney(value: number, isArabic: boolean) {
    const absolute = formatAdminMoney(Math.abs(value), isArabic);
    return value < 0 ? `-${absolute}` : absolute;
  }

  function FinancialMetric({
    label,
    value,
    isArabic,
    tone = "neutral",
  }: {
    label: string;
    value: number;
    isArabic: boolean;
    tone?: FinancialMetricTone;
  }) {
    const containerClass =
      tone === "danger"
        ? "border-rose-400/55 bg-rose-500/15 shadow-[0_0_24px_rgba(244,63,94,0.12)]"
        : tone === "gold"
          ? "border-brand-gold/40 bg-brand-gold/10"
          : "border-white/10 bg-black/10";
    const labelClass =
      tone === "danger" ? "text-rose-200/90" : "text-white/50";
    const valueClass =
      tone === "danger"
        ? "text-rose-300"
        : tone === "gold"
          ? "text-brand-gold"
          : "text-white";

    return (
      <div className={`rounded-2xl border p-3 ${containerClass}`}>
        <span className={`block text-[10px] font-black ${labelClass}`}>{label}</span>
        <strong className={`mt-1 block text-lg font-black ${valueClass}`} dir="ltr">
          {signedAdminMoney(value, isArabic)}
        </strong>
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
  orders?: Order[];
  onSaved?: (order: Order) => void;
}) {
  const [form, setForm] = useState<FinancialOpsOrderInput>(() => freshOrderForMerchant(null));
  const [ownerMode, setOwnerMode] = useState<OrderOwnerMode>("merchant");
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
  const explicitManualZero =
    form.price_mode === "manual" &&
    form.manual_delivery_price !== "" &&
    form.manual_delivery_price !== null &&
    form.manual_delivery_price !== undefined &&
    Number.isFinite(Number(form.manual_delivery_price)) &&
    Number(form.manual_delivery_price) === 0;
  const authoritativeDeliveryFeeMode = explicitManualZero
    ? "deduct_from_merchant"
    : form.delivery_fee_mode;
  const merchantFeeModeActive =
    authoritativeDeliveryFeeMode === "deduct_from_merchant";
  const resolvedFinancialInput = useMemo<FinancialOpsOrderInput>(() => ({
    ...form,
    merchant: selectedMerchant,
    delivery_fee_mode: authoritativeDeliveryFeeMode,
    payment_method: merchantFeeModeActive
      ? "merchant_pays"
      : form.payment_method === "merchant_pays" ||
          form.payment_method === "sender_pays"
        ? "cod"
        : form.payment_method,
  }), [form, selectedMerchant, authoritativeDeliveryFeeMode, merchantFeeModeActive]);
  const financials = useMemo(() => {
    try {
      return calculateFinancialOpsOrder(resolvedFinancialInput);
    } catch {
      return null;
    }
  }, [resolvedFinancialInput]);
  const settlement = financials
    ? merchantSettlement(financials.merchantDue, isArabic)
    : null;
  const merchantDebitActive = Boolean(
    financials && financials.merchantDue < 0,
  );
  const ownerSelectionValue = ownerMode === "personal" ? PERSONAL_ORDER_OPTION : form.merchant_id || "";

  function setField<K extends keyof FinancialOpsOrderInput>(key: K, value: FinancialOpsOrderInput[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value } as FinancialOpsOrderInput;
      if (
        key === "goods_value" &&
        value !== "" &&
        value !== null &&
        value !== undefined &&
        Number.isFinite(Number(value)) &&
        Number(value) === 0
      ) {
        next.delivery_fee_mode = "deduct_from_merchant";
        next.payment_method = "merchant_pays";
      }
      return next;
    });
    setSource("pending");
    setMessage("");
    setError("");
  }


  function setDeliveryFeeMode(value: "customer_pays" | "deduct_from_merchant") {
    setForm((current) => ({
      ...current,
      delivery_fee_mode: value,
      payment_method:
        value === "deduct_from_merchant"
          ? "merchant_pays"
          : current.payment_method === "merchant_pays" ||
              current.payment_method === "sender_pays"
            ? "cod"
            : current.payment_method,
    }));
    setSource("pending");
    setMessage("");
    setError("");
  }

  function chooseMerchant(id: string) {
    if (id === PERSONAL_ORDER_OPTION) {
      setOwnerMode("personal");
      setForm(freshOrderForMerchant(null));
      setSource("pending");
      setMessage("");
      setError("");
      return;
    }

    const merchant = merchants.find((item) => item.id === id) || null;
    setOwnerMode("merchant");
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
    const numericFields: Array<[string, unknown]> = [
      [isArabic ? "قيمة البضاعة" : "goods value", form.goods_value],
      [isArabic ? "الخصم" : "discount", form.discount_amount],
      [isArabic ? "مبلغ التحصيل" : "COD amount", form.cod_amount],
    ];
    if (form.price_mode === "manual") {
      numericFields.push([
        isArabic ? "رسوم التوصيل" : "delivery fee",
        form.manual_delivery_price,
      ]);
    }
    for (const [label, value] of numericFields) {
      if (value === "" || value === null || value === undefined) continue;
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        return isArabic ? `قيمة غير صحيحة في حقل ${label}.` : `Invalid value in ${label}.`;
      }
    }
    const financialError = orderFinancialValidation({
      goodsValue: form.goods_value === "" ? 0 : form.goods_value,
      deliveryFee: pricing.total,
      discountAmount: form.discount_amount,
      deliveryFeeMode: authoritativeDeliveryFeeMode,
    });
    if (financialError) {
      return isArabic
        ? "راجع القيم المالية المدخلة. يمكن إنشاء طلب بقيمة صفر، لكن لا يمكن إدخال قيمة رقمية غير صحيحة."
        : "Review the entered financial values. Zero-value orders are allowed, but invalid numeric values are not.";
    }
    if (entryMode === "coupon" && couponReview && !reviewConfirmed) {
      return isArabic ? "أكد المراجعة اليدوية قبل الحفظ." : "Confirm manual review before saving.";
    }
    return "";
  }

  function prepareNextOrder(merchant: Merchant | null) {
    setForm(freshOrderForMerchant(merchant));
    setCouponReview(null);
    setReviewConfirmed(false);
    setIntakeKey((value) => value + 1);
    window.setTimeout(() => {
      document.querySelector<HTMLInputElement>("[data-admin-next-order-focus='true']")?.focus();
    }, 0);
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
      const couponNumber = clean(form.coupon_number);
      const submissionInput: FinancialOpsOrderInput = {
      ...resolvedFinancialInput,
      coupon_number: couponNumber,
      receiver_address: clean(form.receiver_address),
      delivery_street: clean(form.delivery_street),
      package_type: packageValue || "Shipment",
      package_description: packageValue || "Shipment",
    };
    const calculated = calculateFinancialOpsOrder(submissionInput);
    const result = await createFinancialOpsOrder(submissionInput);
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

      const savedSettlement = merchantSettlement(
        calculated.merchantDue,
        isArabic,
      );
      prepareNextOrder(selectedMerchant);
      const warningCodes = (result.warnings || [])
        .map((warning) => String(warning.code || ""))
        .filter(Boolean);
      const warningSuffix = warningCodes.length
        ? isArabic
          ? ` تم حفظ الطلب، وتوجد ملاحظة تحتاج مراجعة دون إلغاء الحفظ: ${warningCodes.join("، ")}.`
          : ` The order was saved with non-blocking review notes: ${warningCodes.join(", ")}.`
        : "";
      setSource(result.source);
      setMessage(
        isArabic
          ? `تم حفظ الطلب وتنظيف الخانات للطلب التالي. المرجع ${couponNumber || reference} — المطلوب من العميل ${calculated.customerTotal.toFixed(2)} درهم — ${savedSettlement.label} ${savedSettlement.amount.toFixed(2)} درهم — دخل داي نايت ${calculated.companyRevenue.toFixed(2)} درهم.${warningSuffix}${auditSuffix}`
          : `Order saved and the form is ready for the next order. Reference ${couponNumber || reference} — customer total ${calculated.customerTotal.toFixed(2)} AED — ${savedSettlement.label.toLowerCase()} ${savedSettlement.amount.toFixed(2)} AED — DAY NIGHT revenue ${calculated.companyRevenue.toFixed(2)} AED.${warningSuffix}${auditSuffix}`,
      );
      onSaved?.(saved);
    } catch (cause) {
      const feedback = adminOrderActionFeedback(cause, isArabic, "create");
      setSource("none");
      setError(`${feedback.message} ${isArabic ? "رمز العملية" : "Operation code"}: ${feedback.code}`);
      console.error("DAY NIGHT order creation rejected:", feedback.diagnostic || cause);
    } finally {
      setSaving(false);
    }
  }


  if (ownerMode === "personal") {
    return (
      <section
        data-admin-unified-personal-order-entry="true"
        className="space-y-4"
        dir={isArabic ? "rtl" : "ltr"}
      >
        <div className="rounded-[2rem] border border-brand-gold/30 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
          <div className="mb-4">
            <h2 className="text-xl font-black text-white">
              {isArabic ? "إضافة طلب — تاجر أو غرض شخصي" : "Add order — merchant or personal purpose"}
            </h2>
            <p className="mt-1 text-xs font-bold leading-6 text-white/55">
              {isArabic
                ? "اختيار غرض شخصي يلغي أي علاقة بالتجار أو حساباتهم، ويحفظ الطلب مباشرة باسم المرسل والمستلم."
                : "Personal purpose removes every merchant and merchant-ledger relationship and saves the order directly for the sender and recipient."}
            </p>
          </div>
          <label className="grid gap-2">
            <span className="text-xs font-black text-brand-gold">
              {isArabic ? "نوع الطلب أو التاجر" : "Order purpose or merchant"}
            </span>
            <select
              data-admin-order-owner-select="true"
              value={ownerSelectionValue}
              onChange={(event) => chooseMerchant(event.target.value)}
              className={inputClass()}
            >
              <option value="">{isArabic ? "اختر التاجر أو غرض شخصي *" : "Select merchant or personal purpose *"}</option>
              <option value={PERSONAL_ORDER_OPTION}>{isArabic ? "غرض شخصي — بدون تاجر" : "Personal purpose — no merchant"}</option>
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id}>{merchantOptionLabel(merchant)}</option>
              ))}
            </select>
          </label>
        </div>
        <AdminPersonalOrderForm isArabic={isArabic} onSaved={onSaved} />
      </section>
    );
  }

  return (
    <form data-admin-new-order-form="merchant" autoComplete="off" onSubmit={submit} className="rounded-[2rem] border border-brand-sky/20 bg-white/[0.045] p-5 shadow-2xl shadow-black/20" dir={isArabic ? "rtl" : "ltr"}>
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-gold/35 bg-brand-gold/10 text-brand-gold"><PackagePlus className="h-6 w-6" /></span>
          <div>
            <h2 className="text-xl font-black text-white">{isArabic ? "إضافة طلب — فصل مالي كامل من لحظة الإدخال" : "New order — complete financial separation at entry"}</h2>
            <p className="mt-1 max-w-3xl text-xs font-bold leading-6 text-white/55">
              {isArabic
                ? "أدخل الكوبون والهاتف والإمارة والمنطقة وقيمة البضاعة. بعد الحفظ تُنظف الخانات تلقائيًا وتبقى جاهزة لإدخال الطلب التالي."
                : "Enter the order details. After saving, the fields clear automatically and remain ready for the next order."}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 self-start rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-xs font-black text-emerald-200"><Database className="h-4 w-4" />{sourceLabel(source, isArabic)}</span>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-brand-deep/55 p-2">
        <button type="button" onClick={() => setEntryMode("manual")} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black ${entryMode === "manual" ? "bg-brand-gold text-brand-deep" : "text-white/65"}`}><FileText className="h-4 w-4" />{isArabic ? "إدخال يدوي" : "Manual entry"}</button>
        <button type="button" onClick={() => setEntryMode("coupon")} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black ${entryMode === "coupon" ? "bg-brand-gold text-brand-deep" : "text-white/65"}`}><ScanLine className="h-4 w-4" />{isArabic ? "كوبون بالتصوير" : "Coupon photo"}</button>
      </div>

      {entryMode === "coupon" && (
        <div className="mb-5 space-y-3">
          <CouponPhotoIntake key={intakeKey} isArabic={isArabic} mode="admin" onReview={applyCouponReview} onClear={() => { setCouponReview(null); setReviewConfirmed(false); }} />
          {couponReview && <label className="flex gap-3 rounded-2xl border border-brand-gold/25 bg-brand-gold/5 p-4 text-xs font-bold text-white/75"><input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} className="h-4 w-4 accent-amber-400" />{isArabic ? "راجعت رقم الكوبون واسم العميل والهاتف والبيانات المستخرجة." : "I reviewed the coupon number, customer name, phone, and extracted data."}</label>}
        </div>
      )}

      {error && <div className="mb-4 flex gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-xs font-bold text-rose-100"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
      {message && <div className="mb-4 flex gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-xs font-bold text-emerald-100"><CheckCircle2 className="h-4 w-4 shrink-0" />{message}</div>}

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-brand-deep/35 p-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-white"><Store className="h-4 w-4 text-brand-gold" />{isArabic ? "نوع الطلب والتاجر والكوبون" : "Order purpose, merchant, and coupon"}</h3>
          <select data-admin-order-owner-select="true" value={ownerSelectionValue} onChange={(event) => chooseMerchant(event.target.value)} className={inputClass()} required>
            <option value="">{isArabic ? "اختر التاجر أو غرض شخصي *" : "Select merchant or personal purpose *"}</option>
            <option value={PERSONAL_ORDER_OPTION}>{isArabic ? "غرض شخصي — بدون تاجر" : "Personal purpose — no merchant"}</option>
            {merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchantOptionLabel(merchant)}</option>)}
          </select>
          <input data-admin-next-order-focus="true" value={form.coupon_number || ""} onChange={(event) => setField("coupon_number", event.target.value)} placeholder={isArabic ? "رقم الكوبون — اختياري" : "Coupon number — optional"} className={inputClass()} required dir="ltr" />
        </div>

        <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-brand-deep/35 p-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-white"><MapPin className="h-4 w-4 text-brand-gold" />{isArabic ? "بيانات العميل ومكان التسليم" : "Customer and delivery location"}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={form.receiver_name} onChange={(event) => setField("receiver_name", event.target.value)} placeholder={isArabic ? "اسم العميل — اختياري" : "Customer name — optional"} className={inputClass()} required />
            <input value={form.receiver_phone} onChange={(event) => setField("receiver_phone", event.target.value)} placeholder={isArabic ? "رقم تليفون العميل *" : "Customer phone — optional"} className={inputClass()} required dir="ltr" />
          </div>
          <select value={form.shipping_scope} onChange={(event) => setField("shipping_scope", event.target.value as "local" | "international")} className={inputClass()}>
            <option value="local">{isArabic ? "داخل الإمارات" : "Within UAE"}</option>
            <option value="international">{isArabic ? "شحن دولي" : "International"}</option>
          </select>
          {form.shipping_scope === "international" ? (
            <label className="space-y-1">
              <span className="text-[10px] font-black text-white/50">{isArabic ? "دولة التسليم *" : "Destination country *"}</span>
              <select value={form.destination_country || "SA"} onChange={(event) => setField("destination_country", event.target.value)} className={inputClass()}>
                {INTERNATIONAL_DESTINATIONS.map((country) => <option key={country.value} value={country.value}>{isArabic ? country.ar : country.en}</option>)}
              </select>
            </label>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[10px] font-black text-white/50">{isArabic ? "الإمارة *" : "Emirate *"}</span>
                <select value={form.delivery_city} onChange={(event) => setForm((current) => ({ ...current, delivery_city: event.target.value, delivery_area: getDefaultAreaForEmirate(event.target.value) }))} className={inputClass()}>
                  {UAE_LOCATIONS.map((location) => <option key={location.value} value={location.value}>{isArabic ? location.ar : location.en}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black text-white/50">{isArabic ? "المنطقة *" : "Area *"}</span>
                <select value={form.delivery_area || ""} onChange={(event) => setField("delivery_area", event.target.value)} className={inputClass()}>
                  {deliveryAreas.map((area) => <option key={area.value} value={area.value}>{isArabic ? area.ar : area.en}</option>)}
                </select>
              </label>
            </div>
          )}
          <input value={form.delivery_street || form.receiver_address} onChange={(event) => setForm((current) => ({ ...current, delivery_street: event.target.value, receiver_address: event.target.value }))} placeholder={isArabic ? "العنوان التفصيلي — اختياري" : "Detailed address — optional"} className={inputClass()} />
        </div>
      </section>

      <section className="mt-4 rounded-[1.7rem] border border-brand-gold/30 bg-[linear-gradient(135deg,rgba(212,175,55,0.11),rgba(11,95,255,0.08),rgba(3,18,38,0.55))] p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-base font-black text-white"><WalletCards className="h-5 w-5 text-brand-gold" />{isArabic ? "التقسيم المالي للطلب" : "Order financial breakdown"}</h3>
            <p className="mt-1 text-xs font-bold text-white/50">{isArabic ? "القيم الصفرية غير المهمة لا تظهر في الملخص، وتُثبت القيم الفعلية عند إنشاء الطلب." : "Unneeded zero values stay hidden; actual financial values are fixed when the order is created."}</p>
          </div>
          <span className="rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 py-1 text-[10px] font-black text-brand-gold">{isArabic ? "حساب تلقائي مباشر" : "Live automatic calculation"}</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-xs font-black text-white"><ReceiptText className="h-4 w-4 text-brand-sky" />{isArabic ? "قيمة البضاعة — يمكن أن تكون صفرًا" : "Goods value — zero allowed"}</span>
            <input type="number" min={0} step="0.01" data-admin-financial-input="true" name="dn_goods_value_no_history_20260805" autoComplete="off" aria-autocomplete="none" inputMode="decimal" data-form-type="other" data-lpignore="true" data-1p-ignore="true" value={form.goods_value} onChange={(event) => setField("goods_value", event.target.value)} placeholder="100.00" className={inputClass()} required />
            <small className="text-[10px] font-bold text-white/40">{isArabic ? "ثمن منتجات التاجر" : "Merchant product value"}</small>
          </label>
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-xs font-black text-white"><Calculator className="h-4 w-4 text-brand-sky" />{isArabic ? "قيمة التوصيل" : "Delivery fee"}</span>
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 p-2">
              <button type="button" onClick={() => { setField("price_mode", "system"); setField("manual_delivery_price", ""); }} className={`rounded-xl px-3 py-2 text-[10px] font-black ${form.price_mode !== "manual" ? "bg-brand-gold text-brand-deep" : "text-white/65"}`}>{isArabic ? `النظام ${pricing.systemTotal.toFixed(2)}` : `System ${pricing.systemTotal.toFixed(2)}`}</button>
              <button type="button" onClick={() => setField("price_mode", "manual")} className={`rounded-xl px-3 py-2 text-[10px] font-black ${form.price_mode === "manual" ? "bg-brand-gold text-brand-deep" : "text-white/65"}`}>{isArabic ? "يدوي" : "Manual"}</button>
            </div>
            {form.price_mode === "manual" ? <input type="number" min={0} step="0.01" data-admin-financial-input="true" value={form.manual_delivery_price ?? ""} onChange={(event) => setField("manual_delivery_price", event.target.value)} placeholder="25.00" className={inputClass()} /> : <div className="rounded-2xl border border-brand-sky/20 bg-brand-sky/5 px-4 py-3 text-lg font-black text-brand-sky" dir="ltr">{pricing.total.toFixed(2)} AED</div>}
          </label>
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-xs font-black text-white"><Landmark className="h-4 w-4 text-brand-sky" />{isArabic ? "الخصم — اختياري" : "Discount — optional"}</span>
            <input type="number" min={0} step="0.01" data-admin-financial-input="true" value={form.discount_amount ?? ""} onChange={(event) => setField("discount_amount", event.target.value)} placeholder={isArabic ? "اتركه فارغًا بدون خصم" : "Leave blank when there is no discount"} className={inputClass()} />
            <small className="text-[10px] font-bold text-white/40">{isArabic ? "لا يظهر في الملخص عندما تكون قيمته صفرًا" : "Hidden from the summary when its value is zero"}</small>
          </label>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setDeliveryFeeMode("customer_pays")} className={`rounded-2xl border p-4 text-start transition ${authoritativeDeliveryFeeMode === "customer_pays" ? "border-brand-gold/55 bg-brand-gold/15 text-brand-gold" : "border-white/10 bg-black/10 text-white/60"}`}>
            <strong className="block text-xs font-black">{isArabic ? "رسوم التوصيل تُضاف على العميل" : "Customer pays delivery fee"}</strong>
            <small className="mt-1 block text-[10px] font-bold opacity-70">{isArabic ? "الإجمالي = البضاعة + التوصيل − الخصم" : "Total = goods + delivery − discount"}</small>
          </button>
          <button type="button" onClick={() => setDeliveryFeeMode("deduct_from_merchant")} className={`rounded-2xl border p-4 text-start transition ${authoritativeDeliveryFeeMode === "deduct_from_merchant" ? "border-brand-gold/55 bg-brand-gold/15 text-brand-gold" : "border-white/10 bg-black/10 text-white/60"}`}>
            <strong className="block text-xs font-black">{isArabic ? "رسوم التوصيل على حساب التاجر" : "Charge delivery to merchant"}</strong>
            <small className="mt-1 block text-[10px] font-bold opacity-70">{isArabic ? "يظهر المبلغ بوضوح كمستحق على التاجر عند وجود رصيد عليه" : "A merchant liability is shown clearly as due from the merchant"}</small>
          </button>
        </div>

        {financials && settlement ? (
          <div className={`mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${financials.discountAmount > 0 ? "2xl:grid-cols-7" : "2xl:grid-cols-6"}`}>
            <FinancialMetric isArabic={isArabic} label={isArabic ? "قيمة البضاعة" : "Goods"} value={financials.goodsValue} />
            <FinancialMetric isArabic={isArabic} label={isArabic ? "التوصيل" : "Delivery"} value={financials.deliveryFee} />
            {financials.discountAmount > 0 && <FinancialMetric isArabic={isArabic} label={isArabic ? "الخصم" : "Discount"} value={financials.discountAmount} />}
            <FinancialMetric
                isArabic={isArabic}
                label={isArabic ? "المطلوب من العميل" : "Customer total"}
                value={financials.customerTotal}
                tone={merchantFeeModeActive ? "neutral" : "gold"}
              />
              <FinancialMetric
                isArabic={isArabic}
                label={settlement.label}
                value={settlement.amount}
                tone={
                  merchantDebitActive
                    ? "danger"
                    : "neutral"
                }
              />
            <FinancialMetric isArabic={isArabic} label={isArabic ? "دخل داي نايت" : "DAY NIGHT revenue"} value={financials.companyRevenue} />
              <FinancialMetric
                isArabic={isArabic}
                label={
                  financials.merchantDue < 0
                    ? isArabic
                      ? "إجمالي المستحق على التاجر"
                      : "Merchant debit total"
                    : merchantFeeModeActive
                      ? isArabic
                        ? "الإجمالي النهائي للتاجر"
                        : "Final merchant total"
                      : isArabic
                        ? "الإجمالي النهائي المطلوب من العميل"
                        : "Final customer total"
                }
                value={
                  merchantFeeModeActive
                    ? financials.merchantDue
                    : financials.customerTotal
                }
                tone={financials.merchantDue < 0 ? "danger" : "gold"}
              />
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-rose-400/25 bg-rose-400/8 p-3 text-xs font-bold text-rose-100">{isArabic ? "راجع الخصم والقيم المالية لإظهار الإجمالي." : "Check the discount and financial values to display totals."}</div>
        )}
      </section>


        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={saving || !financials}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-gold px-6 py-4 text-sm font-black text-brand-deep disabled:opacity-60 sm:w-auto sm:min-w-[280px]"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            {saving
              ? isArabic
                ? "جارٍ الحفظ..."
                : "Saving..."
              : isArabic
                ? "حفظ وبدء طلب جديد"
                : "Save and start next order"}
          </button>
        </div>
      </form>
  );
}
