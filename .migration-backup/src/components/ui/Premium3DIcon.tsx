import { type LucideIcon } from "lucide-react";
import { useAppContext } from "../../lib/AppContext";

type IconColor = "gold" | "blue" | "sky" | "green" | "white";

interface Premium3DIconProps {
  icon: LucideIcon;
  size?: "sm" | "md" | "lg" | "xl";
  color?: IconColor;
  className?: string;
  animate?: boolean;
}

const colorMap: Record<IconColor, { bg: string; icon: string; glow: string; border: string }> = {
  gold:  { bg: "from-amber-500/20 to-yellow-600/10", icon: "text-amber-400", glow: "shadow-amber-500/25", border: "border-amber-400/25" },
  blue:  { bg: "from-blue-500/20 to-blue-700/10",   icon: "text-blue-400",  glow: "shadow-blue-500/25",  border: "border-blue-400/25" },
  sky:   { bg: "from-sky-400/20 to-cyan-600/10",    icon: "text-sky-400",   glow: "shadow-sky-400/25",   border: "border-sky-400/25" },
  green: { bg: "from-emerald-500/20 to-green-700/10", icon: "text-emerald-400", glow: "shadow-emerald-500/25", border: "border-emerald-400/25" },
  white: { bg: "from-white/15 to-white/5",          icon: "text-white",     glow: "shadow-white/10",     border: "border-white/20" },
};

const sizeMap = {
  sm: { outer: "w-10 h-10 rounded-xl", icon: "w-5 h-5" },
  md: { outer: "w-14 h-14 rounded-2xl", icon: "w-7 h-7" },
  lg: { outer: "w-18 h-18 rounded-2xl", icon: "w-9 h-9" },
  xl: { outer: "w-24 h-24 rounded-3xl", icon: "w-12 h-12" },
};

export default function Premium3DIcon({
  icon: Icon,
  size = "md",
  color = "gold",
  className = "",
  animate = false,
}: Premium3DIconProps) {
  const { theme } = useAppContext();
  const isLight = theme === "light";
  const c = colorMap[color];
  const s = sizeMap[size];

  return (
    <div
      className={`
        ${s.outer} ${className}
        relative flex items-center justify-center shrink-0
        bg-gradient-to-br ${c.bg}
        border ${c.border}
        backdrop-filter backdrop-blur-sm
        shadow-lg ${c.glow}
        ${animate ? "hover:-translate-y-1 hover:scale-105" : ""}
        transition-all duration-300
        ${isLight ? "shadow-sm" : ""}
      `}
      style={{
        background: isLight
          ? `linear-gradient(135deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.45) 100%)`
          : undefined,
        boxShadow: isLight
          ? `0 4px 16px rgba(7,26,51,0.10), inset 0 1px 0 rgba(255,255,255,0.8)`
          : `0 4px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.2)`,
      }}
    >
      {/* Top highlight edge */}
      <div
        className="absolute inset-x-0 top-0 h-[1px] rounded-t-[inherit]"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
        }}
      />
      {/* Icon */}
      <Icon className={`${s.icon} ${c.icon} relative z-10 drop-shadow-sm`} />
    </div>
  );
}

/* ---------------------------------------------------------------
   ServiceIconCard — for service grids
   --------------------------------------------------------------- */
interface ServiceIconCardProps {
  icon: LucideIcon;
  title: string;
  titleAr?: string;
  desc: string;
  descAr?: string;
  color?: IconColor;
  delay?: number;
}

export function ServiceIconCard({
  icon,
  title,
  titleAr,
  desc,
  descAr,
  color = "gold",
  delay = 0,
}: ServiceIconCardProps) {
  const { language, theme } = useAppContext();
  const isArabic = language === "ar";
  const isLight = theme === "light";

  return (
    <div
      className={`
        glass glass-hover card-shine
        p-6 flex flex-col gap-4
        ${isArabic ? "text-right" : "text-left"}
      `}
      style={{ animationDelay: `${delay}ms` }}
    >
      <Premium3DIcon icon={icon} color={color} size="md" animate />
      <div className="space-y-1.5">
        <h3 className={`font-bold text-base leading-tight ${isLight ? "text-[#071A33]" : "text-white"}`}>
          {isArabic && titleAr ? titleAr : title}
        </h3>
        <p className={`text-sm leading-relaxed ${isLight ? "text-[#071A33]/65" : "text-white/65"}`}>
          {isArabic && descAr ? descAr : desc}
        </p>
      </div>
    </div>
  );
}
