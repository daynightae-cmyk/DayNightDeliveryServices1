import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Calculator, Camera, CheckCircle2, PackagePlus, RefreshCw, Save, ShieldCheck } from "lucide-react";
import type { MerchantCreateOrderResult, MerchantPortalCallbacks, MerchantPricingResult } from "./merchantCallbacks";
import { merchantMoney } from "./merchantFormatters";
import type { MerchantBranchViewModel, MerchantOrderFormDraft, MerchantProfileViewModel } from "./merchantViewModels";
import { MerchantButton, MerchantCard, MerchantField, MerchantSectionHeader } from "./MerchantUi";
import { MerchantCouponPhotoIntake } from "./MerchantCouponPhotoIntake";

export interface MerchantCreateOrderViewProps {
  merchant: MerchantProfileViewModel;
  branches: MerchantBranchViewModel[];
  callbacks: MerchantPortalCallbacks;
  isArabic: boolean;
  readOnly?: boolean;
  initialDraft?: Partial<MerchantOrderFormDraft>;
}

const emirates = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];
const steps = ["pickup", "recipient", "package", "service", "pricing", "review", "created"] as const;
type Step = (typeof steps)[number];

const stepLabels: Record<Step, { ar: string; en: string }> = {
  pickup: { ar: "الاستلام", en: "Pickup" },
  recipient: { ar: "المستلم", en: "Recipient" },
  package: { ar: "الطرد", en: "Package" },
  service: { ar: "الخدمة والدفع", en: "Service & payment" },
  pricing: { ar: "التسعير", en: "Pricing" },
  review: { ar: "المراجعة", en: "Review" },
  created: { ar: "تم الإنشاء", en: "Created" },
};

