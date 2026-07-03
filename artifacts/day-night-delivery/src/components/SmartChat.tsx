import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Send, X, Phone, Minus, Truck, Search, DollarSign } from "lucide-react";
import companyMeta from "../data/companyMeta";
import { useAppContext } from "../lib/AppContext";
import { supabase } from "../supabase";
import { useLocation, useNavigate } from "react-router-dom";

type ChatMessage = { id: string; sender: "bot" | "user"; text: string };

const CLOSED_KEY = "dn_chat_closed";
const GREETED_KEY = "dn_chat_greeted";
const HISTORY_KEY = "dn_smart_chat_live_v1";
const HIDDEN_ROUTES = ["/admin", "/driver", "/customer", "/auth", "/update-password"];
const CITY_ROUTE_PRICE = 30;
const SPECIAL_ROUTE_PRICE = 50;

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

function isSpecialRoute(input: string) {
  return hasAny(input, ["special", "al ain", "dhafra", "liwa", "ruwais", "western", "العين", "الظفرة", "ليوا", "الرويس", "الغربية", "خاص"]);
}

function localQuote(input: string, isArabic: boolean) {
  if (!hasAny(input, ["local", "uae", "delivery", "order", "price", "cost", "سعر", "محلي", "توصيل", "طلب", "طلبات", "الإمارات", "الامارات"])) return null;
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
  if (hasAny(input, ["track", "tracking", "invoice", "phone", "تتبع", "فاتورة", "هاتف", "رقم"])) {
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

const QUICK_REPLIES_AR = ["احسب 3 طلبات", "شحن 4 كيلو السعودية", "تتبع برقم الهاتف", "طلب توصيل", "COD", "حساب تاجر", "واتساب"];
const QUICK_REPLIES_EN = ["Calculate 3 orders", "4 kg to Saudi", "Track by phone", "Request delivery", "COD", "Merchant account", "WhatsApp"];

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

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]") as ChatMessage[];
      if (saved.length) { setMessages(saved); return; }
    } catch { /* ignore */ }
    setMessages([{ id: "welcome", sender: "bot", text: isArabic ? "مرحباً، أنا مساعد DAY NIGHT الذكي. اسألني عن الشحن المحلي، الدولي، التتبع، أو الطلبات." : "Welcome to DAY NIGHT AI. Ask about local shipping, international shipping, tracking, or delivery requests." }]);
  }, [isArabic]);

  useEffect(() => { if (messages.length) sessionStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-40))); }, [messages]);
  useEffect(() => { if (open && !minimized) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open, minimized]);
  useEffect(() => {
    if (sessionStorage.getItem(CLOSED_KEY) || sessionStorage.getItem(GREETED_KEY)) return;
    const timer = setTimeout(() => { setShowBubble(true); sessionStorage.setItem(GREETED_KEY, "1"); }, 4000);
    return () => clearTimeout(timer);
  }, []);

  const sendText = useCallback(async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, sender: "user", text: trimmed }]);
    setLoading(true);

    const exact = localQuote(trimmed, isArabic) || internationalQuote(trimmed, isArabic) || operationsAnswer(trimmed, isArabic);
    const live = exact ? null : await askLiveAi(trimmed);
    const answer = exact || live || fallbackAnswer(trimmed, isArabic);

    setMessages((prev) => [...prev, { id: `bot-${Date.now()}`, sender: "bot", text: answer }]);
    setLoading(false);
    if (supabase) supabase.from("chatbot_leads").insert({ message: trimmed, source: live ? "live_ai_chat" : "smart_chat", language }).then(() => undefined);
  }, [isArabic, language, loading]);

  function sendMessage() { const cur = text; setText(""); void sendText(cur); }
  function openPanel() { setOpen(true); setShowBubble(false); setMinimized(false); }
  function closePanel() { setOpen(false); setShowBubble(false); setMinimized(false); sessionStorage.setItem(CLOSED_KEY, "1"); }
  function toggleOpen() { if (open) { minimized ? setMinimized(false) : closePanel(); } else openPanel(); }

  if (HIDDEN_ROUTES.some((r) => location.pathname.startsWith(r))) return null;
  const quickReplies = isArabic ? QUICK_REPLIES_AR : QUICK_REPLIES_EN;
  const whatsappLink = `${companyMeta.whatsappUrl}?text=${encodeURIComponent(isArabic ? "مرحباً، أحتاج مساعدة" : "Hello, I need support")}`;

  return <>
    {showBubble && !open && <div className="fixed max-w-[260px] pointer-events-none" style={{ right: 18, bottom: "calc(148px + env(safe-area-inset-bottom))", zIndex: 72 }}><div className="bg-brand-deep border border-brand-gold/30 rounded-2xl px-4 py-3 shadow-xl relative pointer-events-auto"><button onClick={() => setShowBubble(false)} className="absolute top-2 right-2 text-white/40 hover:text-white/80 transition-colors" aria-label="Dismiss bubble"><X className="w-3 h-3" /></button><p className="text-white text-xs font-bold leading-snug pe-4">{isArabic ? "اسألني عن السعر أو التتبع أو إنشاء طلب." : "Ask me about pricing, tracking, or booking."}</p></div></div>}

    {open && !minimized && <div className="fixed overflow-hidden rounded-3xl border border-brand-gold/25 bg-brand-deep shadow-2xl flex flex-col" dir={isArabic ? "rtl" : "ltr"} style={{ right: 18, bottom: "calc(92px + env(safe-area-inset-bottom))", width: "min(calc(100vw - 24px), 420px)", maxHeight: "min(78vh, calc(100dvh - 128px))", zIndex: 75 }}>
      <div className="bg-brand-cool border-b border-white/10 px-4 py-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><div className="w-9 h-9 rounded-full bg-brand-gold text-brand-deep grid place-items-center"><Truck className="w-4 h-4" /></div><div><p className="text-white font-black text-sm">DAY NIGHT AI</p><p className="text-white/45 text-[10px] font-bold">{isArabic ? "مساعد ذكي حي عند تفعيل نموذج AI" : "Live AI assistant when model is enabled"}</p></div></div><div className="flex items-center gap-1"><button onClick={() => setMinimized(true)} className="p-2 text-white/55 hover:text-brand-gold" aria-label="Minimize chat"><Minus className="w-4 h-4" /></button><button onClick={closePanel} className="p-2 text-white/55 hover:text-brand-gold" aria-label="Close chat"><X className="w-4 h-4" /></button></div></div>
      <div className="p-3 border-b border-white/10 flex flex-wrap gap-2 bg-white/[0.02] max-h-28 overflow-y-auto">{quickReplies.map((item) => <button key={item} onClick={() => void sendText(item)} className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 hover:border-brand-gold/40 hover:text-brand-gold transition-colors">{item}</button>)}</div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[240px]">{messages.map((msg) => <div key={msg.id} className={`flex ${msg.sender === "bot" ? "justify-start" : "justify-end"}`}><div className={`max-w-[84%] rounded-2xl px-3 py-2 text-xs leading-6 whitespace-pre-wrap ${msg.sender === "bot" ? "bg-white/8 text-white border border-white/10" : "bg-brand-gold text-brand-deep font-bold"}`}>{msg.text}</div></div>)}{loading && <div className="text-xs text-white/45">{isArabic ? "جاري التفكير..." : "Thinking..."}</div>}<div ref={messagesEndRef} /></div>
      <div className="px-3 py-2 border-t border-white/10 flex items-center justify-between gap-2 bg-brand-cool/50"><a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-emerald-300 flex items-center gap-1"><Phone className="w-3 h-3" /> WhatsApp</a><button onClick={() => navigate("/tracking")} className="text-[10px] font-black text-white/45 hover:text-brand-gold flex items-center gap-1"><Search className="w-3 h-3" /> {isArabic ? "تتبع" : "Track"}</button><button onClick={() => navigate("/pricing")} className="text-[10px] font-black text-white/45 hover:text-brand-gold flex items-center gap-1"><DollarSign className="w-3 h-3" /> {isArabic ? "سعر" : "Price"}</button></div>
      <div className="p-3 border-t border-white/10 flex items-center gap-2"><input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }} placeholder={isArabic ? "اسأل عن السعر، التتبع، الطلبات..." : "Ask about pricing, tracking, orders..."} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/35 outline-none focus:border-brand-gold/50" /><button onClick={sendMessage} disabled={loading} className="w-10 h-10 rounded-xl bg-brand-gold text-brand-deep grid place-items-center hover:bg-brand-gold-light transition-colors disabled:opacity-60" aria-label="Send message"><Send className="w-4 h-4" /></button></div>
    </div>}

    {(!open || minimized) && <button onClick={toggleOpen} className={`fixed rounded-full shadow-2xl grid place-items-center transition-all hover:scale-105 ${open ? "bg-brand-gold text-brand-deep" : "bg-brand-cool border border-brand-gold/35 text-brand-gold"}`} style={{ right: 18, bottom: "calc(78px + env(safe-area-inset-bottom))", width: 56, height: 56, zIndex: 74 }} aria-label="Smart chat"><MessageSquare className="w-6 h-6" />{!open && <span className="absolute inset-0 rounded-full border border-brand-gold/50 animate-ping" />}</button>}
  </>;
}
