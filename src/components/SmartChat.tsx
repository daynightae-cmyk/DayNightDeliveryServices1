import { useMemo, useState } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import { aiAgentKnowledge } from "../data/aiAgentKnowledge";
import { whatsappStatusUpdate } from "../lib/whatsapp";

type ChatMessage = {
  id: string;
  sender: "bot" | "user";
  text: string;
};

function answerFromKnowledge(input: string) {
  const q = input.toLowerCase();

  if (q.includes("price") || q.includes("سعر") || q.includes("الاسعار")) {
    return [
      `UAE main: ${aiAgentKnowledge.prices.domesticMain}`,
      `UAE extended: ${aiAgentKnowledge.prices.domesticExtended}`,
      `Express: ${aiAgentKnowledge.prices.express}`,
      `GCC: ${aiAgentKnowledge.prices.gcc}`,
      `Worldwide: ${aiAgentKnowledge.prices.worldwide}`
    ].join("\n");
  }

  if (q.includes("track") || q.includes("تتبع")) {
    return "Use the Tracking page and enter your tracking code to get the current status and history.";
  }

  if (q.includes("request") || q.includes("طلب") || q.includes("delivery")) {
    return "Use Request Delivery page, fill sender/receiver details, choose service and payment method, then submit.";
  }

  if (q.includes("cod") || q.includes("cash on delivery") || q.includes("تحصيل")) {
    return aiAgentKnowledge.policies.codRules;
  }

  if (q.includes("corporate") || q.includes("شركة") || q.includes("متجر")) {
    return "Corporate and e-commerce services include daily pickups, COD, returns, and proof of delivery.";
  }

  if (q.includes("contact") || q.includes("واتساب") || q.includes("phone") || q.includes("تواصل")) {
    return `WhatsApp: ${aiAgentKnowledge.contacts.whatsapp}\nPhone: ${aiAgentKnowledge.contacts.phone}\nEmail: ${aiAgentKnowledge.contacts.email}`;
  }

  return "UNKNOWN";
}

export default function SmartChat() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "Welcome to DAY NIGHT smart assistant. I provide rule-based official info."
    }
  ]);

  const fallbackLink = useMemo(() => whatsappStatusUpdate("support", "help"), []);

  function sendMessage() {
    if (!text.trim()) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: text.trim()
    };

    const answer = answerFromKnowledge(text.trim());
    const botMessage: ChatMessage = {
      id: `bot-${Date.now() + 1}`,
      sender: "bot",
      text: answer === "UNKNOWN"
        ? `I could not find an exact answer. Please continue on WhatsApp: ${fallbackLink}`
        : answer
    };

    setMessages((prev) => [...prev, userMessage, botMessage]);
    setText("");
  }

  return (
    <>
      <button
        id="chat_widget_trigger"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-brand-gold text-brand-deep rounded-full flex items-center justify-center z-50"
        aria-label="Open smart chat"
      >
        {open ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 w-[360px] max-w-[92vw] h-[500px] bg-brand-deep border border-white/10 rounded-3xl z-50 flex flex-col">
          <div className="p-4 border-b border-white/10 text-white font-bold text-sm">Smart Chat (Rule-based)</div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`text-xs ${msg.sender === "user" ? "text-right" : "text-left"}`}>
                <div className={`inline-block px-3 py-2 rounded-xl whitespace-pre-line ${msg.sender === "user" ? "bg-brand-blue text-white" : "bg-brand-cool/50 text-white"}`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-white/10 flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }} placeholder="Ask about pricing, tracking, request, COD..." className="flex-1 bg-brand-cool/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
            <button onClick={sendMessage} className="px-3 py-2 bg-brand-gold text-brand-deep rounded-xl" aria-label="Send chat message"><Send className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </>
  );
}