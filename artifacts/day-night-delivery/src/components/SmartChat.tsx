import { useMemo, useState, useEffect, useCallback } from "react";
import { MessageSquare, Send, X, Phone } from "lucide-react";
import { chatKnowledgeEntries } from "../data/aiAgentKnowledge";
import companyMeta from "../data/companyMeta";
import { useAppContext } from "../lib/AppContext";
import { pageCopy } from "../data/pageCopy";
import { searchChatbotAnswerRpc, supabase } from "../supabase";

type ChatMessage = {
  id: string;
  sender: "bot" | "user";
  text: string;
};

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

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    setMessages([{ id: "welcome", sender: "bot", text: t.welcome }]);
  }, [language, t.welcome]);

  useEffect(() => {
    const SESSION_KEY = "dn_chat_greeted";
    if (sessionStorage.getItem(SESSION_KEY)) return;
    const timer = setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, "1");
      setOpen(true);
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
        answer = `${t.unknown}\n${whatsappLink}`;
      }

      setMessages((prev) => [...prev, { id: `bot-${Date.now()}`, sender: "bot", text: answer }]);

      if (supabase) {
        supabase.from("chatbot_leads").insert({
          message: trimmed,
          source: "smart_chat",
          language
        }).then(() => undefined);
      }
    },
    [isArabic, t.unknown, whatsappLink, language]
  );

  function sendMessage() {
    const current = text;
    setText("");
    void sendText(current);
  }

  return (
    <>
      <button
        id="chat_widget_trigger"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-5 end-5 w-14 h-14 bg-brand-gold text-brand-deep rounded-full flex items-center justify-center z-40 shadow-lg shadow-brand-gold/20 hover:scale-105 transition-transform"
        aria-label={t.title}
      >
        {open ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>

      {open && (
        <div
          className="fixed bottom-24 end-5 w-[min(400px,92vw)] h-[min(520px,70vh)] glass-premium border border-white/12 rounded-3xl z-40 flex flex-col shadow-2xl overflow-hidden"
          dir={isArabic ? "rtl" : "ltr"}
        >
          <div className="p-4 border-b border-white/10 bg-brand-deep/80">
            <p className="text-white font-bold text-sm">{t.title}</p>
            <p className="text-white/50 text-[11px]">{t.subtitle}</p>
          </div>

          <div className="flex flex-wrap gap-1.5 p-3 border-b border-white/10 bg-brand-cool/30 max-h-24 overflow-y-auto">
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

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`text-xs ${msg.sender === "user" ? "text-start" : "text-start"}`}>
                <div
                  className={`inline-block max-w-[90%] px-3 py-2 rounded-2xl whitespace-pre-line leading-relaxed ${
                    msg.sender === "user" ? "bg-brand-blue text-white ms-auto block" : "bg-brand-cool/60 text-white/90 border border-white/10"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-white/10 space-y-2 bg-brand-deep/60">
            <div className="flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
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
              WhatsApp
            </a>
          </div>
        </div>
      )}
    </>
  );
}
