/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Order } from "../types";
import { createPublicOrder } from "../supabase";
import { calculateLocalPrice } from "../lib/pricing";
import { 
  Truck, 
  MapPin, 
  CheckCircle, 
  ChevronRight, 
  ArrowLeftRight, 
  Info, 
  DollarSign, 
  Boxes,
  Copy,
  MessageSquare
} from "lucide-react";

import { useAppContext } from "../lib/AppContext";
import { translations } from "../data/translations";

interface RequestDeliveryProps {
  onNavigate: (tab: string, trackingId?: string) => void;
}

export default function RequestDelivery({ onNavigate }: RequestDeliveryProps) {
  const { language } = useAppContext();
  const t = translations[language];

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [successId, setSuccessId] = useState("");
  const [validationError, setValidationError] = useState("");

  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [senderCity, setSenderCity] = useState("أبوظبي");
  const [senderAddress, setSenderAddress] = useState("");

  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverCity, setReceiverCity] = useState("دبي");
  const [receiverAddress, setReceiverAddress] = useState("");

  const [packageType, setPackageType] = useState("Documents");
  const [weight, setWeight] = useState(1);
  const [pieces, setPieces] = useState(1);
  const [serviceType, setServiceType] = useState<"standard" | "express">("standard");
  const [paymentMethod, setPaymentMethod] = useState<Order["payment_method"]>("sender_pays");
  const [codAmount, setCodAmount] = useState("");
  const [notes, setNotes] = useState("");

  const mainCities = ["أبوظبي", "دبي", "الشارقة", "عجمان", "أم القيوين", "رأس الخيمة", "الفجيرة", "خورفكان"];
  
  // Al Ain Suburbs or Western Region count as remote areas
  const expensiveCitiesAr = ["العين (Al Ain)", "المنطقة الغربية (Western Region)", "السلع", "الرويس", "غياثي", "ليوا"];
  
  function getCalculatedDeliveryPrice() {
    const pricing = calculateLocalPrice(receiverCity, weight);
    let base = pricing.subtotal;
    // Express adds an extra premium
    if (serviceType === "express") {
       base += 15;
    }
    const vat = parseFloat((base * 0.05).toFixed(2));
    const total = parseFloat((base + vat).toFixed(2));
    return { subtotal: base, vat, total };
  }

  const deliveryPricing = getCalculatedDeliveryPrice();
  const deliveryPrice = deliveryPricing.total;

  function isValidUaePhone(phone: string) {
    const compact = phone.replace(/[^\d+]/g, "");
    const digits = compact.replace(/\D/g, "");
    return /^9715\d{8}$/.test(digits) || /^05\d{8}$/.test(digits);
  }

  function validateOrderFields() {
    if (!senderName.trim() || !senderPhone.trim() || !senderCity || !senderAddress.trim()) {
      return "يرجى إكمال بيانات المرسل الأساسية قبل إرسال الطلب.";
    }

    if (!receiverName.trim() || !receiverPhone.trim() || !receiverCity || !receiverAddress.trim()) {
      return "يرجى إكمال بيانات المستلم الأساسية قبل إرسال الطلب.";
    }

    if (!isValidUaePhone(senderPhone) || !isValidUaePhone(receiverPhone)) {
      return "يرجى إدخال رقم هاتف إماراتي صحيح مثل +971 56 875 7331.";
    }

    if (!packageType || !serviceType || !paymentMethod) {
      return "يرجى اختيار نوع الطرد والخدمة وطريقة الدفع.";
    }

    if (!Number.isFinite(Number(weight)) || Number(weight) <= 0) {
      return "يرجى إدخال وزن صحيح أكبر من صفر.";
    }

    if (!Number.isFinite(Number(pieces)) || Number(pieces) < 1) {
      return "يرجى إدخال عدد قطع صحيح.";
    }

    if (!Number.isFinite(deliveryPrice) || deliveryPrice <= 0) {
      return "تعذر احتساب سعر التوصيل. يرجى مراجعة البيانات والمحاولة مجدداً.";
    }

    if (paymentMethod === "cod" && (!Number.isFinite(Number(codAmount)) || Number(codAmount) <= 0)) {
      return "يرجى إدخال مبلغ تحصيل COD صحيح.";
    }

    if (!notes.trim()) {
      return "يرجى إضافة ملاحظات الطلب قبل الإرسال.";
    }

    return "";
  }

  async function handleFormSubmit() {
    setValidationError("");

    const validationMessage = validateOrderFields();
    if (validationMessage) {
      setValidationError(validationMessage);
      return;
    }

    setLoading(true);

    const now = new Date().toISOString();
    const statusHistory = [
      {
        status: "Pending",
        date: new Date().toLocaleString(),
        note: "تم استلام الطلب الكترونياً وجاري المراجعة والتأكيد من فريق داي نايت"
      }
    ];

    const newOrder = {
      sender_name: senderName.trim(),
      sender_phone: senderPhone.trim(),
      sender_city: senderCity,
      sender_address: senderAddress.trim(),
      receiver_name: receiverName.trim(),
      receiver_phone: receiverPhone.trim(),
      receiver_city: receiverCity,
      receiver_address: receiverAddress.trim(),
      package_type: packageType,
      weight: Number(weight) || 1,
      pieces: Number(pieces) || 1,
      service_type: serviceType,
      delivery_price: deliveryPrice,
      subtotal: deliveryPricing.subtotal,
      base_price: deliveryPricing.subtotal,
      vat_amount: deliveryPricing.vat,
      vat: deliveryPricing.vat,
      tax_amount: deliveryPricing.vat,
      total: deliveryPricing.total,
      total_price: deliveryPricing.total,
      amount: deliveryPricing.total,
      price: deliveryPricing.total,
      currency: "AED",
      payment_method: paymentMethod,
      cod_amount: paymentMethod === "cod" ? Number(codAmount) : null,
      notes: notes.trim(),
      status: "Pending",
      created_at: now,
      status_history: statusHistory
    };

    try {
      const returnedId = await createPublicOrder(newOrder);
      if (returnedId) {
        setSuccessId(typeof returnedId === 'object' ? JSON.stringify(returnedId) : String(returnedId));
        setStep(4);
      } else {
        setValidationError("تعذر إنشاء الطلب حالياً. يرجى المحاولة أو التواصل عبر واتساب.");
      }
    } catch (e) {
      console.error(e);
      setValidationError("تعذر إنشاء الطلب حالياً. يرجى المحاولة أو التواصل عبر واتساب.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Visual Stepper */}
      <div className="flex items-center justify-between border-b border-white/10 pb-5 max-w-xl mx-auto text-sm font-sans font-bold">
        <div className={`flex items-center gap-2 ${step >= 1 ? "text-brand-gold" : "text-white/40"}`}>
          <span className="w-7 h-7 rounded-full bg-brand-deep border border-white/10 text-white font-mono flex items-center justify-center text-xs">1</span>
          <span>بيانات المرسل</span>
        </div>
        <ChevronRight className="w-4 h-4 text-white/20" />
        <div className={`flex items-center gap-2 ${step >= 2 ? "text-brand-gold" : "text-white/40"}`}>
          <span className="w-7 h-7 rounded-full bg-brand-deep border border-white/10 text-white font-mono flex items-center justify-center text-xs">2</span>
          <span>بيانات المستلم</span>
        </div>
        <ChevronRight className="w-4 h-4 text-white/20" />
        <div className={`flex items-center gap-2 ${step >= 3 ? "text-brand-gold" : "text-white/40"}`}>
          <span className="w-7 h-7 rounded-full bg-brand-deep border border-white/10 text-white font-mono flex items-center justify-center text-xs">3</span>
          <span>بيانات الطرد والدفع</span>
        </div>
      </div>

      {validationError && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-xl text-xs font-bold text-center">
          {validationError}
        </div>
      )}

      <div className="bg-brand-cool/30 rounded-3xl p-6 sm:p-8 border border-white/10 shadow-lg">
        {step === 1 && (
          <div className="space-y-6 text-right">
            <h3 className="text-xl font-bold text-white border-r-4 border-brand-gold pr-3">مرحلة 1: تفاصيل جهة الاستلام (المرسل)</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">اسم المرسل / المتجر *</label>
                <input
                  id="sender_name_input"
                  type="text"
                  required
                  value={senderName}
                  onChange={(e) => { setSenderName(e.target.value); setValidationError(""); }}
                  placeholder="مثال: متجر الياسمين للعطور"
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all placeholder:text-white/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">رقم هاتف المرسل للاستلام المباشر *</label>
                <input
                  id="sender_phone_input"
                  type="text"
                  required
                  value={senderPhone}
                  onChange={(e) => { setSenderPhone(e.target.value); setValidationError(""); }}
                  placeholder="مثال: +971 56 875 7331"
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all placeholder:text-white/20 text-left font-sans"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">مدينة الاستلام *</label>
                <select
                  id="sender_city_select"
                  value={senderCity}
                  onChange={(e) => setSenderCity(e.target.value)}
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all"
                >
                  {mainCities.map((c, i) => (
                    <option key={i} value={c} className="bg-brand-deep text-white">{c}</option>
                  ))}
                  {expensiveCitiesAr.map((c, i) => (
                    <option key={i} value={c} className="bg-brand-deep text-white">{c}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">العنوان التفصيلي / الحي ومقر المستودع *</label>
                <input
                  id="sender_add_input"
                  type="text"
                  required
                  value={senderAddress}
                  onChange={(e) => { setSenderAddress(e.target.value); setValidationError(""); }}
                  placeholder="مثال: مصفح 40 - مقابل وكالة تويوتا"
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all placeholder:text-white/20"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                id="req_step_next_1"
                onClick={() => {
                  if (!senderName || !senderPhone || !senderAddress) {
                    setValidationError("يرجى ملء كافة تفاصيل المرسل الإلزامية للمتابعة");
                    return;
                  }
                  setValidationError("");
                  setStep(2);
                }}
                className="px-8 py-3.5 bg-brand-gold hover:bg-brand-blue hover:text-white text-brand-deep font-extrabold rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>المتابعة لبيانات المستلم</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 text-right">
            <h3 className="text-xl font-bold text-white border-r-4 border-brand-gold pr-3">مرحلة 2: تفاصيل واجهة التسليم والزبون (المستلم)</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">اسم المستلم الكامل *</label>
                <input
                  id="receiver_name_input"
                  type="text"
                  required
                  value={receiverName}
                  onChange={(e) => { setReceiverName(e.target.value); setValidationError(""); }}
                  placeholder="مثال: مروان المري"
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all placeholder:text-white/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">رقم هاتف المستلم للمندوب والتنسيق *</label>
                <input
                  id="receiver_phone_input"
                  type="text"
                  required
                  value={receiverPhone}
                  onChange={(e) => { setReceiverPhone(e.target.value); setValidationError(""); }}
                  placeholder="مثال: +971 56 875 7331"
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all placeholder:text-white/20 text-left font-sans"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">مدينة التسليم *</label>
                <select
                  id="receiver_city_select"
                  value={receiverCity}
                  onChange={(e) => { setReceiverCity(e.target.value); setValidationError(""); }}
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all"
                >
                  {mainCities.map((c, i) => (
                    <option key={i} value={c} className="bg-brand-deep text-white">{c}</option>
                  ))}
                  {expensiveCitiesAr.map((c, i) => (
                    <option key={i} value={c} className="bg-brand-deep text-white">{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">العنوان التفصيلي للتسليم *</label>
                <input
                  id="receiver_add_input"
                  type="text"
                  required
                  value={receiverAddress}
                  onChange={(e) => { setReceiverAddress(e.target.value); setValidationError(""); }}
                  placeholder="مثال: دبي - المرابع العربية - فيلا رقم 3"
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all placeholder:text-white/20"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-between">
              <button
                id="req_step_back_1"
                onClick={() => { setValidationError(""); setStep(1); }}
                className="px-6 py-3.5 bg-brand-deep hover:bg-white/5 border border-white/10 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                رجوع للسابق
              </button>
              <button
                id="req_step_next_2"
                onClick={() => {
                  if (!receiverName || !receiverPhone || !receiverAddress) {
                    setValidationError("يرجى تعبئة كافة بيانات المستلم الإلزامية للمتابعة");
                    return;
                  }
                  setValidationError("");
                  setStep(3);
                }}
                className="px-8 py-3.5 bg-brand-gold hover:bg-brand-blue hover:text-white text-brand-deep font-extrabold rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>المتابعة لبيانات الطرد والدفع</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 text-right">
            <h3 className="text-xl font-bold text-white border-r-4 border-brand-gold pr-3">مرحلة 3: تفاصيل السلعة والدفع والتكلفة</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">نوع محتوى الشحنة *</label>
                <select
                  id="package_type_select"
                  value={packageType}
                  onChange={(e) => setPackageType(e.target.value)}
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all"
                >
                  <option value="Documents" className="bg-brand-deep text-white">مستندات وأوراق (Documents)</option>
                  <option value="Perfumes" className="bg-brand-deep text-white">عطور ومستحضرات تجميل (Perfumes)</option>
                  <option value="Clothes" className="bg-brand-deep text-white">ملابس ومنسوجات (Clothes)</option>
                  <option value="Electronics" className="bg-brand-deep text-white">أجهزة إلكترونية (Electronics)</option>
                  <option value="Foods" className="bg-brand-deep text-white">مواد غذائية أو طعام (Foods)</option>
                  <option value="Gifts" className="bg-brand-deep text-white">هدايا وباقات ورود (Gifts)</option>
                </select>
              </div>

              <div className="space-y-1.5 align-top">
                <label className="text-white/80 text-xs font-bold font-sans">الخدمة المطلوبة</label>
                <div className="flex bg-brand-deep p-1 rounded-xl border border-white/10">
                  <button
                    id="service_type_std"
                    type="button"
                    onClick={() => setServiceType("standard")}
                    className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-colors cursor-pointer ${serviceType === "standard" ? "bg-brand-gold text-brand-deep" : "text-white/40 hover:text-white"}`}
                  >
                    عادي Standard
                  </button>
                  <button
                    id="service_type_exp"
                    type="button"
                    onClick={() => setServiceType("express")}
                    className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg transition-colors cursor-pointer ${serviceType === "express" ? "bg-brand-gold text-brand-deep" : "text-white/40 hover:text-white"}`}
                  >
                    سريع Express
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="text-white/80 text-xs font-bold font-sans">القطع *</label>
                  <input
                    id="pieces_input"
                    type="number"
                    min="1"
                    required
                    value={pieces}
                    onChange={(e) => setPieces(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all text-center font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-white/80 text-xs font-bold font-sans">الوزن (كجم) *</label>
                  <input
                    id="weight_input"
                    type="number"
                    min="0.1"
                    step="0.1"
                    required
                    value={weight}
                    onChange={(e) => setWeight(Math.max(0.1, Number(e.target.value)))}
                    className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all text-center font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">طريقة تسوية الدفع المحددة *</label>
                <select
                  id="payment_method_select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as Order["payment_method"])}
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all"
                >
                  <option value="sender_pays" className="bg-brand-deep text-white">الراسل يدفع الرسوم (Sender Pays)</option>
                  <option value="receiver_pays" className="bg-brand-deep text-white">المستلم يدفع رسوم التوصيل (Receiver Pays)</option>
                  <option value="cod" className="bg-brand-deep text-white">الدفع عند الاستلام للسلعة COD</option>
                </select>
              </div>

              {paymentMethod === "cod" && (
                <div className="space-y-1.5">
                  <label className="text-white/80 text-xs font-bold font-sans">مبلغ التحصيل الإجمالي للسلعة (COD AED) *</label>
                  <input
                    id="cod_amount_input"
                    type="number"
                    required
                    value={codAmount}
                    onChange={(e) => { setCodAmount(e.target.value); setValidationError(""); }}
                    placeholder="مثال: 350 درهم قيمة السلعة"
                    className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-4 text-emerald-400 font-extrabold text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all placeholder:text-white/20 font-mono"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-white/80 text-xs font-bold font-sans">ملاحظات إضافية للمندوب أو الإدارة</label>
              <textarea
                id="notes_textarea"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="اكتب هنا أي ملاحظات مثل: الطرد قابل للكسر، يرجى الاتصال قبل الوصول بنصف ساعة..."
                className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold"
              ></textarea>
            </div>

            {/* Calculations Detail Box */}
            <div className="bg-brand-deep/85 rounded-2xl p-4 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm font-sans font-medium text-right">
              <div className="p-2.5 bg-brand-gold/10 rounded-lg text-brand-gold border border-brand-gold/20 text-[10px] leading-relaxed max-w-xs text-right">
                سيتم تأكيد رسوم التحصيل والدفع بدقة من الإدارة بمجرد معالجة الطلب الكترونياً. الضريبة 5% مضافة تلقائياً.
              </div>
              <div className="space-y-1 w-full sm:w-auto text-right">
                <span className="text-white/40 text-xs font-bold font-sans">بيان قيمة رسوم التوصيل</span>
                <div className="text-xs text-white/60 space-y-0.5">
                  <p>الأساسي: <span className="font-mono text-white">{deliveryPricing.subtotal.toFixed(2)} AED</span></p>
                  <p>الضريبة (5%): <span className="font-mono text-white">{deliveryPricing.vat.toFixed(2)} AED</span></p>
                </div>
                <p className="text-xl font-extrabold text-brand-gold font-mono leading-none pt-1 border-t border-white/5">{deliveryPricing.total.toFixed(2)} AED شاملة</p>
                <p className="text-[10px] text-white/40 font-bold">
                  {expensiveCitiesAr.includes(receiverCity) ? "* منطقة بعيدة/50 درهم أساسي." : "* سعر موحد/30 درهم أساسي."} 
                  {serviceType === "express" && " مضاف رسوم خدمة سريعة (15 درهم)."}
                </p>
              </div>
            </div>

            <div className="pt-4 flex justify-between">
              <button
                id="req_step_back_2"
                onClick={() => { setValidationError(""); setStep(2); }}
                className="px-6 py-3.5 bg-brand-deep hover:bg-white/5 border border-white/10 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                رجوع للسابق
              </button>
              <button
                id="req_submit_confirm"
                onClick={handleFormSubmit}
                disabled={loading}
                className="px-10 py-3.5 bg-brand-gold hover:bg-brand-blue disabled:bg-white/10 text-brand-deep hover:text-white font-extrabold rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>{loading ? "جاري الحفظ والإنشار..." : "أرسل طلب التوصيل الآن"}</span>
                <CheckCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="text-center p-8 space-y-6">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
            
            <div className="space-y-2">
              <h3 className="text-2xl font-extrabold text-white">{t.requestDelivery.requestSuccess}</h3>
              <p className="text-white/40 text-sm">{t.requestDelivery.databaseSaved}</p>
            </div>

            {/* Notification toggle widget */}
            <div className="max-w-sm mx-auto bg-brand-cool/50 rounded-xl p-4 border border-white/5 mt-4">
               <label className={`flex items-center gap-3 cursor-pointer ${language === 'ar' ? 'text-right flex-row' : 'text-left flex-row-reverse'}`}>
                 <span className="text-white/80 text-xs font-bold leading-relaxed">{t.notifications.label}</span>
                 <input 
                   type="checkbox" 
                   className="w-4 h-4 rounded text-brand-gold bg-brand-deep border-white/20 shrink-0" 
                   onChange={(e) => {
                     if (e.target.checked && 'Notification' in window) {
                       Notification.requestPermission();
                     }
                   }}
                 />
               </label>
            </div>

            <div className="bg-brand-deep border border-brand-gold/20 rounded-xl p-5 max-w-sm mx-auto space-y-2 text-center font-mono">
              <p className="text-white/40 text-xs font-bold uppercase tracking-wider font-sans">{t.requestDelivery.trackingNumberLabel}</p>
              <p className="text-2xl font-extrabold text-brand-gold">{successId}</p>
              <p className="text-emerald-500 text-[11px] font-sans font-bold flex items-center justify-center gap-1">
                <span>{language === 'ar' ? 'حالة الشحنة الحالية (Pending)' : 'Current Status (Pending)'}</span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                id="success_copy_tracking_btn"
                type="button"
                onClick={() => navigator.clipboard?.writeText(successId)}
                className="px-5 py-3 bg-white/5 border border-white/10 hover:border-brand-gold text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-2"
                aria-label="Copy tracking code"
              >
                <Copy className="w-4 h-4 text-brand-gold" />
                <span>{language === "ar" ? "نسخ رقم التتبع" : "Copy tracking code"}</span>
              </button>
              <a
                id="success_whatsapp_tracking_btn"
                href={`https://wa.me/971568757331?text=${encodeURIComponent(`Tracking code: ${successId}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp</span>
              </a>
            </div>

            <p className="text-white/60 text-xs leading-relaxed max-w-md mx-auto">
              {language === 'ar' ? 'تم إرسال طردك لوكيل التوزيع، وسيصل سائق داي نايت لإجراء الاستلام في وقت قريب. يمكنك استخدام رقم التتبع أعلاه للمراقبة فورياً!' : 'Your package has been sent to the distribution agent. A driver will arrive for pickup soon. Use the tracking number to monitor.'}
            </p>

            <div className={`flex justify-center gap-3 pt-2 ${language === 'ar' ? 'flex-row' : 'flex-row-reverse'}`}>
              <button
                id="success_new_btn"
                onClick={() => {
                  setStep(1);
                  setValidationError("");
                  setSuccessId("");
                  setSenderName("");
                  setSenderPhone("");
                  setSenderAddress("");
                  setReceiverName("");
                  setReceiverPhone("");
                  setReceiverAddress("");
                  setNotes("");
                  setCodAmount("");
                }}
                className="px-6 py-3 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-bold rounded-xl text-xs transition-transform cursor-pointer"
              >
                {t.requestDelivery.title}
              </button>
              <button
                id="success_track_btn"
                onClick={() => onNavigate("tracking", successId)}
                className="px-6 py-3 bg-brand-deep border border-white/10 hover:border-brand-gold text-white font-bold rounded-xl text-xs transition-transform cursor-pointer"
              >
                {t.requestDelivery.trackNow}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
