import { Code2, ExternalLink, MessageCircle, Sparkles } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAppContext } from "../lib/AppContext";

const DEVELOPER_NAME = "Eng. Sadek Elgazar";
const DEVELOPER_WHATSAPP = "971503281920";

function sourceLabel(pathname: string, isArabic: boolean) {
  if (/^\/merchant(?:\/|$)/i.test(pathname)) {
    return isArabic ? "بوابة التاجر في DAY NIGHT" : "DAY NIGHT Merchant Portal";
  }
  if (/^\/driver(?:\/|$)/i.test(pathname)) {
    return isArabic ? "تطبيق/بوابة المندوب في DAY NIGHT" : "DAY NIGHT Driver App / Portal";
  }
  return isArabic ? "موقع DAY NIGHT" : "DAY NIGHT website";
}

function leadMessage(pathname: string, isArabic: boolean) {
  const source = sourceLabel(pathname, isArabic);

  if (isArabic) {
    return [
      "مرحبًا م. صادق الجزار،",
      "",
      `شاهدت أحد الأنظمة التي قمت بتطويرها عبر ${source} وأعجبني مستوى التصميم والتطوير.`,
      "لدي مشروع وأرغب في مناقشة تطوير موقع / تطبيق / نظام إدارة / متجر إلكتروني / نظام مخصص أو حل بالذكاء الاصطناعي.",
      "",
      "أرغب في معرفة أفضل طريقة للبدء ومناقشة المتطلبات والمدة والتكلفة.",
      "",
      "شكرًا لك.",
      "تم التواصل من خلال أحد منتجات Eng. Sadek Elgazar.",
    ].join("\n");
  }

  return [
    "Hello Eng. Sadek Elgazar,",
    "",
    `I came across one of the systems you developed through the ${source} and I liked the quality of the design and engineering.`,
    "I would like to discuss a website, mobile app, business management system, e-commerce platform, custom software, or AI solution.",
    "",
    "Please let me know the best way to start and discuss the requirements, timeline, and cost.",
    "",
    "Thank you.",
    "Sent via an Eng. Sadek Elgazar digital product.",
  ].join("\n");
}

export default function DeveloperSignature() {
  const { language, theme } = useAppContext();
  const location = useLocation();
  const isArabic = language === "ar";
  const isLight = theme === "light";
  const pathname = location.pathname || "/";

  if (/^\/(?:admin|auth|customer|update-password)(?:\/|$)/i.test(pathname)) return null;

  const whatsappUrl = `https://wa.me/${DEVELOPER_WHATSAPP}?text=${encodeURIComponent(leadMessage(pathname, isArabic))}`;
  const contactLabel = isArabic ? "ابدأ مشروعك عبر واتساب" : "Start your project on WhatsApp";
  const ariaLabel = isArabic
    ? `تواصل مع ${DEVELOPER_NAME} عبر واتساب لطلب مشروع برمجي`
    : `Contact ${DEVELOPER_NAME} on WhatsApp about a software project`;

  return (
    <section
      className="dn-developer-signature relative z-[5] w-full px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6"
      dir={isArabic ? "rtl" : "ltr"}
      aria-label={isArabic ? "توقيع المهندس والمطور" : "Developer engineering signature"}
    >
      <div
        className={`relative mx-auto flex max-w-5xl flex-col gap-4 overflow-hidden rounded-[28px] border p-4 shadow-2xl backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between sm:p-5 ${
          isLight
            ? "border-[#B88913]/25 text-[#071A33] shadow-[0_20px_55px_rgba(25,72,122,0.14)]"
            : "border-[#D4AF37]/25 text-white shadow-[0_22px_65px_rgba(0,0,0,0.34)]"
        }`}
        style={{
          background: isLight
            ? "linear-gradient(135deg, rgba(255,255,255,.92), rgba(236,246,255,.82) 55%, rgba(255,247,218,.72))"
            : "linear-gradient(135deg, rgba(5,24,47,.94), rgba(8,42,78,.88) 58%, rgba(62,49,9,.72))",
        }}
      >
        <div className="pointer-events-none absolute -start-12 -top-16 h-40 w-40 rounded-full bg-[#168FCE]/15 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-16 -end-10 h-40 w-40 rounded-full bg-[#D4AF37]/15 blur-3xl" aria-hidden="true" />

        <div className="relative flex min-w-0 items-center gap-3.5">
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${isLight ? "border-[#0A67C7]/15 bg-[#071A33] text-[#F1C846]" : "border-[#D4AF37]/25 bg-white/[0.06] text-[#F1C846]"}`}>
            <Code2 className="h-5 w-5" />
          </span>

          <div className="min-w-0">
            <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.19em] ${isLight ? "text-[#40607F]" : "text-white/45"}`}>
              <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
              {isArabic ? "الهندسة والتطوير الرقمي" : "DESIGNED & ENGINEERED BY"}
            </span>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={ariaLabel}
              className="group mt-1 inline-flex max-w-full items-center gap-2 rounded-lg font-black text-[#B88913] outline-none transition duration-200 hover:-translate-y-0.5 hover:text-[#D4AF37] focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent sm:text-lg"
            >
              <span className="truncate">{DEVELOPER_NAME}</span>
              <ExternalLink className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>

            <p className={`mt-1 text-[10px] font-bold tracking-wide sm:text-[11px] ${isLight ? "text-[#526F89]" : "text-white/45"}`} dir="ltr">
              Web • Mobile • Business Systems • AI Solutions
            </p>
          </div>
        </div>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={ariaLabel}
          className={`relative inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-black outline-none transition duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
            isLight
              ? "border-[#B88913]/30 bg-[#071A33] text-white hover:border-[#D4AF37]/60 hover:bg-[#0A2442]"
              : "border-[#D4AF37]/35 bg-[#D4AF37]/12 text-[#F4D15D] hover:border-[#D4AF37]/65 hover:bg-[#D4AF37]/18"
          }`}
        >
          <MessageCircle className="h-4 w-4 text-[#25D366]" />
          {contactLabel}
        </a>
      </div>
    </section>
  );
}
