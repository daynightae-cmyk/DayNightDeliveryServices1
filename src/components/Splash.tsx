import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

interface SplashProps {
  onComplete?: () => void;
}

export default function Splash({ onComplete }: SplashProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, 2400);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-brand-deep via-brand-cool to-brand-deep flex items-center justify-center overflow-hidden">
      {/* Animated background gradient circles */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-brand-gold/5 rounded-full blur-3xl animate-pulse" />

      {/* Main splash content */}
      <div className="relative z-10 text-center px-6">
        {/* Logo container with glow effect */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            {/* Outer glow ring */}
            <div className="absolute inset-0 bg-gradient-to-r from-brand-gold/20 to-blue-500/20 rounded-2xl blur-2xl animate-pulse" />

            {/* Main logo box */}
            <div className="relative w-24 h-24 bg-gradient-to-br from-brand-gold to-brand-gold/60 rounded-2xl flex items-center justify-center shadow-2xl">
              <Zap className="w-12 h-12 text-brand-deep animate-bounce" style={{ animationDuration: "1.5s" }} />
            </div>
          </div>
        </div>

        {/* Company name */}
        <div className="mb-6">
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2 animate-fade-in">
            DAY NIGHT
          </h1>
          <p className="text-lg md:text-xl text-brand-gold font-bold animate-fade-in" style={{ animationDelay: "0.2s" }}>
            DELIVERY SERVICES
          </p>
        </div>

        {/* Tagline */}
        <p className="text-white/70 text-sm md:text-base mb-8 max-w-xs mx-auto animate-fade-in" style={{ animationDelay: "0.4s" }}>
          Fast • Reliable • Professional
        </p>

        {/* Loading bar */}
        <div className="w-32 h-1 bg-white/10 rounded-full mx-auto overflow-hidden">
          <div className="h-full bg-gradient-to-r from-transparent via-brand-gold to-transparent animate-loading-bar" />
        </div>
      </div>

      <style>{`
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

        .animate-loading-bar {
          animation: loading-bar 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
