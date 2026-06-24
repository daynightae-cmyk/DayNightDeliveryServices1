import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { MessageSquare, Send, X, Phone, Minus, Truck, Search, DollarSign } from "lucide-react";
import { chatKnowledgeEntries } from "../data/aiAgentKnowledge";
import companyMeta from "../data/companyMeta";
import { useAppContext } from "../lib/AppContext";
import { pageCopy } from "../data/pageCopy";
import { searchChatbotAnswerRpc, supabase } from "../supabase";
import { useLocation, useNavigate } from "react-router-dom";

type ChatMessage = { id: string; sender: "bot" | "user"; text: string };

const CLOSED_KEY  = "dn_chat_closed";
const GREETED_KEY = "dn_chat_greeted";
const HIDDEN_ROUTES = ["/admin", "/driver", "/customer", "/auth"];

function matchKnowledge(input: string, isArabic: boolean): string | null {
  const q = input.toLowerCase().trim();
  for (const entry of chatKnowledgeEntries) {
    if (entry.keys.some((k) => q.includes(k.toLowerCase()))) {
      return isArabic ? entry.ar : entry.en;
    }
  }
  return null;
}

const QUICK_REPLIES_EN = [
  "Local prices", "Express delivery", "Pieces pricing", "COD",
  "GCC shipping", "Worldwide shipping", "Track shipment",
  "Request delivery", "Corporate", "E-commerce stores",
  "Documents", "Prohibited items", "Coverage areas",
  "Delivery times", "Payment methods", "WhatsApp contact",
];

const QUICK_REPLIES_AR = [
  "أسعار محلية", "توصيل سريع", "تسعير القطع", "COD",
  "شحن خليجي", "شحن عالمي", "تتبع شحنة",
  "طلب توصيل", "شركات وعقود", "متاجر إلكترونية",
  "مستندات", "مواد ممنوعة", "مناطق التغطية",
  "مواعيد التوصيل", "طرق الدفع", "تواصل واتساب",
];

