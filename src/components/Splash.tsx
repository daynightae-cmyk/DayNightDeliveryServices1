import { useEffect, useState } from "react";
import { Truck } from "lucide-react";

interface SplashProps {
  onComplete?: () => void;
}

export default function Splash({ onComplete }: SplashProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, 3200);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-brand-deep via-brand-cool to-brand-deep flex items-center justify-center overflow-hidden animate-splash-shell">
      <div className="absolute top-0 left-0 w-96 h-96 bg-sky-400/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-0 w-[32rem] h-[32rem] bg-brand-gold/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute inset-8 border border-brand-gold/10 rounded-[36px]" />

      <div className="relative z-10 text-center px-6">
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-brand-gold/30 to-sky-400/20 rounded-3xl blur-2xl animate-pulse" />
            <div className="relative w-28 h-28 bg-white/5 backdrop-blur-2xl border border-brand-gold/30 rounded-3xl flex items-center justify-center shadow-2xl overflow-hidden">
              <img
                src="https://i.postimg.cc/tC3sSs24/178129358239a5-modified.png"
                alt="DAY NIGHT DELIVERY SERVICES"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-brand-deep/20" />
              <Truck className="relative w-11 h-11 text-brand-gold drop-shadow-[0_0_16px_rgba(212,175,55,0.9)]" />
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-3 animate-fade-in">
            DAY NIGHT DELIVERY SERVICES
          </h1>
          <p className="text-lg md:text-2xl text-brand-gold font-extrabold animate-fade-in" style={{ animationDelay: "0.2s" }}>
            نصل إليك في كل وقت
          </p>
        </div>

        <p className="text-white/70 text-sm md:text-base mb-8 max-w-xs mx-auto animate-fade-in" style={{ animationDelay: "0.4s" }}>
          Fast • Reliable • Every Time
        </p>

        <div className="w-44 h-1 bg-white/10 rounded-full mx-auto overflow-hidden border border-white/10">
          <div className="h-full bg-gradient-to-r from-transparent via-brand-gold to-transparent animate-loading-bar" />
        </div>
      </div>

      <style>{`
        @keyframes splash-shell {
          0%, 82% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes loading-bar {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(400%);
          }
          100% {
            transform: translateX(500%);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.8s ease-out forwards;
        }

        .animate-splash-shell {
          animation: splash-shell 3.2s ease-in-out forwards;
        }

        .animate-loading-bar {
          animation: loading-bar 1.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
