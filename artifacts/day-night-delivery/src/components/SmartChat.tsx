import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, DollarSign, MapPin, MessageSquare, Minus, Navigation, Phone, Search, Send, Sparkles, Truck, X } from "lucide-react";
import companyMeta from "../data/companyMeta";
import { useAppContext } from "../lib/AppContext";
import { supabase } from "../supabase";
import { useLocation, useNavigate } from "react-router-dom";

type ChatMessage = { id: string; sender: "bot" | "user"; text: string };
type PageAssist = { titleAr: string; titleEn: string; promptAr: string; promptEn: string; quickAr: string[]; quickEn: string[] };

const CLOSED_KEY = "dn_chat_closed";
const GREETED_KEY = "dn_chat_greeted";
const HISTORY_KEY = "dn_smart_chat_live_v2";
const HIDDEN_ROUTES = ["/admin", "/driver", "/customer", "/auth", "/update-password"];
const CITY_ROUTE_PRICE = 30;
const SPECIAL_ROUTE_PRICE = 50;

function normalizeArabicDigits(value: string) {
  return value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function firstNumber(input: string, fallback = 1) {
  const match = normalizeArabicDigits(input).match(/\d+(?:\.\d+)?/);
  const parsed = match ? Number(match[0]) : fallback;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function hasAny(input: string, keys: string[]) {
  const q = input.toLowerCase();
  return keys.some((key) => q.includes(key.toLowerCase()));
}

function isSpecialRoute(input: string) {
  return hasAny(input, ["special", "al ain", "dhafra", "liwa", "ruwais", "western", "العين", "الظفرة", "ليوا", "الرويس", "الغربية", "خاص"]);
}

function localQuote(input: string, isArabic: boolean) {
  if (!hasAny(input, ["local", "uae", "delivery", "order", "price", "cost", "سعر", "محلي", "توصيل", "طلب", "طلبات", "الإمارات", "الامارات", "داخل دبي", "أبوظبي"])) return null;
  const count = Math.max(1, Math.ceil(firstNumber(input, 1)));
  const unit = isSpecialRoute(input) ? SPECIAL_ROUTE_PRICE : CITY_ROUTE_PRICE;
  const total = count * unit;
  return isArabic
    ? `حساب الشحن المحلي لدى DAY NIGHT:\n${count} طلب × ${unit} درهم = ${total} درهم.\n\nالمسارات الأساسية: 30 درهم للطلب.\nالمسارات الخاصة: 50 درهم للطلب.\nالوزن لا يدخل في حساب المحلي، ويستخدم فقط في الشحن الدولي.\n\nيمكنك إنشاء طلب من /request أو فتح الأسعار من /pricing.`
    : `DAY NIGHT local shipping estimate:\n${count} order(s) × ${unit} AED = ${total} AED.\n\nStandard routes: 30 AED per order.\nSpecial routes: 50 AED per order.\nWeight is not used for local shipping; it applies only to international shipping.\n\nCreate an order at /request or open /pricing.`;
}

function internationalQuote(input: string, isArabic: boolean) {
  if (!hasAny(input, ["international", "gcc", "world", "shipping", "saudi", "qatar", "oman", "kuwait", "bahrain", "دولي", "خليج", "السعودية", "قطر", "عمان", "الكويت", "البحرين", "عالمي"])) return null;
  const weight = Math.max(1, Math.ceil(firstNumber(input, 1)));
  const isGcc = hasAny(input, ["gcc", "saudi", "qatar", "oman", "kuwait", "bahrain", "خليج", "السعودية", "قطر", "عمان", "الكويت", "البحرين"]);
  const firstKg = isGcc ? 95 : 190;
  const extraKg = isGcc ? 45 : 90;
  const total = firstKg + Math.max(0, weight - 1) * extraKg;
  return isArabic
    ? `تقدير الشحن الدولي:\nالوزن: ${weight} كجم\nأول كيلو: ${firstKg} درهم\nكل كيلو إضافي: ${extraKg} درهم\nالإجمالي التقريبي: ${total} درهم.`
    : `International shipping estimate:\nWeight: ${weight} kg\nFirst kg: ${firstKg} AED\nEach additional kg: ${extraKg} AED\nEstimated total: ${total} AED.`;
}

function operationsAnswer(input: string, isArabic: boolean) {
  if (hasAny(input, ["track", "tracking", "invoice", "phone", "coupon", "تتبع", "فاتورة", "هاتف", "رقم", "كوبون"])) {
    return isArabic
      ? `يمكنك التتبع باستخدام رقم الفاتورة أو رقم التتبع أو رقم الهاتف المسجل أو رقم الكوبون. افتح /tracking وأدخل الرقم. للدعم المباشر: ${companyMeta.whatsappUrl}`
      : `You can track by invoice number, tracking number, saved phone number, or coupon number. Open /tracking and enter the reference. Direct support: ${companyMeta.whatsappUrl}`;
  }
  if (hasAny(input, ["cod", "تحصيل", "الدفع عند الاستلام"])) {
    return isArabic ? "خدمة COD متاحة. عند إنشاء الطلب اختر COD واكتب مبلغ التحصيل ليظهر في الفاتورة ولوحة الإدارة." : "COD is available. Select COD while creating the order and enter the collection amount for invoice/admin visibility.";
  }
  if (hasAny(input, ["merchant", "store", "company", "تاجر", "متجر", "شركة", "عقد"])) {
    return isArabic ? "للتجار والشركات: يمكن فتح حساب تاجر، طلبات بالكوبون، COD، تقارير، وتتبع برقم الفاتورة أو الهاتف. افتح /corporate أو تواصل واتساب." : "For merchants and companies: merchant account, coupon orders, COD, reports, and tracking by invoice or phone. Open /corporate or WhatsApp us.";
  }
  return null;
}

function contextForPath(pathname: string): PageAssist {
  if (pathname.includes("tracking")) return { titleAr: "مساعد التتبع", titleEn: "Tracking assistant", promptAr: "أستطيع مساعدتك في قراءة حالة الشحنة أو شرح رقم التتبع أو فتح واتساب للدعم.", promptEn: "I can help read shipment status, explain tracking, or open WhatsApp support.", quickAr: ["كيف أتتبع بالهاتف؟", "لم تظهر الشحنة", "افتح واتساب للدعم"], quickEn: ["Track by phone", "Shipment not found", "Open WhatsApp support"] };
  if (pathname.includes("pricing")) return { titleAr: "مساعد الأسعار", titleEn: "Pricing assistant", promptAr: "أرسل عدد الطلبات المحلية أو وزن الشحن الدولي وسأحسب السعر فوراً.", promptEn: "Send local order count or international weight and I will estimate the price.", quickAr: ["احسب 4 طلبات محلي", "5 كيلو السعودية", "فرق المحلي والدولي"], quickEn: ["Calculate 4 local orders", "5 kg to Saudi", "Local vs international"] };
  if (pathname.includes("request")) return { titleAr: "مساعد إنشاء الطلب", titleEn: "Order assistant", promptAr: "أرشدك خطوة بخطوة: بيانات المرسل، المستلم، محتوى الشحنة، COD والدفع.", promptEn: "I can guide sender, receiver, shipment content, COD and payment steps.", quickAr: ["ما البيانات المطلوبة؟", "كيف أضيف COD؟", "محتوى الشحنة حر؟"], quickEn: ["Required fields", "How to add COD", "Free shipment description"] };
  if (pathname.includes("uae-delivery")) return { titleAr: "مساعد الشحن المحلي", titleEn: "Local shipping assistant", promptAr: "المحلي يُحسب بعدد الطلبات والمسار، وليس بالكيلو. اسألني عن أي مدينة.", promptEn: "Local shipping is by order count and route, not kilograms. Ask about any UAE area.", quickAr: ["دبي إلى أبوظبي", "العين كم؟", "3 طلبات محلي"], quickEn: ["Dubai to Abu Dhabi", "Al Ain price", "3 local orders"] };
  if (pathname.includes("international")) return { titleAr: "مساعد الشحن الدولي", titleEn: "International assistant", promptAr: "الخليج 95 أول كيلو + 45 إضافي، والعالمي 190 أول كيلو + 90 إضافي.", promptEn: "GCC is 95 first kg + 45 extra, worldwide is 190 first kg + 90 extra.", quickAr: ["5 كيلو السعودية", "2 كيلو أمريكا", "أسعار الخليج"], quickEn: ["5 kg Saudi", "2 kg USA", "GCC prices"] };
  if (pathname.includes("corporate") || pathname.includes("ecommerce")) return { titleAr: "مساعد التجار", titleEn: "Merchant assistant", promptAr: "أساعدك في حساب تاجر، عقود الشركات، COD، والكوبونات/الباركود.", promptEn: "I can help with merchant accounts, corporate contracts, COD and coupon/barcode orders.", quickAr: ["فتح حساب تاجر", "تعاقد شركات", "طلبات بالكوبون"], quickEn: ["Merchant account", "Corporate contract", "Coupon orders"] };
  return { titleAr: "مساعدك الذكي", titleEn: "Smart assistant", promptAr: "اسألني عن السعر، التتبع، طلب توصيل، COD، أو حساب تاجر.", promptEn: "Ask about pricing, tracking, delivery requests, COD, or merchant accounts.", quickAr: ["احسب 3 طلبات", "تتبع برقم الهاتف", "شحن 4 كيلو السعودية"], quickEn: ["Calculate 3 orders", "Track by phone", "4 kg to Saudi"] };
}

async function askLiveAi(message: string): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.functions.invoke("daynight-ai-chat", { body: { message } });
    if (error) return null;
    const answer = typeof data?.answer === "string" ? data.answer.trim() : "";
    return answer || null;
  } catch {
    return null;
  }
}

