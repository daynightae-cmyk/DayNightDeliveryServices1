import { useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  Landmark,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Send,
  Settings2,
  TriangleAlert,
  X,
} from "lucide-react";
import type { DriverOrder } from "../../types/driver";
import {
  copyPreparedWhatsApp,
  createFeedbackLinkForOrder,
  openPreparedWhatsApp,
  recordDriverContactAttempt,
  revisePreparedWhatsAppMessage,
  type MessagePresentationOptions,
  type PreparedWhatsAppMessage,
} from "../../services/whatsappMessageService";
import {
  prepareDeterministicDriverWhatsApp,
  type DriverMessageActionKey,
  type DriverPaymentMode,
} from "../../services/driverActionMessageService";
import {
  buildBankTransferUrl,
  normalizePaymentMode,
  type DayNightBankId,
} from "../../config/bankTransfer";
import { getTrackingUrl } from "../../config/companyContact";

type Props = { order: DriverOrder; isArabic: boolean };
type PaymentChoice = "recorded" | DriverPaymentMode;

type MessageAction = {
  key: DriverMessageActionKey;
  ar: string;
  en: string;
  Icon: typeof Send;
  tone?: "warning" | "success";
};

const MESSAGE_ACTIONS: MessageAction[] = [
  { key: "driver_on_the_way", ar: "أنا في الطريق", en: "I am on the way", Icon: Navigation },
  { key: "driver_request_location", ar: "طلب إرسال الموقع", en: "Request location", Icon: MapPin },
  { key: "driver_arrived", ar: "وصلت إلى الموقع", en: "I have arrived", Icon: MessageCircle },
  { key: "driver_unreachable", ar: "تعذر التواصل", en: "Unable to contact", Icon: TriangleAlert, tone: "warning" },
  { key: "driver_delivered_feedback", ar: "تم التسليم – طلب تقييم", en: "Delivered – request feedback", Icon: CheckCircle2, tone: "success" },
];

function trackingReference(order: DriverOrder) {
  return String(order.tracking_number || order.tracking_code || order.invoice_number || order.id || "").trim();
}

function customerPhone(order: DriverOrder) {
  return String(order.receiver_phone || order.customer_phone || "").trim();
}