export default function SmartChat() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const t = pageCopy[language].chatPage;
  const location = useLocation();
  const navigate = useNavigate();

  const [open, setOpen]           = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [text, setText]           = useState("");
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const messagesEndRef             = useRef<HTMLDivElement>(null);

  /* init welcome message */
  useEffect(() => {
    setMessages([{ id: "welcome", sender: "bot", text: t.welcome }]);
  }, [language, t.welcome]);

  /* auto-scroll */
  useEffect(() => {
    if (open && !minimized) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, minimized]);

  /* greeting bubble — once per session, 4s delay */
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

    if (!answer) {
      answer = isArabic
        ? `لم أجد إجابة دقيقة لسؤالك. يمكنني تحويلك إلى دعم واتساب للمساعدة الشخصية:\n${companyMeta.whatsappUrl}`
        : `I couldn't find an exact answer. Contact WhatsApp support for personal assistance:\n${companyMeta.whatsappUrl}`;
    }

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

  /* hide on staff routes */
  if (HIDDEN_ROUTES.some((r) => location.pathname.startsWith(r))) return null;

  return (
    <>
      {/* ── Greeting bubble ── */}
      {showBubble && !open && (
        <div className="fixed right-4 bottom-[130px] md:bottom-[82px] z-50 max-w-[240px]">
          <div
            className="bg-brand-deep border border-brand-gold/30 rounded-2xl px-4 py-3 shadow-xl relative"
            style={{ animation: "fadeInUp 0.35s ease" }}
          >
            <button
              onClick={() => setShowBubble(false)}
              className="absolute top-2 right-2 text-white/40 hover:text-white/80 transition-colors"
              aria-label="Dismiss bubble"
            >
              <X className="w-3 h-3" />
            </button>
            <p className="text-white text-xs font-bold leading-snug pe-4">{t.welcome}</p>
            <button onClick={openPanel} className="mt-2 text-brand-gold text-[11px] font-bold hover:underline">
              {isArabic ? "ابدأ المحادثة ←" : "Start chat →"}
            </button>
          </div>
          <div className="w-3 h-3 bg-brand-deep border-r border-b border-brand-gold/30 rotate-45 ml-auto mr-5 -mt-1.5" />
        </div>
      )}

      {/* ── Floating chat icon — always RIGHT side ── */}
      <button
        id="chat_widget_trigger"
        onClick={toggleOpen}
        aria-label={t.title}
        className="fixed right-4 bottom-[72px] md:bottom-5 w-13 h-13 rounded-2xl flex items-center justify-center z-50 shadow-xl transition-all hover:scale-105 focus:outline-none"
        style={{
          width: 52,
          height: 52,
          background: open
            ? "rgba(6,18,37,0.95)"
            : "linear-gradient(135deg, #9A6F00 0%, #D4AF37 60%, #F5B700 100%)",
          boxShadow: open
            ? "0 4px 20px rgba(0,0,0,0.5)"
            : "0 4px 24px rgba(212,175,55,0.55)",
          animation: open ? "none" : "chatPulse 2.5s ease-in-out infinite",
          border: open ? "1px solid rgba(212,175,55,0.4)" : "none",
        }}
      >
        {open
          ? <X className="w-5 h-5 text-brand-gold" />
          : <MessageSquare className="w-5 h-5 text-brand-deep" />
        }
      </button>

      {/* ── Chat panel ── */}
      {open && (
        <div
          className={`fixed right-4 w-[min(390px,calc(100vw-2rem))] glass-premium border border-white/12 rounded-2xl z-40 flex flex-col shadow-2xl overflow-hidden transition-all duration-300 ${
            minimized
              ? "bottom-[130px] md:bottom-[68px] h-14"
              : "bottom-[130px] md:bottom-[68px] h-[min(500px,65vh)]"
          }`}
          dir={isArabic ? "rtl" : "ltr"}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10 bg-brand-deep/95 flex items-center justify-between shrink-0">
            <div>
              <p className="text-white font-bold text-sm leading-tight">{t.title}</p>
              {!minimized && <p className="text-white/45 text-[10px]">{t.subtitle}</p>}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMinimized((v) => !v)}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Minimize"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={closePanel}
                className="p-1.5 rounded-lg text-white/50 hover:text-rose-400 hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Quick action buttons */}
              <div className="flex gap-1.5 px-3 py-2 border-b border-white/10 bg-brand-cool/40 shrink-0">
                <button
                  onClick={() => navigate("/request")}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-gold/15 text-brand-gold border border-brand-gold/25 text-[10px] font-bold hover:bg-brand-gold/25 transition-colors"
                >
                  <Truck className="w-3 h-3" />
                  {isArabic ? "توصيل" : "Delivery"}
                </button>
                <button
                  onClick={() => navigate("/pricing")}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 text-white/70 border border-white/10 text-[10px] font-bold hover:bg-white/10 transition-colors"
                >
                  <DollarSign className="w-3 h-3" />
                  {isArabic ? "أسعار" : "Pricing"}
                </button>
                <button
                  onClick={() => navigate("/tracking")}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 text-white/70 border border-white/10 text-[10px] font-bold hover:bg-white/10 transition-colors"
                >
                  <Search className="w-3 h-3" />
                  {isArabic ? "تتبع" : "Track"}
                </button>
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/25 text-[10px] font-bold hover:bg-[#25D366]/20 transition-colors"
                >
                  <Phone className="w-3 h-3" />
                  WA
                </a>
              </div>

              {/* Quick replies chips */}
              <div className="px-3 py-2 border-b border-white/10 bg-brand-cool/20 shrink-0">
                <div className="flex flex-wrap gap-1.5 max-h-[72px] overflow-y-auto">
                  {quickReplies.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => void sendText(chip)}
                      className="text-[10px] px-2.5 py-1 rounded-full border border-brand-gold/25 text-brand-gold/80 hover:bg-brand-gold/10 hover:text-brand-gold transition-colors whitespace-nowrap"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className={`text-xs ${msg.sender === "user" ? "flex justify-end" : "flex justify-start"}`}>
                    <div
                      className={`inline-block max-w-[88%] px-3 py-2 rounded-2xl whitespace-pre-line leading-relaxed ${
                        msg.sender === "user"
                          ? "bg-brand-blue text-white"
                          : "bg-brand-cool/60 text-white/90 border border-white/10"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-white/10 bg-brand-deep/70 shrink-0 space-y-2">
                <div className="flex gap-2">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                    placeholder={t.placeholder}
                    className="flex-1 bg-brand-cool/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-brand-gold"
                  />
                  <button
                    onClick={sendMessage}
                    className="px-3 py-2 bg-brand-gold text-brand-deep rounded-xl shrink-0 hover:bg-yellow-400 transition-colors"
                    aria-label="Send"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-1.5 rounded-xl bg-[#25D366]/12 text-[#25D366] text-[10px] font-bold hover:bg-[#25D366]/22 transition-colors"
                >
                  <Phone className="w-3 h-3" />
                  WhatsApp {isArabic ? "— تحدث مع الدعم" : "— Talk to Support"}
                </a>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes chatPulse {
          0%, 100% { box-shadow: 0 4px 24px rgba(212,175,55,0.55); }
          50% { box-shadow: 0 4px 32px rgba(212,175,55,0.10), 0 0 0 8px rgba(212,175,55,0.12); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
