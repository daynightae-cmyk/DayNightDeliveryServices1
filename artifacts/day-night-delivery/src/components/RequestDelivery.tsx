/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Order } from "../types";
import { createPublicOrder } from "../supabase";
import { canSubmitDeliveryRequest } from "../lib/security";
import { reportError, trackApiCall } from "../lib/monitoring";
import { isValidOperationalPhone, normalizePhoneForStorage, phoneHelpText } from "../lib/phoneValidation";
import QRGenerator from "./QRGenerator";
import Invoice from "./Invoice";
import ShippingLabel from "./ShippingLabel";
import { CheckCircle, ChevronRight, Copy, FileText, MessageSquare } from "lucide-react";
import { exportOrderPDF, exportOrderTXT } from "../lib/exportUtils";
import { useAppContext } from "../lib/AppContext";
import { translations } from "../data/translations";
import TurnstileCaptcha from "./security/TurnstileCaptcha";

interface RequestDeliveryProps {
  onNavigate: (tab: string, trackingId?: string) => void;
}

const LOCAL_DELIVERY_PRICE = 30;
const LOCAL_PACKAGE_WEIGHT = 1;
const LOCAL_PACKAGE_PIECES = 1;
const LOCAL_SERVICE_TYPE = "standard" as const;

export default function RequestDelivery({ onNavigate }: RequestDeliveryProps) {
  const { language } = useAppContext();
  const t = translations[language];
  const isArabic = language === "ar";

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [successId, setSuccessId] = useState("");
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [validationError, setValidationError] = useState("");
  const captchaSiteKey = String(((import.meta as any).env?.VITE_TURNSTILE_SITE_KEY || "")).trim();
  const captchaEnabled = Boolean(captchaSiteKey);
  const [captchaToken, setCaptchaToken] = useState("");

  const i18n = {
    ar: {
      senderRequired: "يرجى إكمال بيانات المرسل الأساسية قبل إرسال الطلب.",
      receiverRequired: "يرجى إكمال بيانات المستلم الأساسية قبل إرسال الطلب.",
      invalidPhone: "رقم الهاتف مرن. اكتب الرقم المحلي مثل 0501234567 أو 0551234567 أو الرقم الدولي مع كود الدولة مثل +971501234567.",
      basicSelections: "يرجى كتابة محتوى الشحنة واختيار طريقة الدفع.",
      invalidPrice: "تعذر احتساب سعر التوصيل. يرجى مراجعة البيانات والمحاولة مجدداً.",
      invalidCod: "يرجى إدخال مبلغ تحصيل صحيح.",
      captchaRequired: "يرجى تأكيد التحقق الأمني قبل إرسال الطلب.",
      orderCreateFailed: "تعذر إنشاء الطلب حالياً. يرجى المحاولة أو التواصل عبر واتساب.",
      senderStepRequired: "يرجى ملء كافة تفاصيل المرسل الإلزامية للمتابعة",
      receiverStepRequired: "يرجى تعبئة كافة بيانات المستلم الإلزامية للمتابعة",
      senderStepPhone: "رقم هاتف المرسل غير واضح. يمكنك كتابته مثل 0501234567 أو +971501234567.",
      receiverStepPhone: "رقم هاتف المستلم غير واضح. يمكنك كتابته مثل 0551234567 أو +971551234567."
    },
    en: {
      senderRequired: "Please complete sender details before submitting the request.",
      receiverRequired: "Please complete receiver details before submitting the request.",
      invalidPhone: "Phone entry is flexible. Use a local UAE number such as 0501234567 or 0551234567, or an international number with country code such as +971501234567.",
      basicSelections: "Please describe the shipment content and choose the payment method.",
      invalidPrice: "Unable to calculate delivery price. Please review the data and try again.",
      invalidCod: "Please enter a valid collection amount.",
      captchaRequired: "Please complete the security verification before submitting the request.",
      orderCreateFailed: "Unable to create order right now. Please retry or contact WhatsApp support.",
      senderStepRequired: "Please complete all required sender details to continue.",
      receiverStepRequired: "Please complete all required receiver details to continue.",
      senderStepPhone: "Sender phone is not clear. You can enter it as 0501234567 or +971501234567.",
      receiverStepPhone: "Receiver phone is not clear. You can enter it as 0551234567 or +971551234567."
    }
  };
  const tr = isArabic ? i18n.ar : i18n.en;

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

  const mainCities = ["أبوظبي", "دبي", "الشارقة", "عجمان", "أم القيوين", "رأس الخيمة", "الفجيرة", "خورفكان"];
  const expensiveCitiesAr = ["العين (Al Ain)", "المنطقة الغربية (Western Region)", "السلع", "الرويس", "غياثي", "ليوا"];
  const allCities = [...mainCities, ...expensiveCitiesAr];

  const deliveryPricing = {
    subtotal: LOCAL_DELIVERY_PRICE,
    total: LOCAL_DELIVERY_PRICE,
    currency: "AED",
    pricingCategory: "UAE Local Delivery",
    billableWeight: LOCAL_PACKAGE_WEIGHT,
    requiresCustomQuote: false,
    breakdown: [
      isArabic ? "توصيل محلي داخل الإمارات: 30.00 AED" : "UAE local delivery: 30.00 AED"
    ],
    notes: isArabic
      ? "السعر المحلي ثابت ولا يعتمد على الوزن أو عدد القطع."
      : "Local delivery fee is fixed and does not depend on weight or pieces."
  };
  const deliveryPrice = deliveryPricing.total;

  function validateOrderFields() {
    if (!senderName.trim() || !senderPhone.trim() || !senderCity || !senderAddress.trim()) return tr.senderRequired;
    if (!receiverName.trim() || !receiverPhone.trim() || !receiverCity || !receiverAddress.trim()) return tr.receiverRequired;
    if (!isValidOperationalPhone(senderPhone, "any") || !isValidOperationalPhone(receiverPhone, "any")) return tr.invalidPhone;
    if (!packageType.trim() || !paymentMethod) return tr.basicSelections;
    if (!Number.isFinite(deliveryPrice) || deliveryPrice <= 0) return tr.invalidPrice;
    if (paymentMethod === "cod" && (!Number.isFinite(Number(codAmount)) || Number(codAmount) <= 0)) return tr.invalidCod;
    if (captchaEnabled && !captchaToken) return tr.captchaRequired;
    return "";
  }

  function resetForm() {
    setStep(1);
    setValidationError("");
    setSuccessId("");
    setCreatedOrder(null);
    setSenderName("");
    setSenderPhone("");
    setSenderAddress("");
    setReceiverName("");
    setReceiverPhone("");
    setReceiverAddress("");
    setPackageType("");
    setNotes("");
    setCodAmount("");
    setCaptchaToken("");
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
      setValidationError(isArabic ? "تجاوزت الحد اليومي المسموح لمحاولات طلب التوصيل. يرجى المحاولة لاحقاً." : "You reached the daily delivery request limit. Please try later.");
      return;
    }

    const now = new Date().toISOString();
    const statusHistory = [{ status: "pending", date: new Date().toLocaleString(), note: "تم استلام الطلب إلكترونياً وجاري المراجعة والتأكيد من فريق داي نايت" }];
    const shipmentDescription = packageType.trim();
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
      captcha_token: captchaToken || null,
      payment_method: paymentMethod,
      cod_amount: paymentMethod === "cod" ? Number(codAmount) : null,
      notes: notes.trim(),
      status: "pending",
      created_at: now,
      status_history: statusHistory
    };

    try {
      const returnedId = await trackApiCall("create_public_order", () => createPublicOrder(newOrder));
      if (returnedId) {
        const trackingCode = String(returnedId);
        setSuccessId(trackingCode);
        setCreatedOrder({ id: trackingCode, ...(newOrder as Omit<Order, "id">) });
        setStep(4);
      } else {
        setValidationError(tr.orderCreateFailed);
      }
    } catch (e) {
      reportError(e, "request_delivery_submit");
      setValidationError(tr.orderCreateFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between border-b border-white/10 pb-5 max-w-xl mx-auto text-sm font-sans font-bold">
        <div className={`flex items-center gap-2 ${step >= 1 ? "text-brand-gold" : "text-white/40"}`}>
          <span className="w-7 h-7 rounded-full bg-brand-deep border border-white/10 text-white font-mono flex items-center justify-center text-xs">1</span>
          <span>{isArabic ? "بيانات المرسل" : "Sender details"}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-white/20" />
        <div className={`flex items-center gap-2 ${step >= 2 ? "text-brand-gold" : "text-white/40"}`}>
          <span className="w-7 h-7 rounded-full bg-brand-deep border border-white/10 text-white font-mono flex items-center justify-center text-xs">2</span>
          <span>{isArabic ? "بيانات المستلم" : "Receiver details"}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-white/20" />
        <div className={`flex items-center gap-2 ${step >= 3 ? "text-brand-gold" : "text-white/40"}`}>
          <span className="w-7 h-7 rounded-full bg-brand-deep border border-white/10 text-white font-mono flex items-center justify-center text-xs">3</span>
          <span>{isArabic ? "الشحنة والدفع" : "Shipment and payment"}</span>
        </div>
      </div>

      {validationError && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-xl text-xs font-bold text-center">{validationError}</div>}

      <div className="bg-brand-cool/30 rounded-3xl p-6 sm:p-8 border border-white/10 shadow-lg">
        {step === 1 && (
          <div className="space-y-6 text-right">
            <h3 className="text-xl font-bold text-white border-r-4 border-brand-gold pr-3">{isArabic ? "مرحلة 1: بيانات المرسل وجهة الاستلام" : "Step 1: Sender and pickup details"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">{isArabic ? "اسم المرسل / المتجر *" : "Sender / store name *"}</label>
                <input id="sender_name_input" type="text" required value={senderName} onChange={(e) => { setSenderName(e.target.value); setValidationError(""); }} placeholder={isArabic ? "مثال: متجر الياسمين للعطور" : "Example: Al Yasmeen Perfumes"} className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all placeholder:text-white/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">{isArabic ? "رقم هاتف المرسل *" : "Sender phone *"}</label>
                <input id="sender_phone_input" type="tel" required value={senderPhone} onChange={(e) => { setSenderPhone(e.target.value); setValidationError(""); }} placeholder="0501234567 / 0551234567 / +971501234567" className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all placeholder:text-white/20 text-left font-sans" dir="ltr" />
                <p className="text-[11px] text-white/45 font-bold leading-5">{phoneHelpText(isArabic)}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">{isArabic ? "مدينة المرسل / مدينة الاستلام *" : "Sender / pickup city *"}</label>
                <select id="sender_city_select" value={senderCity} onChange={(e) => { setSenderCity(e.target.value); setValidationError(""); }} className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all">
                  {allCities.map((c) => <option key={c} value={c} className="bg-brand-deep text-white">{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">{isArabic ? "عنوان المرسل التفصيلي / الحي والمبنى *" : "Detailed pickup address *"}</label>
                <input id="sender_add_input" type="text" required value={senderAddress} onChange={(e) => { setSenderAddress(e.target.value); setValidationError(""); }} placeholder={isArabic ? "مثال: مصفح 40 - مقابل وكالة تويوتا" : "Example: Mussafah 40 - near Toyota showroom"} className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all placeholder:text-white/20" />
              </div>
            </div>
            <div className="pt-4 flex justify-end">
              <button id="req_step_next_1" onClick={() => { if (!senderName || !senderPhone || !senderCity || !senderAddress) { setValidationError(tr.senderStepRequired); return; } if (!isValidOperationalPhone(senderPhone, "any")) { setValidationError(tr.senderStepPhone); return; } setValidationError(""); setStep(2); }} className="px-8 py-3.5 bg-brand-gold hover:bg-brand-blue hover:text-white text-brand-deep font-extrabold rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer">
                <span>{isArabic ? "المتابعة لبيانات المستلم" : "Continue to receiver details"}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 text-right">
            <h3 className="text-xl font-bold text-white border-r-4 border-brand-gold pr-3">{isArabic ? "مرحلة 2: بيانات المستلم وجهة التسليم" : "Step 2: Receiver and delivery details"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">{isArabic ? "اسم المستلم الكامل *" : "Receiver full name *"}</label>
                <input id="receiver_name_input" type="text" required value={receiverName} onChange={(e) => { setReceiverName(e.target.value); setValidationError(""); }} placeholder={isArabic ? "مثال: مروان المري" : "Example: Marwan Al Merri"} className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all placeholder:text-white/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">{isArabic ? "رقم هاتف المستلم للمندوب والتنسيق *" : "Receiver phone for driver coordination *"}</label>
                <input id="receiver_phone_input" type="tel" required value={receiverPhone} onChange={(e) => { setReceiverPhone(e.target.value); setValidationError(""); }} placeholder="0501234567 / 0551234567 / +971501234567" className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all placeholder:text-white/20 text-left font-sans" dir="ltr" />
                <p className="text-[11px] text-white/45 font-bold leading-5">{phoneHelpText(isArabic)}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">{isArabic ? "مدينة التسليم *" : "Delivery city *"}</label>
                <select id="receiver_city_select" value={receiverCity} onChange={(e) => { setReceiverCity(e.target.value); setValidationError(""); }} className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all">
                  {allCities.map((c) => <option key={c} value={c} className="bg-brand-deep text-white">{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">{isArabic ? "العنوان التفصيلي للتسليم *" : "Detailed delivery address *"}</label>
                <input id="receiver_add_input" type="text" required value={receiverAddress} onChange={(e) => { setReceiverAddress(e.target.value); setValidationError(""); }} placeholder={isArabic ? "مثال: دبي - المرابع العربية - فيلا رقم 3" : "Example: Dubai - Arabian Ranches - Villa 3"} className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all placeholder:text-white/20" />
              </div>
            </div>
            <div className="pt-4 flex justify-between">
              <button id="req_step_back_1" onClick={() => { setValidationError(""); setStep(1); }} className="px-6 py-3.5 bg-brand-deep hover:bg-white/5 border border-white/10 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer">{isArabic ? "رجوع للسابق" : "Back"}</button>
              <button id="req_step_next_2" onClick={() => { if (!receiverName || !receiverPhone || !receiverCity || !receiverAddress) { setValidationError(tr.receiverStepRequired); return; } if (!isValidOperationalPhone(receiverPhone, "any")) { setValidationError(tr.receiverStepPhone); return; } setValidationError(""); setStep(3); }} className="px-8 py-3.5 bg-brand-gold hover:bg-brand-blue hover:text-white text-brand-deep font-extrabold rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer">
                <span>{isArabic ? "المتابعة لبيانات الشحنة والدفع" : "Continue to shipment and payment"}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 text-right">
            <h3 className="text-xl font-bold text-white border-r-4 border-brand-gold pr-3">{isArabic ? "مرحلة 3: تفاصيل الشحنة والدفع والتكلفة" : "Step 3: Shipment, payment, and price"}</h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">{isArabic ? "اكتب محتوى الشحنة كما هو *" : "Package content *"}</label>
                <input id="package_type_input" type="text" required value={packageType} onChange={(e) => { setPackageType(e.target.value); setValidationError(""); }} placeholder={isArabic ? "مثال: مستندات عقد، عطر، ملابس، هدية، قطع غيار..." : "Example: documents, perfume, clothes, gift, spare parts..."} className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all placeholder:text-white/25" />
                <p className="text-[11px] text-white/45 font-bold leading-6">{isArabic ? "هذه الخانة مفتوحة للعميل بالكامل، لا يوجد اختيار إجباري لنوع محدد." : "This field is fully open for the customer, with no forced category selection."}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-brand-gold/25 bg-brand-gold/10 px-4 py-3 text-right">
              <p className="text-brand-gold text-sm font-black">{isArabic ? "توصيل محلي داخل الإمارات — 30 درهم ثابت" : "Local UAE delivery — fixed AED 30"}</p>
              <p className="mt-1 text-white/55 text-xs font-bold leading-6">{isArabic ? "لا يتم احتساب أي زيادة حسب عدد القطع أو الوزن في نموذج التوصيل المحلي." : "Local delivery does not add extra charges by pieces or weight."}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">{isArabic ? "طريقة تسوية الدفع المحددة *" : "Selected payment settlement *"}</label>
                <select id="payment_method_select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as Order["payment_method"])} className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all">
                  <option value="sender_pays" className="bg-brand-deep text-white">{isArabic ? "المرسل يدفع رسوم التوصيل" : "Sender pays delivery fee"}</option>
                  <option value="receiver_pays" className="bg-brand-deep text-white">{isArabic ? "المستلم يدفع رسوم التوصيل" : "Receiver pays delivery fee"}</option>
                  <option value="cod" className="bg-brand-deep text-white">{isArabic ? "تحصيل عند التسليم لقيمة السلعة" : "Collect on delivery for item value"}</option>
                </select>
              </div>
              {paymentMethod === "cod" && (
                <div className="space-y-1.5">
                  <label className="text-white/80 text-xs font-bold font-sans">{isArabic ? "مبلغ التحصيل الإجمالي للسلعة *" : "Total item collection amount *"}</label>
                  <input id="cod_amount_input" type="number" required value={codAmount} onChange={(e) => { setCodAmount(e.target.value); setValidationError(""); }} placeholder={isArabic ? "مثال: 350 درهم قيمة السلعة" : "Example: 350 AED item value"} className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-4 text-emerald-400 font-extrabold text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all placeholder:text-white/20 font-mono" />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-white/80 text-xs font-bold font-sans">{isArabic ? "ملاحظات إضافية للمندوب أو الإدارة" : "Additional notes for driver or operations"}</label>
              <textarea id="notes_textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={isArabic ? "اكتب هنا أي ملاحظات مثل: الطرد قابل للكسر، يرجى الاتصال قبل الوصول..." : "Add notes: fragile item, call before arrival..."} className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold" />
            </div>
            {captchaEnabled && <TurnstileCaptcha siteKey={captchaSiteKey} language={language} onVerify={(token) => { setCaptchaToken(token); setValidationError(""); }} onExpire={() => setCaptchaToken("")} />}
            <div className="bg-brand-deep/85 rounded-2xl p-4 border border-brand-gold/20 space-y-3" dir="rtl">
              <p className="text-white/60 text-xs font-bold font-sans">{isArabic ? "بيان رسوم التوصيل" : "Delivery fee summary"}</p>
              <div className="space-y-1.5">{deliveryPricing.breakdown.map((line, i) => <div key={i} className="flex items-center justify-between text-xs" dir="ltr"><span className="text-brand-gold/70">✓</span><span className="text-white/70">{line}</span></div>)}</div>
              {paymentMethod === "cod" && codAmount && <div className="flex items-center justify-between text-xs pt-2 border-t border-white/10"><span className="text-emerald-400 font-bold font-sans">{isArabic ? "مبلغ التحصيل من العميل (منفصل)" : "Collection amount from customer (separate)"}</span><span className="font-mono text-emerald-400 font-bold">{codAmount} AED</span></div>}
              <div className="flex items-center justify-between pt-2 border-t border-brand-gold/20"><span className="text-white/80 text-xs font-bold font-sans">{isArabic ? "إجمالي رسوم التوصيل" : "Total delivery fee"}</span><span className="text-2xl font-black text-brand-gold font-mono" dir="ltr">{deliveryPricing.total.toFixed(2)} AED</span></div>
            </div>
            <div className="pt-4 flex justify-between">
              <button id="req_step_back_2" onClick={() => { setValidationError(""); setStep(2); }} className="px-6 py-3.5 bg-brand-deep hover:bg-white/5 border border-white/10 text-white font-bold rounded-xl text-xs cursor-pointer">{isArabic ? "رجوع للسابق" : "Back"}</button>
              <button id="req_submit_confirm" onClick={handleFormSubmit} disabled={loading || (captchaEnabled && !captchaToken)} className="px-10 py-3.5 bg-brand-gold hover:bg-brand-blue disabled:bg-white/10 text-brand-deep hover:text-white font-extrabold rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer">
                <span>{loading ? (isArabic ? "جاري الحفظ والإرسال..." : "Submitting order...") : (isArabic ? "أرسل طلب التوصيل الآن" : "Submit delivery request")}</span>
                <CheckCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="text-center p-8 space-y-6">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
            <div className="space-y-2"><h3 className="text-2xl font-extrabold text-white">{t.requestDelivery.requestSuccess}</h3><p className="text-white/40 text-sm">{t.requestDelivery.databaseSaved}</p></div>
            <div className="max-w-sm mx-auto bg-brand-cool/50 rounded-xl p-4 border border-white/5 mt-4">
              <label className={`flex items-center gap-3 cursor-pointer ${isArabic ? "text-right flex-row" : "text-left flex-row-reverse"}`}><span className="text-white/80 text-xs font-bold leading-relaxed">{t.notifications.label}</span><input type="checkbox" className="w-4 h-4 rounded text-brand-gold bg-brand-deep border-white/20 shrink-0" onChange={(e) => { if (e.target.checked && "Notification" in window) Notification.requestPermission(); }} /></label>
            </div>
            <div className="bg-brand-deep border border-brand-gold/20 rounded-xl p-5 max-w-sm mx-auto space-y-2 text-center font-mono"><p className="text-white/40 text-xs font-bold uppercase tracking-wider font-sans">{t.requestDelivery.trackingNumberLabel}</p><p className="text-2xl font-extrabold text-brand-gold">{successId}</p><p className="text-emerald-500 text-[11px] font-sans font-bold flex items-center justify-center gap-1"><span>{isArabic ? "حالة الشحنة الحالية (قيد الانتظار)" : "Current status (Pending)"}</span></p></div>
            {createdOrder && <div className="space-y-4 max-w-2xl mx-auto text-left"><QRGenerator trackingCode={successId} /><Invoice order={createdOrder} /><ShippingLabel order={createdOrder} /></div>}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 flex-wrap">
              <button id="success_copy_tracking_btn" type="button" onClick={() => navigator.clipboard?.writeText(successId)} className="px-5 py-3 bg-white/5 border border-white/10 hover:border-brand-gold text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-2" aria-label="Copy tracking code"><Copy className="w-4 h-4 text-brand-gold" /><span>{isArabic ? "نسخ رقم التتبع" : "Copy tracking code"}</span></button>
              <a id="success_whatsapp_tracking_btn" href={`https://wa.me/971568757331?text=${encodeURIComponent(`Tracking code: ${successId}`)}`} target="_blank" rel="noopener noreferrer" className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-2"><MessageSquare className="w-4 h-4" /><span>WhatsApp</span></a>
              <button id="success_export_pdf_btn" type="button" onClick={() => exportOrderPDF({ trackingCode: successId, senderName, senderPhone, senderCity, senderAddress, receiverName, receiverPhone, receiverCity, receiverAddress, packageType, pieces: LOCAL_PACKAGE_PIECES, weight: LOCAL_PACKAGE_WEIGHT, serviceType: LOCAL_SERVICE_TYPE, paymentMethod: paymentMethod || "sender_pays", codAmount, notes, deliveryFee: LOCAL_DELIVERY_PRICE }, "invoice")} className="px-5 py-3 bg-brand-gold/10 border border-brand-gold/25 text-brand-gold font-bold rounded-xl text-xs transition-colors flex items-center gap-2 hover:bg-brand-gold/20"><FileText className="w-4 h-4" /><span>{isArabic ? "تصدير PDF" : "Export PDF"}</span></button>
              <button id="success_export_txt_btn" type="button" onClick={() => exportOrderTXT({ trackingCode: successId, senderName, senderPhone, senderCity, senderAddress, receiverName, receiverPhone, receiverCity, receiverAddress, packageType, pieces: LOCAL_PACKAGE_PIECES, weight: LOCAL_PACKAGE_WEIGHT, serviceType: LOCAL_SERVICE_TYPE, paymentMethod: paymentMethod || "sender_pays", codAmount, notes, deliveryFee: LOCAL_DELIVERY_PRICE })} className="px-5 py-3 bg-white/5 border border-white/10 text-white/70 font-bold rounded-xl text-xs transition-colors flex items-center gap-2 hover:border-white/30"><FileText className="w-4 h-4" /><span>{isArabic ? "تصدير TXT" : "Export TXT"}</span></button>
            </div>
            <p className="text-white/60 text-xs leading-relaxed max-w-md mx-auto">{isArabic ? "تم إرسال طلبك لفريق التشغيل، وسيتم التواصل لتأكيد الاستلام. يمكنك استخدام رقم التتبع أعلاه للمراقبة فورياً." : "Your request has been sent to operations. Use the tracking number above to monitor it."}</p>
            <div className={`flex justify-center gap-3 pt-2 ${isArabic ? "flex-row" : "flex-row-reverse"}`}>
              <button id="success_new_btn" onClick={resetForm} className="px-6 py-3 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-bold rounded-xl text-xs transition-transform cursor-pointer">{t.requestDelivery.title}</button>
              <button id="success_track_btn" onClick={() => onNavigate("tracking", successId)} className="px-6 py-3 bg-brand-deep border border-white/10 hover:border-brand-gold text-white font-bold rounded-xl text-xs transition-transform cursor-pointer">{t.requestDelivery.trackNow}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
