/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, type FormEvent, type ReactNode } from "react";
import {
  Phone,
  Mail,
  MapPin,
  Facebook,
  Instagram,
  MessageSquare,
  ExternalLink,
  CheckCircle,
  Clock
} from "lucide-react";
import companyMeta from "../data/companyMeta";
import { useAppContext } from "../lib/AppContext";
import { pageCopy } from "../data/pageCopy";
import { supabase } from "../supabase";
import SectionHeader from "./ui/SectionHeader";
import GlassCard from "./ui/GlassCard";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

export default function ContactUs() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const t = pageCopy[language].contactPage;

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    subject: "general",
    serviceType: "local",
    message: ""
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (supabase) {
      const { error: insertError } = await supabase.from("chatbot_leads").insert({
        name: formData.name,
        phone: formData.phone,
        email: formData.email || null,
        subject: formData.subject,
        message: formData.message,
        source: "contact_page"
      });
      if (insertError) {
        const { error: altError } = await supabase.from("leads").insert({
          name: formData.name,
          phone: formData.phone,
          email: formData.email || null,
          subject: formData.subject,
          message: formData.message
        });
        if (altError) {
          console.warn("Lead save failed, using WhatsApp fallback.");
        }
      }
    }

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: "", phone: "", email: "", subject: "general", serviceType: "local", message: "" });
    }, 5000);
  }

  const socialLinks = [
    { name: "Facebook", url: companyMeta.socials.facebook, icon: <Facebook className="w-5 h-5 text-[#1877F2]" /> },
    { name: "Instagram", url: companyMeta.socials.instagram, icon: <Instagram className="w-5 h-5 text-[#E4405F]" /> },
    { name: "TikTok", url: companyMeta.socials.tiktok, icon: <TikTokIcon className="w-5 h-5 text-white" /> }
  ];

  return (
    <div className="space-y-12" dir={isArabic ? "rtl" : "ltr"}>
      <SectionHeader badge={t.badge} title={t.title} subtitle={t.subtitle} />

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-12 xl:col-span-5 space-y-6">
          <GlassCard className="p-6 sm:p-8 space-y-6">
            <h3 className="text-xl font-bold text-white border-b border-white/10 pb-3">{t.channelsTitle}</h3>

            <div className="space-y-5">
              <ContactRow icon={<Phone className="w-5 h-5 text-brand-gold" />} label={t.phoneLabel}>
                <a href={`tel:${companyMeta.phone.replace(/\s/g, "")}`} className="text-white font-extrabold hover:text-brand-gold">
                  {companyMeta.phone}
                </a>
              </ContactRow>
              <ContactRow icon={<MessageSquare className="w-5 h-5 text-[#25D366]" />} label={t.whatsappLabel}>
                <a href={companyMeta.whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-[#25D366] font-extrabold hover:underline">
                  {companyMeta.phone}
                </a>
              </ContactRow>
              <ContactRow icon={<ExternalLink className="w-5 h-5 text-amber-400" />} label={t.catalogLabel}>
                <a href={companyMeta.whatsappCatalog} target="_blank" rel="noopener noreferrer" className="text-amber-400 font-bold hover:underline text-sm">
                  {pageCopy[language].corporatePage.whatsappCatalog}
                </a>
              </ContactRow>
              <ContactRow icon={<Mail className="w-5 h-5 text-brand-gold" />} label={t.emailLabel}>
                <a href={`mailto:${companyMeta.email}`} className="text-white font-bold hover:text-brand-gold text-sm break-all">
                  {companyMeta.email}
                </a>
              </ContactRow>
              <ContactRow icon={<MapPin className="w-5 h-5 text-brand-gold" />} label={t.addressLabel}>
                <p className="text-white/80 font-bold text-sm leading-relaxed">
                  {isArabic ? companyMeta.addressAr : companyMeta.addressEn}
                </p>
                <a href={companyMeta.mapUrl} target="_blank" rel="noopener noreferrer" className="text-brand-gold font-bold text-xs mt-1.5 inline-flex items-center gap-1 hover:underline">
                  {t.mapsLink}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </ContactRow>
            </div>

            <GlassCard className="p-4 flex items-center gap-3">
              <Clock className="w-6 h-6 text-brand-gold shrink-0" />
              <div>
                <p className="text-white/50 text-xs font-bold">{t.hoursTitle}</p>
                <p className="text-white font-bold text-sm">{t.hoursValue}</p>
              </div>
            </GlassCard>
          </GlassCard>

          <GlassCard className="p-6 space-y-4">
            <h4 className="font-bold text-white">{t.socialTitle}</h4>
            <div className="flex flex-col gap-2.5">
              {socialLinks.map((s) => (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3.5 bg-brand-deep/60 hover:bg-white/5 rounded-xl border border-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {s.icon}
                    <span className="text-sm font-semibold text-white/80">{s.name}</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-white/40" />
                </a>
              ))}
            </div>
          </GlassCard>
        </div>

        <GlassCard className="lg:col-span-12 xl:col-span-7 p-6 sm:p-8 space-y-6">
          <div className="border-b border-white/10 pb-3">
            <h3 className="text-xl font-bold text-white">{t.formTitle}</h3>
            <p className="text-white/45 text-xs mt-1">{t.formSubtitle}</p>
          </div>

          {submitted ? (
            <div className="p-8 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-center space-y-3">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
              <h4 className="text-emerald-300 font-bold text-lg">{t.successTitle}</h4>
              <p className="text-white/80 text-sm">{t.successDesc}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={`${t.name} *`}>
                  <input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="field-input" />
                </Field>
                <Field label={`${t.phone} *`}>
                  <input required type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="field-input" dir="ltr" />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t.email}>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="field-input" dir="ltr" />
                </Field>
                <Field label={t.subject}>
                  <select value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} className="field-input [color-scheme:dark]">
                    {Object.entries(t.subjects).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label={`${t.message} *`}>
                <textarea required rows={4} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} className="field-input min-h-[100px]" />
              </Field>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <div className={`flex flex-wrap gap-3 pt-2 ${isArabic ? "justify-start" : "justify-end"}`}>
                <button type="submit" className="px-8 py-3.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-extrabold rounded-xl text-xs transition-colors">
                  {t.submit}
                </button>
                <a href={`mailto:${companyMeta.email}?subject=${encodeURIComponent(formData.subject)}`} className="px-6 py-3.5 border border-white/20 text-white/80 hover:border-brand-gold rounded-xl text-xs font-bold transition-colors">
                  {t.emailLabel}
                </a>
              </div>
              <p className="text-white/45 text-xs">{t.faqContact}</p>
            </form>
          )}
        </GlassCard>
      </section>
    </div>
  );
}

function ContactRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <p className="text-white/40 text-xs font-bold">{label}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-white/75 text-xs font-bold">{label}</label>
      {children}
    </div>
  );
}
