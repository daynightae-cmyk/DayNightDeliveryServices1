/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Order } from "../types";
import { createPublicOrder } from "../supabase";
import { calculateDomesticPrice } from "../lib/pricing";
import { canSubmitDeliveryRequest } from "../lib/security";
import { reportError, trackApiCall } from "../lib/monitoring";
import QRGenerator from "./QRGenerator";
import Invoice from "./Invoice";
import ShippingLabel from "./ShippingLabel";
import { 
  CheckCircle, 
  ChevronRight, 
  Copy,
  MessageSquare
} from "lucide-react";

import { useAppContext } from "../lib/AppContext";
import { translations } from "../data/translations";
import TurnstileCaptcha from "./security/TurnstileCaptcha";

interface RequestDeliveryProps {
  onNavigate: (tab: string, trackingId?: string) => void;
}

export default function RequestDelivery({ onNavigate }: RequestDeliveryProps) {
  const { language } = useAppContext();
  const t = translations[language];

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
      senderRequired: "ÙŠØ±Ø¬Ù‰ Ø¥ÙƒÙ…Ø§Ù„ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø±Ø³Ù„ Ø§Ù„Ø£Ø³Ø§Ø³ÙŠØ© Ù‚Ø¨Ù„ Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø·Ù„Ø¨.",
      receiverRequired: "ÙŠØ±Ø¬Ù‰ Ø¥ÙƒÙ…Ø§Ù„ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø³ØªÙ„Ù… Ø§Ù„Ø£Ø³Ø§Ø³ÙŠØ© Ù‚Ø¨Ù„ Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø·Ù„Ø¨.",
      invalidPhone: "ÙŠØ±Ø¬Ù‰ Ø¥Ø¯Ø®Ø§Ù„ Ø±Ù‚Ù… Ù‡Ø§ØªÙ Ø¥Ù…Ø§Ø±Ø§ØªÙŠ ØµØ­ÙŠØ­ Ù…Ø«Ù„ +971 56 875 7331.",
      basicSelections: "ÙŠØ±Ø¬Ù‰ Ø§Ø®ØªÙŠØ§Ø± Ù†ÙˆØ¹ Ø§Ù„Ø·Ø±Ø¯ ÙˆØ§Ù„Ø®Ø¯Ù…Ø© ÙˆØ·Ø±ÙŠÙ‚Ø© Ø§Ù„Ø¯ÙØ¹.",
      invalidWeight: "ÙŠØ±Ø¬Ù‰ Ø¥Ø¯Ø®Ø§Ù„ ÙˆØ²Ù† ØµØ­ÙŠØ­ Ø£ÙƒØ¨Ø± Ù…Ù† ØµÙØ±.",
      invalidPieces: "ÙŠØ±Ø¬Ù‰ Ø¥Ø¯Ø®Ø§Ù„ Ø¹Ø¯Ø¯ Ù‚Ø·Ø¹ ØµØ­ÙŠØ­.",
      invalidPrice: "ØªØ¹Ø°Ø± Ø§Ø­ØªØ³Ø§Ø¨ Ø³Ø¹Ø± Ø§Ù„ØªÙˆØµÙŠÙ„. ÙŠØ±Ø¬Ù‰ Ù…Ø±Ø§Ø¬Ø¹Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª ÙˆØ§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù…Ø¬Ø¯Ø¯Ø§Ù‹.",
      invalidCod: "ÙŠØ±Ø¬Ù‰ Ø¥Ø¯Ø®Ø§Ù„ Ù…Ø¨Ù„Øº ØªØ­ØµÙŠÙ„ COD ØµØ­ÙŠØ­.",
      notesRequired: "ÙŠØ±Ø¬Ù‰ Ø¥Ø¶Ø§ÙØ© Ù…Ù„Ø§Ø­Ø¸Ø§Øª Ø§Ù„Ø·Ù„Ø¨ Ù‚Ø¨Ù„ Ø§Ù„Ø¥Ø±Ø³Ø§Ù„.",
      captchaRequired: "ÙŠØ±Ø¬Ù‰ ØªØ£ÙƒÙŠØ¯ Ø§Ù„ØªØ­Ù‚Ù‚ Ø§Ù„Ø£Ù…Ù†ÙŠ Ù‚Ø¨Ù„ Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø·Ù„Ø¨.",
      orderCreateFailed: "ØªØ¹Ø°Ø± Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ø·Ù„Ø¨ Ø­Ø§Ù„ÙŠØ§Ù‹. ÙŠØ±Ø¬Ù‰ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ø£Ùˆ Ø§Ù„ØªÙˆØ§ØµÙ„ Ø¹Ø¨Ø± ÙˆØ§ØªØ³Ø§Ø¨.",
      senderStepRequired: "ÙŠØ±Ø¬Ù‰ Ù…Ù„Ø¡ ÙƒØ§ÙØ© ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ù…Ø±Ø³Ù„ Ø§Ù„Ø¥Ù„Ø²Ø§Ù…ÙŠØ© Ù„Ù„Ù…ØªØ§Ø¨Ø¹Ø©",
      receiverStepRequired: "ÙŠØ±Ø¬Ù‰ ØªØ¹Ø¨Ø¦Ø© ÙƒØ§ÙØ© Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø³ØªÙ„Ù… Ø§Ù„Ø¥Ù„Ø²Ø§Ù…ÙŠØ© Ù„Ù„Ù…ØªØ§Ø¨Ø¹Ø©"
    },
    en: {
      senderRequired: "Please complete sender details before submitting the request.",
      receiverRequired: "Please complete receiver details before submitting the request.",
      invalidPhone: "Please enter a valid UAE phone number, for example +971 56 875 7331.",
      basicSelections: "Please choose package type, service type, and payment method.",
      invalidWeight: "Please enter a valid weight greater than zero.",
      invalidPieces: "Please enter a valid pieces count.",
      invalidPrice: "Unable to calculate delivery price. Please review the data and try again.",
      invalidCod: "Please enter a valid COD amount.",
      notesRequired: "Please add order notes before submission.",
      captchaRequired: "Please complete the security verification before submitting the request.",
      orderCreateFailed: "Unable to create order right now. Please retry or contact WhatsApp support.",
      senderStepRequired: "Please complete all required sender details to continue.",
      receiverStepRequired: "Please complete all required receiver details to continue."
    }
  };
  const tr = language === "ar" ? i18n.ar : i18n.en;

  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [senderCity, setSenderCity] = useState("Ø£Ø¨ÙˆØ¸Ø¨ÙŠ");
  const [senderAddress, setSenderAddress] = useState("");

  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverCity, setReceiverCity] = useState("Ø¯Ø¨ÙŠ");
  const [receiverAddress, setReceiverAddress] = useState("");

  const [packageType, setPackageType] = useState("Documents");
  const [weight, setWeight] = useState(1);
  const [pieces, setPieces] = useState(1);
  const [serviceType, setServiceType] = useState<"standard" | "express">("standard");
  const [paymentMethod, setPaymentMethod] = useState<Order["payment_method"]>("sender_pays");
  const [codAmount, setCodAmount] = useState("");
  const [notes, setNotes] = useState("");

  const mainCities = ["Ø£Ø¨ÙˆØ¸Ø¨ÙŠ", "Ø¯Ø¨ÙŠ", "Ø§Ù„Ø´Ø§Ø±Ù‚Ø©", "Ø¹Ø¬Ù…Ø§Ù†", "Ø£Ù… Ø§Ù„Ù‚ÙŠÙˆÙŠÙ†", "Ø±Ø£Ø³ Ø§Ù„Ø®ÙŠÙ…Ø©", "Ø§Ù„ÙØ¬ÙŠØ±Ø©", "Ø®ÙˆØ±ÙÙƒØ§Ù†"];
  
  // Al Ain Suburbs or Western Region count as remote areas
  const expensiveCitiesAr = ["Ø§Ù„Ø¹ÙŠÙ† (Al Ain)", "Ø§Ù„Ù…Ù†Ø·Ù‚Ø© Ø§Ù„ØºØ±Ø¨ÙŠØ© (Western Region)", "Ø§Ù„Ø³Ù„Ø¹", "Ø§Ù„Ø±ÙˆÙŠØ³", "ØºÙŠØ§Ø«ÙŠ", "Ù„ÙŠÙˆØ§"];
  
  function getCalculatedDeliveryPrice() {
    const pricing = calculateDomesticPrice({
      deliveryCity: receiverCity,
      weight,
      serviceType
    });
    return { subtotal: pricing.subtotal, total: pricing.total };
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
      return tr.senderRequired;
    }

    if (!receiverName.trim() || !receiverPhone.trim() || !receiverCity || !receiverAddress.trim()) {
      return tr.receiverRequired;
    }

    if (!isValidUaePhone(senderPhone) || !isValidUaePhone(receiverPhone)) {
      return tr.invalidPhone;
    }

    if (!packageType || !serviceType || !paymentMethod) {
      return tr.basicSelections;
    }

    if (!Number.isFinite(Number(weight)) || Number(weight) <= 0) {
      return tr.invalidWeight;
    }

    if (!Number.isFinite(Number(pieces)) || Number(pieces) < 1) {
      return tr.invalidPieces;
    }

    if (!Number.isFinite(deliveryPrice) || deliveryPrice <= 0) {
      return tr.invalidPrice;
    }

    if (paymentMethod === "cod" && (!Number.isFinite(Number(codAmount)) || Number(codAmount) <= 0)) {
      return tr.invalidCod;
    }

    if (captchaEnabled && !captchaToken) {
      return tr.captchaRequired;
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

    const limitCheck = canSubmitDeliveryRequest();
    if (!limitCheck.allowed) {
      setLoading(false);
      setValidationError(language === "ar" ? "ØªØ¬Ø§ÙˆØ²Øª Ø§Ù„Ø­Ø¯ Ø§Ù„ÙŠÙˆÙ…ÙŠ Ø§Ù„Ù…Ø³Ù…ÙˆØ­ Ù„Ù…Ø­Ø§ÙˆÙ„Ø§Øª Ø·Ù„Ø¨ Ø§Ù„ØªÙˆØµÙŠÙ„. ÙŠØ±Ø¬Ù‰ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù„Ø§Ø­Ù‚Ø§Ù‹." : "You reached the daily delivery request limit. Please try later.");
      return;
    }

    const now = new Date().toISOString();
    const statusHistory = [
      {
        status: "Pending",
        date: new Date().toLocaleString(),
        note: "ØªÙ… Ø§Ø³ØªÙ„Ø§Ù… Ø§Ù„Ø·Ù„Ø¨ Ø§Ù„ÙƒØªØ±ÙˆÙ†ÙŠØ§Ù‹ ÙˆØ¬Ø§Ø±ÙŠ Ø§Ù„Ù…Ø±Ø§Ø¬Ø¹Ø© ÙˆØ§Ù„ØªØ£ÙƒÙŠØ¯ Ù…Ù† ÙØ±ÙŠÙ‚ Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª"
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
      status: "Pending",
      created_at: now,
      status_history: statusHistory
    };

    try {
      const returnedId = await trackApiCall("create_public_order", () => createPublicOrder(newOrder));
      if (returnedId) {
        const trackingCode = String(returnedId);
        setSuccessId(trackingCode);
        setCreatedOrder({
          id: trackingCode,
          ...(newOrder as Omit<Order, "id">)
        });
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
      {/* Visual Stepper */}
      <div className="flex items-center justify-between border-b border-white/10 pb-5 max-w-xl mx-auto text-sm font-sans font-bold">
        <div className={`flex items-center gap-2 ${step >= 1 ? "text-brand-gold" : "text-white/40"}`}>
          <span className="w-7 h-7 rounded-full bg-brand-deep border border-white/10 text-white font-mono flex items-center justify-center text-xs">1</span>
          <span>Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø±Ø³Ù„</span>
        </div>
        <ChevronRight className="w-4 h-4 text-white/20" />
        <div className={`flex items-center gap-2 ${step >= 2 ? "text-brand-gold" : "text-white/40"}`}>
          <span className="w-7 h-7 rounded-full bg-brand-deep border border-white/10 text-white font-mono flex items-center justify-center text-xs">2</span>
          <span>Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø³ØªÙ„Ù…</span>
        </div>
        <ChevronRight className="w-4 h-4 text-white/20" />
        <div className={`flex items-center gap-2 ${step >= 3 ? "text-brand-gold" : "text-white/40"}`}>
          <span className="w-7 h-7 rounded-full bg-brand-deep border border-white/10 text-white font-mono flex items-center justify-center text-xs">3</span>
          <span>Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø·Ø±Ø¯ ÙˆØ§Ù„Ø¯ÙØ¹</span>
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
            <h3 className="text-xl font-bold text-white border-r-4 border-brand-gold pr-3">Ù…Ø±Ø­Ù„Ø© 1: ØªÙØ§ØµÙŠÙ„ Ø¬Ù‡Ø© Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù… (Ø§Ù„Ù…Ø±Ø³Ù„)</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">Ø§Ø³Ù… Ø§Ù„Ù…Ø±Ø³Ù„ / Ø§Ù„Ù…ØªØ¬Ø± *</label>
                <input
                  id="sender_name_input"
                  type="text"
                  required
                  value={senderName}
                  onChange={(e) => { setSenderName(e.target.value); setValidationError(""); }}
                  placeholder="Ù…Ø«Ø§Ù„: Ù…ØªØ¬Ø± Ø§Ù„ÙŠØ§Ø³Ù…ÙŠÙ† Ù„Ù„Ø¹Ø·ÙˆØ±"
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all placeholder:text-white/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">Ø±Ù‚Ù… Ù‡Ø§ØªÙ Ø§Ù„Ù…Ø±Ø³Ù„ Ù„Ù„Ø§Ø³ØªÙ„Ø§Ù… Ø§Ù„Ù…Ø¨Ø§Ø´Ø± *</label>
                <input
                  id="sender_phone_input"
                  type="text"
                  required
                  value={senderPhone}
                  onChange={(e) => { setSenderPhone(e.target.value); setValidationError(""); }}
                  placeholder="Ù…Ø«Ø§Ù„: +971 56 875 7331"
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all placeholder:text-white/20 text-left font-sans"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">Ù…Ø¯ÙŠÙ†Ø© Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù… *</label>
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
                <label className="text-white/80 text-xs font-bold font-sans">Ø§Ù„Ø¹Ù†ÙˆØ§Ù† Ø§Ù„ØªÙØµÙŠÙ„ÙŠ / Ø§Ù„Ø­ÙŠ ÙˆÙ…Ù‚Ø± Ø§Ù„Ù…Ø³ØªÙˆØ¯Ø¹ *</label>
                <input
                  id="sender_add_input"
                  type="text"
                  required
                  value={senderAddress}
                  onChange={(e) => { setSenderAddress(e.target.value); setValidationError(""); }}
                  placeholder="Ù…Ø«Ø§Ù„: Ù…ØµÙØ­ 40 - Ù…Ù‚Ø§Ø¨Ù„ ÙˆÙƒØ§Ù„Ø© ØªÙˆÙŠÙˆØªØ§"
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all placeholder:text-white/20"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                id="req_step_next_1"
                onClick={() => {
                  if (!senderName || !senderPhone || !senderAddress) {
                    setValidationError(tr.senderStepRequired);
                    return;
                  }
                  setValidationError("");
                  setStep(2);
                }}
                className="px-8 py-3.5 bg-brand-gold hover:bg-brand-blue hover:text-white text-brand-deep font-extrabold rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø© Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø³ØªÙ„Ù…</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 text-right">
            <h3 className="text-xl font-bold text-white border-r-4 border-brand-gold pr-3">Ù…Ø±Ø­Ù„Ø© 2: ØªÙØ§ØµÙŠÙ„ ÙˆØ§Ø¬Ù‡Ø© Ø§Ù„ØªØ³Ù„ÙŠÙ… ÙˆØ§Ù„Ø²Ø¨ÙˆÙ† (Ø§Ù„Ù…Ø³ØªÙ„Ù…)</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªÙ„Ù… Ø§Ù„ÙƒØ§Ù…Ù„ *</label>
                <input
                  id="receiver_name_input"
                  type="text"
                  required
                  value={receiverName}
                  onChange={(e) => { setReceiverName(e.target.value); setValidationError(""); }}
                  placeholder="Ù…Ø«Ø§Ù„: Ù…Ø±ÙˆØ§Ù† Ø§Ù„Ù…Ø±ÙŠ"
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all placeholder:text-white/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">Ø±Ù‚Ù… Ù‡Ø§ØªÙ Ø§Ù„Ù…Ø³ØªÙ„Ù… Ù„Ù„Ù…Ù†Ø¯ÙˆØ¨ ÙˆØ§Ù„ØªÙ†Ø³ÙŠÙ‚ *</label>
                <input
                  id="receiver_phone_input"
                  type="text"
                  required
                  value={receiverPhone}
                  onChange={(e) => { setReceiverPhone(e.target.value); setValidationError(""); }}
                  placeholder="Ù…Ø«Ø§Ù„: +971 56 875 7331"
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all placeholder:text-white/20 text-left font-sans"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">Ù…Ø¯ÙŠÙ†Ø© Ø§Ù„ØªØ³Ù„ÙŠÙ… *</label>
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
                <label className="text-white/80 text-xs font-bold font-sans">Ø§Ù„Ø¹Ù†ÙˆØ§Ù† Ø§Ù„ØªÙØµÙŠÙ„ÙŠ Ù„Ù„ØªØ³Ù„ÙŠÙ… *</label>
                <input
                  id="receiver_add_input"
                  type="text"
                  required
                  value={receiverAddress}
                  onChange={(e) => { setReceiverAddress(e.target.value); setValidationError(""); }}
                  placeholder="Ù…Ø«Ø§Ù„: Ø¯Ø¨ÙŠ - Ø§Ù„Ù…Ø±Ø§Ø¨Ø¹ Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© - ÙÙŠÙ„Ø§ Ø±Ù‚Ù… 3"
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
                Ø±Ø¬ÙˆØ¹ Ù„Ù„Ø³Ø§Ø¨Ù‚
              </button>
              <button
                id="req_step_next_2"
                onClick={() => {
                  if (!receiverName || !receiverPhone || !receiverAddress) {
                    setValidationError(tr.receiverStepRequired);
                    return;
                  }
                  setValidationError("");
                  setStep(3);
                }}
                className="px-8 py-3.5 bg-brand-gold hover:bg-brand-blue hover:text-white text-brand-deep font-extrabold rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø© Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø·Ø±Ø¯ ÙˆØ§Ù„Ø¯ÙØ¹</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 text-right">
            <h3 className="text-xl font-bold text-white border-r-4 border-brand-gold pr-3">Ù…Ø±Ø­Ù„Ø© 3: ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ø³Ù„Ø¹Ø© ÙˆØ§Ù„Ø¯ÙØ¹ ÙˆØ§Ù„ØªÙƒÙ„ÙØ©</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-white/80 text-xs font-bold font-sans">Ù†ÙˆØ¹ Ù…Ø­ØªÙˆÙ‰ Ø§Ù„Ø´Ø­Ù†Ø© *</label>
                <select
                  id="package_type_select"
                  value={packageType}
                  onChange={(e) => setPackageType(e.target.value)}
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all"
                >
                  <option value="Documents" className="bg-brand-deep text-white">Ù…Ø³ØªÙ†Ø¯Ø§Øª ÙˆØ£ÙˆØ±Ø§Ù‚ (Documents)</option>
                  <option value="Perfumes" className="bg-brand-deep text-white">Ø¹Ø·ÙˆØ± ÙˆÙ…Ø³ØªØ­Ø¶Ø±Ø§Øª ØªØ¬Ù…ÙŠÙ„ (Perfumes)</option>
                  <option value="Clothes" className="bg-brand-deep text-white">Ù…Ù„Ø§Ø¨Ø³ ÙˆÙ…Ù†Ø³ÙˆØ¬Ø§Øª (Clothes)</option>
                  <option value="Electronics" className="bg-brand-deep text-white">Ø£Ø¬Ù‡Ø²Ø© Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠØ© (Electronics)</option>
                  <option value="Foods" className="bg-brand-deep text-white">Ù…ÙˆØ§Ø¯ ØºØ°Ø§Ø¦ÙŠØ© Ø£Ùˆ Ø·Ø¹Ø§Ù… (Foods)</option>
                  <option value="Gifts" className="bg-brand-deep text-white">Ù‡Ø¯Ø§ÙŠØ§ ÙˆØ¨Ø§Ù‚Ø§Øª ÙˆØ±ÙˆØ¯ (Gifts)</option>
                </select>
              </div>

              <div className="space-y-1.5 align-top">
                <label className="text-white/80 text-xs font-bold font-sans">Ø§Ù„Ø®Ø¯Ù…Ø© Ø§Ù„Ù…Ø·Ù„ÙˆØ¨Ø©</label>
                <div className="flex bg-brand-deep p-1 rounded-xl border border-white/10">
                  <button
                    id="service_type_std"
                    type="button"
                    onClick={() => setServiceType("standard")}
                    className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-colors cursor-pointer ${serviceType === "standard" ? "bg-brand-gold text-brand-deep" : "text-white/40 hover:text-white"}`}
                  >
                    Ø¹Ø§Ø¯ÙŠ Standard
                  </button>
                  <button
                    id="service_type_exp"
                    type="button"
                    onClick={() => setServiceType("express")}
                    className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg transition-colors cursor-pointer ${serviceType === "express" ? "bg-brand-gold text-brand-deep" : "text-white/40 hover:text-white"}`}
                  >
                    Ø³Ø±ÙŠØ¹ Express
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="text-white/80 text-xs font-bold font-sans">Ø§Ù„Ù‚Ø·Ø¹ *</label>
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
                  <label className="text-white/80 text-xs font-bold font-sans">Ø§Ù„ÙˆØ²Ù† (ÙƒØ¬Ù…) *</label>
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
                <label className="text-white/80 text-xs font-bold font-sans">Ø·Ø±ÙŠÙ‚Ø© ØªØ³ÙˆÙŠØ© Ø§Ù„Ø¯ÙØ¹ Ø§Ù„Ù…Ø­Ø¯Ø¯Ø© *</label>
                <select
                  id="payment_method_select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as Order["payment_method"])}
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all"
                >
                  <option value="sender_pays" className="bg-brand-deep text-white">Ø§Ù„Ø±Ø§Ø³Ù„ ÙŠØ¯ÙØ¹ Ø§Ù„Ø±Ø³ÙˆÙ… (Sender Pays)</option>
                  <option value="receiver_pays" className="bg-brand-deep text-white">Ø§Ù„Ù…Ø³ØªÙ„Ù… ÙŠØ¯ÙØ¹ Ø±Ø³ÙˆÙ… Ø§Ù„ØªÙˆØµÙŠÙ„ (Receiver Pays)</option>
                  <option value="cod" className="bg-brand-deep text-white">Ø§Ù„Ø¯ÙØ¹ Ø¹Ù†Ø¯ Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù… Ù„Ù„Ø³Ù„Ø¹Ø© COD</option>
                </select>
              </div>

              {paymentMethod === "cod" && (
                <div className="space-y-1.5">
                  <label className="text-white/80 text-xs font-bold font-sans">Ù…Ø¨Ù„Øº Ø§Ù„ØªØ­ØµÙŠÙ„ Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ù„Ù„Ø³Ù„Ø¹Ø© (COD AED) *</label>
                  <input
                    id="cod_amount_input"
                    type="number"
                    required
                    value={codAmount}
                    onChange={(e) => { setCodAmount(e.target.value); setValidationError(""); }}
                    placeholder="Ù…Ø«Ø§Ù„: 350 Ø¯Ø±Ù‡Ù… Ù‚ÙŠÙ…Ø© Ø§Ù„Ø³Ù„Ø¹Ø©"
                    className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-4 text-emerald-400 font-extrabold text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep/95 transition-all placeholder:text-white/20 font-mono"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-white/80 text-xs font-bold font-sans">Ù…Ù„Ø§Ø­Ø¸Ø§Øª Ø¥Ø¶Ø§ÙÙŠØ© Ù„Ù„Ù…Ù†Ø¯ÙˆØ¨ Ø£Ùˆ Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©</label>
              <textarea
                id="notes_textarea"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ø§ÙƒØªØ¨ Ù‡Ù†Ø§ Ø£ÙŠ Ù…Ù„Ø§Ø­Ø¸Ø§Øª Ù…Ø«Ù„: Ø§Ù„Ø·Ø±Ø¯ Ù‚Ø§Ø¨Ù„ Ù„Ù„ÙƒØ³Ø±ØŒ ÙŠØ±Ø¬Ù‰ Ø§Ù„Ø§ØªØµØ§Ù„ Ù‚Ø¨Ù„ Ø§Ù„ÙˆØµÙˆÙ„ Ø¨Ù†ØµÙ Ø³Ø§Ø¹Ø©..."
                className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold"
              ></textarea>
            </div>

            {captchaEnabled && (
              <TurnstileCaptcha
                siteKey={captchaSiteKey}
                language={language}
                onVerify={(token) => {
                  setCaptchaToken(token);
                  setValidationError("");
                }}
                onExpire={() => setCaptchaToken("")}
              />
            )}

            {/* Calculations Detail Box */}
            <div className="bg-brand-deep/85 rounded-2xl p-4 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm font-sans font-medium text-right">
              <div className="p-2.5 bg-brand-gold/10 rounded-lg text-brand-gold border border-brand-gold/20 text-[10px] leading-relaxed max-w-xs text-right">
                Ø³ÙŠØªÙ… ØªØ£ÙƒÙŠØ¯ Ø±Ø³ÙˆÙ… Ø§Ù„ØªØ­ØµÙŠÙ„ ÙˆØ§Ù„Ø¯ÙØ¹ Ø¨Ø¯Ù‚Ø© Ù…Ù† Ø§Ù„Ø¥Ø¯Ø§Ø±Ø© Ø¨Ù…Ø¬Ø±Ø¯ Ù…Ø¹Ø§Ù„Ø¬Ø© Ø§Ù„Ø·Ù„Ø¨ Ø§Ù„ÙƒØªØ±ÙˆÙ†ÙŠØ§Ù‹. Ø§Ù„Ø£Ø³Ø¹Ø§Ø± Ø§Ù„Ù…Ø¹Ø±ÙˆØ¶Ø© Ù†Ù‡Ø§Ø¦ÙŠØ© ÙˆÙˆØ§Ø¶Ø­Ø©.
              </div>
              <div className="space-y-1 w-full sm:w-auto text-right">
                <span className="text-white/40 text-xs font-bold font-sans">Ø¨ÙŠØ§Ù† Ù‚ÙŠÙ…Ø© Ø±Ø³ÙˆÙ… Ø§Ù„ØªÙˆØµÙŠÙ„</span>
                <div className="text-xs text-white/60 space-y-0.5">
                  <p>Ø³Ø¹Ø± Ø§Ù„Ø®Ø¯Ù…Ø©: <span className="font-mono text-white">{deliveryPricing.subtotal.toFixed(2)} AED</span></p>
                </div>
                <p className="text-xl font-extrabold text-brand-gold font-mono leading-none pt-1 border-t border-white/5">{deliveryPricing.total.toFixed(2)} AED Ù†Ù‡Ø§Ø¦ÙŠ</p>
                <p className="text-[10px] text-white/40 font-bold">
                  {expensiveCitiesAr.includes(receiverCity) ? "* Ù…Ù†Ø·Ù‚Ø© Ø¨Ø¹ÙŠØ¯Ø©/50 Ø¯Ø±Ù‡Ù… Ø£Ø³Ø§Ø³ÙŠ." : "* Ø³Ø¹Ø± Ù…ÙˆØ­Ø¯/30 Ø¯Ø±Ù‡Ù… Ø£Ø³Ø§Ø³ÙŠ."} 
                  {serviceType === "express" && " Ù…Ø¶Ø§Ù Ø±Ø³ÙˆÙ… Ø®Ø¯Ù…Ø© Ø³Ø±ÙŠØ¹Ø© (15 Ø¯Ø±Ù‡Ù…)."}
                </p>
              </div>
            </div>

            <div className="pt-4 flex justify-between">
              <button
                id="req_step_back_2"
                onClick={() => { setValidationError(""); setStep(2); }}
                className="px-6 py-3.5 bg-brand-deep hover:bg-white/5 border border-white/10 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Ø±Ø¬ÙˆØ¹ Ù„Ù„Ø³Ø§Ø¨Ù‚
              </button>
              <button
                id="req_submit_confirm"
                onClick={handleFormSubmit}
                disabled={loading || (captchaEnabled && !captchaToken)}
                className="px-10 py-3.5 bg-brand-gold hover:bg-brand-blue disabled:bg-white/10 text-brand-deep hover:text-white font-extrabold rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>{loading ? (language === "ar" ? "Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø­ÙØ¸ ÙˆØ§Ù„Ø¥Ø±Ø³Ø§Ù„..." : "Submitting order...") : (language === "ar" ? "Ø£Ø±Ø³Ù„ Ø·Ù„Ø¨ Ø§Ù„ØªÙˆØµÙŠÙ„ Ø§Ù„Ø¢Ù†" : "Submit delivery request")}</span>
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
                <span>{language === 'ar' ? 'Ø­Ø§Ù„Ø© Ø§Ù„Ø´Ø­Ù†Ø© Ø§Ù„Ø­Ø§Ù„ÙŠØ© (Pending)' : 'Current Status (Pending)'}</span>
              </p>
            </div>

            {createdOrder && (
              <div className="space-y-4 max-w-2xl mx-auto text-left">
                <QRGenerator trackingCode={successId} />
                <Invoice order={createdOrder} />
                <ShippingLabel order={createdOrder} />
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                id="success_copy_tracking_btn"
                type="button"
                onClick={() => navigator.clipboard?.writeText(successId)}
                className="px-5 py-3 bg-white/5 border border-white/10 hover:border-brand-gold text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-2"
                aria-label="Copy tracking code"
              >
                <Copy className="w-4 h-4 text-brand-gold" />
                <span>{language === "ar" ? "Ù†Ø³Ø® Ø±Ù‚Ù… Ø§Ù„ØªØªØ¨Ø¹" : "Copy tracking code"}</span>
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
              {language === 'ar' ? 'ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø·Ø±Ø¯Ùƒ Ù„ÙˆÙƒÙŠÙ„ Ø§Ù„ØªÙˆØ²ÙŠØ¹ØŒ ÙˆØ³ÙŠØµÙ„ Ø³Ø§Ø¦Ù‚ Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª Ù„Ø¥Ø¬Ø±Ø§Ø¡ Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù… ÙÙŠ ÙˆÙ‚Øª Ù‚Ø±ÙŠØ¨. ÙŠÙ…ÙƒÙ†Ùƒ Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø±Ù‚Ù… Ø§Ù„ØªØªØ¨Ø¹ Ø£Ø¹Ù„Ø§Ù‡ Ù„Ù„Ù…Ø±Ø§Ù‚Ø¨Ø© ÙÙˆØ±ÙŠØ§Ù‹!' : 'Your package has been sent to the distribution agent. A driver will arrive for pickup soon. Use the tracking number to monitor.'}
            </p>

            <div className={`flex justify-center gap-3 pt-2 ${language === 'ar' ? 'flex-row' : 'flex-row-reverse'}`}>
              <button
                id="success_new_btn"
                onClick={() => {
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
                  setNotes("");
                  setCodAmount("");
                  setCaptchaToken("");
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

