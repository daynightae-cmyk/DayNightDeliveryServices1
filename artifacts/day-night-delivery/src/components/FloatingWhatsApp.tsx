import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { MessageCircle, X, Phone, ExternalLink } from "lucide-react";
import companyMeta from "../data/companyMeta";
import { useAppContext } from "../lib/AppContext";
import { useLocation } from "react-router-dom";

const HIDDEN_ON = ["/admin", "/driver", "/customer", "/auth"];

export default function FloatingWhatsApp() {
  const [open, setOpen] = useState(false);
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const location = useLocation();

  if (HIDDEN_ON.some((r) => location.pathname.startsWith(r))) return null;

  return (
    <div
      className="hidden md:flex fixed flex-col items-start gap-3"
      style={{ left: 24, bottom: 28, zIndex: 70 }}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.92, originX: 0 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.92 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="glass-strong rounded-2xl p-5 w-68 max-w-[calc(100vw-2rem)] shadow-2xl border border-[#25D366]/20"
            dir={isArabic ? "rtl" : "ltr"}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`flex items-center gap-2 ${isArabic ? "flex-row-reverse" : ""}`}>
                <div className="w-9 h-9 rounded-xl bg-[#25D366]/15 border border-[#25D366]/30 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-5 h-5 text-[#25D366]" />
                </div>
                <div className={isArabic ? "text-right" : "text-left"}>
                  <p className="text-white text-xs font-bold leading-none">DAY NIGHT</p>
                  <p className="text-white/50 text-[10px] mt-0.5">
                    {isArabic ? "متاح الآن • 24/7" : "Available now • 24/7"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className={`text-white/70 text-xs mb-4 leading-relaxed ${isArabic ? "text-right" : "text-left"}`}>
              {isArabic
                ? "تواصل معنا عبر واتساب للاستفسار عن الأسعار والخدمات أو لطلب التوصيل."
                : "Chat with us on WhatsApp for pricing, services, or to book a delivery."}
            </p>

            <div className="flex flex-col gap-2">
              <a
                href={companyMeta.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{isArabic ? "تواصل عبر واتساب" : "Chat on WhatsApp"}</span>
              </a>
              <a
                href={companyMeta.whatsappCatalog}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold bg-amber-500/10 border border-amber-400/25 text-amber-400 hover:bg-amber-500/20 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{isArabic ? "عرض الكتالوج" : "View Catalog"}</span>
              </a>
              <a
                href={`tel:${companyMeta.phone}`}
                className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                dir="ltr"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{companyMeta.phone}</span>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        id="whatsapp_widget_trigger"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        aria-label="WhatsApp"
        className="relative rounded-2xl flex items-center justify-center shadow-2xl"
        style={{
          width: 56,
          height: 56,
          background: "linear-gradient(135deg, #128C7E 0%, #25D366 100%)",
          boxShadow: "0 14px 34px rgba(37,211,102,0.42)",
        }}
      >
        {!open && (
          <span
            className="absolute inset-0 rounded-2xl"
            style={{ animation: "waPulse 2.5s ease-in-out infinite", background: "rgba(37,211,102,0.35)" }}
          />
        )}
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.18 }}>
              <X className="w-6 h-6 text-white" />
            </motion.div>
          ) : (
            <motion.div key="msg" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.18 }}>
              <MessageCircle className="w-6 h-6 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      <style>{`
        @keyframes waPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.35); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
