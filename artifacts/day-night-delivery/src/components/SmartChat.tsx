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
const HISTORY_KEY = "dn_smart_chat_history_v2";
const HIDDEN_ROUTES = ["/admin", "/driver", "/customer", "/auth", "/update-password"];

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

  if (["human", "agent", "support", "موظف", "انسان", "دعم"].some((k) => q.includes(k))) {
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
      ? `${facts.prices.domesticMainAr}\n${facts.prices.domesticExtendedAr}\nالخليج: 95 درهم أول كيلو + 45 لكل كيلو إضافي.\nالعالمي: 190 درهم أول كيلو + 90 لكل كيلو إضافي.\nاستخدم الحاسبة: /pricing`
      : `${facts.prices.domesticMain}\n${facts.prices.domesticExtended}\nGCC: 95 AED first kg + 45 AED per additional kg.\nWorldwide: 190 AED first kg + 90 AED per additional kg.\nUse calculator: /pricing`;
  }

  return isArabic
    ? `أفهم سؤالك. بناءً على بيانات داي نايت الرسمية، أقدر أساعدك في الأسعار، التتبع، طلب توصيل، COD، الشحن الدولي، حقوق العميل، أو السياسات.\nاكتب مثلاً: "سعر دبي"، "تتبع شحنة"، "حقوق العميل"، أو تواصل واتساب: ${companyMeta.whatsappUrl}`
    : `I understand your question. Based on Day Night official data, I can help with pricing, tracking, delivery requests, COD, international shipping, customer rights, and policies.\nTry: "Dubai price", "track shipment", "customer rights", or contact WhatsApp: ${companyMeta.whatsappUrl}`;
}

const QUICK_REPLIES_EN = [
  "Local prices", "Express delivery", "Pieces pricing", "COD",
  "GCC shipping", "Worldwide shipping", "Track shipment",
  "Request delivery", "Corporate", "E-commerce stores",
  "Customer rights", "Privacy", "Download policy PDF",
  "Documents", "Prohibited items", "Coverage areas",
  "Delivery times", "Payment methods", "WhatsApp contact",
];

const QUICK_REPLIES_AR = [
  "أسعار محلية", "توصيل سريع", "تسعير القطع", "COD",
  "شحن خليجي", "شحن عالمي", "تتبع شحنة",
  "طلب توصيل", "شركات وعقود", "متاجر إلكترونية",
  "حقوق العميل", "الخصوصية", "تحميل PDF السياسة",
  "مستندات", "مواد ممنوعة", "مناطق التغطية",
  "مواعيد التوصيل", "طرق الدفع", "تواصل واتساب",
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
    setMessages([{ id: "welcome", sender: "bot", text: t.welcome }]);
  }, [language, t.welcome]);

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

    let answer = matchKnowledge(trimmed, isArabic);

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

  function openPanel() { setOpen(true); setShowBubble(false); setMinimized(false); }
  function closePanel() {
    setOpen(false); setShowBubble(false); setMinimized(false);
    sessionStorage.setItem(CLOSED_KEY, "1");
  }
  function toggleOpen() {
    if (open) { minimized ? setMinimized(false) : closePanel(); }
    else openPanel();
  }
  function sendMessage() { const cur = text; setText(""); void sendText(cur); }

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
        <div className="fixed right-4 bottom-[130px] md:bottom-[82px] z-50 max-w-[240px]">
          <div className="bg-brand-deep border border-brand-gold/30 rounded-2xl px-4 py-3 shadow-xl relative" style={{ animation: "fadeInUp 0.35s ease" }}>
            <button onClick={() => setShowBubble(false)} className="absolute top-2 right-2 text-white/40 hover:text-white/80 transition-colors" aria-label="Dismiss bubble">
              <X className="w-3 h-3" />
            </button>
            <p className="text-white text-xs font-bold leading-snug pe-4">{t.welcome}</p>
            <div className="absolute -bottom-2 right-8 w-4 h-4 bg-brand-deep border-r border-b border-brand-gold/30 rotate-45" />
          </div>
        </div>
      )}

      {open && !minimized && (
        <div className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 w-[min(92vw,390px)] max-h-[78vh] bg-brand-deep border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col" dir={isArabic ? "rtl" : "ltr"}>
          <div className="bg-brand-cool border-b border-white/10 px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-brand-gold text-brand-deep grid place-items-center">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-white font-black text-sm">DAY NIGHT AI</p>
                <p className="text-white/45 text-[10px] font-bold">{isArabic ? "مساعد الخدمات الذكي" : "Smart service assistant"}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setMinimized(true)} className="p-2 text-white/55 hover:text-brand-gold transition-colors" aria-label="Minimize chat"><Minus className="w-4 h-4" /></button>
              <button onClick={closePanel} className="p-2 text-white/55 hover:text-brand-gold transition-colors" aria-label="Close chat"><X className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="p-3 border-b border-white/10 flex flex-wrap gap-2 bg-white/[0.02] max-h-28 overflow-y-auto">
            {quickReplies.map((item) => (
              <button key={item} onClick={() => void sendText(item)} className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 hover:border-brand-gold/40 hover:text-brand-gold transition-colors">
                {item}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[260px]">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === "bot" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-6 whitespace-pre-wrap ${msg.sender === "bot" ? "bg-white/8 text-white border border-white/10" : "bg-brand-gold text-brand-deep font-bold"}`}>
                  {msg.text}
                </div>
              </div>
            ))}
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
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
              placeholder={t.placeholder}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/35 outline-none focus:border-brand-gold/50"
            />
            <button onClick={sendMessage} className="w-10 h-10 rounded-xl bg-brand-gold text-brand-deep grid place-items-center hover:bg-brand-gold-light transition-colors" aria-label="Send message">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <button onClick={toggleOpen} className={`fixed right-4 z-50 w-14 h-14 rounded-full shadow-2xl grid place-items-center transition-all hover:scale-105 ${open && minimized ? "bottom-[88px]" : "bottom-6 md:bottom-6"} ${open ? "bg-brand-gold text-brand-deep" : "bg-brand-cool border border-brand-gold/35 text-brand-gold"}`} aria-label="Smart chat">
        <MessageSquare className="w-6 h-6" />
        {!open && <span className="absolute inset-0 rounded-full border border-brand-gold/50 animate-ping" />}
      </button>
    </>
  );
}
