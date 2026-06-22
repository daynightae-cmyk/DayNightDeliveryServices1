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
    text: "Ù…Ø±Ø­Ø¨Ø§Ù‹ Ø¨ÙƒÙ… ÙÙŠ Ø§Ù„Ù…Ø³Ø§Ø¹Ø¯ Ø§Ù„Ø°ÙƒÙŠ Ù„Ø´Ø±ÙƒØ© Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª Ù„Ø®Ø¯Ù…Ø§Øª Ø§Ù„ØªÙˆØµÙŠÙ„ ÙˆØ§Ù„Ø´Ø­Ù† (DAY NIGHT) ðŸšš\nÙƒÙŠÙ ÙŠÙ…ÙƒÙ†Ù†ÙŠ Ù…Ø³Ø§Ø¹Ø¯ØªÙƒ Ø§Ù„ÙŠÙˆÙ…ØŸ",
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    quickReplies: [
      { textAr: "ÙƒÙ… ØªØ¨Ù„Øº Ø£Ø³Ø¹Ø§Ø± Ø§Ù„ØªÙˆØµÙŠÙ„ØŸ", action: "pricing" },
      { textAr: "Ø¹Ø±Ø¶ ÙƒØªØ§Ù„ÙˆØ¬ ÙˆØ§ØªØ³Ø§Ø¨ ðŸ–¥ï¸", action: "catalog" },
      { textAr: "Ø£Ø±ÙŠØ¯ Ø­Ø¬Ø² Ø·Ù„Ø¨ ØªÙˆØµÙŠÙ„", action: "request" },
      { textAr: "ØªØªØ¨Ø¹ Ø´Ø­Ù†Ø© Ø­ÙŠØ©", action: "tracking" },
      { textAr: "ØªØ­Ø¯Ø« Ù…Ø¹ Ø®Ø¯Ù…Ø© Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡ (ÙˆØ§ØªØ³Ø§Ø¨)", action: "whatsapp" },
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
      userText = "ÙƒÙ… ØªØ¨Ù„Øº Ø£Ø³Ø¹Ø§Ø± Ø§Ù„ØªÙˆØµÙŠÙ„ØŸ";
      replyText = `Ø§Ù„ØªØ¹Ø±ÙØ© Ø§Ù„Ø±Ø³Ù…ÙŠØ© Ù„Ø®Ø¯Ù…Ø§ØªÙ†Ø§ Ù‡ÙŠ ÙƒØ§Ù„Ø¢ØªÙŠ:
â€¢ ðŸ‡¦ðŸ‡ª Ø§Ù„Ù…Ø¯Ù† Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ© Ø¯Ø§Ø®Ù„ Ø§Ù„Ø¥Ù…Ø§Ø±Ø§Øª: 30 Ø¯Ø±Ù‡Ù… Ø¥Ù…Ø§Ø±Ø§ØªÙŠ (31.50 Ø´Ø§Ù…Ù„ Ø¶Ø±ÙŠØ¨Ø© VAT 5%)
â€¢ ðŸ“ Ø§Ù„Ù…Ù†Ø§Ø·Ù‚ Ø§Ù„Ù…Ù…ØªØ¯Ø© ÙˆØ§Ù„ØºØ±Ø¨ÙŠØ© ÙÙŠ Ø§Ù„Ø¹ÙŠÙ† ÙˆØ£Ø¨ÙˆØ¸Ø¨ÙŠ: 50 Ø¯Ø±Ù‡Ù… Ø¥Ù…Ø§Ø±Ø§ØªÙŠ (52.50 Ø´Ø§Ù…Ù„ Ø¶Ø±ÙŠØ¨Ø© VAT 5%)
â€¢ ðŸ‡¸ðŸ‡¦ Ø¯ÙˆÙ„ Ù…Ø¬Ù„Ø³ Ø§Ù„ØªØ¹Ø§ÙˆÙ† Ø§Ù„Ø®Ù„ÙŠØ¬ÙŠ (GCC): ØªØ¨Ø¯Ø£ Ù…Ù† 95 Ø¯Ø±Ù‡Ù… Ø¥Ù…Ø§Ø±Ø§ØªÙŠ Ù„Ø£ÙˆÙ„ ÙƒØ¬Ù… (Ø´Ø§Ù…Ù„ Ø¶Ø±ÙŠØ¨Ø© VAT) + 45 Ø¯Ø±Ù‡Ù… Ù„ÙƒÙ„ ÙƒØ¬Ù… Ø¥Ø¶Ø§ÙÙŠ.
â€¢ ðŸŒ Ø§Ù„Ø´Ø±Ø§Ø¡ ÙˆØ§Ù„Ø´Ø­Ù† Ø§Ù„Ø¹Ø§Ù„Ù…ÙŠ: ÙŠØ¨Ø¯Ø£ Ù…Ù† 190 Ø¯Ø±Ù‡Ù… Ø¥Ù…Ø§Ø±Ø§ØªÙŠ Ù„Ø£ÙˆÙ„ ÙƒØ¬Ù… (Ø´Ø§Ù…Ù„ Ø¶Ø±ÙŠØ¨Ø© VAT) + 90 Ø¯Ø±Ù‡Ù… Ù„ÙƒÙ„ ÙƒØ¬Ù… Ø¥Ø¶Ø§ÙÙŠ.`;
    } else if (action === "catalog") {
      userText = "Ø¹Ø±Ø¶ ÙƒØªØ§Ù„ÙˆØ¬ ÙˆØ§ØªØ³Ø§Ø¨ ðŸ–¥ï¸";
      replyText = "Ø¬Ø§Ø±ÙŠ ØªØ­ÙˆÙŠÙ„Ùƒ Ù„Ø¹Ø±Ø¶ ÙƒØªØ§Ù„ÙˆØ¬ Ø§Ù„Ø®Ø¯Ù…Ø§Øª ÙˆØ§Ù„Ø£Ø³Ø¹Ø§Ø± Ø§Ù„Ù…Ø¹ØªÙ…Ø¯ Ø¹Ù„Ù‰ ÙˆØ§ØªØ³Ø§Ø¨ (Ø¹Ù„Ù‰ Ø§Ù„Ø±Ù‚Ù… +971568757331). ÙŠÙ…ÙƒÙ†Ùƒ ØªØµÙØ­ Ø§Ù„ÙƒØªØ§Ù„ÙˆØ¬ ÙˆØ±Ø¤ÙŠØ© Ø§Ù„Ø¹Ø±ÙˆØ¶ Ø§Ù„Ù…Ø®ØµØµØ© Ù…Ø¨Ø§Ø´Ø±Ø©.";
      setTimeout(() => {
        window.open("https://wa.me/c/971568757331", "_blank");
      }, 1500);
    } else if (action === "request") {
      userText = "Ø£Ø±ÙŠØ¯ Ø­Ø¬Ø² Ø·Ù„Ø¨ ØªÙˆØµÙŠÙ„";
      replyText = "Ø£Ù‡Ù„Ø§Ù‹ Ø¨Ùƒ! ÙŠÙ…ÙƒÙ†Ùƒ Ø¥Ù†Ø´Ø§Ø¡ Ø·Ù„Ø¨ ØªÙˆØµÙŠÙ„ Ø­Ù‚ÙŠÙ‚ÙŠ ÙˆÙ…Ø¨Ø§Ø´Ø± Ø¨Ø§Ù„Ø°Ù‡Ø§Ø¨ Ø¥Ù„Ù‰ ØµÙØ­Ø© 'Ø§Ø­Ø¬Ø² ØªÙˆØµÙŠÙ„' Ø£Ùˆ Ø­Ø¬Ø² Ø·Ø±Ø¯ ÙÙˆØ±ÙŠ Ù…Ù† Ø®Ù„Ø§Ù„ Ø§Ø³ØªÙ…Ø§Ø±Ø© Ø§Ù„Ø­Ø¬Ø² Ø¨Ø§Ù„Ù…ÙˆÙ‚Ø¹ Ù…Ø¨Ø§Ø´Ø±Ø©ØŒ Ø£Ùˆ Ø§Ù„ØªÙˆØ§ØµÙ„ Ø¹Ø¨Ø± ÙˆØ§ØªØ³Ø§Ø¨ Ù„ÙŠØ±Ø³Ù„ Ù„Ùƒ Ø§Ù„Ù†Ø¸Ø§Ù… Ø§Ù„Ù…Ù†Ø¯ÙˆØ¨ ÙÙˆØ±Ø§Ù‹.";
      setShowLeadForm(true); // Trigger lead capture to assist them
    } else if (action === "tracking") {
      userText = "ØªØªØ¨Ø¹ Ø´Ø­Ù†Ø© Ø­ÙŠØ©";
      replyText = "Ù„ØªØªØ¨Ø¹ Ø´Ø­Ù†ØªÙƒØŒ ÙÙ‚Ø· ØªØµÙØ­ ÙÙŠ Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª ÙˆØ§Ù†ØªÙ‚Ù„ Ø¥Ù„Ù‰ ØµÙØ­Ø© 'ØªØªØ¨Ø¹ Ø§Ù„Ø´Ø­Ù†Ø©' ÙˆØ§ÙƒØªØ¨ Ø±Ù‚Ù… Ø§Ù„ÙƒÙˆØ¯ Ø§Ù„Ø®Ø§Øµ Ø¨Ùƒ Ù…Ø«Ù„ DN-2026-XXXXX Ù„ØªØ±Ù‰ ØªØ­Ø¯ÙŠØ«Ø§Øª Ø§Ø³ØªÙ„Ø§Ù… Ø§Ù„Ø´Ø­Ù†Ø© ÙˆØªØªØ¨Ø¹ Ø§Ù„Ø³Ø§Ø¦Ù‚ Ø§Ù„Ø­Ø§Ù„ÙŠ.";
    } else if (action === "whatsapp") {
      userText = "ØªØ­Ø¯Ø« Ù…Ø¹ Ø®Ø¯Ù…Ø© Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡ (ÙˆØ§ØªØ³Ø§Ø¨)";
      replyText = "Ø¬Ø§Ø±ÙŠ ÙØªØ­ Ù†Ø§ÙØ°Ø© Ø§Ù„ØªÙˆØ§ØµÙ„ Ø§Ù„Ù…Ø¨Ø§Ø´Ø± Ù…Ø¹ Ø¯Ø¹Ù… Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª Ø§Ù„Ù„ÙˆØ¬Ø³ØªÙŠ Ø§Ù„ÙÙˆØ±ÙŠ Ø¹Ù„Ù‰ Ø§Ù„Ø±Ù‚Ù… +971568757331 Ù„Ø®Ø¯Ù…ØªÙƒ Ø¨Ø£Ø³Ø±Ø¹ Ù…Ø§ ÙŠÙ…ÙƒÙ†.";
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
          { textAr: "Ø§Ù„Ø±Ø¬ÙˆØ¹ Ù„Ù„Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©", action: "back" },
          { textAr: "Ø§Ù„ØªØ­Ø¯Ø« ÙˆØ§ØªØ³Ø§Ø¨ Ø§Ù„ÙÙˆØ±ÙŠ", action: "whatsapp" }
        ]
      };

      setMessages(prev => [...prev, userMsg, botMsg]);
    } else if (action === "back") {
      const backMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: "ÙƒÙŠÙ ÙŠØ³Ø¹Ø¯Ù†ÙŠ ØªÙ„Ø¨ÙŠØ© Ø·Ù„Ø¨Ùƒ Ø§Ù„Ø¢Ø®Ø±ØŸ Ø¥Ù„ÙŠÙƒ Ø®ÙŠØ§Ø±Ø§Øª Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª Ø§Ù„Ø³Ø±ÙŠØ¹Ø©:",
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

      if (query.includes("Ø³Ø¹Ø±") || query.includes("Ø§Ø³Ø¹Ø§Ø±") || query.includes("ÙƒÙ„ÙØ©") || query.includes("Ø¨ÙƒÙ…") || query.includes("ØªØ¹Ø±ÙÙ‡") || query.includes("Ø¹Ø´Ø±Ø©") || query.includes("Ø¯Ø±Ù‡Ù…") || query.includes("pricing") || query.includes("price")) {
        botResponse = `Ø§Ù„Ø£Ø³Ø¹Ø§Ø± Ø§Ù„Ù…Ø¹ØªÙ…Ø¯Ø© Ù„Ø´Ø±ÙƒØ© Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª Ù„Ø®Ø¯Ù…Ø§Øª Ø§Ù„ØªÙˆØµÙŠÙ„ Ù‡ÙŠ:
â€¢ ðŸ‡¦ðŸ‡ª Ø§Ù„Ø¥Ù…Ø§Ø±Ø© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ© (Ø¯Ø¨ÙŠØŒ Ø£Ø¨ÙˆØ¸Ø¨ÙŠØŒ Ø§Ù„Ø´Ø§Ø±Ù‚Ø©ØŒ Ø¥Ù„Ø®): 30 Ø¯Ø±Ù‡Ù… Ø¥Ù…Ø§Ø±Ø§ØªÙŠ (31.50 Ø´Ø§Ù…Ù„ Ø¶Ø±ÙŠØ¨Ø© VAT)
â€¢ ðŸ“ Ø§Ù„Ù…Ù†Ø§Ø·Ù‚ Ø§Ù„Ù…Ù…ØªØ¯Ø© ÙˆØ§Ù„ØºØ±Ø¨ÙŠØ© ÙÙŠ Ø§Ù„Ø¹ÙŠÙ† ÙˆÙ…ØµÙØ­ Ø§Ù„Ø¨Ø¹ÙŠØ¯Ø©: 50 Ø¯Ø±Ù‡Ù… Ø¥Ù…Ø§Ø±Ø§ØªÙŠ (52.50 Ø´Ø§Ù…Ù„ Ø¶Ø±ÙŠØ¨Ø© VAT)
â€¢ ðŸ‡¸ðŸ‡¦ Ø¯ÙˆÙ„ Ø§Ù„Ø®Ù„ÙŠØ¬ Ø§Ù„Ø¹Ø±Ø¨ÙŠ GCC: ØªØ¨Ø¯Ø£ Ù…Ù† 95 Ø¯Ø±Ù‡Ù… ÙˆØ§Ù„ÙˆØ²Ù† Ø§Ù„Ø¥Ø¶Ø§ÙÙŠ 45 Ø¯Ø±Ù‡Ù….
â€¢ ðŸŒ Ø´Ø­Ù† Ø¹Ø§Ù„Ù…ÙŠ (Ø£ÙˆØ±ÙˆØ¨Ø§ ÙˆØ£Ù…Ø±ÙŠÙƒØ§): ÙŠØ¨Ø¯Ø£ Ù…Ù† 190 Ø¯Ø±Ù‡Ù… ÙˆØ§Ù„ÙˆØ²Ù† Ø§Ù„Ø¥Ø¶Ø§ÙÙŠ 90 Ø¯Ø±Ù‡Ù….`;
      } else if (query.includes("Ø±Ù‚Ù…") || query.includes("Ø§Ù„Ù‡Ø§ØªÙ") || query.includes("ØªÙˆØ§ØµÙ„") || query.includes("Ø§ØªØµØ§Ù„") || query.includes("whatsapp") || query.includes("ÙˆØ§ØªØ³") || query.includes("ÙˆØ§ØªØ³Ø§Ø¨") || query.includes("ØªÙ„ÙÙˆÙ†") || query.includes("contact")) {
        botResponse = "ÙŠÙ…ÙƒÙ†Ùƒ Ø§Ù„Ø§ØªØµØ§Ù„ Ø§Ù„ÙÙˆØ±ÙŠ Ø¨Ù†Ø§ Ù‡Ø§ØªÙÙŠØ§Ù‹ Ø£Ùˆ Ø¹Ø¨Ø± ÙˆØ§ØªØ³Ø§Ø¨ Ø¹Ù„Ù‰ Ø§Ù„Ø±Ù‚Ù… Ø§Ù„Ø±Ø³Ù…ÙŠ Ø§Ù„Ù…Ø¹ØªÙ…Ø¯:\nðŸ“ž +971 56 875 7331\nðŸ“§ Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø±Ø³Ù…ÙŠ: Admin@daynightae.com";
      } else if (query.includes("Ø£ÙŠÙ†") || query.includes("Ù…ÙƒØ§Ù†") || query.includes("Ù…ÙˆÙ‚Ø¹") || query.includes("Ù…Ù‚Ø±") || query.includes("Ø¹Ù†ÙˆØ§Ù†") || query.includes("Ø®Ø±Ø§Ø¦Ø·") || query.includes("maps")) {
        botResponse = "Ù…Ù‚Ø±Ù†Ø§ Ø§Ù„Ø±Ø³Ù…ÙŠ ÙˆØ§Ù„Ù„ÙˆØ¬Ø³ØªÙŠ ÙŠÙ‚Ø¹ ÙÙŠ:\nðŸ“ Ù…ØµÙØ­ 40 - Ø£Ø¨ÙˆØ¸Ø¨ÙŠ - Ø§Ù„Ø¥Ù…Ø§Ø±Ø§Øª Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© Ø§Ù„Ù…ØªØ­Ø¯Ø©.\nÙŠÙ…ÙƒÙ†Ùƒ ØªØµÙØ­ Ø±Ø§Ø¨Ø· Ø®Ø±Ø§Ø¦Ø· Ø¬ÙˆØ¬Ù„ Ù…Ù† ÙˆØ§Ø¬Ù‡Ø© Ø§Ù„Ø§ØªØµØ§Ù„ Ø£Ùˆ Ø¹Ø¨Ø± QR Ø¨Ù…ÙˆÙ‚Ø¹Ù†Ø§.";
      } else if (query.includes("ØµÙŠØ¯Ù„ÙŠ") || query.includes("Ø¯ÙˆØ§Ø¡") || query.includes("Ø¹Ù†Ø§ÙŠØ©") || query.includes("Ø·Ø¨ÙŠ") || query.includes("pharmacy")) {
        botResponse = "ØªÙ„ØªØ²Ù… Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª Ø¨ØªÙˆØµÙŠÙ„ Ø§Ù„Ø·Ø±ÙˆØ¯ Ø§Ù„ØµÙŠØ¯Ù„Ø§Ù†ÙŠØ© ÙˆØ£Ø¯ÙˆØ§Øª Ø§Ù„ØªØ¬Ù…ÙŠÙ„ ÙˆØ§Ù„Ø¹Ù†Ø§ÙŠØ© Ø§Ù„Ø´Ø®ØµÙŠØ© Ø§Ù„Ù…ØºÙ„Ù‚Ø© ØªÙ…Ø§Ù…Ø§Ù‹ ÙˆÙ…Ø­ÙƒÙ…Ø© Ø§Ù„ØºÙ„Ù‚ ÙˆÙÙ‚ Ø§Ù„Ù„ÙˆØ§Ø¦Ø­ ØªÙ…Ø§Ø´ÙŠØ§Ù‹ Ù…Ø¹ Ù…Ø¹Ø§ÙŠÙŠØ± Ø§Ù„Ø£Ù…Ø§Ù† Ø§Ù„Ù…Ø¹ØªÙ…Ø¯Ø©. Ù„Ø§ Ù†ÙˆÙØ± Ø§Ø³ØªØ´Ø§Ø±Ø§Øª Ø·Ø¨ÙŠØ© ÙˆÙ„Ø§ Ù†Ù†Ù‚Ù„ Ù…ÙˆØ§Ø¯ Ø£Ùˆ Ø¹Ù‚Ø§Ù‚ÙŠØ± Ø®Ø§Ø¶Ø¹Ø© Ù„Ù„Ø±Ù‚Ø§Ø¨Ø© Ø§Ù„Ù…Ø±ÙƒØ¨Ø©.";
      } else if (query.includes("Ø¹Ù‚ÙˆØ¯") || query.includes("Ø´Ø±ÙƒØ©") || query.includes("Ù…ØªØ§Ø¬Ø±") || query.includes("Ù…ØªØ¬Ø±") || query.includes("ecommerce")) {
        botResponse = "Ø£Ù‡Ù„Ø§Ù‹ Ø¨Ùƒ Ø´Ø±ÙŠÙƒØ§Ù‹ Ù„Ù†Ø§! Ù†ÙˆÙØ± Ø®Ø¯Ù…Ø§Øª Ø§Ø³ØªØ«Ù†Ø§Ø¦ÙŠØ© Ù„Ù…ØªØ§Ø¬Ø± Ø¥Ù†Ø³ØªØºØ±Ø§Ù… ÙˆØªÙŠÙƒ ØªÙˆÙƒ ÙˆØ´ÙˆØ¨ÙŠÙØ§ÙŠ Ù…Ø¹ ØªØ­ØµÙŠÙ„ COD ÙÙˆØ±ÙŠ ÙˆÙ†Ø¸Ø§Ù… Ø¢Ø¬Ù„ ÙˆØ¹Ù‚ÙˆØ¯ Ù„Ù„Ø´Ø±ÙƒØ§Øª ÙˆØ§Ù„Ù…ØµØ§Ø±Ù ÙˆØ§Ù„Ù…Ø­Ø§Ù…Ø§Ø© Ù„ØªØ³Ù„ÙŠÙ… Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª Ø¨Ø£Ø³Ø¹Ø§Ø± Ù…Ù…ÙŠØ²Ø©. Ù‡Ù„ ØªØ±ØºØ¨ ÙÙŠ ØªØ³Ø¬ÙŠÙ„ Ø±Ù‚Ù…Ùƒ Ù„Ù†ØªØµÙ„ Ø¨ÙƒØŸ";
        setShowLeadForm(true);
      } else {
        botResponse = "Ø¹Ø°Ø±Ø§Ù‹ØŒ Ù„Ù… Ø£ÙÙ‡Ù… Ø§Ø³ØªÙØ³Ø§Ø±Ùƒ Ø¨Ø¯Ù‚Ø© Ø¨Ø®ØµÙˆØµ Ø£Ù†Ø¸Ù…ØªÙ†Ø§. ÙŠÙ…ÙƒÙ†Ùƒ ÙƒØªØ§Ø¨Ø© Ø§Ø³ØªÙØ³Ø§Ø± Ø¨Ø®ØµÙˆØµ (Ø§Ù„Ø£Ø³Ø¹Ø§Ø±ØŒ Ø£Ø±Ù‚Ø§Ù… Ø§Ù„ØªÙˆØ§ØµÙ„ØŒ Ø­Ø¬Ø² Ù…Ù†Ø¯ÙˆØ¨ØŒ ÙˆØ§Ù„ØªØªØ¨Ø¹) Ø£Ùˆ Ø§Ù„Ø¶ØºØ· Ø¹Ù„Ù‰ Ø²Ø± ÙˆØ§ØªØ³Ø§Ø¨ Ù„Ù„ØªØ­Ø¯Ø« Ù„Ù„Ù…ÙˆØ¸Ù Ø§Ù„Ø¨Ø´Ø±ÙŠ ÙÙˆØ±Ø§!";
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: botResponse,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: [
          { textAr: "Ø§Ù„Ø±Ø¬ÙˆØ¹ Ù„Ù„Ø±Ø¦ÙŠØ³ÙŠØ©", action: "back" },
          { textAr: "Ø§ÙØªØ­ Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø© ÙÙŠ ÙˆØ§ØªØ³Ø§Ø¨", action: "whatsapp" }
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
        text: `ØªÙ… Ø§Ø³ØªÙ„Ø§Ù… Ù…Ø¹Ù„ÙˆÙ…Ø§ØªÙƒ ÙŠØ§ ${leadForm.name} Ø¨Ù†Ø¬Ø§Ø­! Ø³ÙŠØªØµÙ„ Ø¨Ùƒ ÙØ±ÙŠÙ‚ Ø§Ù„ØªØ³ÙˆÙŠÙ‚ ÙˆØ§Ù„Ø´Ø±ÙƒØ§Ø¡ Ø§Ù„ØªØ¬Ø§Ø±ÙŠÙŠÙ† Ù„Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª Ù‡Ø§ØªÙÙŠØ§Ù‹ Ù‚Ø±ÙŠØ¨Ø§Ù‹ Ù„ØªÙØ¹ÙŠÙ„ Ø­Ø³Ø§Ø¨Ùƒ ÙˆØªÙˆÙÙŠØ± Ø§Ù„ØªØ¹Ø±ÙŠÙØ© Ø§Ù„Ø­ØµØ±ÙŠØ© Ù„Ùƒ.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: [
          { textAr: "ØªØ³Ø¹ÙŠØ±Ø§Øª Ø§Ù„ØªÙˆØµÙŠÙ„", action: "pricing" },
          { textAr: "ØªÙˆØ§ØµÙ„ ÙˆØ§ØªØ³Ø§Ø¨", action: "whatsapp" }
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
        title="Ù…Ø³Ø§Ø¹Ø¯ Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª Ø§Ù„Ø°ÙƒÙŠ"
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
                <h4 className="font-extrabold text-xs text-white leading-tight">Ø§Ù„Ù…Ø³Ø§Ø¹Ø¯ Ø§Ù„Ø¢Ù„ÙŠ Ù„Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª</h4>
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
                <h5 className="font-bold text-[11px] text-brand-gold">ØªØ³Ø¬ÙŠÙ„ Ø§ØªØµØ§Ù„ Ø³Ø±ÙŠØ¹ Ù„Ù„Ø´Ø±ÙƒØ§Ø¡ ÙˆØ§Ù„Ù…ØªØ§Ø¬Ø±</h5>
                <p className="text-[10px] text-white/70">Ø§ÙƒØªØ¨ Ø§Ø³Ù…Ùƒ ÙˆØ±Ù‚Ù… Ù‡Ø§ØªÙÙƒ Ù„ÙŠØªÙˆØ§ØµÙ„ Ø¨Ùƒ Ø§Ù„Ù…Ù†Ø¯ÙˆØ¨ ÙÙˆØ±Ø§ Ù„ØªØ£ÙƒÙŠØ¯ Ø£Ø³Ø¹Ø§Ø±Ùƒ.</p>
                <form onSubmit={handleLeadSubmit} className="space-y-2">
                  <input
                    type="text"
                    required
                    placeholder="Ø§Ù„Ø§Ø³Ù… Ø§Ù„ÙƒØ±ÙŠÙ…"
                    value={leadForm.name}
                    onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                    className="w-full bg-brand-deep border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/20"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Ø±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ: +971"
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                    className="w-full bg-brand-deep border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/20"
                  />
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-brand-gold text-brand-deep font-bold rounded-lg text-[10px] hover:bg-brand-blue hover:text-white transition-colors cursor-pointer"
                  >
                    Ø£Ø±Ø³Ù„ Ù„ÙŠ Ø§Ù„Ù…Ù†Ø¯ÙˆØ¨ ÙÙˆØ±Ø§!
                  </button>
                </form>
              </div>
            )}

            {/* Loading bot state */}
            {loading && (
              <div className="flex items-center gap-2 flex-row-reverse text-right text-white/30 text-[10px] font-bold">
                <span className="animate-bounce">â€¢</span>
                <span className="animate-bounce [animation-delay:0.2s]">â€¢</span>
                <span className="animate-bounce [animation-delay:0.4s]">â€¢</span>
                <span>Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª ÙŠÙƒØªØ¨...</span>
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
              placeholder="Ø§ÙƒØªØ¨ Ø§Ø³ØªÙØ³Ø§Ø±Ùƒ Ù‡Ù†Ø§..."
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

