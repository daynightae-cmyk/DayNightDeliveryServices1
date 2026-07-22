/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import type { Order } from "../types";
import { createPublicOrder } from "../supabase";
import { canSubmitDeliveryRequest } from "../lib/security";
import { reportError, trackApiCall } from "../lib/monitoring";
import { isValidOperationalPhone, normalizePhoneForStorage, phoneHelpText } from "../lib/phoneValidation";
import { createPublicCouponIntakeAudit } from "../lib/couponIntakeData";
import QRGenerator from "./QRGenerator";
import Invoice from "./Invoice";
import ShippingLabel from "./ShippingLabel";
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Copy,
  FileText,
  MessageSquare,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { exportOrderPDF, exportOrderTXT } from "../lib/exportUtils";
import { useAppContext } from "../lib/AppContext";
import { translations } from "../data/translations";
import TurnstileCaptcha from "./security/TurnstileCaptcha";
import CouponPhotoIntake, { type CouponPhotoReview } from "./shared/CouponPhotoIntake";

interface RequestDeliveryProps {
  onNavigate: (tab: string, trackingId?: string) => void;
}

const LOCAL_DELIVERY_PRICE = 25;
const LOCAL_PACKAGE_WEIGHT = 1;
const LOCAL_PACKAGE_PIECES = 1;
const LOCAL_SERVICE_TYPE = "standard" as const;

const mainCities = ["أبوظبي", "دبي", "الشارقة", "عجمان", "أم القيوين", "رأس الخيمة", "الفجيرة", "خورفكان"];
const extendedCities = ["العين (Al Ain)", "المنطقة الغربية (Western Region)", "السلع", "الرويس", "غياثي", "ليوا"];
const allCities = [...mainCities, ...extendedCities];

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function toPublicCity(value: unknown) {
  const normalized = clean(value).toLowerCase();
  const cityMap: Record<string, string> = {
    "abu dhabi": "أبوظبي",
    abudhabi: "أبوظبي",
    dubai: "دبي",
    sharjah: "الشارقة",
    ajman: "عجمان",
    "umm al quwain": "أم القيوين",
    "ras al khaimah": "رأس الخيمة",
    fujairah: "الفجيرة",
    khorfakkan: "خورفكان",
    "al ain": "العين (Al Ain)",
    "western region": "المنطقة الغربية (Western Region)",
  };
  if (cityMap[normalized]) return cityMap[normalized];
  return allCities.find((city) => city.toLowerCase() === normalized) || clean(value) || "دبي";
}

function sourceLabel(review: CouponPhotoReview, isArabic: boolean) {
  if (review.result.source === "barcode") return isArabic ? "QR / باركود" : "QR / barcode";
  if (review.result.source === "ocr") return isArabic ? "OCR من الصورة" : "Image OCR";
  return isArabic ? "نص يدوي" : "Manual text";
}

