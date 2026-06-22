/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Building2, 
  FileText, 
  CheckCircle2, 
  Truck, 
  UserCheck, 
  TrendingDown, 
  Clock, 
  BadgeCheck,
  Send,
  MessageSquare,
  PhoneCall
} from "lucide-react";

export default function CorporateSolutions() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    contactPerson: "",
    phone: "",
    email: "",
    volume: "medium",
    notes: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName || !formData.phone) return;
    setSubmitted(true);
  };

  const benefits = [
    {
      icon: <FileText className="w-6 h-6 text-brand-gold" />,
      title_ar: "ØªÙˆØµÙŠÙ„ Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª Ø§Ù„Ù‚Ø§Ù†ÙˆÙ†ÙŠØ© ÙˆØ§Ù„Ø¹Ù‚ÙˆØ¯",
      title_en: "Legal & Corporate Documents",
      desc_ar: "Ù†Ù‚Ù„ Ø¢Ù…Ù† ÙˆØ¹Ø§Ø¬Ù„ Ù„Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª Ø§Ù„Ø±Ø³Ù…ÙŠØ© ÙˆØ§Ù„Ø£ÙˆØ±Ø§Ù‚ Ø§Ù„Ø«Ø¨ÙˆØªÙŠØ© ÙˆØ§Ù„Ù…Ù„ÙØ§Øª Ø§Ù„Ø­ÙƒÙˆÙ…ÙŠØ© Ø¨ÙŠÙ† Ø§Ù„ÙØ±ÙˆØ¹ ÙˆØ§Ù„ÙˆØ²Ø§Ø±Ø§Øª Ø¨Ø£Ø¹Ù„Ù‰ Ø¯Ø±Ø¬Ø§Øª Ø§Ù„Ø³Ø±ÙŠØ© ÙˆØ§Ù„ØªÙˆÙ‚ÙŠØ¹ Ø§Ù„Ù…Ø¹ØªÙ…Ø¯.",
      desc_en: "Super secure & swift transport of legal files and government paperwork with proof of delivery."
    },
    {
      icon: <TrendingDown className="w-6 h-6 text-brand-gold" />,
      title_ar: "Ø£Ø³Ø¹Ø§Ø± ØªÙØ¶ÙŠÙ„ÙŠØ© ÙˆØ¹Ù‚ÙˆØ¯ Ø´Ù‡Ø±ÙŠØ©",
      title_en: "Corporate Rates & Monthly Billing",
      desc_ar: "Ø®ØµÙˆÙ…Ø§Øª Ø­ØµØ±ÙŠØ© Ù„Ù„Ø´Ø±ÙƒØ§Øª Ø°Ø§Øª Ø§Ù„Ø£Ø­Ø¬Ø§Ù… Ø§Ù„ÙƒØ¨ÙŠØ±Ø© Ù…Ù† Ø§Ù„Ø·Ø±ÙˆØ¯ Ù…Ø¹ ÙÙˆØªØ±Ø© Ø´Ù‡Ø±ÙŠØ© Ù…Ø±Ù†Ø© ÙˆÙ†Ø¸Ø§Ù… Ø¯ÙØ¹ Ø¢Ø¬Ù„ Ù…Ø¹ ØªØ²ÙˆÙŠØ¯ÙƒÙ… Ø¨ØªÙ‚Ø§Ø±ÙŠØ± ØªØ³Ù„ÙŠÙ… Ù…ÙØµÙ„Ø©.",
      desc_en: "Competitive pricing tailored for scale, complete with periodic invoices and volume discounts."
    },
    {
      icon: <UserCheck className="w-6 h-6 text-brand-gold" />,
      title_ar: "Ù…Ù†Ø¯ÙˆØ¨ Ù…Ø®ØµØµ ÙˆØ­ØµØ±ÙŠ Ù„Ù…Ø¤Ø³Ø³ØªÙƒ",
      title_en: "Dedicated Courier Agent",
      desc_ar: "Ù†ÙˆÙØ± Ù„Ø´Ø±ÙƒØªÙƒ Ø³Ø§Ø¦Ù‚Ø§Ù‹ ÙˆÙ…Ù†Ø¯ÙˆØ¨Ø§Ù‹ Ø®Ø§ØµØ§Ù‹ Ù…Ø¯Ø±Ø¨Ø§Ù‹ Ø¹Ù„Ù‰ Ø·Ø¨ÙŠØ¹Ø© Ø¹Ù…Ù„Ùƒ ÙŠØªØ±Ø¯Ø¯ Ø¹Ù„ÙŠÙƒÙ… ÙŠÙˆÙ…ÙŠØ§Ù‹ Ù„Ø§Ø³ØªÙ„Ø§Ù… ÙˆØªØ³Ù„ÙŠÙ… Ø§Ù„Ù…Ø¹Ø§Ù…Ù„Ø§Øª Ø¯ÙˆÙ† ØªØ£Ø®ÙŠØ±.",
      desc_en: "A fully dedicated delivery representative stationed for your daily pick-up patterns."
    },
    {
      icon: <Clock className="w-6 h-6 text-brand-gold" />,
      title_ar: "Ø£ÙˆÙ„ÙˆÙŠØ© Ø§Ø³ØªØ«Ù†Ø§Ø¦ÙŠØ© ÙˆØ¯Ø¹Ù… Ø¹Ù„Ù‰ Ù…Ø¯Ø§Ø± Ø§Ù„Ø³Ø§Ø¹Ø©",
      title_en: "24/7 Priority Assistance",
      desc_ar: "ÙØ±ÙŠÙ‚ Ø¯Ø¹Ù… Ù…Ø®ØµØµ Ù„Ù„Ø´Ø±ÙƒØ§Øª Ø§Ù„Ù…ØªØ¹Ø§Ù‚Ø¯Ø© Ù„Ù…Ø¹Ø§Ù„Ø¬Ø© Ø£ÙŠ Ø´Ø­Ù†Ø© Ø·Ø§Ø±Ø¦Ø© Ø£Ùˆ Ø®Ø§ØµØ© ÙÙŠ Ø£ÙŠ ÙˆÙ‚Øª Ù…Ù† Ø§Ù„Ù„ÙŠÙ„ ÙˆØ§Ù„Ù†Ù‡Ø§Ø±.",
      desc_en: "Round-the-clock professional coordination specifically for corporate contracts."
    }
  ];

  return (
    <div className="space-y-16 text-right">
      {/* Header */}
      <section className="text-center max-w-2xl mx-auto space-y-4">
        <span className="bg-brand-gold/10 text-brand-gold text-xs px-3.5 py-1 rounded-full font-bold uppercase font-sans tracking-widest inline-block">
          Corporate & Government Solutions â€¢ Ø§Ù„Ø´Ø±ÙƒØ§Øª ÙˆØ§Ù„Ø¹Ù‚ÙˆØ¯
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
          Ø§Ù„Ø­Ù„ÙˆÙ„ Ø§Ù„Ù„ÙˆØ¬Ø³ØªÙŠØ© Ø§Ù„Ù…ØªÙƒØ§Ù…Ù„Ø© Ù„Ù„Ø´Ø±ÙƒØ§Øª ÙˆØ§Ù„Ø¬Ù‡Ø§Øª Ø§Ù„Ø­ÙƒÙˆÙ…ÙŠØ©
        </h2>
        <p className="text-white/60 text-sm">
          Ø´Ø±ÙŠÙƒÙƒ Ø§Ù„Ù„ÙˆØ¬Ø³ØªÙŠ Ø§Ù„Ù…ÙˆØ«ÙˆÙ‚ ÙÙŠ Ø¯ÙˆÙ„Ø© Ø§Ù„Ø¥Ù…Ø§Ø±Ø§Øª Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© Ø§Ù„Ù…ØªØ­Ø¯Ø©. Ù†Ù‚Ø¯Ù… Ø¹Ù‚ÙˆØ¯Ø§Ù‹ Ø´Ù‡Ø±ÙŠØ© Ù…Ø±Ù†Ø© ÙˆØ£Ø³Ø·ÙˆÙ„Ø§Ù‹ Ù…Ø¬Ù‡Ø²Ø§Ù‹ Ù„ØªÙ„Ø¨ÙŠØ© Ù…ØªØ·Ù„Ø¨Ø§Øª Ø£Ø¹Ù…Ø§Ù„ÙƒÙ… Ø¨Ø¯Ù‚Ø© ÙØ§Ø¦Ù‚Ø©.
        </p>
      </section>

      {/* Main Grid Content */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Benefits Block */}
        <div className="lg:col-span-12 xl:col-span-7 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {benefits.map((b, idx) => (
              <div id={`corp_benefit_${idx}`} key={idx} className="bg-brand-cool/30 p-6 rounded-2xl border border-white/10 space-y-4 hover:border-brand-gold/50 transition-all duration-300">
                <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center shrink-0">
                  {b.icon}
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white">{b.title_ar}</h3>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide font-mono">{b.title_en}</p>
                  <p className="text-white/70 text-sm leading-relaxed">{b.desc_ar}</p>
                  <p className="text-white/40 text-xs leading-relaxed italic">{b.desc_en}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Slogan strip */}
          <div className="bg-brand-cool/20 border border-white/10 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-right">
              <h4 className="text-md font-bold text-white flex items-center justify-end gap-1.5">
                <span>Ù…ØªÙˆØ§Ø¬Ø¯ÙˆÙ† Ø¨Ù…Ù‚Ø±Ù†Ø§ ÙÙŠ Ø£Ø¨ÙˆØ¸Ø¨ÙŠ Ù„Ø®Ø¯Ù…Ø© Ù…ÙƒØ§ØªØ¨ÙƒÙ…</span>
                <Building2 className="w-5 h-5 text-brand-gold" />
              </h4>
              <p className="text-xs text-white/50">Ø³Ø¬Ù„ Ù…Ø¹ØªÙ…Ø¯ØŒ Ø³ÙŠØ§Ø±Ø§Øª Toyota Rush Ø¨ÙŠØ¶Ø§Ø¡ Ø­Ø¯ÙŠØ«Ø© ÙˆÙ…Ù†Ø¯ÙˆØ¨ÙŠÙ† Ø¨Ø§Ù„Ø²ÙŠ Ø§Ù„Ø±Ø³Ù…ÙŠ.</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <a 
                href="https://wa.me/971568757331" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-extrabold rounded-xl text-xs transition-colors shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Ø·Ù„Ø¨ Ù…Ø¨Ø§Ø´Ø± Ø¹Ø¨Ø± ÙˆØ§ØªØ³Ø§Ø¨</span>
              </a>
              <a 
                id="corporate_whatsapp_catalog"
                href="https://wa.me/c/971568757331" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl text-xs transition-colors shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Ø¹Ø±Ø¶ ÙƒØªØ§Ù„ÙˆØ¬ ÙˆØ§ØªØ³Ø§Ø¨</span>
              </a>
            </div>
          </div>
        </div>

        {/* Corporate Form Block */}
        <div className="lg:col-span-12 xl:col-span-5 bg-brand-cool/30 rounded-3xl p-6 sm:p-8 border border-white/10 space-y-6">
          <div className="border-b border-white/10 pb-3">
            <h3 className="text-xl font-bold text-white">Ø·Ù„Ø¨ Ø§Ø³ØªØ´Ø§Ø±Ø© ÙˆØ¹Ù‚Ø¯ ØªØ¬Ø§Ø±ÙŠ</h3>
            <p className="text-white/40 text-xs mt-0.5 leading-normal">Ø§Ù…Ù„Ø£ Ø§Ù„Ø§Ø³ØªÙ…Ø§Ø±Ø© ÙˆØ³ÙŠØ¬ÙŠØ¨Ùƒ Ø£Ø­Ø¯ Ù…Ø³Ø¤ÙˆÙ„ÙŠ Ø§Ù„Ø­Ø³Ø§Ø¨Ø§Øª Ø§Ù„ØªØ¬Ø§Ø±ÙŠØ© Ø¨Ø¹Ø±Ø¶ Ù…Ø§Ù„ÙŠ Ù…Ù„Ø§Ø¦Ù….</p>
          </div>

          {submitted ? (
            <div className="p-8 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-center space-y-3">
              <BadgeCheck className="w-12 h-12 text-emerald-400 mx-auto" />
              <h4 className="text-emerald-300 font-bold text-lg">ÙˆØµÙ„Ù†Ø§ Ø·Ù„Ø¨Ùƒ Ø¨Ù†Ø¬Ø§Ø­!</h4>
              <p className="text-white/80 text-sm">Ø³ÙŠØªÙ… Ù…Ø±Ø§Ø¬Ø¹Ø© Ø§Ø³ØªÙØ³Ø§Ø±Ùƒ ÙˆÙ‚Ø¯Ø± Ø§Ù„Ø·Ø±ÙˆØ¯ Ø§Ù„Ø®Ø§Øµ Ø¨Ø¬Ù‡ØªÙƒÙ… ÙˆØ¥Ø±Ø³Ø§Ù„ Ù…Ø³ÙˆØ¯Ø© ØªØ³Ø¹ÙŠØ± ÙˆØ¹Ù‚Ø¯ ÙÙŠ Ø£Ù‚Ø±Ø¨ ÙˆÙ‚Øª.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-right">
              <div className="space-y-1.5">
                <label className="text-white/75 text-xs font-bold">Ø§Ø³Ù… Ø§Ù„Ø´Ø±ÙƒØ© Ø£Ùˆ Ø§Ù„Ø¬Ù‡Ø© Ø§Ù„Ø­ÙƒÙˆÙ…ÙŠØ© *</label>
                <input
                  id="corp_input_company"
                  type="text"
                  required
                  placeholder="Ù…Ø«Ø§Ù„: Ø´Ø±ÙƒØ© Ø£Ø¨ÙˆØ¸Ø¨ÙŠ Ù„Ù„Ø§Ø³ØªØ«Ù…Ø§Ø±"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep text-right"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-white/75 text-xs font-bold">Ù…Ø³Ø¤ÙˆÙ„ Ø§Ù„ØªÙˆØ§ØµÙ„ ÙˆØ§Ù„ØªØ¹Ø§Ù‚Ø¯</label>
                <input
                  id="corp_input_person"
                  type="text"
                  placeholder="Ø§Ù„Ø§Ø³Ù… Ø§Ù„ÙƒØ§Ù…Ù„"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep text-right"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-white/75 text-xs font-bold">Ø±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ Ù„Ù„Ø§ØªØµØ§Ù„ Ø§Ù„Ù…Ø¨Ø§Ø´Ø± *</label>
                  <input
                    id="corp_input_phone"
                    type="tel"
                    required
                    placeholder="+971 56 875 7331"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep text-right"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-white/75 text-xs font-bold">Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ Ù„Ù„Ø¬Ù‡Ø©</label>
                  <input
                    id="corp_input_email"
                    type="email"
                    placeholder="business@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep text-right"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-white/75 text-xs font-bold">Ø§Ù„Ø­Ø¬Ù… Ø§Ù„ØªÙ‚Ø±ÙŠØ¨ÙŠ Ù„Ù„Ø·Ø±ÙˆØ¯ / Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª Ø´Ù‡Ø±ÙŠØ§Ù‹</label>
                <select
                  id="corp_input_volume"
                  value={formData.volume}
                  onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep [color-scheme:dark] select-none text-right"
                >
                  <option value="low">Ø£Ù‚Ù„ Ù…Ù† 100 Ø·Ø±Ø¯ Ø´Ù‡Ø±ÙŠØ§Ù‹</option>
                  <option value="medium">Ù…Ù† 100 Ø¥Ù„Ù‰ 500 Ø·Ø±Ø¯ Ø´Ù‡Ø±ÙŠØ§Ù‹</option>
                  <option value="high">Ø£ÙƒØ«Ø± Ù…Ù† 500 Ø·Ø±Ø¯ Ø´Ù‡Ø±ÙŠØ§Ù‹</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-white/75 text-xs font-bold">Ù…ØªØ·Ù„Ø¨Ø§Øª Ø·Ø±ÙˆØ¯ÙƒÙ… Ø§Ù„Ø®Ø§ØµØ©</label>
                <textarea
                  id="corp_input_notes"
                  placeholder="Ù…Ø«Ø§Ù„: Ø®Ø¯Ù…Ø§Øª Ø§Ø³ØªÙ„Ø§Ù… Ø§Ù„Ø£ÙˆØ±Ø§Ù‚ Ø§Ù„Ø­ÙƒÙˆÙ…ÙŠØ© ÙˆØ§Ù„ØªÙˆÙ‚ÙŠØ¹ Ø§Ù„Ù…Ø¹ØªÙ…Ø¯ØŒ Ø´Ø­Ù†Ø§Øª Ù„ÙŠÙ„ÙŠØ© Ø¹Ø§Ø¬Ù„Ø©..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep text-right min-h-[80px]"
                ></textarea>
              </div>

              <button
                id="corp_submit_btn"
                type="submit"
                className="w-full sm:w-auto px-8 py-3.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-black rounded-xl text-xs transition-colors cursor-pointer text-center"
              >
                Ø¥Ø±Ø³Ø§Ù„ Ø¹Ø±Ø¶ Ø§Ù„ØªØ¹Ø§Ù‚Ø¯
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

