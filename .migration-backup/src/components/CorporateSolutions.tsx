/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, type FormEvent } from "react";
import {
  Building2,
  FileText,
  CheckCircle2,
  TrendingDown,
  UserCheck,
  Clock,
  BadgeCheck,
  MessageSquare,
  Check
} from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import { pageCopy } from "../data/pageCopy";
import companyMeta from "../data/companyMeta";
import SectionHeader from "./ui/SectionHeader";
import GlassCard from "./ui/GlassCard";

export default function CorporateSolutions() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const t = pageCopy[language].corporatePage;

  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    contactPerson: "",
    phone: "",
    email: "",
    businessType: "",
    volume: "medium",
    pickupArea: "",
    coverage: "",
    serviceRequired: "",
    notes: ""
  });

  const benefitIcons = [FileText, TrendingDown, UserCheck, Clock];

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!formData.companyName || !formData.phone) return;

    const message = [
      `Corporate quote request`,
      `Company: ${formData.companyName}`,
      `Contact: ${formData.contactPerson}`,
      `Phone: ${formData.phone}`,
      `Email: ${formData.email}`,
      `Volume: ${formData.volume}`,
      `Pickup: ${formData.pickupArea}`,
      `Coverage: ${formData.coverage}`,
      `Service: ${formData.serviceRequired}`,
      `Notes: ${formData.notes}`
    ].join("\n");

    window.open(
      `${companyMeta.whatsappUrl}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
    setSubmitted(true);
  }

  return (
    <div className="space-y-16" dir={isArabic ? "rtl" : "ltr"}>
      <SectionHeader badge={t.badge} title={t.title} subtitle={t.subtitle} />

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-12 xl:col-span-7 space-y-8">
          <GlassCard className="p-6 sm:p-8 space-y-4">
            <h3 className="text-xl font-bold text-white">{t.heroTitle}</h3>
            <p className="text-white/70 text-sm leading-relaxed">{t.heroDesc}</p>
          </GlassCard>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassCard className="p-5">
              <h4 className="text-brand-gold font-bold mb-3">{t.whoServesTitle}</h4>
              <ul className="space-y-2">
                {t.whoServes.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-white/75">
                    <Check className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
            <GlassCard className="p-5">
              <h4 className="text-brand-gold font-bold mb-3">{t.featuresTitle}</h4>
              <ul className="space-y-2">
                {t.features.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-white/75">
                    <Check className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {t.benefits.map((b, idx) => {
              const Icon = benefitIcons[idx] || FileText;
              return (
                <div key={b.title}>
                <GlassCard className="p-6 space-y-4 hover:border-brand-gold/40 transition-colors">
                  <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center">
                    <Icon className="w-6 h-6 text-brand-gold" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white">{b.title}</h3>
                    <p className="text-white/70 text-sm leading-relaxed">{b.desc}</p>
                  </div>
                </GlassCard>
                </div>
              );
            })}
          </div>

          <GlassCard className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className={`space-y-1 ${isArabic ? "text-right" : "text-left"}`}>
              <h4 className="text-md font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-gold shrink-0" />
                <span>{t.trustTitle}</span>
              </h4>
              <p className="text-xs text-white/55">{t.trustDesc}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <a
                href={companyMeta.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-extrabold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <MessageSquare className="w-4 h-4" />
                {t.whatsappQuote}
              </a>
              <a
                href={companyMeta.whatsappCatalog}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-[#25D366] hover:bg-[#1da851] text-white font-extrabold rounded-xl text-xs transition-colors text-center"
              >
                {t.whatsappCatalog}
              </a>
            </div>
          </GlassCard>
        </div>

        <GlassCard className="lg:col-span-12 xl:col-span-5 p-6 sm:p-8 space-y-6">
          <div className="border-b border-white/10 pb-3">
            <h3 className="text-xl font-bold text-white">{t.formTitle}</h3>
            <p className="text-white/45 text-xs mt-1">{t.formSubtitle}</p>
          </div>

          {submitted ? (
            <div className="p-8 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-center space-y-3">
              <BadgeCheck className="w-12 h-12 text-emerald-400 mx-auto" />
              <h4 className="text-emerald-300 font-bold text-lg">{t.successTitle}</h4>
              <p className="text-white/80 text-sm">{t.successDesc}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {[
                { id: "companyName", label: t.companyName, key: "companyName", required: true },
                { id: "contactPerson", label: t.contactPerson, key: "contactPerson" },
                { id: "phone", label: t.phone, key: "phone", type: "tel", required: true },
                { id: "email", label: t.email, key: "email", type: "email" },
                { id: "businessType", label: t.businessType, key: "businessType" },
                { id: "pickupArea", label: t.pickupArea, key: "pickupArea" },
                { id: "coverage", label: t.coverage, key: "coverage" },
                { id: "serviceRequired", label: t.serviceRequired, key: "serviceRequired" }
              ].map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-white/75 text-xs font-bold">{field.label}{field.required ? " *" : ""}</label>
                  <input
                    id={`corp_${field.id}`}
                    type={field.type || "text"}
                    required={field.required}
                    value={formData[field.key as keyof typeof formData]}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold"
                  />
                </div>
              ))}

              <div className="space-y-1.5">
                <label className="text-white/75 text-xs font-bold">{t.monthlyVolume}</label>
                <select
                  value={formData.volume}
                  onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold [color-scheme:dark]"
                >
                  <option value="low">{t.volumeLow}</option>
                  <option value="medium">{t.volumeMedium}</option>
                  <option value="high">{t.volumeHigh}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-white/75 text-xs font-bold">{t.notes}</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold min-h-[80px]"
                />
              </div>

              <button
                type="submit"
                className="w-full px-8 py-3.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-black rounded-xl text-xs transition-colors"
              >
                {t.submit}
              </button>
            </form>
          )}
        </GlassCard>
      </section>
    </div>
  );
}