function fallbackAnswer(input: string, isArabic: boolean) {
  return isArabic
    ? `أنا مساعد DAY NIGHT الذكي. أقدر أساعدك في الشحن المحلي، الشحن الدولي، التتبع، COD، التجار والشركات، وإنشاء الطلبات.\n\nجرّب: "احسب 3 طلبات" أو "شحن 4 كيلو السعودية" أو "تتبع برقم الهاتف".`
    : `I am the DAY NIGHT smart assistant. I can help with local shipping, international shipping, tracking, COD, merchant accounts, and booking.\n\nTry: "calculate 3 orders", "4 kg to Saudi", or "track by phone".`;
}

export default function SmartChat() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pageAssist = useMemo(() => contextForPath(location.pathname), [location.pathname]);
  const quickReplies = isArabic ? pageAssist.quickAr : pageAssist.quickEn;
  const title = isArabic ? pageAssist.titleAr : pageAssist.titleEn;
  const prompt = isArabic ? pageAssist.promptAr : pageAssist.promptEn;

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]") as ChatMessage[];
      if (saved.length) { setMessages(saved); return; }
    } catch { /* ignore */ }
    setMessages([{ id: "welcome", sender: "bot", text: isArabic ? "مرحباً، أنا مساعد DAY NIGHT الذكي. أرافقك في كل صفحة وأقترح الخطوة المناسبة." : "Welcome to DAY NIGHT AI. I can guide you on every page and suggest the next step." }]);
  }, [isArabic]);

  useEffect(() => { if (messages.length) sessionStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-40))); }, [messages]);
  useEffect(() => { if (open && !minimized) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open, minimized]);
  useEffect(() => {
    if (sessionStorage.getItem(CLOSED_KEY) || sessionStorage.getItem(GREETED_KEY)) return;
    const timer = setTimeout(() => { setShowBubble(true); sessionStorage.setItem(GREETED_KEY, "1"); }, 3200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open || minimized) return;
    setMessages((prev) => {
      const last = prev[prev.length - 1]?.id || "";
      const id = `page-${location.pathname}`;
      if (last === id || prev.some((m) => m.id === id)) return prev;
      return [...prev, { id, sender: "bot", text: `${title}: ${prompt}` }].slice(-40);
    });
  }, [location.pathname, open, minimized, title, prompt]);

  const sendText = useCallback(async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, sender: "user", text: trimmed }]);
    setLoading(true);

    const contextualMessage = `${isArabic ? "سياق الصفحة" : "Page context"}: ${title}. ${prompt}\n${isArabic ? "رسالة العميل" : "Customer message"}: ${trimmed}`;
    const exact = localQuote(trimmed, isArabic) || internationalQuote(trimmed, isArabic) || operationsAnswer(trimmed, isArabic);
    const live = exact ? null : await askLiveAi(contextualMessage);
    const answer = exact || live || fallbackAnswer(trimmed, isArabic);

    setMessages((prev) => [...prev, { id: `bot-${Date.now()}`, sender: "bot", text: answer }]);
    setLoading(false);
    if (supabase) supabase.from("chatbot_leads").insert({ message: trimmed, source: live ? "live_ai_chat" : "smart_chat", language, page_path: location.pathname }).then(() => undefined);
  }, [isArabic, language, loading, location.pathname, prompt, title]);

  function sendMessage() { const cur = text; setText(""); void sendText(cur); }
  function openPanel() { setOpen(true); setShowBubble(false); setMinimized(false); }
  function closePanel() { setOpen(false); setShowBubble(false); setMinimized(false); sessionStorage.setItem(CLOSED_KEY, "1"); }
  function toggleOpen() { if (open) { minimized ? setMinimized(false) : closePanel(); } else openPanel(); }

  if (HIDDEN_ROUTES.some((r) => location.pathname.startsWith(r))) return null;
  const whatsappLink = `${companyMeta.whatsappUrl}?text=${encodeURIComponent(isArabic ? "مرحباً، أحتاج مساعدة" : "Hello, I need support")}`;

  return <>
    {showBubble && !open && <div className="dn-chat-bubble fixed max-w-[275px] pointer-events-none"><div className="bg-brand-deep border border-brand-gold/30 rounded-2xl px-4 py-3 shadow-xl relative pointer-events-auto"><button onClick={() => setShowBubble(false)} className="absolute top-2 right-2 text-white/40 hover:text-white/80 transition-colors" aria-label="Dismiss bubble"><X className="w-3 h-3" /></button><p className="text-white text-xs font-bold leading-snug pe-4">{title}</p><p className="mt-1 text-white/52 text-[10px] font-bold leading-5 pe-4">{prompt}</p></div></div>}

    {open && !minimized && <div className="dn-smartchat-panel fixed overflow-hidden rounded-3xl border border-brand-gold/25 bg-brand-deep shadow-2xl flex flex-col" dir={isArabic ? "rtl" : "ltr"}>
      <div className="bg-brand-cool border-b border-white/10 px-4 py-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><div className="w-9 h-9 rounded-full bg-brand-gold text-brand-deep grid place-items-center"><Bot className="w-4 h-4" /></div><div><p className="text-white font-black text-sm">DAY NIGHT AI</p><p className="text-white/45 text-[10px] font-bold">{title}</p></div></div><div className="flex items-center gap-1"><button onClick={() => setMinimized(true)} className="p-2 text-white/55 hover:text-brand-gold" aria-label="Minimize chat"><Minus className="w-4 h-4" /></button><button onClick={closePanel} className="p-2 text-white/55 hover:text-brand-gold" aria-label="Close chat"><X className="w-4 h-4" /></button></div></div>
      <div className="px-3 py-2 border-b border-white/10 bg-white/[0.02]"><div className="mb-2 flex items-start gap-2 rounded-2xl border border-brand-gold/18 bg-brand-gold/8 p-3"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" /><p className="text-[11px] font-bold leading-5 text-white/68">{prompt}</p></div><div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">{quickReplies.map((item) => <button key={item} onClick={() => void sendText(item)} className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 hover:border-brand-gold/40 hover:text-brand-gold transition-colors">{item}</button>)}</div></div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[220px]">{messages.map((msg) => <div key={msg.id} className={`flex ${msg.sender === "bot" ? "justify-start" : "justify-end"}`}><div className={`max-w-[84%] rounded-2xl px-3 py-2 text-xs leading-6 whitespace-pre-wrap ${msg.sender === "bot" ? "bg-white/8 text-white border border-white/10" : "bg-brand-gold text-brand-deep font-bold"}`}>{msg.text}</div></div>)}{loading && <div className="text-xs text-white/45">{isArabic ? "جاري التفكير..." : "Thinking..."}</div>}<div ref={messagesEndRef} /></div>
      <div className="px-3 py-2 border-t border-white/10 flex items-center justify-between gap-2 bg-brand-cool/50"><a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-emerald-300 flex items-center gap-1"><Phone className="w-3 h-3" /> WhatsApp</a><button onClick={() => navigate("/tracking")} className="text-[10px] font-black text-white/45 hover:text-brand-gold flex items-center gap-1"><Search className="w-3 h-3" /> {isArabic ? "تتبع" : "Track"}</button><button onClick={() => navigate("/pricing")} className="text-[10px] font-black text-white/45 hover:text-brand-gold flex items-center gap-1"><DollarSign className="w-3 h-3" /> {isArabic ? "سعر" : "Price"}</button><button onClick={() => navigate("/request")} className="text-[10px] font-black text-white/45 hover:text-brand-gold flex items-center gap-1"><Truck className="w-3 h-3" /> {isArabic ? "طلب" : "Order"}</button></div>
      <div className="p-3 border-t border-white/10 flex items-center gap-2"><input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }} placeholder={isArabic ? "اسألني عن هذه الصفحة..." : "Ask about this page..."} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/35 outline-none focus:border-brand-gold/50" /><button onClick={sendMessage} disabled={loading} className="w-10 h-10 rounded-xl bg-brand-gold text-brand-deep grid place-items-center hover:bg-brand-gold-light transition-colors disabled:opacity-60" aria-label="Send message"><Send className="w-4 h-4" /></button></div>
    </div>}

    {(!open || minimized) && <button onClick={toggleOpen} className={`dn-smartchat-trigger fixed rounded-full shadow-2xl grid place-items-center transition-all hover:scale-105 ${open ? "bg-brand-gold text-brand-deep" : "bg-brand-cool border border-brand-gold/35 text-brand-gold"}`} aria-label="Smart chat"><MessageSquare className="w-6 h-6" />{!open && <span className="absolute inset-0 rounded-full border border-brand-gold/50 animate-ping" />}</button>}
  </>;
}
