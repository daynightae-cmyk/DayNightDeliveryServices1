/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { FAQItem } from "../types";
import { HelpCircle, ChevronDown, ChevronUp } from "lucide-react";

export default function Faqs() {
  const [activeIdx, setActiveIdx] = useState<number | null>(0);

  const faqList: FAQItem[] = [
    {
      question: "ÙƒÙ… ØªÙƒÙ„ÙØ© Ø®Ø¯Ù…Ø© Ø§Ù„ØªÙˆØµÙŠÙ„ Ø§Ù„Ø¹Ø§Ø¯ÙŠ Ø¯Ø§Ø®Ù„ Ø§Ù„Ù…Ø¯Ù† Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ© ÙÙŠ Ø§Ù„Ø¥Ù…Ø§Ø±Ø§ØªØŸ",
      answer: "ØªØ¨Ø¯Ø£ Ø§Ù„ØªØ¹Ø±ÙØ© Ø§Ù„Ù…ÙˆØ­Ø¯Ø© Ø§Ù„ØªÙ†Ø§ÙØ³ÙŠØ© Ù„Ø¬Ù…ÙŠØ¹ Ø§Ù„Ù…Ø¯Ù† ÙˆØ§Ù„Ù…Ù†Ø§Ø·Ù‚ Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ© Ù…Ù† 30 Ø¯Ø±Ù‡Ù… Ø¥Ù…Ø§Ø±Ø§ØªÙŠ ÙÙ‚Ø· (31.50 Ø¯Ø±Ù‡Ù… Ø´Ø§Ù…Ù„ Ø§Ù„Ø¶Ø±ÙŠØ¨Ø©) Ù„Ù„Ø·Ø±ÙˆØ¯ Ù…ØªÙˆØ³Ø·Ø© Ø§Ù„Ø­Ø¬Ù… ÙˆØ§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª Ø¨ÙˆØ²Ù† Ø¹Ø§Ø¯ÙŠ."
    },
    {
      question: "ÙƒÙ… ÙŠØ³ØªØºØ±Ù‚ ÙˆÙ‚Øª Ø§Ù„ØªÙˆØµÙŠÙ„ Ø§Ù„Ø¹Ø§Ø¯ÙŠ (Standard Delivery)ØŸ",
      answer: "ÙŠØ³ØªØºØ±Ù‚ ÙˆÙ‚Øª Ø§Ù„Ù†Ù‚Ù„ ÙˆØ§Ù„ØªÙˆØ²ÙŠØ¹ Ø§Ù„Ø§Ø¹ØªÙŠØ§Ø¯ÙŠ Ù…Ù† 24 Ø¥Ù„Ù‰ 48 Ø³Ø§Ø¹Ø© ÙƒØ­Ø¯ Ø£Ù‚ØµÙ‰ Ù…Ù† Ù„Ø­Ø¸Ø© Ø§Ø³ØªÙ„Ø§Ù… Ø§Ù„Ø·Ø±Ø¯ Ù…Ù† Ù…Ø®Ø²Ù† Ø£Ùˆ Ù…Ù‚Ø± Ø§Ù„Ø¹Ù…ÙŠÙ„ Ø§Ù„Ù…Ø±Ø³Ù„."
    },
    {
      question: "Ù‡Ù„ ØªØªÙˆÙØ± Ø®Ø¯Ù…Ø© ØªÙˆØµÙŠÙ„ Ø³Ø±ÙŠØ¹Ø© ÙÙŠ Ù†ÙØ³ Ø§Ù„ÙŠÙˆÙ… ÙˆØ¬Ø¯Ø§ÙˆÙ„ Ø·Ø§Ø±Ø¦Ø©ØŸ",
      answer: "Ù†Ø¹Ù… Ø¨Ø§Ù„Ø·Ø¨Ø¹ØŒ ØªØªÙˆÙØ± ØªÙØ¶ÙŠÙ„Ø§Øª Ø§Ù„ØªÙˆØµÙŠÙ„ Ø§Ù„Ø³Ø±ÙŠØ¹ (Express Courier) Ù„Ø§Ø³ØªÙ„Ø§Ù… ÙˆØªØ³Ù„ÙŠÙ… Ø§Ù„Ø·Ø±ÙˆØ¯ ÙˆØ§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª Ø§Ù„Ø¹Ø§Ø¬Ù„Ø© ÙÙŠ ØºØ¶ÙˆÙ† Ø³Ø§Ø¹Ø§Øª Ù‚Ù„ÙŠÙ„Ø© Ù…Ù† Ù†ÙØ³ Ø§Ù„ÙŠÙˆÙ…ØŒ Ù…Ø¹ Ø±Ø³ÙˆÙ… Ø¥Ø¶Ø§ÙÙŠØ© ØªØ¨Ù„Øº 15 Ø¯Ø±Ù‡Ù… ÙÙ‚Ø· Ø¹Ù„Ù‰ Ø§Ù„Ø³Ø¹Ø± Ø§Ù„Ø£Ø³Ø§Ø³ÙŠ."
    },
    {
      question: "Ù…Ø§ Ù‡ÙŠ ØªØ¹Ø±ÙØ© Ø§Ù„ØªÙˆØµÙŠÙ„ Ù„Ù„Ù…Ù†Ø§Ø·Ù‚ Ø§Ù„Ø¨Ø¹ÙŠØ¯Ø© ÙˆØ§Ù„Ù‚Ø±Ù‰ ÙˆØ§Ù„Ø¶ÙˆØ§Ø­ÙŠØŸ",
      answer: "ØªØ¨Ø¯Ø£ Ø±Ø³ÙˆÙ… Ø§Ù„ØªÙˆØµÙŠÙ„ Ù„Ù„Ù…Ù†Ø§Ø·Ù‚ Ø§Ù„Ø¨Ø¹ÙŠØ¯Ø© ÙˆØ¨Ù„Ø¯ÙŠØ§Øª Ø§Ù„Ø¹ÙŠÙ† Ø§Ù„Ø®Ø§Ø±Ø¬ÙŠØ© ÙˆÙ…Ù†Ø§Ø·Ù‚ Ø§Ù„Ø¸ÙØ±Ø© ÙˆØ§Ù„ØºØ±Ø¨ÙŠØ© (Ù…Ø«Ù„ Ø§Ù„Ø¸Ù‡ÙŠØ±Ø© ÙˆØ§Ù„Ø³Ù„Ø¹ ÙˆØºÙŠØ§Ø«ÙŠ ÙˆØ­Ù…ÙŠÙ… Ù„ÙŠÙˆØ§) Ù…Ù† 50 Ø¯Ø±Ù‡Ù… Ø¥Ù…Ø§Ø±Ø§ØªÙŠ (52.50 Ø¯Ø±Ù‡Ù… Ø´Ø§Ù…Ù„ Ø§Ù„Ø¶Ø±ÙŠØ¨Ø©) Ù†Ø¸Ø±Ø§Ù‹ Ù„Ù‚ÙŠÙ…Ø© Ø§Ù„ØªÙ†Ù‚Ù„ ÙˆØ§Ù„ÙØ±Ø² Ø§Ù„Ù„ÙˆØ¬Ø³ØªÙŠ Ø§Ù„Ø®Ø§Øµ Ø¨Ù‡Ø§ØŒ ÙÙŠÙ…Ø§ ØªØ¨Ù„Øº ØªØ¹Ø±ÙØ© Ø§Ù„Ø±ÙˆÙŠØ³ 30 Ø¯Ø±Ù‡Ù… ÙÙ‚Ø· ÙƒØ¹Ø±Ø¶ Ø®Ø§Øµ."
    },
    {
      question: "Ù…Ø§ Ù‡ÙŠ Ø³ÙŠØ§Ø³Ø© ØªØ­ØµÙŠÙ„ ÙˆØªÙˆØµÙŠØ© Ø§Ù„Ø£Ù…ÙˆØ§Ù„ (COD) Ù„Ø£ØµØ­Ø§Ø¨ ÙˆÙ…ØªØ§Ø¬Ø± Ø§Ù„ØªØ¬Ø²Ø¦Ø©ØŸ",
      answer: "ÙŠÙ‚Ø¯Ù… Ø§Ù„Ù…Ù†Ø¯ÙˆØ¨ Ø®Ø¯Ù…Ø© ØªØ­ØµÙŠÙ„ Ù‚ÙŠÙ…Ø© Ø§Ù„Ø¨Ø¶Ø§Ø¹Ø© ÙˆØ§Ù„Ø·Ø±ÙˆØ¯ Ù†Ù‚Ø¯Ø§Ù‹ Ù…Ù† Ø§Ù„Ù…Ø´ØªØ±ÙŠ Ø¹Ù†Ø¯ Ø¹Ù…Ù„ÙŠØ© Ø§Ù„ØªØ³Ù„ÙŠÙ… Ø¨Ù†Ø¬Ø§Ø­ØŒ ÙˆÙŠØªÙ… Ø¥Ø¬Ø±Ø§Ø¡ ØªØµÙÙŠØ© Ù…Ø§Ù„ÙŠØ©ØŒ ØªØ³ÙˆÙŠØ© Ø¯ÙˆØ±ÙŠØ© ÙˆÙƒØ´Ù ÙƒØ´ÙˆÙØ§Øª Ø­Ø³Ø§Ø¨ Ù…Ù†Ø¸Ù… Ø£Ø³Ø¨ÙˆØ¹ÙŠØ§Ù‹ ÙˆØ¨ÙƒÙ„ Ø£Ù…Ø§Ù†Ø© Ù„Ø¶Ù…Ø§Ù† ØªÙˆÙÙŠØ± Ø³ÙŠÙˆÙ„Ø© Ù†Ù‚Ø¯ÙŠØ© Ø¬ÙŠØ¯Ø© Ù„Ù„Ù…ØªØ§Ø¬Ø±."
    },
    {
      question: "Ù‡Ù„ ÙŠØªÙˆÙØ± Ù„Ø¯ÙŠÙƒÙ… Ø§Ù„Ø´Ø­Ù† Ø§Ù„Ø¯ÙˆÙ„ÙŠØŒ ÙˆÙ…Ø§ Ù‡ÙŠ Ø¢Ù„ÙŠØ§Øª Ø§Ø­ØªØ³Ø§Ø¨ Ù‚ÙŠÙ…ØªÙ‡ØŸ",
      answer: "Ù†Ø¹Ù… Ø¨Ø§Ù„ØªØ£ÙƒÙŠØ¯ØŒ Ù†ÙˆÙØ± Ø´Ø­Ù†Ø§Ù‹ Ù…ØªÙ…ÙŠØ²Ø§Ù‹ ÙˆØ³Ø±ÙŠØ¹Ø§Ù‹ Ù„Ø¯ÙˆÙ„ Ø§Ù„Ø®Ù„ÙŠØ¬ (GCC) Ø¨Ù€ 95 Ø¯Ø±Ù‡Ù… Ù„Ø£ÙˆÙ„ ÙƒÙŠÙ„Ùˆ Ùˆ 45 Ø¯Ø±Ù‡Ù… Ù„ÙƒÙ„ ÙƒÙŠÙ„Ùˆ Ø¥Ø¶Ø§ÙÙŠ (Ø´Ø§Ù…Ù„ Ø§Ù„Ø¶Ø±ÙŠØ¨Ø© ÙˆØ§Ù„Ø±Ø³ÙˆÙ… Ø§Ù„Ù„ÙˆØ¬Ø³ØªÙŠØ©)ØŒ ÙˆÙ„Ù„Ù…Ø­Ø§ÙˆØ± ÙˆØ§Ù„ÙˆØ¬Ù‡Ø§Øª Ø§Ù„Ø¹Ø§Ù„Ù…ÙŠØ© Ø§Ù„Ø£Ø®Ø±Ù‰ (Ø§Ù„Ø§ØªØ­Ø§Ø¯ Ø§Ù„Ø£ÙˆØ±ÙˆØ¨ÙŠØŒ ÙƒÙ†Ø¯Ø§ ÙˆØ£Ù…Ø±ÙŠÙƒØ§ ÙˆØ£Ø³ØªØ±Ø§Ù„ÙŠØ§) Ø¨Ù€ 190 Ø¯Ø±Ù‡Ù… Ù„Ø£ÙˆÙ„ ÙƒÙŠÙ„Ùˆ Ùˆ 90 Ø¯Ø±Ù‡Ù… Ù„ÙƒÙ„ ÙƒÙŠÙ„Ùˆ Ø¬Ø±Ø§Ù… Ø¥Ø¶Ø§ÙÙŠ."
    }
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-12 text-right">
      {/* Page Header */}
      <section className="text-center max-w-2xl mx-auto space-y-4">
        <span className="bg-brand-gold/10 text-brand-gold text-xs px-3.5 py-1 rounded-full font-bold uppercase font-sans tracking-widest inline-block">
          Frequently Asked Questions â€¢ Ø§Ù„Ø£Ø³Ø¦Ù„Ø© Ø§Ù„Ù…ØªÙƒØ±Ø±Ø©
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
          ÙƒÙ„ Ù…Ø§ ØªÙˆØ¯ Ù…Ø¹Ø±ÙØªÙ‡ Ø¹Ù† Ø®Ø¯Ù…Ø§Øª Ø§Ù„ØªÙˆØµÙŠÙ„ ÙˆØ§Ù„Ø´Ø­Ù†
        </h2>
        <p className="text-white/60 text-sm">
          Ø¬Ù…Ø¹Ù†Ø§ Ù„ÙƒÙ… ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ø£Ø³Ø¦Ù„Ø© Ø§Ù„Ù…ØªØ¯Ø§ÙˆÙ„Ø© Ù…Ù† Ø´Ø±ÙƒØ§Ø¦Ù†Ø§ ÙˆØ¹Ù…Ù„Ø§Ø¦Ù†Ø§ Ù„ØªØ³Ù‡ÙŠÙ„ ØªØ¬Ø±Ø¨Ø© Ø§Ù„Ù†Ù‚Ù„ ÙˆØ§Ù„Ø®Ø¯Ù…Ø§Øª Ø§Ù„Ù„ÙˆØ¬Ø³ØªÙŠØ© Ù„ÙƒÙ….
        </p>
      </section>

      {/* Accordion List */}
      <section className="space-y-4">
        {faqList.map((faq, index) => {
          const isOpen = activeIdx === index;

          return (
            <div
              id={`faq_accordion_${index}`}
              key={index}
              className="bg-brand-cool/30 rounded-2xl border border-white/10 overflow-hidden hover:border-brand-gold/60 transition-all duration-200"
            >
              <button
                type="button"
                onClick={() => setActiveIdx(isOpen ? null : index)}
                className="w-full p-5 flex items-center justify-between text-right gap-4 cursor-pointer focus:outline-none"
              >
                {isOpen ? (
                  <ChevronUp className="w-5 h-5 text-white/40 shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-white/40 shrink-0" />
                )}
                <div className="flex items-center gap-3 text-white flex-row-reverse">
                  <span className="font-bold text-sm sm:text-base text-right leading-snug">{faq.question}</span>
                  <HelpCircle className="w-5 h-5 text-brand-gold shrink-0" />
                </div>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 text-white/70 text-sm border-t border-white/5 leading-relaxed font-sans pr-11 text-right">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Embedded Slogan Help banner */}
      <section className="bg-brand-cool/40 text-white rounded-2xl p-6 text-center border border-white/10">
        <p className="text-sm text-white/80">
          Ù„Ø¯ÙŠÙƒ Ø§Ø³ØªÙØ³Ø§Ø± Ø¢Ø®Ø± Ù„Ù… ÙŠØªÙ… ØªÙˆØ¶ÙŠØ­Ù‡ Ù‡Ù†Ø§ØŸ ØªÙˆØ§ØµÙ„ ÙÙˆØ±ÙŠØ§Ù‹ Ù…Ø¹ Ø®Ø¯Ù…Ø© Ø¹Ù…Ù„Ø§Ø¡ Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª Ø¹Ø¨Ø± Ø§Ù„Ù‡Ø§ØªÙ Ø£Ùˆ Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¯Ø¹Ù….
        </p>
        <div className="pt-4">
          <a
            href="mailto:Admin@daynightae.com"
            className="px-6 py-2.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-bold rounded-lg text-xs transition-colors inline-block cursor-pointer font-sans"
          >
            Ø±Ø§Ø³Ù„Ù†Ø§: Admin@daynightae.com
          </a>
        </div>
      </section>
    </div>
  );
}

