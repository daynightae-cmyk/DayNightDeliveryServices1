import { useState, useCallback } from "react";
import {
  QrCode,
  Download,
  Copy,
  Check,
  MessageSquare,
  Truck,
  Phone,
  Globe,
  Search,
  FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../lib/AppContext";
import companyMeta from "../data/companyMeta";
import {
  buildTrackingQrUrl,
  buildWhatsappSupportQrUrl,
  buildRequestDeliveryQrUrl,
  buildContactQrUrl,
  buildWebsiteQrUrl,
  downloadQr,
  downloadQrAsPdf,
  copyToClipboard,
} from "../lib/qrGenerator";

interface QRProps {
  onNavigate?: (tab: string) => void;
}

interface QrCardDef {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  titleEn: string;
  titleAr: string;
  subtitleEn: string;
  subtitleAr: string;
  url: string;
  dataUrl: string;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handle}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
        copied
          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
          : "bg-white/5 border-white/10 text-white/70 hover:border-brand-gold/40 hover:text-brand-gold"
      }`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy Link"}
    </button>
  );
}

function QrCardItem({ card, language }: { card: QrCardDef; language: string }) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const isAr = language === "ar";
  const title = isAr ? card.titleAr : card.titleEn;
  const subtitle = isAr ? card.subtitleAr : card.subtitleEn;

  const handlePdf = async () => {
    setPdfLoading(true);
    try {
      await downloadQrAsPdf(card.url, title, subtitle);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div
      id={`qr-card-${card.id}`}
      className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent backdrop-blur-sm overflow-hidden hover:border-brand-gold/30 transition-all duration-300"
    >
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-brand-gold to-transparent opacity-70" />
      <div className="p-5 flex flex-col items-center text-center space-y-4">
        <div className="flex items-center gap-2">
          <card.icon className={`w-5 h-5 ${card.iconColor}`} />
          <h3 className="text-sm font-bold text-white">{title}</h3>
        </div>

        <div className="bg-white rounded-xl p-3 shadow-lg">
          <img
            src={card.url}
            alt={title}
            className="w-36 h-36 sm:w-40 sm:h-40 object-contain"
            loading="lazy"
          />
        </div>

        <p className="text-xs text-white/50 leading-relaxed min-h-[2.5rem]">{subtitle}</p>

        <div className="flex flex-wrap gap-2 justify-center w-full">
          <button
            id={`download-qr-${card.id}`}
            onClick={() => downloadQr(card.url, `daynight-${card.id}.png`)}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-gold/10 border border-brand-gold/25 text-brand-gold rounded-xl text-xs font-bold hover:bg-brand-gold/20 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            PNG
          </button>
          <button
            onClick={handlePdf}
            disabled={pdfLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-gold/10 border border-brand-gold/25 text-brand-gold rounded-xl text-xs font-bold hover:bg-brand-gold/20 transition-colors disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5" />
            {pdfLoading ? "…" : "PDF"}
          </button>
          <CopyBtn text={card.dataUrl} />
        </div>
      </div>
    </div>
  );
}

export default function QR({ onNavigate }: QRProps) {
  const { language, theme } = useAppContext();
  const navigate = useNavigate();
  const isAr = language === "ar";
  const isLight = theme === "light";

  const [trackingCode, setTrackingCode] = useState("");
  const [trackingPdfLoading, setTrackingPdfLoading] = useState(false);

  const trimmed = trackingCode.trim();
  const trackingQrUrl = trimmed ? buildTrackingQrUrl(trimmed) : "";

  const handleTrackNow = useCallback(() => {
    if (trimmed) {
      navigate(`/tracking?code=${encodeURIComponent(trimmed)}`);
      onNavigate?.("tracking");
    }
  }, [trimmed, navigate, onNavigate]);

  const handleTrackingPdf = async () => {
    if (!trackingQrUrl) return;
    setTrackingPdfLoading(true);
    try {
      await downloadQrAsPdf(trackingQrUrl, "Tracking QR", `Code: ${trimmed}`);
    } finally {
      setTrackingPdfLoading(false);
    }
  };

  const fixedCards: QrCardDef[] = [
    {
      id: "whatsapp",
      icon: MessageSquare,
      iconColor: "text-[#25D366]",
      titleEn: "WhatsApp Support",
      titleAr: "واتساب الدعم",
      subtitleEn: "Scan to open WhatsApp chat with our support team",
      subtitleAr: "امسح للتحدث مع فريق الدعم عبر واتساب",
      url: buildWhatsappSupportQrUrl(),
      dataUrl: "https://wa.me/971568757331",
    },
    {
      id: "request",
      icon: Truck,
      iconColor: "text-brand-gold",
      titleEn: "Request Delivery",
      titleAr: "طلب توصيل",
      subtitleEn: "Scan to open the delivery request form",
      subtitleAr: "امسح لفتح نموذج طلب التوصيل",
      url: buildRequestDeliveryQrUrl(),
      dataUrl: "https://daynightae.com/request",
    },
    {
      id: "contact",
      icon: Phone,
      iconColor: "text-brand-gold",
      titleEn: "Company Contact",
      titleAr: "بيانات التواصل",
      subtitleEn: "Scan to save our contact info to your phone",
      subtitleAr: "امسح لحفظ بياناتنا في هاتفك",
      url: buildContactQrUrl(),
      dataUrl: `${companyMeta.website}`,
    },
    {
      id: "website",
      icon: Globe,
      iconColor: "text-brand-gold",
      titleEn: "Official Website",
      titleAr: "الموقع الرسمي",
      subtitleEn: "Scan to open daynightae.com",
      subtitleAr: "امسح لفتح الموقع الرسمي",
      url: buildWebsiteQrUrl(),
      dataUrl: "https://daynightae.com",
    },
  ];

  const cardBase = isLight
    ? "bg-brand-deep/5 border-brand-deep/10"
    : "bg-white/3 border-white/10";

  return (
    <div className="space-y-10 pb-8" dir={isAr ? "rtl" : "ltr"}>
      {/* ── Hero ── */}
      <div className="text-center space-y-3 pt-2">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-gold/30 bg-brand-gold/10 text-brand-gold text-xs font-bold tracking-wider uppercase">
          <QrCode className="w-3.5 h-3.5" />
          {isAr ? "خدمات QR الذكية" : "Smart QR Services"}
        </div>
        <h1
          className={`text-3xl sm:text-4xl font-black tracking-tight ${
            isLight ? "text-brand-deep" : "text-white"
          }`}
        >
          {isAr ? (
            <>
              خدمات <span className="text-brand-gold">داي نايت</span> عبر QR
            </>
          ) : (
            <>
              DAY NIGHT <span className="text-brand-gold">QR</span> SERVICES
            </>
          )}
        </h1>
        <p
          className={`text-sm max-w-xl mx-auto leading-relaxed ${
            isLight ? "text-brand-deep/65" : "text-white/55"
          }`}
        >
          {isAr
            ? "ولّد رمز QR لتتبع شحنتك أو شارك روابطنا الرسمية — قابل للتحميل PNG أو PDF مع هوية داي نايت."
            : "Generate a tracking QR or share our official links — download as PNG or branded PDF."}
        </p>
      </div>

      {/* ── Tracking QR Generator ── */}
      <div
        className={`relative rounded-2xl border overflow-hidden ${
          isLight
            ? "border-brand-gold/30 bg-brand-gold/5"
            : "border-brand-gold/20 bg-gradient-to-b from-brand-gold/8 to-transparent"
        }`}
      >
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-brand-gold to-transparent" />
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-brand-gold" />
            <h2
              className={`text-base font-bold ${
                isLight ? "text-brand-deep" : "text-white"
              }`}
            >
              {isAr ? "ولّد QR لتتبع شحنتك" : "Generate Tracking QR"}
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTrackNow()}
              placeholder={
                isAr
                  ? "أدخل رقم التتبع مثل: DN-2026-XXXXX"
                  : "Enter tracking code e.g. DN-2026-XXXXX"
              }
              id="tracking-qr-input"
              className={`flex-1 px-4 py-3 rounded-xl border text-sm font-mono transition-colors focus:outline-none focus:border-brand-gold ${
                isLight
                  ? "bg-white border-brand-deep/20 text-brand-deep placeholder-brand-deep/35"
                  : "bg-white/5 border-white/15 text-white placeholder-white/25"
              }`}
            />
            <button
              onClick={handleTrackNow}
              disabled={!trimmed}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-brand-gold text-brand-deep font-bold rounded-xl text-sm hover:bg-yellow-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Search className="w-4 h-4" />
              {isAr ? "تتبع الآن" : "Track Now"}
            </button>
          </div>

          {trackingQrUrl ? (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="bg-white rounded-xl p-3 shadow-lg shrink-0">
                <img
                  src={trackingQrUrl}
                  alt="Tracking QR"
                  id="tracking-qr-image"
                  className="w-40 h-40 object-contain"
                  loading="lazy"
                />
              </div>
              <div className="flex flex-col gap-3 w-full">
                <p
                  className={`text-xs font-mono ${
                    isLight ? "text-brand-deep/55" : "text-white/45"
                  }`}
                >
                  {isAr ? "رقم التتبع: " : "Code: "}
                  <span className="text-brand-gold font-bold">{trimmed}</span>
                </p>
                <p
                  className={`text-xs ${
                    isLight ? "text-brand-deep/45" : "text-white/35"
                  }`}
                >
                  {isAr
                    ? "يفتح صفحة التتبع مباشرة برقم الشحنة"
                    : "Opens tracking page directly with your shipment code"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    id="download-tracking-qr-png"
                    onClick={() =>
                      downloadQr(trackingQrUrl, `daynight-tracking-${trimmed}.png`)
                    }
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-gold/10 border border-brand-gold/30 text-brand-gold rounded-xl text-xs font-bold hover:bg-brand-gold/20 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {isAr ? "تحميل PNG" : "Download PNG"}
                  </button>
                  <button
                    id="download-tracking-qr-pdf"
                    onClick={handleTrackingPdf}
                    disabled={trackingPdfLoading}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-gold/10 border border-brand-gold/30 text-brand-gold rounded-xl text-xs font-bold hover:bg-brand-gold/20 transition-colors disabled:opacity-50"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {trackingPdfLoading
                      ? "…"
                      : isAr
                      ? "تحميل PDF"
                      : "Download PDF"}
                  </button>
                  <CopyBtn
                    text={`https://daynightae.com/tracking?code=${trimmed}`}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div
              className={`flex items-center justify-center h-16 rounded-xl border-2 border-dashed text-sm ${
                isLight
                  ? "border-brand-deep/12 text-brand-deep/25"
                  : "border-white/8 text-white/18"
              }`}
            >
              {isAr
                ? "أدخل رقم التتبع لتوليد رمز QR"
                : "Enter a tracking code above to generate QR"}
            </div>
          )}
        </div>
      </div>

      {/* ── Fixed QR Cards ── */}
      <div className="space-y-4">
        <h2
          className={`text-lg font-bold ${
            isLight ? "text-brand-deep" : "text-white"
          }`}
        >
          {isAr ? "بطاقات QR الجاهزة" : "Ready-to-Use QR Cards"}
        </h2>
        <div
          id="qr-cards-grid"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
        >
          {fixedCards.map((card) => (
            <QrCardItem key={card.id} card={card} language={language} />
          ))}
        </div>
      </div>

      {/* ── Brand footer strip ── */}
      <div
        className={`rounded-2xl border p-5 flex flex-col sm:flex-row items-center justify-between gap-4 ${cardBase}`}
      >
        <div className="flex items-center gap-3">
          <img
            src={companyMeta.logoUrl}
            alt={companyMeta.name}
            className="h-9 object-contain"
            loading="lazy"
          />
          <div>
            <p
              className={`text-xs font-black tracking-wide ${
                isLight ? "text-brand-deep" : "text-white"
              }`}
            >
              {companyMeta.name}
            </p>
            <p className="text-xs text-brand-gold">{companyMeta.displayWebsite}</p>
          </div>
        </div>
        <div
          className={`text-xs text-center sm:text-right space-y-0.5 ${
            isLight ? "text-brand-deep/55" : "text-white/45"
          }`}
        >
          <p>{companyMeta.phone}</p>
          <p>{companyMeta.email}</p>
        </div>
      </div>
    </div>
  );
}