export function MerchantCreateOrderView({ merchant, branches, callbacks, isArabic, readOnly, initialDraft }: MerchantCreateOrderViewProps) {
  const [step, setStep] = useState<Step>("pickup");
  const [couponOpen, setCouponOpen] = useState(false);
  const [draft, setDraft] = useState<MerchantOrderFormDraft>({
    pickupAddress: merchant.pickupAddress || merchant.address || "",
    senderName: merchant.tradeName,
    senderPhone: merchant.phone || "",
    pickupEmirate: merchant.emirate || "Abu Dhabi",
    pickupCity: merchant.city || "",
    packageType: "parcel",
    pieces: 1,
    weight: 1,
    serviceType: "standard",
    paymentMethod: "sender_pays",
    deliveryFeeMode: "sender_pays",
    codAmount: 0,
    ...initialDraft,
  });
  const [pricing, setPricing] = useState<MerchantPricingResult | null>(null);
  const [result, setResult] = useState<MerchantCreateOrderResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const currentIndex = steps.indexOf(step);
  const selectedBranch = branches.find((branch) => branch.id === draft.pickupBranchId);

  function update<K extends keyof MerchantOrderFormDraft>(key: K, value: MerchantOrderFormDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    if (["pickupCity", "deliveryCity", "weight", "serviceType", "deliveryFeeMode"].includes(key)) setPricing(null);
  }

  const validation = useMemo(() => {
    if (step === "pickup") {
      if (!draft.senderName?.trim() || !draft.senderPhone?.trim() || !draft.pickupAddress?.trim() || !draft.pickupCity?.trim()) return isArabic ? "أكمل اسم المرسل والهاتف ومدينة وعنوان الاستلام." : "Complete sender name, phone, pickup city, and pickup address.";
    }
    if (step === "recipient") {
      if (!draft.recipientName?.trim() || !draft.recipientPhone?.trim() || !draft.deliveryCity?.trim() || !draft.deliveryAddress?.trim()) return isArabic ? "أكمل اسم المستلم والهاتف والمدينة والعنوان." : "Complete recipient name, phone, city, and address.";
      if (draft.recipientPhone.replace(/\D/g, "").length < 9) return isArabic ? "رقم هاتف المستلم غير مكتمل." : "Recipient phone number is incomplete.";
    }
    if (step === "package") {
      if (!draft.packageType || Number(draft.pieces || 0) < 1 || Number(draft.weight || 0) <= 0) return isArabic ? "حدد نوع الطرد والقطع والوزن." : "Select parcel type, pieces, and weight.";
    }
    if (step === "service") {
      if (!draft.serviceType || !draft.paymentMethod) return isArabic ? "حدد الخدمة وطريقة الدفع." : "Select service and payment method.";
      if (draft.paymentMethod === "cod" && Number(draft.codAmount || 0) <= 0) return isArabic ? "أدخل مبلغ COD الصحيح." : "Enter a valid COD amount.";
    }
    if (step === "pricing" && !pricing?.confirmed) return isArabic ? "يجب تأكيد السعر قبل المتابعة." : "Pricing must be confirmed before continuing.";
    return "";
  }, [draft, isArabic, pricing?.confirmed, step]);

  function next() {
    setError("");
    if (validation) { setError(validation); return; }
    setStep(steps[Math.min(currentIndex + 1, steps.length - 1)]);
  }
  function previous() {
    setError("");
    setStep(steps[Math.max(currentIndex - 1, 0)]);
  }

  async function calculatePrice() {
    setBusy(true);
    setError("");
    try {
      const response = await callbacks.onCalculatePrice(draft);
      setPricing(response);
      if (!response.confirmed) setError(response.error?.message || (isArabic ? "تعذر تأكيد السعر. يرجى إعادة المحاولة." : "Pricing could not be confirmed. Please retry."));
    } catch (priceError) {
      setError(priceError instanceof Error ? priceError.message : String(priceError));
    } finally { setBusy(false); }
  }

  async function createOrder() {
    if (readOnly) return;
    setBusy(true);
    setError("");
    try {
      const response = await callbacks.onCreateOrder(draft);
      setResult(response);
      if (response.success) setStep("created");
      else setError(response.error?.message || (isArabic ? "تعذر إنشاء الطلب." : "The order could not be created."));
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError));
    } finally { setBusy(false); }
  }

  function restart() {
    setStep("pickup");
    setPricing(null);
    setResult(null);
    setError("");
    setDraft((current) => ({ ...current, recipientName: "", recipientPhone: "", recipientAlternatePhone: "", recipientEmail: "", deliveryCity: "", deliveryAddress: "", deliveryArea: "", deliveryBuilding: "", deliveryFloor: "", deliveryLandmark: "", packageDescription: "", codAmount: 0, merchantReference: "", couponNumber: "" }));
  }

  const BackIcon = isArabic ? ArrowRight : ArrowLeft;
  const NextIcon = isArabic ? ArrowLeft : ArrowRight;

  if (couponOpen) return <MerchantCouponPhotoIntake isArabic={isArabic} onUpload={callbacks.onUploadCouponImage} onExtract={callbacks.onExtractCoupon} onClose={() => setCouponOpen(false)} onUseFields={(fields) => { setDraft((current) => ({ ...current, ...fields })); setCouponOpen(false); setStep("recipient"); }} />;

  return (
    <div className="dn-merchant-stack">
      <MerchantSectionHeader
        eyebrowAr="إنشاء شحنة"
        eyebrowEn="CREATE SHIPMENT"
        titleAr="نموذج واضح يمنع الأخطاء قبل الإرسال"
        titleEn="A clear workflow that prevents errors before submission"
        descriptionAr="سبع مراحل من الاستلام إلى رقم التتبع، مع تسعير مؤكد ومراجعة نهائية."
        descriptionEn="Seven stages from pickup to tracking, with confirmed pricing and final review."
        isArabic={isArabic}
        actions={<MerchantButton variant="secondary" onClick={() => setCouponOpen(true)}><Camera className="h-4 w-4" />{isArabic ? "إدخال كوبون بالتصوير" : "Coupon photo intake"}</MerchantButton>}
      />

      <ol className="dn-merchant-wizard-steps">
        {steps.map((item, index) => <li key={item} className={`${item === step ? "is-active" : ""} ${index < currentIndex ? "is-complete" : ""}`}><i>{index < currentIndex ? <CheckCircle2 className="h-4 w-4" /> : index + 1}</i><span>{isArabic ? stepLabels[item].ar : stepLabels[item].en}</span></li>)}
      </ol>

      {step === "pickup" ? (
        <MerchantCard>
          <header className="dn-merchant-card-header"><div><span>01</span><h3>{isArabic ? "بيانات الاستلام" : "Pickup details"}</h3></div></header>
          <div className="dn-merchant-form-grid">
            <MerchantField label={isArabic ? "الفرع" : "Branch"}><select value={draft.pickupBranchId || ""} onChange={(event) => { update("pickupBranchId", event.target.value); const branch = branches.find((item) => item.id === event.target.value); if (branch) { update("pickupAddress", branch.address || ""); update("pickupCity", branch.city || ""); update("pickupEmirate", branch.emirate || ""); update("senderName", branch.contactName || merchant.tradeName); update("senderPhone", branch.phone || merchant.phone || ""); } }}><option value="">{isArabic ? "الفرع الرئيسي/الملف" : "Profile default"}</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></MerchantField>
            <MerchantField label={isArabic ? "اسم المرسل" : "Sender name"} required><input value={draft.senderName || ""} onChange={(event) => update("senderName", event.target.value)} /></MerchantField>
            <MerchantField label={isArabic ? "هاتف المرسل" : "Sender phone"} required><input value={draft.senderPhone || ""} onChange={(event) => update("senderPhone", event.target.value)} dir="ltr" /></MerchantField>
            <MerchantField label={isArabic ? "الإمارة" : "Emirate"}><select value={draft.pickupEmirate || ""} onChange={(event) => update("pickupEmirate", event.target.value)}>{emirates.map((emirate) => <option key={emirate}>{emirate}</option>)}</select></MerchantField>
            <MerchantField label={isArabic ? "المدينة" : "City"} required><input value={draft.pickupCity || ""} onChange={(event) => update("pickupCity", event.target.value)} /></MerchantField>
            <MerchantField label={isArabic ? "المنطقة" : "Area"}><input value={draft.pickupArea || ""} onChange={(event) => update("pickupArea", event.target.value)} /></MerchantField>
            <MerchantField label={isArabic ? "عنوان الاستلام" : "Pickup address"} required><textarea value={draft.pickupAddress || ""} onChange={(event) => update("pickupAddress", event.target.value)} rows={3} /></MerchantField>
            <MerchantField label={isArabic ? "المبنى/الفيلا" : "Building / villa"}><input value={draft.pickupBuilding || ""} onChange={(event) => update("pickupBuilding", event.target.value)} /></MerchantField>
            <MerchantField label={isArabic ? "الطابق/الوحدة" : "Floor / unit"}><input value={draft.pickupFloor || ""} onChange={(event) => update("pickupFloor", event.target.value)} /></MerchantField>
            <MerchantField label={isArabic ? "علامة مميزة" : "Landmark"}><input value={draft.pickupLandmark || ""} onChange={(event) => update("pickupLandmark", event.target.value)} /></MerchantField>
            <MerchantField label={isArabic ? "موعد الاستلام المطلوب" : "Requested pickup time"}><input type="datetime-local" value={draft.pickupTime || ""} onChange={(event) => update("pickupTime", event.target.value)} /></MerchantField>
            <MerchantField label={isArabic ? "مرجع التاجر" : "Merchant reference"}><input value={draft.merchantReference || ""} onChange={(event) => update("merchantReference", event.target.value)} dir="ltr" /></MerchantField>
            <MerchantField label={isArabic ? "رقم الكوبون" : "Coupon number"}><input value={draft.couponNumber || ""} onChange={(event) => update("couponNumber", event.target.value)} dir="ltr" /></MerchantField>
            <MerchantField label={isArabic ? "تعليمات الاستلام" : "Pickup instructions"}><textarea value={draft.pickupInstructions || ""} onChange={(event) => update("pickupInstructions", event.target.value)} rows={3} /></MerchantField>
          </div>
          {selectedBranch ? <p className="dn-merchant-form-note">{isArabic ? `تم تطبيق بيانات ${selectedBranch.name}.` : `${selectedBranch.name} defaults were applied.`}</p> : null}
        </MerchantCard>
      ) : null}

      {step === "recipient" ? (
        <MerchantCard><header className="dn-merchant-card-header"><div><span>02</span><h3>{isArabic ? "بيانات المستلم" : "Recipient details"}</h3></div></header><div className="dn-merchant-form-grid">
          <MerchantField label={isArabic ? "اسم المستلم" : "Recipient name"} required><input value={draft.recipientName || ""} onChange={(event) => update("recipientName", event.target.value)} /></MerchantField>
          <MerchantField label={isArabic ? "الهاتف الأساسي" : "Primary phone"} required><input value={draft.recipientPhone || ""} onChange={(event) => update("recipientPhone", event.target.value)} dir="ltr" /></MerchantField>
          <MerchantField label={isArabic ? "الهاتف البديل" : "Alternate phone"}><input value={draft.recipientAlternatePhone || ""} onChange={(event) => update("recipientAlternatePhone", event.target.value)} dir="ltr" /></MerchantField>
          <MerchantField label={isArabic ? "البريد" : "Email"}><input type="email" value={draft.recipientEmail || ""} onChange={(event) => update("recipientEmail", event.target.value)} dir="ltr" /></MerchantField>
          <MerchantField label={isArabic ? "الإمارة" : "Emirate"}><select value={draft.deliveryEmirate || "Abu Dhabi"} onChange={(event) => update("deliveryEmirate", event.target.value)}>{emirates.map((emirate) => <option key={emirate}>{emirate}</option>)}</select></MerchantField>
          <MerchantField label={isArabic ? "المدينة" : "City"} required><input value={draft.deliveryCity || ""} onChange={(event) => update("deliveryCity", event.target.value)} /></MerchantField>
          <MerchantField label={isArabic ? "المنطقة" : "Area"}><input value={draft.deliveryArea || ""} onChange={(event) => update("deliveryArea", event.target.value)} /></MerchantField>
          <MerchantField label={isArabic ? "العنوان الكامل" : "Full address"} required><textarea value={draft.deliveryAddress || ""} onChange={(event) => update("deliveryAddress", event.target.value)} rows={3} /></MerchantField>
          <MerchantField label={isArabic ? "المبنى/الفيلا" : "Building / villa"}><input value={draft.deliveryBuilding || ""} onChange={(event) => update("deliveryBuilding", event.target.value)} /></MerchantField>
          <MerchantField label={isArabic ? "الطابق/الشقة" : "Floor / apartment"}><input value={draft.deliveryFloor || ""} onChange={(event) => update("deliveryFloor", event.target.value)} /></MerchantField>
          <MerchantField label={isArabic ? "علامة مميزة" : "Landmark"}><input value={draft.deliveryLandmark || ""} onChange={(event) => update("deliveryLandmark", event.target.value)} /></MerchantField>
          <MerchantField label={isArabic ? "تعليمات التسليم" : "Delivery instructions"}><textarea value={draft.deliveryInstructions || ""} onChange={(event) => update("deliveryInstructions", event.target.value)} rows={3} /></MerchantField>
        </div></MerchantCard>
      ) : null}

      {step === "package" ? (
        <MerchantCard><header className="dn-merchant-card-header"><div><span>03</span><h3>{isArabic ? "بيانات الطرد" : "Package details"}</h3></div></header><div className="dn-merchant-form-grid">
          <MerchantField label={isArabic ? "نوع الطرد" : "Package type"} required><select value={draft.packageType || "parcel"} onChange={(event) => update("packageType", event.target.value)}><option value="parcel">{isArabic ? "طرد" : "Parcel"}</option><option value="documents">{isArabic ? "مستندات" : "Documents"}</option><option value="food">{isArabic ? "طعام" : "Food"}</option><option value="pharmacy">{isArabic ? "صيدلية/حساس" : "Pharmacy / sensitive"}</option><option value="other">{isArabic ? "أخرى" : "Other"}</option></select></MerchantField>
          <MerchantField label={isArabic ? "عدد القطع" : "Pieces"} required><input type="number" min="1" value={draft.pieces || 1} onChange={(event) => update("pieces", Math.max(1, Number(event.target.value) || 1))} /></MerchantField>
          <MerchantField label={isArabic ? "الوزن بالكيلو" : "Weight (kg)"} required><input type="number" min="0.1" step="0.1" value={draft.weight || 1} onChange={(event) => update("weight", Number(event.target.value) || 0)} /></MerchantField>
          <MerchantField label={isArabic ? "الأبعاد" : "Dimensions"}><input value={draft.dimensions || ""} onChange={(event) => update("dimensions", event.target.value)} placeholder="30 × 20 × 15 cm" dir="ltr" /></MerchantField>
          <MerchantField label={isArabic ? "قيمة البضاعة" : "Goods value"}><input type="number" min="0" step="0.01" value={draft.goodsValue ?? ""} onChange={(event) => update("goodsValue", Number(event.target.value) || 0)} /></MerchantField>
          <MerchantField label={isArabic ? "وصف المحتوى" : "Contents description"}><textarea value={draft.packageDescription || ""} onChange={(event) => update("packageDescription", event.target.value)} rows={3} /></MerchantField>
          <label className="dn-merchant-checkbox"><input type="checkbox" checked={Boolean(draft.fragile)} onChange={(event) => update("fragile", event.target.checked)} /><span>{isArabic ? "قابل للكسر" : "Fragile"}</span></label>
          <label className="dn-merchant-checkbox"><input type="checkbox" checked={Boolean(draft.temperatureSensitive)} onChange={(event) => update("temperatureSensitive", event.target.checked)} /><span>{isArabic ? "حساس للحرارة" : "Temperature sensitive"}</span></label>
          <MerchantField label={isArabic ? "تعليمات خاصة" : "Special handling"}><textarea value={draft.specialHandling || ""} onChange={(event) => update("specialHandling", event.target.value)} rows={3} /></MerchantField>
        </div></MerchantCard>
      ) : null}

      {step === "service" ? (
        <MerchantCard><header className="dn-merchant-card-header"><div><span>04</span><h3>{isArabic ? "الخدمة وطريقة الدفع" : "Service and payment"}</h3></div></header><div className="dn-merchant-choice-grid">
          {[{ value: "standard", ar: "توصيل عادي", en: "Standard delivery" }, { value: "express", ar: "توصيل سريع", en: "Express delivery" }, { value: "scheduled", ar: "موعد مجدول", en: "Scheduled delivery" }, { value: "international", ar: "شحن دولي", en: "International shipping" }].map((item) => <button type="button" key={item.value} className={draft.serviceType === item.value ? "is-selected" : ""} onClick={() => update("serviceType", item.value)}><ShieldCheck className="h-5 w-5" /><strong>{isArabic ? item.ar : item.en}</strong></button>)}
        </div><div className="dn-merchant-form-grid">
          <MerchantField label={isArabic ? "طريقة الدفع" : "Payment method"} required><select value={draft.paymentMethod || "sender_pays"} onChange={(event) => update("paymentMethod", event.target.value)}><option value="sender_pays">{isArabic ? "المرسل يدفع" : "Sender pays"}</option><option value="receiver_pays">{isArabic ? "المستلم يدفع الرسوم" : "Receiver pays fee"}</option><option value="cod">COD</option><option value="prepaid">{isArabic ? "مدفوع مسبقاً" : "Prepaid"}</option></select></MerchantField>
          <MerchantField label={isArabic ? "معالجة رسوم التوصيل" : "Delivery-fee treatment"}><select value={draft.deliveryFeeMode || "sender_pays"} onChange={(event) => update("deliveryFeeMode", event.target.value)}><option value="sender_pays">{isArabic ? "تُدفع من التاجر" : "Merchant pays"}</option><option value="receiver_pays">{isArabic ? "يدفعها المستلم" : "Receiver pays"}</option><option value="deduct_from_merchant">{isArabic ? "تُخصم من مستحق التاجر" : "Deduct from merchant due"}</option></select></MerchantField>
          {draft.paymentMethod === "cod" ? <MerchantField label="COD (AED)" required><input type="number" min="0" step="0.01" value={draft.codAmount ?? ""} onChange={(event) => update("codAmount", Number(event.target.value) || 0)} dir="ltr" /></MerchantField> : null}
        </div></MerchantCard>
      ) : null}

      {step === "pricing" ? (
        <MerchantCard tone="gold"><header className="dn-merchant-card-header"><div><span>05</span><h3>{isArabic ? "التسعير المؤكد" : "Confirmed pricing"}</h3></div><Calculator className="h-5 w-5" /></header>
          {!pricing ? <div className="dn-merchant-pricing-empty"><p>{isArabic ? "اضغط لحساب السعر من محرك التسعير المتصل بالنظام." : "Calculate the price through the connected pricing engine."}</p><MerchantButton disabled={busy} onClick={() => void calculatePrice()}>{busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}{isArabic ? "حساب السعر" : "Calculate price"}</MerchantButton></div> : <div className="dn-merchant-price-breakdown"><dl><div><dt>{isArabic ? "المصدر" : "Source"}</dt><dd>{pricing.source}</dd></div><div><dt>{isArabic ? "السعر الأساسي" : "Base fee"}</dt><dd>{merchantMoney(pricing.baseFee, "AED", isArabic ? "ar-AE" : "en-AE")}</dd></div><div><dt>{isArabic ? "الوزن" : "Weight fee"}</dt><dd>{merchantMoney(pricing.weightFee, "AED", isArabic ? "ar-AE" : "en-AE")}</dd></div><div><dt>{isArabic ? "الخدمة" : "Service surcharge"}</dt><dd>{merchantMoney(pricing.serviceSurcharge, "AED", isArabic ? "ar-AE" : "en-AE")}</dd></div><div><dt>{isArabic ? "المناطق البعيدة" : "Remote-area surcharge"}</dt><dd>{merchantMoney(pricing.remoteAreaSurcharge, "AED", isArabic ? "ar-AE" : "en-AE")}</dd></div><div><dt>{isArabic ? "الخصم" : "Discount"}</dt><dd>{merchantMoney(pricing.discount, "AED", isArabic ? "ar-AE" : "en-AE")}</dd></div><div><dt>{isArabic ? "الضريبة" : "Tax"}</dt><dd>{merchantMoney(pricing.tax, "AED", isArabic ? "ar-AE" : "en-AE")}</dd></div></dl><footer><span>{isArabic ? "الإجمالي" : "Total"}</span><strong>{merchantMoney(pricing.total, "AED", isArabic ? "ar-AE" : "en-AE")}</strong><MerchantButton variant="secondary" disabled={busy} onClick={() => void calculatePrice()}><RefreshCw className="h-4 w-4" />{isArabic ? "إعادة الحساب" : "Recalculate"}</MerchantButton></footer></div>}
        </MerchantCard>
      ) : null}

      {step === "review" ? (
        <MerchantCard><header className="dn-merchant-card-header"><div><span>06</span><h3>{isArabic ? "المراجعة النهائية" : "Final review"}</h3></div><ShieldCheck className="h-5 w-5" /></header><div className="dn-merchant-review-grid">
          <section><h4>{isArabic ? "الاستلام" : "Pickup"}</h4><p>{draft.senderName} · <span dir="ltr">{draft.senderPhone}</span></p><p>{draft.pickupCity} · {draft.pickupAddress}</p><button type="button" onClick={() => setStep("pickup")}>{isArabic ? "تعديل" : "Edit"}</button></section>
          <section><h4>{isArabic ? "المستلم" : "Recipient"}</h4><p>{draft.recipientName} · <span dir="ltr">{draft.recipientPhone}</span></p><p>{draft.deliveryCity} · {draft.deliveryAddress}</p><button type="button" onClick={() => setStep("recipient")}>{isArabic ? "تعديل" : "Edit"}</button></section>
          <section><h4>{isArabic ? "الطرد" : "Package"}</h4><p>{draft.packageType} · {draft.pieces} pcs · {draft.weight} kg</p><p>{draft.packageDescription || "—"}</p><button type="button" onClick={() => setStep("package")}>{isArabic ? "تعديل" : "Edit"}</button></section>
          <section><h4>{isArabic ? "الدفع" : "Payment"}</h4><p>{draft.serviceType} · {draft.paymentMethod}</p><p>COD: {merchantMoney(draft.codAmount || 0, "AED", isArabic ? "ar-AE" : "en-AE")}</p><button type="button" onClick={() => setStep("service")}>{isArabic ? "تعديل" : "Edit"}</button></section>
        </div><div className="dn-merchant-review-total"><span>{isArabic ? "السعر المؤكد" : "Confirmed price"}</span><strong>{merchantMoney(pricing?.total, "AED", isArabic ? "ar-AE" : "en-AE")}</strong><small>{isArabic ? "لن يتم إنشاء الطلب إلا بعد تأكيد النظام." : "The order is created only after authoritative confirmation."}</small></div><MerchantButton disabled={busy || readOnly} onClick={() => void createOrder()}>{busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{isArabic ? "تأكيد وإنشاء الطلب" : "Confirm and create order"}</MerchantButton></MerchantCard>
      ) : null}

      {step === "created" ? (
        <MerchantCard className="dn-merchant-created-result" tone="navy"><span><CheckCircle2 className="h-10 w-10" /></span><h3>{isArabic ? "تم إنشاء الطلب بنجاح" : "Order created successfully"}</h3><p>{isArabic ? "البيانات التالية عادت من عملية الإنشاء الفعلية." : "The following values were returned by the authoritative creation operation."}</p><dl><div><dt>{isArabic ? "رقم التتبع" : "Tracking"}</dt><dd dir="ltr">{result?.trackingNumber || "—"}</dd></div><div><dt>{isArabic ? "الفاتورة" : "Invoice"}</dt><dd dir="ltr">{result?.invoiceNumber || "—"}</dd></div><div><dt>{isArabic ? "المبلغ" : "Amount"}</dt><dd>{merchantMoney(result?.amount, "AED", isArabic ? "ar-AE" : "en-AE")}</dd></div><div><dt>{isArabic ? "وقت الإنشاء" : "Created at"}</dt><dd>{result?.createdAt || "—"}</dd></div></dl><footer><MerchantButton variant="gold" onClick={() => result?.orderId && callbacks.onOpenOrder(result.orderId)}>{isArabic ? "فتح الطلب" : "Open order"}</MerchantButton><MerchantButton variant="secondary" onClick={restart}><PackagePlus className="h-4 w-4" />{isArabic ? "إنشاء طلب آخر" : "Create another"}</MerchantButton><MerchantButton variant="ghost" onClick={() => callbacks.onNavigate("orders", undefined)}>{isArabic ? "جميع الطلبات" : "All orders"}</MerchantButton></footer></MerchantCard>
      ) : null}

      {error ? <p className="dn-merchant-form-error">{error}</p> : null}
      {!['created'].includes(step) ? <footer className="dn-merchant-wizard-footer">{currentIndex > 0 ? <MerchantButton variant="secondary" onClick={previous}><BackIcon className="h-4 w-4" />{isArabic ? "السابق" : "Back"}</MerchantButton> : <span />}{step !== "review" ? <MerchantButton disabled={Boolean(validation) || busy} onClick={next}>{isArabic ? "التالي" : "Next"}<NextIcon className="h-4 w-4" /></MerchantButton> : null}</footer> : null}
    </div>
  );
}
