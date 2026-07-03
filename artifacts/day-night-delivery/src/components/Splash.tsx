import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAppContext } from "../lib/AppContext";
import companyMeta from "../data/companyMeta";

interface SplashProps {
  onComplete?: () => void;
}

export default function Splash({ onComplete }: SplashProps) {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const duration = 1800;
    const startedAt = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const next = Math.min(100, ((now - startedAt) / duration) * 100);
      setProgress(next);
      if (next < 100) {
        raf = requestAnimationFrame(tick);
        return;
      }
      setVisible(false);
      window.setTimeout(() => onComplete?.(), 260);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onComplete]);

  const exitNow = () => {
    setVisible(false);
    window.setTimeout(() => onComplete?.(), 180);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="dn-splash fixed inset-0 z-[99999] grid place-items-center overflow-hidden bg-[#020914] text-white"
          style={{ width: "100vw", height: "100dvh" }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          role="status"
          aria-label="DAY NIGHT loading"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(24,168,232,.22),transparent_28rem),radial-gradient(circle_at_78%_30%,rgba(245,183,0,.13),transparent_24rem),linear-gradient(135deg,#020914,#061b36)]" />
          <button onClick={exitNow} className="absolute top-5 left-5 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-2 text-[11px] font-black text-brand-gold">
            {isArabic ? "دخول الموقع" : "Enter Site"}
          </button>
          <div className="relative z-10 mx-auto flex w-[min(90vw,420px)] flex-col items-center rounded-[2rem] border border-brand-gold/25 bg-[#061225]/78 p-8 text-center shadow-2xl backdrop-blur-2xl">
            <img src={companyMeta.logoUrl} alt="DAY NIGHT" className="h-28 w-28 rounded-full border-2 border-brand-gold/50 bg-white object-contain p-1 shadow-[0_0_55px_rgba(245,183,0,.22)]" draggable={false} />
            <h1 className="mt-5 text-2xl font-black tracking-tight">DAY NIGHT</h1>
            <p className="mt-1 text-sm font-black tracking-[0.25em] text-brand-gold">DELIVERY SERVICES</p>
            <p className="mt-4 text-xs font-bold text-white/62">{isArabic ? "تجهيز تجربة التوصيل الاحترافية" : "Preparing your premium delivery experience"}</p>
            <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-gold via-brand-sky to-brand-gold" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.22em] text-white/45">{Math.round(progress)}%</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
