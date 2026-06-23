/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { 
  Copy, 
  Share2, 
  Check, 
  ExternalLink, 
  PhoneCall, 
  MessageSquare, 
  Mail, 
  MapPin, 
  Home, 
  Facebook, 
  Instagram, 
  Truck,
  DollarSign,
  QrCode
} from "lucide-react";

interface QRProps {
  onNavigate?: (tab: string) => void;
}

export default function QR({ onNavigate }: QRProps) {
  const [copied, setCopied] = useState(false);

  const websiteUrl = "https://daynightae.com";
  const logoUrl = "https://i.postimg.cc/tC3sSs24/178129358239a5-modified.png";
  const qrUrl = "https://i.postimg.cc/P5KCWNMd/qr-code-1000-1000.png";

  const handleCopy = () => {
    navigator.clipboard.writeText(websiteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Ø¯Ù„ÙŠÙ„ ØªÙˆØ§ØµÙ„ ÙˆØ±ÙˆØ§Ø¨Ø· Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª Ù„Ø®Ø¯Ù…Ø§Øª Ø§Ù„ØªÙˆØµÙŠÙ„",
          text: "Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª Ù„Ø®Ø¯Ù…Ø§Øª Ø§Ù„ØªÙˆØµÙŠÙ„ ÙˆØ§Ù„Ø´Ø­Ù† - Ø£Ø¨ÙˆØ¸Ø¨ÙŠ ÙˆÙ…ØµÙØ­ ÙˆØ§Ù„Ø¥Ù…Ø§Ø±Ø§Øª",
          url: websiteUrl,
        });
      } catch (e) {
        console.warn("Share failed or was aborted:", e);
      }
    } else {
      handleCopy();
    }
  };

  const actions = [
    {
      titleAr: "Ø­Ø¬Ø² Ø·Ù„Ø¨ ØªÙˆØµÙŠÙ„ Ø¬Ø¯ÙŠØ¯",
      titleEn: "Request a New Delivery",
      icon: <Truck className="w-5 h-5 text-brand-gold" />,
      onClick: () => onNavigate?.("request"),
    },
    {
      titleAr: "ØªØªØ¨Ø¹ Ø´Ø­Ù†ØªÙƒ Ø§Ù„Ù…Ø¨Ø§Ø´Ø±Ø©",
      titleEn: "Live Shipment Tracking",
      icon: <QrCode className="w-5 h-5 text-brand-gold" />,
      onClick: () => onNavigate?.("tracking"),
    },
    {
      titleAr: "Ø­Ø³Ø§Ø¨ ÙƒÙ„ÙØ© Ø§Ù„Ø´Ø­Ù†Ø© ÙˆØ§Ù„ØªØ¹Ø±ÙØ©",
      titleEn: "Inspect Rates & Calculator",
      icon: <DollarSign className="w-5 h-5 text-brand-gold" />,
      onClick: () => onNavigate?.("pricing"),
    },
  ];

  const externalLinks = [
    {
      name: "+971 56 875 7331 (Ø§ØªØµØ§Ù„ Ù‡Ø§ØªÙÙŠ)",
      url: "tel:+971568757331",
      icon: <PhoneCall className="w-5 h-5 text-brand-gold" />,
      color: "bg-brand-cool/40"
    },
    {
      name: "ØªÙˆØ§ØµÙ„ ÙˆØ§ØªØ³Ø§Ø¨ Ù„Ø·Ù„Ø¨ Ø§Ù„Ù…Ù†Ø¯ÙˆØ¨",
      url: "https://wa.me/971568757331",
      icon: <MessageSquare className="w-5 h-5 text-emerald-400" />,
      color: "bg-emerald-950/20 border-emerald-500/20"
    },
    {
      name: "Ø¹Ø±Ø¶ ÙƒØªØ§Ù„ÙˆØ¬ ÙˆØ§ØªØ³Ø§Ø¨ / View WhatsApp Catalog",
      url: "https://wa.me/c/971568757331",
      icon: <MessageSquare className="w-5 h-5 text-amber-400" />,
      color: "bg-amber-950/20 border-amber-500/20"
    },
    {
      name: "Ø§Ù„Ø¨Ø±ÙŠØ¯: Admin@daynightae.com",
      url: "mailto:Admin@daynightae.com",
      icon: <Mail className="w-5 h-5 text-brand-gold" />,
      color: "bg-brand-cool/40"
    },
    {
      name: "Ù„ÙˆÙƒÙŠØ´Ù† Ø§Ù„Ù…Ù‚Ø± - Ù…ØµÙØ­ 40",
      url: "https://maps.app.goo.gl/PCTjMCQpZuR3ns2J7",
      icon: <MapPin className="w-5 h-5 text-brand-gold" />,
      color: "bg-brand-cool/40"
    },
  ];

  const socials = [
    {
      name: "ÙÙŠØ³Ø¨ÙˆÙƒ",
      url: "https://www.facebook.com/profile.php?id=61590600606676",
      icon: <Facebook className="w-5 h-5 text-sky-400" />
    },
    {
      name: "Ø¥Ù†Ø³ØªØºØ±Ø§Ù…",
      url: "https://www.instagram.com/day_night_delivery_services",
      icon: <Instagram className="w-5 h-5 text-pink-400" />
    },
    {
      name: "ØªÙŠÙƒ ØªÙˆÙƒ",
      url: "https://www.tiktok.com/@daynight4767",
      icon: <span className="font-bold text-xs uppercase text-white tracking-widest font-mono">TikTok</span>
    }
  ];

  return (
    <div className="max-w-md mx-auto py-4 space-y-8 text-right">
      {/* Header and Logo Grid */}
      <section className="text-center space-y-4">
        <div className="relative inline-block">
          <img 
            src={logoUrl} 
            alt="Day Night Logo" 
            referrerPolicy="no-referrer"
            className="w-24 h-24 mx-auto object-contain rounded-2xl bg-brand-deep p-1.5 border border-white/10 shadow-[0_4px_24px_rgba(212,175,55,0.15)]"
          />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white">DAY NIGHT Delivery</h2>
          <p className="text-xs text-white/50 tracking-wider">Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª Ù„Ø®Ø¯Ù…Ø§Øª Ø§Ù„ØªÙˆØµÙŠÙ„ ÙˆØ§Ù„Ø´Ø­Ù† â€¢ 24/7</p>
        </div>
      </section>

      {/* Main QR Card */}
      <section className="bg-brand-cool/30 border border-white/10 rounded-2xl p-6 text-center space-y-4">
        <h3 className="font-extrabold text-sm text-white">Ø§Ù„Ø¨Ø§Ø±ÙƒÙˆØ¯ Ø§Ù„Ø±Ø³Ù…ÙŠ Ù„Ù…ÙˆÙ‚Ø¹ Ø§Ù„Ø´Ø±ÙƒØ© ÙˆØ§Ù„Ø·Ù„Ø¨</h3>
        <div className="bg-white p-4 inline-block rounded-2xl border-4 border-brand-gold shadow-[0_0_25px_rgba(212,175,55,0.15)]">
          <img 
            src={qrUrl} 
            alt="Day Night QR Code" 
            referrerPolicy="no-referrer"
            className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
          />
        </div>
        
        {/* URL share / Copy buttons */}
        <div className="flex justify-center items-center gap-2.5 pt-2">
          <button
            onClick={handleShare}
            className="px-4 py-2 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Ù…Ø´Ø§Ø±ÙƒØ© Ø§Ù„Ø±Ø§Ø¨Ø·</span>
          </button>
          
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl text-xs border border-white/10 hover:border-brand-gold/50 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "ØªÙ… Ø§Ù„Ù†Ø³Ø®" : "Ù†Ø³Ø® Ø§Ù„Ù…ÙˆÙ‚Ø¹"}</span>
          </button>
        </div>
      </section>

      {/* Core Actions Navigation (If in-app trigger provided) */}
      {onNavigate && (
        <section className="space-y-3">
          <h4 className="font-bold text-xs text-white/40 border-b border-white/5 pb-1 uppercase tracking-wide">Ø§Ù„Ø®Ø¯Ù…Ø§Øª Ø§Ù„Ø³Ø±ÙŠØ¹Ø© Ø¨Ø§Ù„Ù…ÙˆÙ‚Ø¹</h4>
          {actions.map((act, idx) => (
            <button
              id={`qr_action_${idx}`}
              key={idx}
              onClick={act.onClick}
              className="w-full p-4 bg-brand-blue/10 hover:bg-brand-blue/20 rounded-xl border border-brand-blue/30 text-right flex items-center justify-between transition-all hover:scale-[1.01] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                {act.icon}
                <div>
                  <h4 className="font-bold text-sm text-white">{act.titleAr}</h4>
                  <p className="text-[10px] text-white/55 font-mono leading-none">{act.titleEn}</p>
                </div>
              </div>
              <span className="text-white/40 font-mono text-xs font-bold font-sans">Ø§ÙØªØ­ â”€â”€</span>
            </button>
          ))}
        </section>
      )}

      {/* Socials & Channels Block */}
      <section className="space-y-3">
        <h4 className="font-bold text-xs text-white/40 border-b border-white/5 pb-1 uppercase tracking-wide">Ù‚Ù†ÙˆØ§Øª Ø§Ù„Ø§ØªØµØ§Ù„ ÙˆØ§Ù„Ø·Ù„Ø¨ Ø§Ù„ÙÙˆØ±ÙŠ</h4>
        
        <div className="space-y-2.5">
          {externalLinks.map((lnk, idx) => (
            <a
              id={`qr_exlink_${idx}`}
              key={idx}
              href={lnk.url}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              className={`w-full p-4 rounded-xl border border-white/10 text-right flex items-center justify-between transition-colors hover:border-brand-gold/60 ${lnk.color}`}
            >
              <div className="flex items-center gap-3">
                {lnk.icon}
                <span className="font-bold text-xs sm:text-sm text-white">{lnk.name}</span>
              </div>
              <ExternalLink className="w-4 h-4 text-white/20 shrink-0" />
            </a>
          ))}
        </div>
      </section>

      {/* Social networks layout */}
      <section className="space-y-3">
        <h4 className="font-bold text-xs text-white/40 border-b border-white/5 pb-1 uppercase tracking-wide">ØªØ§Ø¨Ø¹ÙˆÙ†Ø§ Ø¹Ù„Ù‰ Ù…ÙˆØ§Ù‚Ø¹ Ø§Ù„ØªÙˆØ§ØµÙ„ Ø§Ù„Ø§Ø¬ØªÙ…Ø§Ø¹ÙŠ</h4>
        <div className="grid grid-cols-3 gap-3">
          {socials.map((s, idx) => (
            <a
              key={idx}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              className="bg-brand-cool/30 border border-white/10 hover:border-brand-gold/50 p-3 rounded-xl flex flex-col items-center justify-center text-center gap-1.5 text-xs font-semibold text-white/80 transition-all hover:scale-105"
            >
              {s.icon}
              <span className="text-[11px] leading-tight">{s.name}</span>
            </a>
          ))}
        </div>
      </section>

      {/* Simple Go Home widget */}
      {onNavigate && (
        <div className="text-center pt-4">
          <button
            onClick={() => onNavigate("home")}
            className="px-6 py-2 bg-brand-cool text-white hover:text-brand-gold text-xs font-bold rounded-xl border border-white/10 transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„ØµÙØ­Ø© Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©</span>
          </button>
        </div>
      )}
    </div>
  );
}

