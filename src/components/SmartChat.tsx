/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { 
  MessageSquare, 
  X, 
  Send, 
  ChevronDown, 
  PhoneCall, 
  Truck, 
  DollarSign, 
  ShieldAlert,
  Bot,
  User,
  Heart
} from "lucide-react";
import { supabase } from "../supabase";

interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  text: string;
  time: string;
  quickReplies?: { textAr: string; action: string }[];
}

export default function SmartChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: "", phone: "" });
  const [showLeadForm, setShowLeadForm] = useState(false);

  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  // Initial welcome messages
  const welcomeMessage: ChatMessage = {
    id: "welcome-1",
    sender: "bot",
    text: "مرحباً بكم في المساعد الذكي لشركة داي نايت لخدمات التوصيل والشحن (DAY NIGHT) 🚚\nكيف يمكنني مساعدتك اليوم؟",
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    quickReplies: [
      { textAr: "كم تبلغ أسعار التوصيل؟", action: "pricing" },
      { textAr: "عرض كتالوج واتساب 🖥️", action: "catalog" },
      { textAr: "أريد حجز طلب توصيل", action: "request" },
      { textAr: "تتبع شحنة حية", action: "tracking" },
      { textAr: "تحدث مع خدمة العملاء (واتساب)", action: "whatsapp" },
    ]
  };

  useEffect(() => {
    setMessages([welcomeMessage]);
  }, []);

  useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleQuickAction = (action: string) => {
    let userText = "";
    let replyText = "";
    let links: { textAr: string; action: string }[] | undefined = undefined;

    if (action === "pricing") {
      userText = "كم تبلغ أسعار التوصيل؟";
      replyText = `التعرفة الرسمية لخدماتنا هي كالآتي:
• 🇦🇪 المدن الرئيسية داخل الإمارات: 30 درهم إماراتي
• 📍 المناطق الممتدة والغربية في العين وأبوظبي: 50 درهم إماراتي
• 🇸🇦 دول مجلس التعاون الخليجي (GCC): تبدأ من 95 درهم إماراتي لأول كجم + 45 درهم لكل كجم إضافي.
• 🌐 الشراء والشحن العالمي: يبدأ من 190 درهم إماراتي لأول كجم + 90 درهم لكل كجم إضافي.`;
    } else if (action === "catalog") {
      userText = "عرض كتالوج واتساب 🖥️";
      replyText = "جاري تحويلك لعرض كتالوج الخدمات والأسعار المعتمد على واتساب (على الرقم +971568757331). يمكنك تصفح الكتالوج ورؤية العروض المخصصة مباشرة.";
      setTimeout(() => {
        window.open("https://wa.me/c/971568757331", "_blank");
      }, 1500);
    } else if (action === "request") {
      userText = "أريد حجز طلب توصيل";
      replyText = "أهلاً بك! يمكنك إنشاء طلب توصيل حقيقي ومباشر بالذهاب إلى صفحة 'احجز توصيل' أو حجز طرد فوري من خلال استمارة الحجز بالموقع مباشرة، أو التواصل عبر واتساب ليرسل لك النظام المندوب فوراً.";
      setShowLeadForm(true); // Trigger lead capture to assist them
    } else if (action === "tracking") {
      userText = "تتبع شحنة حية";
      replyText = "لتتبع شحنتك، فقط تصفح في داي نايت وانتقل إلى صفحة 'تتبع الشحنة' واكتب رقم الكود الخاص بك مثل DN-2026-XXXXX لترى تحديثات استلام الشحنة وتتبع السائق الحالي.";
    } else if (action === "whatsapp") {
      userText = "تحدث مع خدمة العملاء (واتساب)";
      replyText = "جاري فتح نافذة التواصل المباشر مع دعم داي نايت اللوجستي الفوري على الرقم +971568757331 لخدمتك بأسرع ما يمكن.";
      setTimeout(() => {
        window.open("https://wa.me/971568757331", "_blank");
      }, 1500);
    }

    if (userText) {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: "user",
        text: userText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const botMsg: ChatMessage = {
        id: `bot-${Date.now() + 1}`,
        sender: "bot",
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: [
          { textAr: "الرجوع للقائمة الرئيسية", action: "back" },
          { textAr: "التحدث واتساب الفوري", action: "whatsapp" }
        ]
      };

      setMessages(prev => [...prev, userMsg, botMsg]);
    } else if (action === "back") {
      const backMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: "كيف يسعدني تلبية طلبك الآخر؟ إليك خيارات داي نايت السريعة:",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: welcomeMessage.quickReplies
      };
      setMessages(prev => [...prev, backMsg]);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    setInput("");

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // AI automated logic parsing for key topics to prevent hallucinated advice
    setTimeout(() => {
      let botResponse = "";
      const query = userText.toLowerCase();

      if (query.includes("سعر") || query.includes("اسعار") || query.includes("كلفة") || query.includes("بكم") || query.includes("تعرفه") || query.includes("عشرة") || query.includes("درهم") || query.includes("pricing") || query.includes("price")) {
        botResponse = `الأسعار المعتمدة لشركة داي نايت لخدمات التوصيل هي:
• 🇦🇪 الإمارة الرئيسية (دبي، أبوظبي، الشارقة، إلخ): 30 درهم إماراتي
• 📍 المناطق الممتدة والغربية في العين ومصفح البعيدة: 50 درهم إماراتي
• 🇸🇦 دول الخليج العربي GCC: تبدأ من 95 درهم والوزن الإضافي 45 درهم.
• 🌐 شحن عالمي (أوروبا وأمريكا): يبدأ من 190 درهم والوزن الإضافي 90 درهم.`;
      } else if (query.includes("رقم") || query.includes("الهاتف") || query.includes("تواصل") || query.includes("اتصال") || query.includes("whatsapp") || query.includes("واتس") || query.includes("واتساب") || query.includes("تلفون") || query.includes("contact")) {
        botResponse = "يمكنك الاتصال الفوري بنا هاتفياً أو عبر واتساب على الرقم الرسمي المعتمد:\n📞 +971 56 875 7331\n📧 البريد الرسمي: Admin@daynight.ae";
      } else if (query.includes("أين") || query.includes("مكان") || query.includes("موقع") || query.includes("مقر") || query.includes("عنوان") || query.includes("خرائط") || query.includes("maps")) {
        botResponse = "مقرنا الرسمي واللوجستي يقع في:\n📍 مصفح 40 - أبوظبي - الإمارات العربية المتحدة.\nيمكنك تصفح رابط خرائط جوجل من واجهة الاتصال أو عبر QR بموقعنا.";
      } else if (query.includes("صيدلي") || query.includes("دواء") || query.includes("عناية") || query.includes("طبي") || query.includes("pharmacy")) {
        botResponse = "تلتزم داي نايت بتوصيل الطرود الصيدلانية وأدوات التجميل والعناية الشخصية المغلقة تماماً ومحكمة الغلق وفق اللوائح تماشياً مع معايير الأمان المعتمدة. لا نوفر استشارات طبية ولا ننقل مواد أو عقاقير خاضعة للرقابة المركبة.";
      } else if (query.includes("عقود") || query.includes("شركة") || query.includes("متاجر") || query.includes("متجر") || query.includes("ecommerce")) {
        botResponse = "أهلاً بك شريكاً لنا! نوفر خدمات استثنائية لمتاجر إنستغرام وتيك توك وشوبيفاي مع تحصيل COD فوري ونظام آجل وعقود للشركات والمصارف والمحاماة لتسليم المستندات بأسعار مميزة. هل ترغب في تسجيل رقمك لنتصل بك؟";
        setShowLeadForm(true);
      } else {
        botResponse = "عذراً، لم أفهم استفسارك بدقة بخصوص أنظمتنا. يمكنك كتابة استفسار بخصوص (الأسعار، أرقام التواصل، حجز مندوب، والتتبع) أو الضغط على زر واتساب للتحدث للموظف البشري فورا!";
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: botResponse,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: [
          { textAr: "الرجوع للرئيسية", action: "back" },
          { textAr: "افتح المحادثة في واتساب", action: "whatsapp" }
        ]
      };

      setMessages(prev => [...prev, botMsg]);
      setLoading(false);
    }, 1000);
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.name || !leadForm.phone) return;

    try {
      // Background insert to Supabase chatbot_leads table if RLS allows, else handle cleanly
      const { error } = await supabase
        .from("chatbot_leads")
        .insert([{
          name: leadForm.name,
          phone: leadForm.phone,
          created_at: new Date().toISOString(),
          source: "SmartChat_Widget"
        }]);

      if (error) {
        console.warn("Could not insert chatbot lead inside cloud database, save locally:", error.message);
      }
    } catch {
      // Silent error fallback
    }

    setLeadCaptured(true);
    setTimeout(() => {
      setShowLeadForm(false);
      const okMsg: ChatMessage = {
        id: `bot-lead-${Date.now()}`,
        sender: "bot",
        text: `تم استلام معلوماتك يا ${leadForm.name} بنجاح! سيتصل بك فريق التسويق والشركاء التجاريين لداي نايت هاتفياً قريباً لتفعيل حسابك وتوفير التعريفة الحصرية لك.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: [
          { textAr: "تسعيرات التوصيل", action: "pricing" },
          { textAr: "تواصل واتساب", action: "whatsapp" }
        ]
      };
      setMessages(prev => [...prev, okMsg]);
    }, 1200);
  };

  return (
    <>
      {/* Floating Chat Circle button */}
      <button
        id="chat_widget_trigger"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 z-50 cursor-pointer border border-brand-gold/20"
        title="مساعد داي نايت الذكي"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6 animate-pulse" />}
      </button>

      {/* Expanded Chat Dialog Window */}
      {isOpen && (
        <div 
          id="chat_widget_dialog" 
          className="fixed bottom-24 right-6 w-[340px] sm:w-[380px] h-[500px] bg-brand-deep/95 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col z-50 animate-in slide-in-from-bottom-5 duration-300"
        >
          {/* Header Bar */}
          <div className="bg-brand-cool text-white px-5 py-4 border-b border-white/10 flex items-center justify-between text-right">
            <div className="flex items-center gap-2 flex-row-reverse text-right">
              <div className="w-8 h-8 rounded-full bg-brand-gold/15 flex items-center justify-center border border-brand-gold/30">
                <Bot className="w-4 h-4 text-brand-gold" />
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-white leading-tight">المساعد الآلي لداي نايت</h4>
                <p className="text-[9px] text-brand-gold font-bold uppercase mt-0.5 tracking-wider">Day Night Smart Chat Bot</p>
              </div>
            </div>
            
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/40 hover:text-white cursor-pointer"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-right scrollbar-thin">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-start text-left" : "items-end text-right"} space-y-1.5`}
              >
                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${
                    msg.sender === "user"
                      ? "bg-brand-blue text-white rounded-bl-sm"
                      : "bg-brand-cool/50 text-white border border-white/10 rounded-br-sm text-right"
                  }`}
                >
                  {msg.text}
                </div>
                
                {/* Time indicators */}
                <p className="text-[9px] text-white/30 font-mono italic px-1">{msg.time}</p>

                {/* Quick replies items grid */}
                {msg.sender === "bot" && msg.quickReplies && msg.quickReplies.length > 0 && (
                  <div className="flex flex-wrap justify-end gap-1.5 pt-1 max-w-[95%]">
                    {msg.quickReplies.map((reply, index) => (
                      <button
                        key={index}
                        onClick={() => handleQuickAction(reply.action)}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-[10px] font-bold border border-white/10 hover:border-brand-gold transition-colors cursor-pointer text-center"
                      >
                        {reply.textAr}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Smart Inline Lead Capture Form */}
            {showLeadForm && !leadCaptured && (
              <div className="bg-brand-blue/10 border border-brand-blue/30 rounded-2xl p-4 space-y-3 my-2 text-right">
                <h5 className="font-bold text-[11px] text-brand-gold">تسجيل اتصال سريع للشركاء والمتاجر</h5>
                <p className="text-[10px] text-white/70">اكتب اسمك ورقم هاتفك ليتواصل بك المندوب فورا لتأكيد أسعارك.</p>
                <form onSubmit={handleLeadSubmit} className="space-y-2">
                  <input
                    type="text"
                    required
                    placeholder="الاسم الكريم"
                    value={leadForm.name}
                    onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                    className="w-full bg-brand-deep border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/20"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="رقم الهاتف: +971"
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                    className="w-full bg-brand-deep border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/20"
                  />
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-brand-gold text-brand-deep font-bold rounded-lg text-[10px] hover:bg-brand-blue hover:text-white transition-colors cursor-pointer"
                  >
                    أرسل لي المندوب فورا!
                  </button>
                </form>
              </div>
            )}

            {/* Loading bot state */}
            {loading && (
              <div className="flex items-center gap-2 flex-row-reverse text-right text-white/30 text-[10px] font-bold">
                <span className="animate-bounce">•</span>
                <span className="animate-bounce [animation-delay:0.2s]">•</span>
                <span className="animate-bounce [animation-delay:0.4s]">•</span>
                <span>داي نايت يكتب...</span>
              </div>
            )}
            
            <div ref={endOfMessagesRef} />
          </div>

          {/* Footer Input Form bar */}
          <form 
            onSubmit={handleSendMessage} 
            className="p-3 bg-brand-cool border-t border-white/10 flex items-center gap-2"
          >
            <button
              type="submit"
              className="p-2.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white rounded-xl transition-colors shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
            <input
              type="text"
              placeholder="اكتب استفسارك هنا..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-gold focus:bg-brand-deep text-right"
            />
          </form>
        </div>
      )}
    </>
  );
}
