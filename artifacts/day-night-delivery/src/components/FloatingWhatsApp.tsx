import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { MessageCircle, X, Phone, ExternalLink, ShieldCheck } from "lucide-react";
import companyMeta from "../data/companyMeta";
import { useAppContext } from "../lib/AppContext";
import { useLocation } from "react-router-dom";

const HIDDEN_ON = ["/admin", "/driver", "/customer", "/auth", "/update-password"];

export default function FloatingWhatsApp() {
  const [open, setOpen] = useState(false);
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const location = useLocation();

  if (HIDDEN_ON.some((r) => location.pathname.startsWith(r))) return null;

  return (
    <div className="dn-wa-widget fixed flex flex-col items-start gap-3" dir={isArabic ? "rtl" : "ltr"}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.92, originX: 0 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.92 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="dn-wa-panel w-[min(330px,calc(100vw-28px))] rounded-[1.6rem] border border-[#25D366]/30 bg-[#061225]/92 p-4 shadow-2xl backdrop-blur-2xl"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#25D366]/35 bg-[#25D366]/14 shadow-[0_0_30px_rgba(37,211,102,.18)]">
                  <MessageCircle className="h-5 w-5 text-[#25D366]" />
                </div>
                <div>
                  <p className="text-sm font-black leading-none text-white">DAY NIGHT</p>
                  <p className="mt-1 text-[11px] font-bold text-white/55">
                    {isArabic ? "دعم مباشر على مدار الساعة" : "Live support 24/7"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-xl text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close WhatsApp panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 rounded-2xl border border-brand-gold/20 bg-brand-gold/8 p-3">
              <p className="flex items-start gap-2 text-xs font-bold leading-6 text-white/72">
                <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-brand-gold" />
                {isArabic
                  ? "اضغط للتواصل الفوري بخصوص التتبع، الأسعار، الطلبات، أو حسابات التجار."
                  : "Tap for instant help with tracking, pricing, orders, or merchant accounts."}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <a
                href={companyMeta.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black"
              >
                <MessageCircle className="h-4 w-4" />
                <span>{isArabic ? "ابدأ المحادثة الآن" : "Start WhatsApp Chat"}</span>
              </a>
              <a
                href={companyMeta.whatsappCatalog}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-2xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-3 text-xs font-black text-brand-gold transition-colors hover:bg-brand-gold hover:text-brand-deep"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>{isArabic ? "فتح كتالوج واتساب" : "Open WhatsApp Catalog"}</span>
              </a>
              <a
                href={`tel:${companyMeta.phone}`}
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                dir="ltr"
              >
                <Phone className="h-3.5 w-3.5" />
                <span>{companyMeta.phone}</span>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        id="whatsapp_widget_trigger"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen(!open)}
        aria-label="WhatsApp support"
        className="dn-wa-trigger relative grid place-items-center overflow-hidden rounded-[1.35rem] border border-[#25D366]/40 text-white shadow-2xl"
      >
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.35),transparent_26%),linear-gradient(135deg,#128C7E,#25D366)]" />
        {!open && <span className="dn-wa-pulse absolute inset-0 rounded-[1.35rem] bg-[#25D366]/35" />}
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="x" className="relative z-10" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.18 }}>
              <X className="h-6 w-6" />
            </motion.div>
          ) : (
            <motion.div key="msg" className="relative z-10" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.18 }}>
              <MessageCircle className="h-6 w-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
