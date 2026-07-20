import { Laptop2, Moon, Sun } from "lucide-react";
import { useAppContext } from "../lib/AppContext";

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { themeMode, toggleTheme, language } = useAppContext();
  const isArabic = language === "ar";
  const Icon = themeMode === "dark" ? Moon : themeMode === "light" ? Sun : Laptop2;
  const label = themeMode === "dark"
    ? (isArabic ? "ليلي" : "Night")
    : themeMode === "light"
      ? (isArabic ? "نهاري" : "Light")
      : (isArabic ? "تلقائي" : "System");

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="dn-theme-toggle inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-brand-gold/25 bg-brand-gold/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-brand-gold shadow-[0_0_24px_rgba(245,183,0,0.10)] transition hover:border-brand-gold/55 hover:bg-brand-gold/15"
      title={isArabic ? `الوضع الحالي: ${label} — اضغط للتغيير` : `Current mode: ${label} — click to change`}
      aria-label={isArabic ? `تغيير المظهر، الوضع الحالي ${label}` : `Change appearance, current mode ${label}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {!compact && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}
