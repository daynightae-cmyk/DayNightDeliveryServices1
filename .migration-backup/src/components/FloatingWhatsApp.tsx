import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { MessageCircle, X, Phone, ExternalLink } from "lucide-react";
import companyMeta from "../data/companyMeta";
import { useAppContext } from "../lib/AppContext";
import { translations } from "../data/translations";

export default function FloatingWhatsApp() {
  const [open, setOpen] = useState(false);
  const { language } = useAppContext();
  const t = translations[language];
  const isArabic = language === "ar";

  return (
    <div
      className={`fixed bottom-6 z-50 flex flex-col items-end gap-3 ${
        isArabic ? "left-6" : "right-6"
      }`}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.92 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="glass-strong rounded-2xl p-5 w-72 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`flex items-center gap-2 ${isArabic ? "flex-row-reverse" : ""}`}>
                <div className="w-9 h-9 rounded-xl bg-[#25D366]/15 border border-[#25D366]/30 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-[#25D366]" />
                </div>
                <div className={isArabic ? "text-right" : "text-left"}>
                  <p className="text-white text-xs font-bold leading-none">DAY NIGHT</p>
                  <p className="text-white/50 text-[10px] mt-0.5">
                    {isArabic ? "متاح الآن" : "Available now"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
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

      {/* Main FAB */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl"
        style={{
          background: "linear-gradient(135deg, #128C7E 0%, #25D366 100%)",
          boxShadow: "0 4px 20px rgba(37,211,102,0.40)",
        }}
      >
        {/* Pulse ring */}
        {!open && (
          <span className="absolute inset-0 rounded-2xl bg-[#25D366]/40 pulse-ring" />
        )}
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <X className="w-6 h-6 text-white" />
            </motion.div>
          ) : (
            <motion.div key="msg" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <MessageCircle className="w-6 h-6 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
