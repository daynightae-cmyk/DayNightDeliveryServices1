/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import {
  Copy,
  Share2,
  Check,
  ExternalLink,
  PhoneCall,
  MessageSquare,
  Mail,
  MapPin,
  Truck,
  DollarSign,
  QrCode
} from "lucide-react";
import { Link } from "react-router-dom";
import companyMeta from "../data/companyMeta";
import { useAppContext } from "../lib/AppContext";
import { pageCopy } from "../data/pageCopy";
import SectionHeader from "./ui/SectionHeader";
import GlassCard from "./ui/GlassCard";
import { buildQrDataUrl, downloadQr } from "../lib/qrGenerator";

interface QRProps {
  onNavigate?: (tab: string) => void;
}

export default function QR({ onNavigate }: QRProps) {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const t = pageCopy[language].qrPage;
  const [copied, setCopied] = useState(false);
  const [siteQr, setSiteQr] = useState("");

  useEffect(() => {
    let cancelled = false;
    buildQrDataUrl(companyMeta.website).then((dataUrl) => {
      if (!cancelled) setSiteQr(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(companyMeta.website);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const shareData = {
      title: companyMeta.name,
      text: isArabic ? companyMeta.legalNameAr : companyMeta.name,
      url: companyMeta.website
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  const actions = [
    { label: t.requestDelivery, icon: Truck, path: "/request-delivery" },
    { label: t.trackShipment, icon: QrCode, path: "/tracking" },
    { label: t.viewPricing, icon: DollarSign, path: "/pricing" }
  ];

  const channels = [
    { label: companyMeta.phone, url: `tel:${companyMeta.phone.replace(/\s/g, "")}`, icon: PhoneCall, color: "text-brand-gold" },
    { label: isArabic ? "واتساب" : "WhatsApp", url: companyMeta.whatsappUrl, icon: MessageSquare, color: "text-[#25D366]" },
    { label: companyMeta.email, url: `mailto:${companyMeta.email}`, icon: Mail, color: "text-brand-gold" },
    { label: isArabic ? companyMeta.addressAr : companyMeta.addressEn, url: companyMeta.mapUrl, icon: MapPin, color: "text-brand-gold" }
  ];

  return (
    <div className="space-y-12" dir={isArabic ? "rtl" : "ltr"}>
      <SectionHeader badge={t.badge} title={t.title} subtitle={t.subtitle} />

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <GlassCard className="lg:col-span-5 p-8 flex flex-col items-center text-center space-y-6">
          <h3 className="text-lg font-bold text-white">{t.scanTitle}</h3>
          <div className="p-4 bg-white rounded-2xl shadow-xl">
            {siteQr ? (
              <img src={siteQr} alt="DAY NIGHT official website QR" className="w-48 h-48 sm:w-56 sm:h-56 object-contain" loading="lazy" />
            ) : (
              <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-xl bg-brand-deep/10 animate-pulse" />
            )}
          </div>
          <img src={companyMeta.logoUrl} alt={companyMeta.name} className="h-12 object-contain" loading="lazy" />
          <p className="text-brand-gold font-bold text-sm" dir="ltr">{companyMeta.displayWebsite}</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button onClick={handleCopy} className="flex items-center gap-2 px-4 py-2 bg-brand-gold/20 text-brand-gold rounded-xl text-xs font-bold hover:bg-brand-gold/30 transition-colors">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? t.copied : t.copyLink}
            </button>
            <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-xl text-xs font-bold hover:bg-white/15 transition-colors">
              <Share2 className="w-4 h-4" />
              {t.share}
            </button>
            <button disabled={!siteQr} onClick={() => downloadQr(siteQr, "daynightae.com-qr.png")} className="flex items-center gap-2 px-4 py-2 bg-brand-blue/20 text-white rounded-xl text-xs font-bold hover:bg-brand-blue/30 transition-colors disabled:opacity-50">
              <QrCode className="w-4 h-4" />
              PNG
            </button>
          </div>
        </GlassCard>

        <div className="lg:col-span-7 space-y-6">
          <GlassCard className="p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">{t.actionsTitle}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {actions.map(({ label, icon: Icon, path }) => (
                <Link
                  key={path}
                  to={path}
                  onClick={() => onNavigate?.(path.replace("/", ""))}
                  className="p-4 rounded-xl border border-white/10 bg-brand-deep/50 hover:border-brand-gold/40 transition-all flex flex-col items-center gap-2 text-center"
                >
                  <Icon className="w-6 h-6 text-brand-gold" />
                  <span className="text-xs font-bold text-white/80">{label}</span>
                </Link>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">{t.externalTitle}</h3>
            <div className="space-y-3">
              {channels.map((ch) => (
                <a
                  key={ch.url}
                  href={ch.url}
                  target={ch.url.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-brand-deep/50 hover:border-brand-gold/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ch.icon className={`w-5 h-5 shrink-0 ${ch.color}`} />
                    <span className="text-sm font-semibold text-white/80 truncate">{ch.label}</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-white/40 shrink-0" />
                </a>
              ))}
            </div>
          </GlassCard>
        </div>
      </section>
    </div>
  );
}
