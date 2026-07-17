/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Link } from "react-router-dom";
import { FileQuestion, Home, MessageSquare, Search } from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import companyMeta from "../data/companyMeta";

interface NotFoundProps {
  onNavigate?: (tab: string) => void;
}

export default function NotFound({ onNavigate }: NotFoundProps) {
  const { language } = useAppContext();
  const isArabic = language === "ar";

  const homeLabel = isArabic ? "العودة للرئيسية" : "Back to home";
  const trackingLabel = isArabic ? "تتبع شحنة" : "Track shipment";
  const supportLabel = isArabic ? "الدعم عبر واتساب" : "WhatsApp support";

  return (
    <section className="dn-page-width-comfort mx-auto py-12 text-center" dir={isArabic ? "rtl" : "ltr"}>
      <div className="dn-finish-surface rounded-[2.5rem] p-6 sm:p-10">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-[1.6rem] border border-brand-gold/30 bg-brand-gold/10 text-brand-gold shadow-[0_0_34px_rgba(235,188,4,0.18)]">
          <FileQuestion className="h-10 w-10" />
        </div>

        <div className="mx-auto mt-6 max-w-2xl space-y-3">
          <p className="text-xs font-black uppercase tracking-[0.26em] text-brand-gold">DAY NIGHT SUPPORT</p>
          <h1 className="text-3xl font-black text-white sm:text-5xl">{isArabic ? "الصفحة غير متاحة" : "Page unavailable"}</h1>
          <p className="text-sm font-bold leading-7 text-white/62">
            {isArabic
              ? "قد يكون الرابط تغير أو لم يعد متاحاً. يمكنك الرجوع للرئيسية أو فتح التتبع أو التواصل مع الدعم مباشرة."
              : "The link may have changed or is no longer available. Return home, open shipment tracking, or contact support directly."}
          </p>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {onNavigate ? (
            <button type="button" onClick={() => onNavigate("home")} className="dn-btn dn-btn-primary dn-btn-md">
              <Home className="h-4 w-4" />
              {homeLabel}
            </button>
          ) : (
            <Link to="/" className="dn-btn dn-btn-primary dn-btn-md">
              <Home className="h-4 w-4" />
              {homeLabel}
            </Link>
          )}
          <Link to="/tracking" className="dn-btn dn-btn-secondary dn-btn-md">
            <Search className="h-4 w-4 text-brand-gold" />
            {trackingLabel}
          </Link>
          <a href={companyMeta.whatsappUrl} target="_blank" rel="noopener noreferrer" className="dn-btn dn-btn-whatsapp dn-btn-md">
            <MessageSquare className="h-4 w-4" />
            {supportLabel}
          </a>
        </div>
      </div>
    </section>
  );
}