export default function RequestDelivery({ onNavigate }: RequestDeliveryProps) {
  const { language } = useAppContext();
  const t = translations[language];
  const isArabic = language === "ar";
  const captchaSiteKey = String(((import.meta as any).env?.VITE_TURNSTILE_SITE_KEY || "")).trim();
  const captchaEnabled = Boolean(captchaSiteKey);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [successId, setSuccessId] = useState("");
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [validationError, setValidationError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [couponReview, setCouponReview] = useState<CouponPhotoReview | null>(null);
  const [couponReviewConfirmed, setCouponReviewConfirmed] = useState(false);
  const [couponAuditWarning, setCouponAuditWarning] = useState("");
  const [intakeKey, setIntakeKey] = useState(0);

  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [senderCity, setSenderCity] = useState("أبوظبي");
  const [senderAddress, setSenderAddress] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverCity, setReceiverCity] = useState("دبي");
  const [receiverAddress, setReceiverAddress] = useState("");
  const [packageType, setPackageType] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<Order["payment_method"]>("sender_pays");
  const [codAmount, setCodAmount] = useState("");
  const [notes, setNotes] = useState("");

  const deliveryPricing = {
    subtotal: LOCAL_DELIVERY_PRICE,
    total: LOCAL_DELIVERY_PRICE,
    currency: "AED",
    pricingCategory: "UAE Local Delivery",
    billableWeight: LOCAL_PACKAGE_WEIGHT,
    requiresCustomQuote: false,
    breakdown: [isArabic ? "توصيل محلي داخل الإمارات: 25.00 AED" : "UAE local delivery: 25.00 AED"],
    notes: isArabic ? "السعر المحلي ثابت ولا يعتمد على الوزن أو عدد القطع." : "Local delivery fee is fixed and does not depend on weight or pieces.",
  };
  const deliveryPrice = deliveryPricing.total;
  const priceMismatch = couponReview?.extractedDeliveryFee !== null
    && couponReview?.extractedDeliveryFee !== undefined
    && Math.abs(couponReview.extractedDeliveryFee - deliveryPrice) > 0.01;

  const i18n = isArabic
    ? {
        senderRequired: "يرجى إكمال بيانات المرسل الأساسية قبل إرسال الطلب.",
        receiverRequired: "يرجى إكمال بيانات المستلم الأساسية قبل إرسال الطلب.",
        invalidPhone: "اكتب رقم هاتف محلياً مثل 0501234567 أو دولياً مثل +971501234567.",
        basicSelections: "يرجى كتابة محتوى الشحنة واختيار طريقة الدفع.",
        invalidPrice: "تعذر احتساب سعر التوصيل. راجع البيانات وحاول مجدداً.",
        invalidCod: "يرجى إدخال مبلغ تحصيل صحيح.",
        captchaRequired: "يرجى تأكيد التحقق الأمني قبل إرسال الطلب.",
        orderCreateFailed: "تعذر إنشاء الطلب الحقيقي حالياً. حاول مجدداً أو تواصل عبر واتساب.",
        senderStepRequired: "يرجى ملء كافة تفاصيل المرسل الإلزامية للمتابعة.",
        receiverStepRequired: "يرجى تعبئة كافة بيانات المستلم الإلزامية للمتابعة.",
        senderStepPhone: "رقم هاتف المرسل غير واضح.",
        receiverStepPhone: "رقم هاتف المستلم غير واضح.",
        couponReviewRequired: "راجع البيانات المستخرجة من الكوبون ثم أكد المراجعة اليدوية قبل الإرسال.",
      }
    : {
        senderRequired: "Please complete sender details before submitting.",
        receiverRequired: "Please complete receiver details before submitting.",
        invalidPhone: "Use a local number such as 0501234567 or an international number such as +971501234567.",
        basicSelections: "Please describe the shipment and choose a payment method.",
        invalidPrice: "The delivery price could not be calculated. Review the data and retry.",
        invalidCod: "Please enter a valid collection amount.",
        captchaRequired: "Please complete the security verification before submitting.",
        orderCreateFailed: "The real order could not be created right now. Retry or contact WhatsApp support.",
        senderStepRequired: "Please complete all required sender details.",
        receiverStepRequired: "Please complete all required receiver details.",
        senderStepPhone: "The sender phone is not clear.",
        receiverStepPhone: "The receiver phone is not clear.",
        couponReviewRequired: "Review the coupon-extracted data and confirm manual review before submitting.",
      };

  function applyCouponReview(review: CouponPhotoReview) {
    const fields = review.result.fields;
    setCouponReview(review);
    setCouponReviewConfirmed(false);
    setValidationError("");
    setCouponAuditWarning("");
    if (clean(fields.receiver_name)) setReceiverName(clean(fields.receiver_name));
    if (clean(fields.receiver_phone)) setReceiverPhone(clean(fields.receiver_phone));
    if (clean(fields.delivery_city)) setReceiverCity(toPublicCity(fields.delivery_city));
    const importedAddress = clean(fields.receiver_address || fields.delivery_street);
    if (importedAddress) setReceiverAddress(importedAddress);
    if (clean(fields.package_type)) setPackageType(clean(fields.package_type));
    if (Number(fields.cod_amount || 0) > 0) {
      setPaymentMethod("cod");
      setCodAmount(clean(fields.cod_amount));
    }
    const couponNumber = clean(fields.coupon_number);
    const auditNote = isArabic
      ? `مصدر الطلب: كوبون مصور (${sourceLabel(review, true)})، ثقة القراءة ${review.confidence}%، تمت المراجعة قبل الإرسال${couponNumber ? `، رقم الكوبون ${couponNumber}` : ""}.`
      : `Request source: coupon photo (${sourceLabel(review, false)}), ${review.confidence}% extraction confidence, reviewed before submission${couponNumber ? `, coupon ${couponNumber}` : ""}.`;
    setNotes((current) => [clean(current), auditNote].filter(Boolean).join("\n"));
    setStep(2);
  }

  function clearCouponReview() {
    setCouponReview(null);
    setCouponReviewConfirmed(false);
    setCouponAuditWarning("");
  }

  function validateOrderFields() {
    if (!senderName.trim() || !senderPhone.trim() || !senderCity || !senderAddress.trim()) return i18n.senderRequired;
    if (!receiverName.trim() || !receiverPhone.trim() || !receiverCity || !receiverAddress.trim()) return i18n.receiverRequired;
    if (!isValidOperationalPhone(senderPhone, "any") || !isValidOperationalPhone(receiverPhone, "any")) return i18n.invalidPhone;
    if (!packageType.trim() || !paymentMethod) return i18n.basicSelections;
    if (!Number.isFinite(deliveryPrice) || deliveryPrice <= 0) return i18n.invalidPrice;
    if (paymentMethod === "cod" && (!Number.isFinite(Number(codAmount)) || Number(codAmount) <= 0)) return i18n.invalidCod;
    if (couponReview && !couponReviewConfirmed) return i18n.couponReviewRequired;
    if (captchaEnabled && !captchaToken) return i18n.captchaRequired;
    return "";
  }

  function resetForm() {
    setStep(1);
    setValidationError("");
    setSuccessId("");
    setCreatedOrder(null);
    setSenderName("");
    setSenderPhone("");
    setSenderCity("أبوظبي");
    setSenderAddress("");
    setReceiverName("");
    setReceiverPhone("");
    setReceiverCity("دبي");
    setReceiverAddress("");
    setPackageType("");
    setPaymentMethod("sender_pays");
    setNotes("");
    setCodAmount("");
    setCaptchaToken("");
    setCouponReview(null);
    setCouponReviewConfirmed(false);
    setCouponAuditWarning("");
    setIntakeKey((value) => value + 1);
  }

  async function handleFormSubmit() {
    setValidationError("");
    const validationMessage = validateOrderFields();
    if (validationMessage) {
      setValidationError(validationMessage);
      return;
    }

    setLoading(true);
    const limitCheck = canSubmitDeliveryRequest();
    if (!limitCheck.allowed) {
      setLoading(false);
      setValidationError(isArabic ? "تجاوزت الحد اليومي لمحاولات الطلب. حاول لاحقاً." : "You reached the daily request limit. Try later.");
      return;
    }

    const now = new Date().toISOString();
    const statusHistory = [{ status: "pending", date: new Date().toLocaleString(), note: isArabic ? "تم استلام الطلب إلكترونياً وجاري المراجعة." : "The request was received electronically and is under review." }];
    const shipmentDescription = packageType.trim();
    const couponFields = couponReview?.result.fields;
    const newOrder = {
      sender_name: senderName.trim(),
      sender_phone: normalizePhoneForStorage(senderPhone),
      sender_city: senderCity,
      sender_address: senderAddress.trim(),
      receiver_name: receiverName.trim(),
      receiver_phone: normalizePhoneForStorage(receiverPhone),
      receiver_city: receiverCity,
      receiver_address: receiverAddress.trim(),
      package_type: shipmentDescription,
      package_description: shipmentDescription,
      weight: LOCAL_PACKAGE_WEIGHT,
      pieces: LOCAL_PACKAGE_PIECES,
      service_type: LOCAL_SERVICE_TYPE,
      delivery_price: deliveryPrice,
      subtotal: deliveryPricing.subtotal,
      base_price: deliveryPricing.subtotal,
      total: deliveryPricing.total,
      total_price: deliveryPricing.total,
      amount: deliveryPricing.total,
      price: deliveryPricing.total,
      currency: "AED",
      source_domain: "daynightae.com",
      source_channel: couponReview ? "public_coupon_photo" : "public_request",
      coupon_number: clean(couponFields?.coupon_number) || null,
      captcha_token: captchaToken || null,
      payment_method: paymentMethod,
      cod_amount: paymentMethod === "cod" ? Number(codAmount) : null,
      notes: notes.trim() || "N/A",
      status: "pending",
      created_at: now,
      status_history: statusHistory,
    };

    try {
      const returnedId = await trackApiCall("create_public_order", () => createPublicOrder(newOrder));
      if (!returnedId) {
        setValidationError(i18n.orderCreateFailed);
        return;
      }

      const trackingCode = String(returnedId);
      if (couponReview) {
        const audit = await createPublicCouponIntakeAudit({ review: couponReview, trackingNumber: trackingCode });
        if (audit.warning) setCouponAuditWarning(isArabic ? "تم إنشاء الطلب، لكن سجل الكوبون يحتاج تطبيق migration." : "The order was created, but the coupon audit requires the migration.");
      }
      setSuccessId(trackingCode);
      setCreatedOrder({ id: trackingCode, ...(newOrder as Omit<Order, "id">) });
      setStep(4);
    } catch (cause) {
      reportError(cause, "request_delivery_submit");
      setValidationError(i18n.orderCreateFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8" dir={isArabic ? "rtl" : "ltr"}>
      {step < 4 && (
        <CouponPhotoIntake key={intakeKey} isArabic={isArabic} mode="public" onReview={applyCouponReview} onClear={clearCouponReview} />
      )}

      {couponReview && step < 4 && (
        <div className="space-y-3 rounded-3xl border border-brand-gold/25 bg-brand-gold/5 p-4">
          <div className="flex items-start gap-2 text-xs font-bold leading-6 text-white/70">
            <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-brand-gold" />
            <span>{isArabic ? "البيانات المستخرجة ليست نهائية. عدّل أي خطأ في النموذج ثم أكد أنك راجعتها." : "Extracted data is not final. Correct the form and confirm that you reviewed it."}</span>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-brand-deep/55 p-3 text-xs font-black text-white/80">
            <input type="checkbox" checked={couponReviewConfirmed} onChange={(event) => setCouponReviewConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-400" />
            <span>{isArabic ? "راجعت الاسم والهاتف والعنوان والتحصيل وأوافق على إرسال البيانات المصححة." : "I reviewed the name, phone, address, and COD amount and approve the corrected data."}</span>
          </label>
          {priceMismatch && couponReview.extractedDeliveryFee !== null && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs font-bold leading-6 text-amber-100">
              <AlertTriangle className="mt-1 h-4 w-4 shrink-0" />
              <span>{isArabic ? `سعر الكوبون ${couponReview.extractedDeliveryFee.toFixed(2)} درهم يختلف عن سعر النظام ${deliveryPrice.toFixed(2)} درهم. سيتم اعتماد سعر النظام.` : `Coupon fee ${couponReview.extractedDeliveryFee.toFixed(2)} AED differs from the system fee ${deliveryPrice.toFixed(2)} AED. The system fee will be used.`}</span>
            </div>
          )}
        </div>
      )}

      {step < 4 && (
        <div className="mx-auto flex max-w-xl items-center justify-between border-b border-white/10 pb-5 text-sm font-bold">
          {[1, 2, 3].map((number, index) => (
            <div key={number} className="contents">
              {index > 0 && <ChevronRight className={`h-4 w-4 text-white/20 ${isArabic ? "rotate-180" : ""}`} />}
              <div className={`flex items-center gap-2 ${step >= number ? "text-brand-gold" : "text-white/40"}`}>
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-brand-deep text-xs font-mono text-white">{number}</span>
                <span>{number === 1 ? (isArabic ? "المرسل" : "Sender") : number === 2 ? (isArabic ? "المستلم" : "Receiver") : (isArabic ? "الشحنة والدفع" : "Shipment & payment")}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {validationError && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-center text-xs font-bold text-rose-300">{validationError}</div>}

      <div className="rounded-3xl border border-white/10 bg-brand-cool/30 p-6 shadow-lg sm:p-8">
        {step === 1 && (
          <div className="space-y-6 text-right">
            <h3 className="border-r-4 border-brand-gold pr-3 text-xl font-bold text-white">{isArabic ? "مرحلة 1: بيانات المرسل والاستلام" : "Step 1: Sender and pickup details"}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-1.5"><span className="text-xs font-bold text-white/80">{isArabic ? "اسم المرسل / المتجر *" : "Sender / store name *"}</span><input value={senderName} onChange={(event) => { setSenderName(event.target.value); setValidationError(""); }} className="w-full rounded-xl border border-white/10 bg-brand-deep/80 px-4 py-3 text-sm text-white outline-none focus:border-brand-gold" /></label>
              <label className="space-y-1.5"><span className="text-xs font-bold text-white/80">{isArabic ? "هاتف المرسل *" : "Sender phone *"}</span><input type="tel" value={senderPhone} onChange={(event) => { setSenderPhone(event.target.value); setValidationError(""); }} className="w-full rounded-xl border border-white/10 bg-brand-deep/80 px-4 py-3 text-left text-sm text-white outline-none focus:border-brand-gold" dir="ltr" /><small className="text-[11px] font-bold text-white/45">{phoneHelpText(isArabic)}</small></label>
              <label className="space-y-1.5"><span className="text-xs font-bold text-white/80">{isArabic ? "مدينة الاستلام *" : "Pickup city *"}</span><select value={senderCity} onChange={(event) => setSenderCity(event.target.value)} className="w-full rounded-xl border border-white/10 bg-brand-deep/80 px-4 py-3 text-sm text-white outline-none focus:border-brand-gold">{allCities.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
              <label className="space-y-1.5"><span className="text-xs font-bold text-white/80">{isArabic ? "عنوان الاستلام التفصيلي *" : "Detailed pickup address *"}</span><input value={senderAddress} onChange={(event) => setSenderAddress(event.target.value)} className="w-full rounded-xl border border-white/10 bg-brand-deep/80 px-4 py-3 text-sm text-white outline-none focus:border-brand-gold" /></label>
            </div>
            <div className="flex justify-end"><button type="button" onClick={() => { if (!senderName || !senderPhone || !senderCity || !senderAddress) return setValidationError(i18n.senderStepRequired); if (!isValidOperationalPhone(senderPhone, "any")) return setValidationError(i18n.senderStepPhone); setValidationError(""); setStep(2); }} className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-8 py-3.5 text-xs font-extrabold text-brand-deep transition hover:bg-white">{isArabic ? "المتابعة لبيانات المستلم" : "Continue to receiver"}<ChevronRight className={`h-4 w-4 ${isArabic ? "rotate-180" : ""}`} /></button></div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 text-right">
            <h3 className="border-r-4 border-brand-gold pr-3 text-xl font-bold text-white">{isArabic ? "مرحلة 2: بيانات المستلم والتسليم" : "Step 2: Receiver and delivery details"}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-1.5"><span className="text-xs font-bold text-white/80">{isArabic ? "اسم المستلم *" : "Receiver name *"}</span><input value={receiverName} onChange={(event) => setReceiverName(event.target.value)} className="w-full rounded-xl border border-white/10 bg-brand-deep/80 px-4 py-3 text-sm text-white outline-none focus:border-brand-gold" /></label>
              <label className="space-y-1.5"><span className="text-xs font-bold text-white/80">{isArabic ? "هاتف المستلم *" : "Receiver phone *"}</span><input type="tel" value={receiverPhone} onChange={(event) => setReceiverPhone(event.target.value)} className="w-full rounded-xl border border-white/10 bg-brand-deep/80 px-4 py-3 text-left text-sm text-white outline-none focus:border-brand-gold" dir="ltr" /><small className="text-[11px] font-bold text-white/45">{phoneHelpText(isArabic)}</small></label>
              <label className="space-y-1.5"><span className="text-xs font-bold text-white/80">{isArabic ? "مدينة التسليم *" : "Delivery city *"}</span><select value={receiverCity} onChange={(event) => setReceiverCity(event.target.value)} className="w-full rounded-xl border border-white/10 bg-brand-deep/80 px-4 py-3 text-sm text-white outline-none focus:border-brand-gold">{allCities.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
              <label className="space-y-1.5"><span className="text-xs font-bold text-white/80">{isArabic ? "عنوان التسليم التفصيلي *" : "Detailed delivery address *"}</span><input value={receiverAddress} onChange={(event) => setReceiverAddress(event.target.value)} className="w-full rounded-xl border border-white/10 bg-brand-deep/80 px-4 py-3 text-sm text-white outline-none focus:border-brand-gold" /></label>
            </div>
            <div className="flex justify-between gap-3"><button type="button" onClick={() => { setValidationError(""); setStep(1); }} className="rounded-xl border border-white/10 bg-brand-deep px-6 py-3.5 text-xs font-bold text-white">{isArabic ? "رجوع" : "Back"}</button><button type="button" onClick={() => { if (!receiverName || !receiverPhone || !receiverCity || !receiverAddress) return setValidationError(i18n.receiverStepRequired); if (!isValidOperationalPhone(receiverPhone, "any")) return setValidationError(i18n.receiverStepPhone); setValidationError(""); setStep(3); }} className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-8 py-3.5 text-xs font-extrabold text-brand-deep transition hover:bg-white">{isArabic ? "المتابعة للشحنة والدفع" : "Continue to shipment"}<ChevronRight className={`h-4 w-4 ${isArabic ? "rotate-180" : ""}`} /></button></div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 text-right">
            <h3 className="border-r-4 border-brand-gold pr-3 text-xl font-bold text-white">{isArabic ? "مرحلة 3: الشحنة والدفع" : "Step 3: Shipment and payment"}</h3>
            <label className="block space-y-1.5"><span className="text-xs font-bold text-white/80">{isArabic ? "محتوى الشحنة *" : "Package content *"}</span><input value={packageType} onChange={(event) => setPackageType(event.target.value)} className="w-full rounded-xl border border-white/10 bg-brand-deep/80 px-4 py-3 text-sm text-white outline-none focus:border-brand-gold" /></label>
            <div className="rounded-2xl border border-brand-gold/25 bg-brand-gold/10 px-4 py-3"><p className="text-sm font-black text-brand-gold">{isArabic ? "توصيل محلي داخل الإمارات — 25 درهم ثابت" : "Local UAE delivery — fixed AED 25"}</p><p className="mt-1 text-xs font-bold text-white/55">{deliveryPricing.notes}</p></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="space-y-1.5"><span className="text-xs font-bold text-white/80">{isArabic ? "طريقة الدفع *" : "Payment method *"}</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as Order["payment_method"])} className="w-full rounded-xl border border-white/10 bg-brand-deep/80 px-4 py-3 text-sm text-white outline-none focus:border-brand-gold"><option value="sender_pays">{isArabic ? "المرسل يدفع رسوم التوصيل" : "Sender pays delivery fee"}</option><option value="receiver_pays">{isArabic ? "المستلم يدفع رسوم التوصيل" : "Receiver pays delivery fee"}</option><option value="cod">{isArabic ? "تحصيل عند التسليم" : "Collect on delivery"}</option></select></label>{paymentMethod === "cod" && <label className="space-y-1.5"><span className="text-xs font-bold text-white/80">{isArabic ? "مبلغ التحصيل *" : "Collection amount *"}</span><input type="number" min={0} step="0.01" value={codAmount} onChange={(event) => setCodAmount(event.target.value)} className="w-full rounded-xl border border-white/10 bg-brand-deep/80 px-4 py-3 text-sm font-bold text-emerald-400 outline-none focus:border-brand-gold" /></label>}</div>
            <label className="block space-y-1.5"><span className="text-xs font-bold text-white/80">{isArabic ? "ملاحظات" : "Notes"}</span><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded-xl border border-white/10 bg-brand-deep/80 px-4 py-3 text-sm text-white outline-none focus:border-brand-gold" /></label>
            {captchaEnabled && <TurnstileCaptcha siteKey={captchaSiteKey} language={language} onVerify={(token) => { setCaptchaToken(token); setValidationError(""); }} onExpire={() => setCaptchaToken("")} />}
            <div className="rounded-2xl border border-brand-gold/20 bg-brand-deep/85 p-4"><div className="flex items-center justify-between"><span className="text-xs font-bold text-white/80">{isArabic ? "إجمالي رسوم التوصيل" : "Total delivery fee"}</span><strong className="text-2xl text-brand-gold">{deliveryPrice.toFixed(2)} AED</strong></div>{couponReview && <div className="mt-2 flex items-center gap-2 border-t border-white/10 pt-2 text-[11px] font-bold text-white/55"><ScanLine className="h-3.5 w-3.5" />{isArabic ? `تمت تعبئة الطلب من ${sourceLabel(couponReview, true)} بثقة ${couponReview.confidence}%` : `Prefilled from ${sourceLabel(couponReview, false)} at ${couponReview.confidence}% confidence`}</div>}</div>
            <div className="flex justify-between gap-3"><button type="button" onClick={() => { setValidationError(""); setStep(2); }} className="rounded-xl border border-white/10 bg-brand-deep px-6 py-3.5 text-xs font-bold text-white">{isArabic ? "رجوع" : "Back"}</button><button type="button" onClick={() => void handleFormSubmit()} disabled={loading || (captchaEnabled && !captchaToken)} className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-8 py-3.5 text-xs font-extrabold text-brand-deep transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? (isArabic ? "جارٍ إنشاء الطلب الحقيقي..." : "Creating real order...") : (isArabic ? "إرسال طلب التوصيل" : "Submit delivery request")}<CheckCircle className="h-4 w-4" /></button></div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 p-8 text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-emerald-500" />
            <div><h3 className="text-2xl font-extrabold text-white">{t.requestDelivery.requestSuccess}</h3><p className="mt-2 text-sm text-white/40">{t.requestDelivery.databaseSaved}</p></div>
            {couponAuditWarning && <div className="mx-auto max-w-xl rounded-2xl border border-amber-400/25 bg-amber-400/10 p-3 text-xs font-bold text-amber-100">{couponAuditWarning}</div>}
            <div className="mx-auto max-w-sm rounded-xl border border-brand-gold/20 bg-brand-deep p-5 font-mono"><p className="text-xs font-bold uppercase tracking-wider text-white/40">{t.requestDelivery.trackingNumberLabel}</p><p className="mt-2 text-2xl font-extrabold text-brand-gold">{successId}</p></div>
            {createdOrder && <div className="mx-auto max-w-2xl space-y-4 text-left"><QRGenerator trackingCode={successId} /><Invoice order={createdOrder} /><ShippingLabel order={createdOrder} /></div>}
            <div className="flex flex-wrap items-center justify-center gap-3"><button type="button" onClick={() => navigator.clipboard?.writeText(successId)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-bold text-white"><Copy className="h-4 w-4 text-brand-gold" />{isArabic ? "نسخ رقم التتبع" : "Copy tracking code"}</button><a href={`https://wa.me/971568757331?text=${encodeURIComponent(`Tracking code: ${successId}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white"><MessageSquare className="h-4 w-4" />WhatsApp</a><button type="button" onClick={() => exportOrderPDF({ trackingCode: successId, senderName, senderPhone, senderCity, senderAddress, receiverName, receiverPhone, receiverCity, receiverAddress, packageType, pieces: LOCAL_PACKAGE_PIECES, weight: LOCAL_PACKAGE_WEIGHT, serviceType: LOCAL_SERVICE_TYPE, paymentMethod: paymentMethod || "sender_pays", codAmount, notes, deliveryFee: LOCAL_DELIVERY_PRICE }, "invoice")} className="inline-flex items-center gap-2 rounded-xl border border-brand-gold/25 bg-brand-gold/10 px-5 py-3 text-xs font-bold text-brand-gold"><FileText className="h-4 w-4" />PDF</button><button type="button" onClick={() => exportOrderTXT({ trackingCode: successId, senderName, senderPhone, senderCity, senderAddress, receiverName, receiverPhone, receiverCity, receiverAddress, packageType, pieces: LOCAL_PACKAGE_PIECES, weight: LOCAL_PACKAGE_WEIGHT, serviceType: LOCAL_SERVICE_TYPE, paymentMethod: paymentMethod || "sender_pays", codAmount, notes, deliveryFee: LOCAL_DELIVERY_PRICE })} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-bold text-white/70"><FileText className="h-4 w-4" />TXT</button></div>
            <div className="flex justify-center gap-3"><button type="button" onClick={resetForm} className="rounded-xl bg-brand-gold px-6 py-3 text-xs font-bold text-brand-deep">{t.requestDelivery.title}</button><button type="button" onClick={() => onNavigate("tracking", successId)} className="rounded-xl border border-white/10 bg-brand-deep px-6 py-3 text-xs font-bold text-white">{t.requestDelivery.trackNow}</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