function amountDue(order: DriverOrder) {
  const candidates = [
    order.cod_amount,
    order.customer_total,
    order.total_amount,
    order.total_price,
    order.total,
    order.amount,
    order.collected_amount,
    order.goods_value,
    order.product_value,
    order.merchant_goods_value,
    order.delivery_fee,
    order.delivery_price,
    order.price,
    order.base_price,
  ];
  for (const candidate of candidates) {
    const value = Number(candidate ?? 0);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function formattedAmount(amount: number, isArabic: boolean) {
  return new Intl.NumberFormat(isArabic ? "ar-AE" : "en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#071A33]/10 bg-white px-3 py-2 text-[10px] font-black text-[#071A33]">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[#0057B8]" />
      <span>{label}</span>
    </label>
  );
}

export default function DriverCustomerCommunication({ order, isArabic }: Props) {
  const reference = useMemo(() => trackingReference(order), [order]);
  const phone = useMemo(() => customerPhone(order), [order]);
  const shipmentAmount = useMemo(() => amountDue(order), [order]);
  const trackingUrl = useMemo(() => getTrackingUrl(reference), [reference]);
  const recordedPaymentMode = useMemo(() => normalizePaymentMode(order.payment_method), [order.payment_method]);

  const [prepared, setPrepared] = useState<PreparedWhatsAppMessage | null>(null);
  const [draft, setDraft] = useState("");
  const [preparing, setPreparing] = useState<DriverMessageActionKey | "">("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [contactNote, setContactNote] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>("recorded");
  const [preferredBank, setPreferredBank] = useState<DayNightBankId>("adib");
  const [presentation, setPresentation] = useState<MessagePresentationOptions>({
    includeBrandSignature: true,
    includeSlogan: true,
    includeTrackingLink: true,
    includeFeedbackLink: true,
    includeSupportPhone: true,
    spacing: "comfortable",
  });

  const effectivePaymentMode: DriverPaymentMode = paymentChoice === "recorded" ? recordedPaymentMode : paymentChoice;
  const bankPaymentUrl = useMemo(
    () => buildBankTransferUrl({ orderReference: reference, amount: shipmentAmount, bank: preferredBank, locale: isArabic ? "ar" : "en" }),
    [isArabic, preferredBank, reference, shipmentAmount],
  );

  const setOption = <K extends keyof MessagePresentationOptions>(key: K, value: MessagePresentationOptions[K]) => {
    setPresentation((current) => ({ ...current, [key]: value }));
  };

  async function prepare(action: MessageAction) {
    setPreparing(action.key);
    setError("");
    setCopied(false);
    try {
      let feedbackUrl = "";
      if (action.key === "driver_delivered_feedback") {
        feedbackUrl = await createFeedbackLinkForOrder(order.id);
      }

      const result = await prepareDeterministicDriverWhatsApp({
        messageType: action.key,
        orderId: order.id,
        trackingNumber: reference,
        customerName: order.receiver_name || order.customer_name,
        customerPhone: phone,
        customerCity: order.receiver_city,
        merchantId: order.merchant_id,
        merchantName: order.merchant_name,
        driverId: order.assigned_driver_id || order.driver_id || undefined,
        driverName: order.driver_name,
        driverPhone: order.driver_phone,
        amountDue: shipmentAmount,
        paymentMethod: effectivePaymentMode === "online" ? "bank_transfer" : "cash",
        pickupAddress: [order.sender_city, order.sender_address].filter(Boolean).join("، "),
        deliveryAddress: [order.receiver_city, order.receiver_address].filter(Boolean).join("، "),
        trackingUrl,
        feedbackUrl,
        orderStatus: order.status,
        locale: isArabic ? "ar" : "en",
        paymentMode: effectivePaymentMode,
        preferredBank,
        presentation: { ...presentation, customNote: customNote.trim() },
        metadata: {
          surface: "driver_order_card",
          action: action.key,
          deterministicTemplate: true,
          paymentMode: effectivePaymentMode,
          preferredBank,
          recordedShipmentAmount: shipmentAmount,
        },
      });

      setPrepared(result);
      setDraft(result.message);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "message_generation_failed";
      setError(
        isArabic
          ? code === "invalid_whatsapp_phone"
            ? "رقم هاتف العميل غير صالح لفتح واتساب. راجع بيانات الطلب أولًا."
            : code === "feedback_service_unavailable" || code === "feedback_link_not_created"
              ? "تعذر إنشاء رابط التقييم الآمن لهذا الطلب."
              : "تعذر تجهيز الرسالة المستقلة. راجع بيانات الطلب وحاول مجددًا."
          : code === "invalid_whatsapp_phone"
            ? "The customer phone is invalid for WhatsApp."
            : "The action-specific message could not be prepared. Review the order and try again.",
      );
    } finally {
      setPreparing("");
    }
  }

  function finalPrepared() {
    return prepared ? revisePreparedWhatsAppMessage(prepared, draft, { customNote: "", customClosing: "", customFooter: "" }) : null;
  }

  async function recordUnreachable(result: "opened" | "copied") {
    if (prepared?.templateKey !== "driver_unreachable") return;
    try {
      await recordDriverContactAttempt({
        orderId: order.id,
        driverId: order.assigned_driver_id || order.driver_id || undefined,
        attemptType: "whatsapp_unreachable",
        result,
        note: contactNote.trim() || undefined,
      });
    } catch {
      setError(isArabic ? "تم تنفيذ الإرسال، لكن تعذر تسجيل محاولة التواصل." : "The message action completed, but the contact attempt could not be logged.");
    }
  }

  async function copyMessage() {
    const final = finalPrepared();
    if (!final) return;
    await copyPreparedWhatsApp(final);
    await recordUnreachable("copied");
    setCopied(true);
  }

  async function openWhatsApp() {
    const final = finalPrepared();
    if (!final) return;
    await recordUnreachable("opened");
    await openPreparedWhatsApp(final, { direct: true });
  }

  async function copyReference() {
    await navigator.clipboard.writeText(reference);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="mt-4 rounded-3xl border border-[#0057B8]/20 bg-white/95 p-4 shadow-[0_18px_50px_rgba(7,26,51,0.08)]" dir={isArabic ? "rtl" : "ltr"}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0057B8]">DAY NIGHT SMART CONTACT</span>
          <h4 className="mt-1 text-base font-black text-[#071A33]">{isArabic ? "التواصل الاحترافي مع العميل" : "Professional customer communication"}</h4>
          <p className="mt-1 text-xs leading-6 text-[#52627A]">
            {isArabic
              ? "كل زر يستخدم رسالة مستقلة حسب الإجراء، مع رقم الشحنة والمبلغ وطريقة الدفع ورابط التحويل عند اختيار الدفع أونلاين. فتح واتساب لا يغيّر حالة الطلب."
              : "Every action uses its own message, including shipment number, amount, payment method, and an online-transfer link when selected. Opening WhatsApp does not change the order status."}
          </p>
        </div>
        <MessageCircle className="h-8 w-8 shrink-0 text-[#25D366]" />
      </div>

      {shipmentAmount > 0 && (
        <div className="mb-3 rounded-2xl border border-[#D4AF37]/30 bg-[#FFF9E8] px-4 py-3 text-xs font-black text-[#735400]">
          {isArabic ? "مبلغ الشحنة المسجل" : "Recorded shipment amount"}: {formattedAmount(shipmentAmount, isArabic)} {isArabic ? "درهم" : "AED"}
        </div>
      )}

      <div className="mb-3 grid gap-2 rounded-2xl border border-[#0057B8]/15 bg-[#F4F8FF] p-3 sm:grid-cols-2">
        <label className="grid gap-1 text-[10px] font-black text-[#071A33]">
          <span className="inline-flex items-center gap-1"><Banknote className="h-4 w-4 text-[#0057B8]" />{isArabic ? "طريقة الدفع في الرسالة" : "Payment method in message"}</span>
          <select value={paymentChoice} onChange={(event) => setPaymentChoice(event.target.value as PaymentChoice)} className="min-h-11 rounded-xl border border-[#071A33]/10 bg-white px-3 text-xs font-black">
            <option value="recorded">{isArabic ? `حسب الطلب (${recordedPaymentMode === "online" ? "أونلاين" : "كاش"})` : `From order (${recordedPaymentMode})`}</option>
            <option value="cash">{isArabic ? "كاش عند الاستلام" : "Cash on delivery"}</option>
            <option value="online">{isArabic ? "تحويل بنكي / أونلاين" : "Bank transfer / online"}</option>
          </select>
        </label>
        <label className="grid gap-1 text-[10px] font-black text-[#071A33]">
          <span className="inline-flex items-center gap-1"><Landmark className="h-4 w-4 text-[#D4AF37]" />{isArabic ? "الحساب البنكي المفضل" : "Preferred bank account"}</span>
          <select value={preferredBank} onChange={(event) => setPreferredBank(event.target.value as DayNightBankId)} disabled={effectivePaymentMode !== "online"} className="min-h-11 rounded-xl border border-[#071A33]/10 bg-white px-3 text-xs font-black disabled:opacity-45">
            <option value="adib">ADIB — مصرف أبوظبي الإسلامي</option>
            <option value="adcb">ADCB — بنك أبوظبي التجاري</option>
          </select>
        </label>
        {effectivePaymentMode === "online" && (
          <a href={bankPaymentUrl} target="_blank" rel="noreferrer" className="sm:col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#071A33] px-3 text-xs font-black text-white">
            <Landmark className="h-4 w-4 text-[#D4AF37]" />
            {isArabic ? "معاينة صفحة التحويل التي ستصل للعميل" : "Preview customer bank-transfer page"}
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      <button type="button" onClick={() => setOptionsOpen((value) => !value)} className="mb-3 inline-flex items-center gap-2 rounded-xl border border-[#0057B8]/20 bg-[#EDF5FF] px-3 py-2 text-[11px] font-black text-[#0057B8]">
        <Settings2 className="h-4 w-4" />
        {isArabic ? "خيارات الرسالة" : "Message options"}
      </button>

      {optionsOpen && (
        <div className="mb-4 rounded-2xl border border-[#0057B8]/15 bg-[#F4F8FF] p-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Toggle checked={presentation.includeTrackingLink !== false} onChange={(value) => setOption("includeTrackingLink", value)} label={isArabic ? "رابط التتبع" : "Tracking link"} />
            <Toggle checked={presentation.includeFeedbackLink !== false} onChange={(value) => setOption("includeFeedbackLink", value)} label={isArabic ? "رابط التقييم" : "Feedback link"} />
            <Toggle checked={presentation.includeBrandSignature !== false} onChange={(value) => setOption("includeBrandSignature", value)} label={isArabic ? "توقيع داي نايت" : "DAY NIGHT signature"} />
          </div>
          <label className="mt-3 block text-[11px] font-black text-[#071A33]">
            {isArabic ? "ملاحظة خاصة يضيفها المندوب" : "Driver note added to this message"}
            <textarea value={customNote} onChange={(event) => setCustomNote(event.target.value)} rows={2} maxLength={600} className="mt-2 w-full rounded-xl border border-[#071A33]/10 bg-white p-3 text-sm font-medium leading-6" placeholder={isArabic ? "مثال: سأصل خلال عشر دقائق." : "Example: I will arrive in ten minutes."} />
          </label>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {MESSAGE_ACTIONS.map(({ Icon, ...action }) => (
          <button key={action.key} type="button" disabled={Boolean(preparing)} onClick={() => void prepare({ Icon, ...action })} className={`min-h-20 rounded-2xl border p-3 text-start text-xs font-black transition disabled:opacity-50 ${action.tone === "warning" ? "border-amber-400/35 bg-amber-50 text-amber-900" : action.tone === "success" ? "border-emerald-500/30 bg-emerald-50 text-emerald-900" : "border-[#0057B8]/15 bg-[#EDF5FF] text-[#071A33]"}`}>
            <Icon className="mb-2 h-5 w-5" />
            <span>{isArabic ? action.ar : action.en}</span>
            {preparing === action.key && <small className="mt-2 block opacity-60">{isArabic ? "جارٍ تجهيز القالب الخاص…" : "Preparing this action…"}</small>}
          </button>
        ))}
        <a href={phone ? `tel:${phone}` : undefined} aria-disabled={!phone} className="min-h-20 rounded-2xl border border-[#0057B8]/15 bg-[#EDF5FF] p-3 text-xs font-black text-[#071A33] aria-disabled:pointer-events-none aria-disabled:opacity-45">
          <Phone className="mb-2 h-5 w-5" />
          {isArabic ? "اتصال بالعميل" : "Call customer"}
        </a>
        <a href={trackingUrl} target="_blank" rel="noreferrer" className="min-h-20 rounded-2xl border border-[#D4AF37]/30 bg-[#FFF9E8] p-3 text-xs font-black text-[#735400]">
          <ExternalLink className="mb-2 h-5 w-5" />
          {isArabic ? "فتح التتبع" : "Open tracking"}
        </a>
        <button type="button" onClick={() => void copyReference()} className="min-h-20 rounded-2xl border border-[#0057B8]/15 bg-[#EDF5FF] p-3 text-start text-xs font-black text-[#071A33]">
          <ClipboardCopy className="mb-2 h-5 w-5" />
          {copied ? (isArabic ? "تم النسخ" : "Copied") : (isArabic ? "نسخ رقم الشحنة" : "Copy tracking number")}
        </button>
      </div>

      {error && <p className="mt-3 rounded-2xl border border-red-500/20 bg-red-50 p-3 text-xs font-bold leading-6 text-red-800">{error}</p>}

      {prepared && (
        <div className="fixed inset-0 z-[100000] flex items-end justify-center bg-[#071A33]/70 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true">
          <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#25D366]">WhatsApp preview</span>
                <h4 className="mt-1 text-lg font-black text-[#071A33]">{isArabic ? "معاينة القالب الخاص بهذا الزر" : "Preview this action-specific message"}</h4>
                <p className="mt-1 text-xs text-[#52627A]" dir="ltr">{prepared.phone}</p>
              </div>
              <button type="button" onClick={() => { setPrepared(null); setDraft(""); }} className="rounded-full bg-[#071A33]/5 p-2"><X className="h-5 w-5" /></button>
            </div>

            {prepared.templateKey === "driver_unreachable" && (
              <label className="mt-4 block text-xs font-black text-[#071A33]">
                {isArabic ? "ملاحظة المندوب لمحاولة التواصل" : "Driver contact-attempt note"}
                <textarea value={contactNote} onChange={(event) => setContactNote(event.target.value)} rows={2} className="mt-2 w-full rounded-2xl border border-[#071A33]/15 bg-[#F7FAFF] p-3 text-sm" />
              </label>
            )}

            <textarea value={draft} onChange={(event) => { setDraft(event.target.value); setCopied(false); }} rows={18} maxLength={7000} className="mt-4 min-h-[380px] w-full resize-y rounded-2xl border border-[#071A33]/10 bg-[#F5F8FD] p-4 text-sm font-medium leading-7 text-[#071A33] outline-none focus:border-[#0057B8]" />

            <div className="sticky bottom-0 mt-4 grid grid-cols-3 gap-2 bg-white pt-2">
              <button type="button" onClick={() => { setPrepared(null); setDraft(""); }} className="rounded-2xl border border-[#071A33]/15 px-3 py-3 text-xs font-black">{isArabic ? "إلغاء" : "Cancel"}</button>
              <button type="button" onClick={() => void copyMessage()} className="rounded-2xl border border-[#0057B8]/20 bg-[#EDF5FF] px-3 py-3 text-xs font-black text-[#0057B8]">{copied ? (isArabic ? "تم النسخ" : "Copied") : (isArabic ? "نسخ الرسالة" : "Copy")}</button>
              <button type="button" onClick={() => void openWhatsApp()} disabled={!draft.trim()} className="rounded-2xl bg-[#25D366] px-3 py-3 text-xs font-black text-[#071A33] shadow-lg disabled:opacity-50">{isArabic ? "فتح واتساب" : "Open WhatsApp"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
