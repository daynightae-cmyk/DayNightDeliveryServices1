import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { MessageSquare, Send, X, Phone, Minus, Truck, Search, DollarSign, Download, FileText } from "lucide-react";
import { aiAgentKnowledge, chatKnowledgeEntries } from "../data/aiAgentKnowledge";
import companyMeta from "../data/companyMeta";
import { useAppContext } from "../lib/AppContext";
import { pageCopy } from "../data/pageCopy";
import { searchChatbotAnswerRpc, supabase } from "../supabase";
import { useLocation, useNavigate } from "react-router-dom";

type ChatMessage = { id: string; sender: "bot" | "user"; text: string };

const CLOSED_KEY = "dn_chat_closed";
const GREETED_KEY = "dn_chat_greeted";
const HISTORY_KEY = "dn_smart_chat_history_v3";
const HIDDEN_ROUTES = ["/admin", "/driver", "/customer", "/auth", "/update-password"];
const MAIN_LOCAL_PRICE = 30;
const EXTENDED_LOCAL_PRICE = 50;

function normalizeArabicDigits(value: string) {
  return value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function firstNumber(input: string, fallback = 1) {
  const normalized = normalizeArabicDigits(input);
  const match = normalized.match(/\d+(?:\.\d+)?/);
  const parsed = match ? Number(match[0]) : fallback;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function hasAny(input: string, keys: string[]) {
  const q = input.toLowerCase();
  return keys.some((key) => q.includes(key.toLowerCase()));
}

function isExtendedAreaQuestion(input: string) {
  return hasAny(input, ["extended", "al ain", "western", "dhafra", "liwa", "ruwais", "غياثي", "ليوا", "الرويس", "العين", "الغربية", "الظفرة", "ممتدة", "بعيدة"]);
}

function localOrderQuote(input: string, isArabic: boolean): string | null {
  if (!hasAny(input, ["local", "uae", "delivery", "order", "orders", "price", "cost", "سعر", "تكلفة", "محلي", "توصيل", "طلبية", "طلبيات", "طلبات", "الامارات", "الإمارات"])) return null;

  const hasOrderWord = hasAny(input, ["order", "orders", "طلبية", "طلبيات", "طلبات", "parcel", "shipment", "شحنة"]);
  const hasPriceWord = hasAny(input, ["price", "cost", "quote", "estimate", "سعر", "تكلفة", "احسب", "كام", "كم"]);
  const localIntent = hasAny(input, ["local", "uae", "محلي", "التوصيل", "داخل", "الإمارات", "الامارات"]);
  if (!localIntent && !(hasOrderWord && hasPriceWord)) return null;

  const count = Math.max(1, Math.ceil(firstNumber(input, 1)));
  const unit = isExtendedAreaQuestion(input) ? EXTENDED_LOCAL_PRICE : MAIN_LOCAL_PRICE;
  const total = count * unit;
  const zone = unit === EXTENDED_LOCAL_PRICE
    ? (isArabic ? "منطقة ممتدة" : "extended area")
    : (isArabic ? "منطقة رئيسية" : "main area");

  return isArabic
    ? `حساب التوصيل المحلي لدى DAY NIGHT يكون بالطلبية فقط وليس بالكيلو.\n\n${count} طلبية × ${unit} درهم (${zone}) = ${total} درهم.\n\nأمثلة سريعة للمناطق الرئيسية:\n• 1 طلبية = 30 درهم\n• 2 طلبية = 60 درهم\n• 3 طلبيات = 90 درهم\n\nالكيلو والزيادة بالكيلو تخص الشحن الدولي فقط. يمكنك إنشاء الطلب من /request أو مراجعة الأسعار من /pricing.`
    : `DAY NIGHT local UAE delivery is priced by order count only, not kilograms.\n\n${count} order(s) × ${unit} AED (${zone}) = ${total} AED.\n\nMain-area examples:\n• 1 order = 30 AED\n• 2 orders = 60 AED\n• 3 orders = 90 AED\n\nKilogram pricing applies to international shipping only. Create an order at /request or review prices at /pricing.`;
}

function internationalQuote(input: string, isArabic: boolean): string | null {
  if (!hasAny(input, ["international", "gcc", "world", "global", "saudi", "qatar", "oman", "kuwait", "bahrain", "shipping", "دولي", "خليج", "الخليج", "السعودية", "قطر", "عمان", "الكويت", "البحرين", "عالمي", "أمريكا", "اوروبا", "أوروبا"])) return null;
  const weight = Math.max(1, Math.ceil(firstNumber(input, 1)));
  const isGcc = hasAny(input, ["gcc", "saudi", "qatar", "oman", "kuwait", "bahrain", "خليج", "الخليج", "السعودية", "قطر", "عمان", "الكويت", "البحرين"]);
  const firstKg = isGcc ? 95 : 190;
  const additionalKg = isGcc ? 45 : 90;
  const total = firstKg + Math.max(0, weight - 1) * additionalKg;
  return isArabic
    ? `تقدير الشحن الدولي:\n${isGcc ? "وجهة خليجية" : "وجهة عالمية"}\nالوزن المحتسب: ${weight} كجم\nأول كيلو: ${firstKg} درهم\nكل كيلو إضافي: ${additionalKg} درهم\nالإجمالي التقريبي: ${total} درهم.\n\nيمكنك الحجز من /request أو فتح حاسبة الأسعار من /pricing.`
    : `International shipping estimate:\n${isGcc ? "GCC destination" : "Worldwide destination"}\nBillable weight: ${weight} kg\nFirst kg: ${firstKg} AED\nEach additional kg: ${additionalKg} AED\nEstimated total: ${total} AED.\n\nBook at /request or open the calculator at /pricing.`;
}

function operationalAssistant(input: string, isArabic: boolean): string | null {
  if (hasAny(input, ["track", "tracking", "invoice", "phone", "where", "تتبع", "فاتورة", "هاتف", "رقم", "وين", "اين", "أين"])) {
    return isArabic
      ? `للتتبع يمكنك استخدام أي واحد من هذه البيانات:\n• رقم الفاتورة\n• رقم التتبع\n• رقم الهاتف المسجل في الطلب\n• رقم الكوبون إذا كان الطلب من لوحة الإدارة\n\nافتح صفحة التتبع: /tracking ثم أدخل الرقم. إذا لم تظهر النتيجة، أرسل الرقم عبر واتساب وسنراجعه فوراً: ${companyMeta.whatsappUrl}`
      : `You can track using any of these:\n• Invoice number\n• Tracking number\n• Phone number saved on the order\n• Coupon number for admin-created coupon orders\n\nOpen /tracking and enter the reference. If no result appears, send it on WhatsApp: ${companyMeta.whatsappUrl}`;
  }

  if (hasAny(input, ["request", "book", "order now", "send", "pickup", "اطلب", "احجز", "ارسل", "استلام", "مندوب", "طلب توصيل"])) {
    return isArabic
      ? `لإنشاء طلب توصيل جديد:\n1) افتح /request\n2) اكتب بيانات المرسل: الاسم، الهاتف، مدينة الاستلام، العنوان\n3) اكتب بيانات المستلم: الاسم، الهاتف، مدينة التسليم، العنوان\n4) اكتب محتوى الشحنة بحرية\n5) اختر الدفع أو COD عند الحاجة\n\nبعد الإرسال سيظهر رقم تتبع/فاتورة للمتابعة.`
      : `To create a new delivery request:\n1) Open /request\n2) Add sender details: name, phone, pickup city, address\n3) Add receiver details: name, phone, delivery city, address\n4) Describe the shipment freely\n5) Choose payment or COD if needed\n\nAfter submission, you receive a tracking/invoice reference.`;
  }

  if (hasAny(input, ["cod", "cash", "collection", "تحصيل", "الدفع عند الاستلام", "كاش"])) {
    return isArabic
      ? `خدمة COD متاحة للمتاجر والعملاء. عند إنشاء الطلب اختر COD واكتب مبلغ التحصيل. يظهر مبلغ COD في لوحة الإدارة والفاتورة والتقارير.`
      : `COD is available for merchants and customers. Select COD while creating the order and enter the collection amount. COD appears in admin, invoice, and reports.`;
  }

  if (hasAny(input, ["merchant", "store", "contract", "company", "business", "تاجر", "متجر", "شركة", "عقد", "شركات", "تعاقد"])) {
    return isArabic
      ? `للتجار والشركات: نوفر حساب تاجر، طلبات بالكوبون/الباركود، COD، فواتير، تقارير، وتتبع برقم الفاتورة أو الهاتف. افتح /corporate أو تواصل واتساب لفتح ملف تاجر.`
      : `For merchants and companies: merchant accounts, coupon/barcode orders, COD, invoices, reports, and tracking by invoice or phone. Open /corporate or WhatsApp us to create a merchant profile.`;
  }

  return null;
}

function matchKnowledge(input: string, isArabic: boolean): string | null {
  const q = input.toLowerCase().trim();
  for (const entry of chatKnowledgeEntries) {
    if (entry.keys.some((k) => q.includes(k.toLowerCase()))) {
      return isArabic ? entry.ar : entry.en;
    }
  }
  return null;
}

function smartFallback(input: string, isArabic: boolean): string {
  const q = input.toLowerCase();
  const facts = aiAgentKnowledge;
  const local = localOrderQuote(input, isArabic);
  if (local) return local;
  const intl = internationalQuote(input, isArabic);
  if (intl) return intl;
  const ops = operationalAssistant(input, isArabic);
  if (ops) return ops;

  if (["human", "agent", "support", "موظف", "انسان", "إنسان", "دعم"].some((k) => q.includes(k.toLowerCase()))) {
    return isArabic
      ? `أقدر أحولك مباشرة للدعم البشري عبر واتساب: ${companyMeta.whatsappUrl}\nاكتب رقم التتبع أو اسم المرسل وسنساعدك بسرعة.`
      : `I can route you to human support through WhatsApp: ${companyMeta.whatsappUrl}\nSend your tracking number or sender name for faster help.`;
  }

  if (["rights", "privacy", "policy", "terms", "refund", "customer", "حقوق", "خصوصية", "سياسة", "شروط", "استرداد"].some((k) => q.includes(k))) {
    return isArabic
      ? `ملخص مهم:\n• حقوق العميل وسياسة الخدمة متاحة على /policy\n• الخصوصية وحماية البيانات على /privacy\n• يمكنك تحميل مستندات PDF من صفحة السياسات\n• لأي مطالبة: أرسل رقم التتبع للدعم ${companyMeta.phone}`
      : `Important summary:\n• Customer rights and service policy: /policy\n• Privacy and data protection: /privacy\n• PDF downloads are available from the policy page\n• For any claim, send the tracking number to support: ${companyMeta.phone}`;
  }

  if (["price", "cost", "quote", "سعر", "تكلفة", "عرض"].some((k) => q.includes(k))) {
    return isArabic
      ? `${facts.prices.domesticMainAr}\n${facts.prices.domesticExtendedAr}\nالمحلي بالطلبية فقط وليس بالكيلو.\nالخليج: 95 درهم أول كيلو + 45 لكل كيلو إضافي.\nالعالمي: 190 درهم أول كيلو + 90 لكل كيلو إضافي.\nاستخدم الحاسبة: /pricing`
      : `${facts.prices.domesticMain}\n${facts.prices.domesticExtended}\nLocal is by order count only, not kg.\nGCC: 95 AED first kg + 45 AED per additional kg.\nWorldwide: 190 AED first kg + 90 AED per additional kg.\nUse calculator: /pricing`;
  }

  return isArabic
    ? `أنا مساعد DAY NIGHT الذكي المجاني داخل الموقع. أقدر أساعدك فوراً في:\n• حساب المحلي بعدد الطلبيات: 1=30، 2=60، 3=90\n• حساب الدولي بالكيلو\n• التتبع برقم الفاتورة أو الهاتف\n• إنشاء طلب توصيل\n• COD والتجار والشركات\n\nاكتب مثلاً: "احسب 3 طلبيات" أو "شحن 4 كيلو السعودية" أو "أريد تتبع شحنتي".`
    : `I am the free DAY NIGHT smart assistant inside the website. I can help with:\n• Local order-count pricing: 1=30, 2=60, 3=90\n• International kg pricing\n• Tracking by invoice or phone\n• Creating delivery orders\n• COD, merchants, and corporate accounts\n\nTry: "calculate 3 local orders", "4 kg to Saudi", or "track my shipment".`;
}

const QUICK_REPLIES_EN = [
  "Calculate 3 local orders", "Local prices", "GCC 3 kg estimate", "Track by phone",
  "Request delivery", "COD", "Merchant account", "Corporate quote",
  "Worldwide shipping", "Coverage areas", "WhatsApp contact",
];

const QUICK_REPLIES_AR = [
  "احسب 3 طلبيات محلي", "أسعار محلية", "3 كيلو السعودية", "تتبع برقم الهاتف",
  "طلب توصيل", "COD", "إضافة تاجر", "عرض للشركات",
  "شحن عالمي", "مناطق التغطية", "تواصل واتساب",
];

export default function SmartChat() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const t = pageCopy[language].chatPage;
  const location = useLocation();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]") as ChatMessage[];
      if (saved.length) {
        setMessages(saved);
        return;
      }
    } catch {
      // ignore corrupted session history
    }
    setMessages([{ id: "welcome", sender: "bot", text: isArabic ? "مرحباً، أنا مساعد DAY NIGHT الذكي. اسألني عن السعر المحلي بالطلبية، الشحن الدولي بالكيلو، التتبع، COD، أو إنشاء طلب توصيل." : t.welcome }]);
  }, [isArabic, t.welcome]);

  useEffect(() => {
    if (messages.length) sessionStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-40)));
  }, [messages]);

  useEffect(() => {
    if (open && !minimized) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, minimized]);

  useEffect(() => {
    if (sessionStorage.getItem(CLOSED_KEY) || sessionStorage.getItem(GREETED_KEY)) return;
    const timer = setTimeout(() => {
      setShowBubble(true);
      sessionStorage.setItem(GREETED_KEY, "1");
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  const whatsappLink = useMemo(
    () => `${companyMeta.whatsappUrl}?text=${encodeURIComponent(isArabic ? "مرحباً، أحتاج مساعدة" : "Hello, I need support")}`,
    [isArabic]
  );

  const quickReplies = isArabic ? QUICK_REPLIES_AR : QUICK_REPLIES_EN;

  const sendText = useCallback(async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, sender: "user", text: trimmed }]);

    let answer = localOrderQuote(trimmed, isArabic) || internationalQuote(trimmed, isArabic) || operationalAssistant(trimmed, isArabic) || matchKnowledge(trimmed, isArabic);

    if (!answer) {
      const rpcAnswer = await searchChatbotAnswerRpc(trimmed);
      if (rpcAnswer?.answer) answer = rpcAnswer.answer;
      else if (typeof rpcAnswer === "string") answer = rpcAnswer;
    }

    if (!answer) answer = smartFallback(trimmed, isArabic);

    setMessages((prev) => [...prev, { id: `bot-${Date.now()}`, sender: "bot", text: answer! }]);

    if (supabase) {
      supabase.from("chatbot_leads").insert({ message: trimmed, source: "smart_chat", language }).then(() => undefined);
    }
  }, [isArabic, language]);

  function openPanel() {
    setOpen(true);
    setShowBubble(false);
    setMinimized(false);
  }

  function closePanel() {
    setOpen(false);
    setShowBubble(false);
    setMinimized(false);
    sessionStorage.setItem(CLOSED_KEY, "1");
  }

  function toggleOpen() {
    if (open) {
      minimized ? setMinimized(false) : closePanel();
    } else {
      openPanel();
    }
  }

  function sendMessage() {
    const cur = text;
    setText("");
    void sendText(cur);
  }

  function exportConversationTxt() {
    const lines = [
      "DAY NIGHT DELIVERY SERVICES — Smart Chat Transcript",
      `Website: ${companyMeta.displayWebsite}`,
      `Email: ${companyMeta.email}`,
      `Phone: ${companyMeta.phone}`,
      "Creating by Eng Sadek Elgazar",
      "",
      ...messages.map((msg) => `${msg.sender === "bot" ? "DAY NIGHT" : "CUSTOMER"}: ${msg.text}`),
    ];
    const blob = new Blob([lines.join("\n\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DayNight_Chat_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportConversationPdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const maybe = doc as unknown as { processArabic?: (input: string) => string };
    const tx = (value: string) => isArabic && typeof maybe.processArabic === "function" ? maybe.processArabic(value) : value;
    doc.setFillColor(7, 26, 51);
    doc.rect(0, 0, 210, 36, "F");
    doc.setTextColor(212, 175, 55);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("DAY NIGHT DELIVERY SERVICES", 105, 14, { align: "center" });
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(tx(isArabic ? "تقرير محادثة العميل" : "Customer Chat Transcript"), 105, 24, { align: "center" });
    let y = 48;
    messages.slice(-28).forEach((msg) => {
      if (y > 270) return;
      doc.setTextColor(msg.sender === "bot" ? 7 : 30, msg.sender === "bot" ? 26 : 40, msg.sender === "bot" ? 51 : 60);
      doc.setFont("helvetica", msg.sender === "bot" ? "bold" : "normal");
      const label = msg.sender === "bot" ? "DAY NIGHT" : "CUSTOMER";
      doc.text(`${label}:`, isArabic ? 192 : 16, y, { align: isArabic ? "right" : "left" });
      y += 5;
      const parts = doc.splitTextToSize(tx(msg.text), 172);
      doc.text(parts, isArabic ? 192 : 18, y, { align: isArabic ? "right" : "left" });
      y += Math.min(parts.length, 5) * 5 + 4;
    });
    doc.setFillColor(7, 26, 51);
    doc.rect(0, 282, 210, 15, "F");
    doc.setTextColor(212, 175, 55);
    doc.setFontSize(7);
    doc.text("Creating by Eng Sadek Elgazar", 105, 291, { align: "center" });
    doc.save(`DayNight_Chat_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  if (HIDDEN_ROUTES.some((r) => location.pathname.startsWith(r))) return null;

  return (
    <>
      {showBubble && !open && (
        <div className="fixed max-w-[260px] pointer-events-none" style={{ right: 18, bottom: "calc(148px + env(safe-area-inset-bottom))", zIndex: 72 }}>
          <div className="bg-brand-deep border border-brand-gold/30 rounded-2xl px-4 py-3 shadow-xl relative pointer-events-auto" style={{ animation: "fadeInUp 0.35s ease" }}>
            <button onClick={() => setShowBubble(false)} className="absolute top-2 right-2 text-white/40 hover:text-white/80 transition-colors" aria-label="Dismiss bubble"><X className="w-3 h-3" /></button>
            <p className="text-white text-xs font-bold leading-snug pe-4">{isArabic ? "اسألني: احسب 3 طلبيات، أو تتبع برقم الهاتف، أو شحن السعودية." : t.welcome}</p>
            <div className="absolute -bottom-2 right-8 w-4 h-4 bg-brand-deep border-r border-b border-brand-gold/30 rotate-45" />
          </div>
        </div>
      )}

      {open && !minimized && (
        <div className="fixed overflow-hidden rounded-3xl border border-brand-gold/25 bg-brand-deep shadow-2xl flex flex-col" dir={isArabic ? "rtl" : "ltr"} style={{ right: 18, bottom: "calc(92px + env(safe-area-inset-bottom))", width: "min(calc(100vw - 24px), 420px)", maxHeight: "min(78vh, calc(100dvh - 128px))", zIndex: 75 }}>
          <div className="bg-brand-cool border-b border-white/10 px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-brand-gold text-brand-deep grid place-items-center"><Truck className="w-4 h-4" /></div>
              <div>
                <p className="text-white font-black text-sm">DAY NIGHT AI</p>
                <p className="text-white/45 text-[10px] font-bold">{isArabic ? "مساعد مجاني للأسعار والتتبع والطلبات" : "Free pricing, tracking, and order assistant"}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setMinimized(true)} className="p-2 text-white/55 hover:text-brand-gold transition-colors" aria-label="Minimize chat"><Minus className="w-4 h-4" /></button>
              <button onClick={closePanel} className="p-2 text-white/55 hover:text-brand-gold transition-colors" aria-label="Close chat"><X className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="p-3 border-b border-white/10 flex flex-wrap gap-2 bg-white/[0.02] max-h-28 overflow-y-auto">
            {quickReplies.map((item) => <button key={item} onClick={() => void sendText(item)} className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 hover:border-brand-gold/40 hover:text-brand-gold transition-colors">{item}</button>)}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[240px]">
            {messages.map((msg) => <div key={msg.id} className={`flex ${msg.sender === "bot" ? "justify-start" : "justify-end"}`}><div className={`max-w-[84%] rounded-2xl px-3 py-2 text-xs leading-6 whitespace-pre-wrap ${msg.sender === "bot" ? "bg-white/8 text-white border border-white/10" : "bg-brand-gold text-brand-deep font-bold"}`}>{msg.text}</div></div>)}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-3 py-2 border-t border-white/10 flex items-center justify-between gap-2 bg-brand-cool/50">
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-emerald-300 hover:text-emerald-200 flex items-center gap-1"><Phone className="w-3 h-3" /> WhatsApp</a>
            <button onClick={exportConversationTxt} className="text-[10px] font-black text-white/45 hover:text-brand-gold flex items-center gap-1"><FileText className="w-3 h-3" /> TXT</button>
            <button onClick={() => void exportConversationPdf()} className="text-[10px] font-black text-white/45 hover:text-brand-gold flex items-center gap-1"><Download className="w-3 h-3" /> PDF</button>
            <button onClick={() => navigate("/tracking")} className="text-[10px] font-black text-white/45 hover:text-brand-gold flex items-center gap-1"><Search className="w-3 h-3" /> {isArabic ? "تتبع" : "Track"}</button>
            <button onClick={() => navigate("/pricing")} className="text-[10px] font-black text-white/45 hover:text-brand-gold flex items-center gap-1"><DollarSign className="w-3 h-3" /> {isArabic ? "سعر" : "Price"}</button>
          </div>

          <div className="p-3 border-t border-white/10 flex items-center gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }} placeholder={isArabic ? "اسأل عن السعر، التتبع، الطلبات..." : t.placeholder} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/35 outline-none focus:border-brand-gold/50" />
            <button onClick={sendMessage} className="w-10 h-10 rounded-xl bg-brand-gold text-brand-deep grid place-items-center hover:bg-brand-gold-light transition-colors" aria-label="Send message"><Send className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {(!open || minimized) && (
        <button onClick={toggleOpen} className={`fixed rounded-full shadow-2xl grid place-items-center transition-all hover:scale-105 ${open ? "bg-brand-gold text-brand-deep" : "bg-brand-cool border border-brand-gold/35 text-brand-gold"}`} style={{ right: 18, bottom: "calc(78px + env(safe-area-inset-bottom))", width: 56, height: 56, zIndex: 74 }} aria-label="Smart chat">
          <MessageSquare className="w-6 h-6" />
          {!open && <span className="absolute inset-0 rounded-full border border-brand-gold/50 animate-ping" />}
        </button>
      )}
    </>
  );
}
