content = r"""import { useEffect, useState } from "react";

interface SplashProps {
  onComplete?: () => void;
}

const LOGO_URL = "https://i.postimg.cc/tC3sSs24/178129358239a5-modified.png";

export default function Splash({ onComplete }: SplashProps) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 600);
    const t2 = setTimeout(() => setPhase("out"), 2600);
    const t3 = setTimeout(() => onComplete?.(), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background: "linear-gradient(145deg,#040E1E 0%,#071A33 40%,#0A1C3A 70%,#0B2040 100%)",
        opacity: phase === "out" ? 0 : 1,
        transition: phase === "out" ? "opacity 0.6s ease-in-out" : "none",
        pointerEvents: phase === "out" ? "none" : "all",
      }}
    >
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-[120px] animate-pulse pointer-events-none"
        style={{ background: "rgba(0,87,184,0.08)" }} />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-[100px] pointer-events-none"
        style={{ background: "rgba(212,175,55,0.06)", animationDelay: "1s" }} />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(212,175,55,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(212,175,55,0.06) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
          opacity: 0.4,
        }}
      />

      {/* Main content */}
      <div
        className="relative z-10 text-center px-8 max-w-lg w-full"
        style={{
          opacity: phase === "in" ? 0 : 1,
          transform: phase === "in" ? "translateY(20px)" : "translateY(0)",
          transition: "opacity 0.7s ease-out, transform 0.7s ease-out",
        }}
      >
        {/* Logo with neon glow */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div
              className="absolute -inset-4 rounded-3xl blur-2xl pointer-events-none"
              style={{
                background: "radial-gradient(ellipse,rgba(212,175,55,0.35) 0%,transparent 70%)",
                animation: "splashGlow 2.5s ease-in-out infinite",
              }}
            />
            <div
              className="relative w-28 h-28 rounded-2xl overflow-hidden"
              style={{
                border: "2px solid rgba(212,175,55,0.45)",
                background: "rgba(7,26,51,0.85)",
                boxShadow: "0 0 30px rgba(212,175,55,0.25),0 0 60px rgba(212,175,55,0.1),inset 0 1px 0 rgba(255,255,255,0.1)",
              }}
            >
              <img
                src={LOGO_URL}
                alt="DAY NIGHT Logo"
                className="w-full h-full object-cover scale-110"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>

        {/* Brand name with gold gradient */}
        <div className="mb-3 space-y-1">
          <h1
            className="text-5xl md:text-6xl font-black tracking-tight leading-none"
            style={{
              background: "linear-gradient(135deg,#FFFFFF 0%,#F0E8C8 40%,#D4AF37 70%,#B8960A 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            DAY NIGHT
          </h1>
          <p
            className="text-base md:text-lg font-bold tracking-widest uppercase"
            style={{ color: "#D4AF37", letterSpacing: "0.2em" }}
          >
            DELIVERY SERVICES
          </p>
        </div>

        {/* Bilingual tagline */}
        <div className="mb-8 space-y-1.5">
          <p className="text-white/70 text-sm md:text-base font-light tracking-wide">
            Fast &bull; Reliable &bull; Every Time
          </p>
          <p className="text-white/55 text-sm font-light" dir="rtl">
            نصل إليك في كل وقت... وفي كل مكان
          </p>
        </div>

        {/* Animated gold loading bar */}
        <div className="w-48 h-px bg-white/10 rounded-full mx-auto overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              background: "linear-gradient(90deg,transparent,#D4AF37,#F5E27B,#D4AF37,transparent)",
              animation: "splashBar 2s ease-in-out infinite",
              width: "40%",
            }}
          />
        </div>

        <p className="mt-6 text-white/20 text-[10px] font-mono tracking-[0.25em] uppercase">
          UAE Certified Logistics &bull; 24/7
        </p>
      </div>

      <style>{`
        @keyframes splashGlow {
          0%,100% { opacity:0.5; transform:scale(1); }
          50%      { opacity:1;   transform:scale(1.1); }
        }
        @keyframes splashBar {
          0%   { transform:translateX(-200%); }
          100% { transform:translateX(500%); }
        }
      `}</style>
    </div>
  );
}
"""

with open("src/components/Splash.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Splash.tsx written successfully")
