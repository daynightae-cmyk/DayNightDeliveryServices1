import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Truck } from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import { translations } from "../data/translations";

interface SplashProps {
  onComplete?: () => void;
}

const LOGO_IMAGE_URL = "https://i.postimg.cc/tC3sSs24/178129358239a5-modified.png";
const SESSION_KEY = "dn_splash_shown";

export default function Splash({ onComplete }: SplashProps) {
  const { language, theme } = useAppContext();
  const t = translations[language];
  const [show, setShow] = useState(false);
  const [progress, setProgress] = useState(0);
  const isLight = theme === "light";

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem(SESSION_KEY);
    if (alreadyShown) {
      onComplete?.();
      return;
    }
    setShow(true);
  }, [onComplete]);

  useEffect(() => {
    if (!show) return;

    const duration = 3000;
    const start = performance.now();
    let raf: number;

    const tick = (now: number) => {
      const elapsed = now - start;
      const next = Math.min((elapsed / duration) * 100, 100);
      setProgress(next);
      if (elapsed < duration) {
        raf = requestAnimationFrame(tick);
      } else {
        completeSplash();
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [show]);

  function completeSplash() {
    try {
      sessionStorage.setItem(SESSION_KEY, "true");
    } catch {
      // ignore
    }
    setShow(false);
    setTimeout(() => onComplete?.(), 500);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden ${
            isLight
              ? "bg-gradient-to-br from-[#E8F0FE] via-[#DDE7F5] to-[#E4EDF8]"
              : "bg-gradient-to-br from-brand-deep via-brand-cool to-brand-deep"
          }`}
        >
          {/* Animated background glows */}
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.25, 0.15] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute top-0 left-0 w-96 h-96 rounded-full blur-3xl ${
              isLight ? "bg-brand-blue/20" : "bg-sky-400/10"
            }`}
          />
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.2, 0.1] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute bottom-0 right-0 w-[32rem] h-[32rem] rounded-full blur-3xl ${
              isLight ? "bg-brand-gold/20" : "bg-brand-gold/10"
            }`}
          />

          {/* Glass frame */}
          <div
            className={`absolute inset-6 sm:inset-10 rounded-[36px] border ${
              isLight ? "border-brand-gold/20" : "border-brand-gold/10"
            }`}
          />

          {/* Skip button */}
          <button
            onClick={completeSplash}
            className={`absolute top-6 ${
              language === "ar" ? "left-6" : "right-6"
            } z-20 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all backdrop-blur-md border ${
              isLight
                ? "bg-white/60 text-brand-deep border-brand-deep/10 hover:bg-white/80 hover:border-brand-gold/50"
                : "bg-white/5 text-white/60 border-white/10 hover:text-brand-gold hover:border-brand-gold/30"
            }`}
          >
            {t.splash.skip}
          </button>

          {/* Main content */}
          <div className="relative z-10 text-center px-6 max-w-lg">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="mb-8 flex justify-center"
            >
              <div className="relative">
                <div
                  className={`absolute inset-0 rounded-3xl blur-2xl animate-pulse ${
                    isLight ? "bg-brand-gold/30" : "bg-gradient-to-r from-brand-gold/30 to-sky-400/20"
                  }`}
                />
                <div
                  className={`relative w-28 h-28 backdrop-blur-2xl rounded-3xl flex items-center justify-center shadow-2xl overflow-hidden border ${
                    isLight ? "bg-white/70 border-brand-gold/30" : "bg-white/5 border-brand-gold/30"
                  }`}
                >
                  <img
                    src={LOGO_IMAGE_URL}
                    alt="DAY NIGHT DELIVERY SERVICES"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover opacity-80"
                  />
                  <div className={`absolute inset-0 ${isLight ? "bg-brand-deep/10" : "bg-brand-deep/20"}`} />
                  <Truck className="relative w-11 h-11 text-brand-gold drop-shadow-[0_0_16px_rgba(212,175,55,0.9)]" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mb-6"
            >
              <h1
                className={`text-3xl md:text-5xl font-black tracking-tight mb-3 ${
                  isLight ? "text-brand-deep" : "text-white"
                }`}
              >
                {t.splash.title}
              </h1>
              <p className="text-lg md:text-2xl text-brand-gold font-extrabold">
                {t.splash.subtitle}
              </p>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className={`text-sm md:text-base mb-8 max-w-xs mx-auto ${
                isLight ? "text-brand-deep/70" : "text-white/70"
              }`}
            >
              {t.splash.tagline}
            </motion.p>

            {/* Progress bar */}
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className={`w-44 h-1 rounded-full mx-auto overflow-hidden border ${
                isLight ? "bg-brand-deep/10 border-brand-deep/10" : "bg-white/10 border-white/10"
              }`}
            >
              <motion.div
                className="h-full bg-gradient-to-r from-transparent via-brand-gold to-transparent"
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1, ease: "linear" }}
              />
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className={`mt-3 text-[10px] uppercase tracking-widest font-medium ${
                isLight ? "text-brand-deep/40" : "text-white/40"
              }`}
            >
              {t.splash.loading}
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
