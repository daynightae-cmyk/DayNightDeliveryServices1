import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAppContext } from "../lib/AppContext";
import { translations } from "../data/translations";
import companyMeta from "../data/companyMeta";

const LOGO_IMAGE_URL = companyMeta.logoUrl;

interface SplashProps {
  onComplete?: () => void;
}

export default function Splash({ onComplete }: SplashProps) {
  const { language, theme } = useAppContext();
  const t = translations[language];
  const [progress, setProgress] = useState(0);
  const [show, setShow] = useState(true);
  const isLight = theme === "light";

  const particles = useMemo(() =>
    Array.from({ length: 22 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1.5,
      dur: Math.random() * 3 + 2.5,
      delay: Math.random() * 2.5,
      dy: -(Math.random() * 30 + 10),
    })), []
  );

  useEffect(() => {
    const duration = 3600;
    const start = performance.now();
    let raf: number;

    const tick = (now: number) => {
      const elapsed = now - start;
      const next = Math.min((elapsed / duration) * 100, 100);
      setProgress(next);
      if (elapsed < duration) {
        raf = requestAnimationFrame(tick);
      } else {
        handleExit();
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  function handleExit() {
    setShow(false);
    setTimeout(() => onComplete?.(), 650);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.65, ease: "easeInOut" }}
          className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden select-none ${
            isLight
              ? "bg-gradient-to-br from-[#D4E4FA] via-[#EAF3FF] to-[#F0F8FF]"
              : "bg-gradient-to-br from-[#030C1A] via-[#071A33] to-[#040F22]"
          }`}
        >
          {/* Floating gold particles */}
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className={`absolute rounded-full pointer-events-none ${
                isLight ? "bg-brand-gold/50" : "bg-brand-gold/60"
              }`}
              style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
              animate={{ opacity: [0, 0.9, 0], y: [0, p.dy, p.dy * 1.6], scale: [0.8, 1.4, 0.6] }}
              transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
            />
          ))}

          {/* Large ambient glow blobs */}
          <motion.div
            animate={{ scale: [1, 1.25, 1], opacity: [0.12, 0.22, 0.12] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute -top-1/4 -left-1/4 w-[70vw] h-[70vw] rounded-full blur-3xl pointer-events-none ${
              isLight ? "bg-brand-blue/20" : "bg-brand-blue/12"
            }`}
          />
          <motion.div
            animate={{ scale: [1, 1.18, 1], opacity: [0.1, 0.2, 0.1] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
            className={`absolute -bottom-1/4 -right-1/4 w-[80vw] h-[80vw] rounded-full blur-3xl pointer-events-none ${
              isLight ? "bg-brand-gold/20" : "bg-brand-gold/10"
            }`}
          />

          {/* Decorative frame */}
          <div
            className={`absolute inset-4 sm:inset-8 rounded-[36px] border pointer-events-none ${
              isLight ? "border-brand-gold/20" : "border-brand-gold/12"
            }`}
          />
          <div
            className={`absolute inset-5 sm:inset-9 rounded-[34px] border pointer-events-none ${
              isLight ? "border-white/40" : "border-white/5"
            }`}
          />

          {/* Corner accents */}
          {[
            "top-6 left-6 border-t-2 border-l-2 rounded-tl-2xl",
            "top-6 right-6 border-t-2 border-r-2 rounded-tr-2xl",
            "bottom-6 left-6 border-b-2 border-l-2 rounded-bl-2xl",
            "bottom-6 right-6 border-b-2 border-r-2 rounded-br-2xl",
          ].map((cls, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.08 }}
              className={`absolute w-8 h-8 border-brand-gold/50 pointer-events-none ${cls}`}
            />
          ))}

          {/* Skip button */}
          <motion.button
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            onClick={handleExit}
            className={`absolute top-5 ${
              language === "ar" ? "left-5" : "right-5"
            } z-20 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all backdrop-blur-lg border ${
              isLight
                ? "bg-white/60 text-[#071A33]/60 border-[#071A33]/12 hover:bg-white/80 hover:border-brand-gold/50 hover:text-[#071A33]"
                : "bg-white/5 text-white/45 border-white/10 hover:bg-white/10 hover:text-brand-gold hover:border-brand-gold/35"
            }`}
          >
            {t.splash.skip}
          </motion.button>

          {/* Main content */}
          <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-xs sm:max-w-sm">

            {/* Logo with rings */}
            <motion.div
              initial={{ opacity: 0, scale: 0.4, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.85, ease: [0.34, 1.56, 0.64, 1] }}
              className="mb-6 relative"
            >
              {/* Outer pulse ring */}
              <motion.div
                animate={{ scale: [1, 1.4, 1.8], opacity: [0.35, 0.15, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
                className="absolute inset-0 rounded-full border-2 border-brand-gold/60 pointer-events-none"
              />
              {/* Mid pulse ring */}
              <motion.div
                animate={{ scale: [1, 1.25, 1.55], opacity: [0.25, 0.12, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                className="absolute inset-0 rounded-full border border-brand-sky/50 pointer-events-none"
              />
              {/* Glow aura */}
              <motion.div
                animate={{ opacity: [0.35, 0.65, 0.35] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -inset-3 rounded-full bg-gradient-to-r from-brand-gold/25 via-brand-sky/15 to-brand-gold/25 blur-xl pointer-events-none"
              />
              {/* Logo image */}
              <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden border-2 border-brand-gold/55 shadow-2xl bg-white/5">
                <img
                  src={LOGO_IMAGE_URL}
                  alt="DAY NIGHT DELIVERY SERVICES"
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              </div>
            </motion.div>

            {/* Company name */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.38 }}
              className="mb-1.5"
            >
              <h1
                className={`text-2xl sm:text-3xl font-black tracking-tight uppercase leading-tight ${
                  isLight ? "text-[#071A33]" : "text-white"
                }`}
              >
                DAY NIGHT
              </h1>
              <p className="text-sm sm:text-base font-black tracking-[0.25em] uppercase text-brand-gold mt-0.5">
                DELIVERY SERVICES
              </p>
            </motion.div>

            {/* Divider */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="w-20 h-px bg-gradient-to-r from-transparent via-brand-gold to-transparent my-3"
            />

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.6 }}
              className={`text-xs sm:text-sm mb-7 ${
                isLight ? "text-[#071A33]/55" : "text-white/55"
              }`}
            >
              {t.splash.tagline}
            </motion.p>

            {/* Progress bar */}
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.5, delay: 0.75 }}
              className={`w-48 h-[3px] rounded-full overflow-hidden relative ${
                isLight ? "bg-[#071A33]/10" : "bg-white/10"
              }`}
            >
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-brand-gold via-brand-sky to-brand-gold"
                style={{ width: `${progress}%`, transition: "width 0.08s linear" }}
              />
              {/* Shimmer on bar */}
              <motion.div
                animate={{ x: ["-100%", "400%"] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
                className="absolute inset-0 w-1/4 bg-gradient-to-r from-transparent via-white/40 to-transparent"
              />
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className={`mt-2.5 text-[10px] uppercase tracking-widest font-medium ${
                isLight ? "text-[#071A33]/35" : "text-white/35"
              }`}
            >
              {t.splash.loading} {Math.round(progress)}%
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
