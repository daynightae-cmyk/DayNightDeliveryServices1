import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { MessageSquare, Send, X, Phone, Minus } from "lucide-react";
import { chatKnowledgeEntries } from "../data/aiAgentKnowledge";
import companyMeta from "../data/companyMeta";
import { useAppContext } from "../lib/AppContext";
import { pageCopy } from "../data/pageCopy";
import { searchChatbotAnswerRpc, supabase } from "../supabase";
import { useLocation } from "react-router-dom";

type ChatMessage = {
  id: string;
  sender: "bot" | "user";
  text: string;
};

const CLOSED_KEY = "dn_chat_closed";
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

export default function SmartChat() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const t = pageCopy[language].chatPage;
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* Reset messages when language changes */
  useEffect(() => {
    setMessages([{ id: "welcome", sender: "bot", text: t.welcome }]);
  }, [language, t.welcome]);

  /* Auto-scroll to bottom on new message */
  useEffect(() => {
    if (open && !minimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open, minimized]);

  /* Show greeting bubble after 4s — only once per session, only if not closed */
  useEffect(() => {
    if (sessionStorage.getItem(CLOSED_KEY)) return;
    if (sessionStorage.getItem(GREETED_KEY)) return;
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

  const sendText = useCallback(
    async (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) return;

      const userMessage: ChatMessage = { id: `user-${Date.now()}`, sender: "user", text: trimmed };
      setMessages((prev) => [...prev, userMessage]);

      let answer = matchKnowledge(trimmed, isArabic);

      if (!answer) {
        const rpcAnswer = await searchChatbotAnswerRpc(trimmed);
        if (rpcAnswer?.answer) answer = rpcAnswer.answer;
        else if (typeof rpcAnswer === "string") answer = rpcAnswer;
      }

      if (!answer) {
        answer = isArabic
          ? `يمكنني تحويلك إلى واتساب الدعم للحصول على تأكيد مباشر.\n${companyMeta.whatsappUrl}`
          : `I can forward you to WhatsApp support for direct confirmation.\n${companyMeta.whatsappUrl}`;
      }

      setMessages((prev) => [...prev, { id: `bot-${Date.now()}`, sender: "bot", text: answer! }]);

      if (supabase) {
        supabase.from("chatbot_leads").insert({
          message: trimmed,
          source: "smart_chat",
          language
        }).then(() => undefined);
      }
    },
    [isArabic, language]
  );

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
      if (minimized) {
        setMinimized(false);
      } else {
        closePanel();
      }
    } else {
      openPanel();
    }
  }

  function sendMessage() {
    const current = text;
    setText("");
    void sendText(current);
  }

  /* Hide entirely on admin/driver/customer/auth routes */
  const isHiddenRoute = HIDDEN_ROUTES.some((r) => location.pathname.startsWith(r));
  if (isHiddenRoute) return null;

  return (
    <>
      {/* ── Greeting bubble (small, non-intrusive) ── */}
      {showBubble && !open && (
        <div
          className="fixed bottom-24 end-5 z-50 max-w-[260px] animate-fade-in"
          style={{ animation: "fadeInUp 0.35s ease" }}
        >
          <div className="bg-brand-deep border border-brand-gold/30 rounded-2xl px-4 py-3 shadow-xl shadow-brand-deep/40 relative">
            <button
              onClick={() => setShowBubble(false)}
              className="absolute top-2 end-2 text-white/40 hover:text-white/80 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
            <p className="text-white text-xs font-bold leading-snug pe-4">{t.welcome}</p>
            <button
              onClick={openPanel}
              className="mt-2 text-brand-gold text-[11px] font-bold hover:underline"
            >
              {isArabic ? "ابدأ المحادثة ←" : "Start chat →"}
            </button>
          </div>
          {/* Bubble tail */}
          <div className="w-3 h-3 bg-brand-deep border-r border-b border-brand-gold/30 rotate-45 ms-auto me-7 -mt-1.5" />
        </div>
      )}

      {/* ── Floating icon button ── */}
      <button
        id="chat_widget_trigger"
        onClick={toggleOpen}
        aria-label={t.title}
        className={`fixed bottom-5 end-5 w-14 h-14 rounded-full flex items-center justify-center z-50 shadow-lg transition-transform hover:scale-105 ${
          open
            ? "bg-brand-deep border border-brand-gold/40 text-brand-gold"
            : "bg-brand-gold text-brand-deep shadow-brand-gold/30 animate-chat-pulse"
        }`}
        style={!open ? { animation: "chatPulse 2.5s ease-in-out infinite" } : undefined}
      >
        {open ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>

      {/* ── Full chat panel ── */}
      {open && (
        <div
          className={`fixed end-5 w-[min(400px,92vw)] glass-premium border border-white/12 rounded-3xl z-40 flex flex-col shadow-2xl overflow-hidden transition-all duration-300 ${
            minimized ? "bottom-24 h-14" : "bottom-24 h-[min(520px,70vh)]"
          }`}
          dir={isArabic ? "rtl" : "ltr"}
        >
          {/* Header */}
          <div className="p-4 border-b border-white/10 bg-brand-deep/90 flex items-center justify-between shrink-0">
            <div>
              <p className="text-white font-bold text-sm">{t.title}</p>
              {!minimized && <p className="text-white/50 text-[11px]">{t.subtitle}</p>}
            </div>
            <div className="flex items-center gap-2">
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
              {/* Quick replies */}
              <div className="flex flex-wrap gap-1.5 p-3 border-b border-white/10 bg-brand-cool/30 max-h-24 overflow-y-auto shrink-0">
                {t.quickReplies.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => void sendText(chip)}
                    className="text-[10px] px-2.5 py-1 rounded-full border border-brand-gold/30 text-brand-gold hover:bg-brand-gold/10 transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
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

              {/* Input + WhatsApp */}
              <div className="p-3 border-t border-white/10 space-y-2 bg-brand-deep/60 shrink-0">
                <div className="flex gap-2">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                    placeholder={t.placeholder}
                    className="flex-1 bg-brand-cool/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-gold"
                  />
                  <button onClick={sendMessage} className="px-3 py-2 bg-brand-gold text-brand-deep rounded-xl shrink-0" aria-label="Send">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-[#25D366]/15 text-[#25D366] text-xs font-bold hover:bg-[#25D366]/25 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  WhatsApp {isArabic ? "— تحدث مع الدعم" : "— Talk to Support"}
                </a>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes chatPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(212,175,55,0.5); }
          50% { box-shadow: 0 0 0 10px rgba(212,175,55,0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
