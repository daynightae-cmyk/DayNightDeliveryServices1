import { Moon, Sun } from "lucide-react";
import { useAppContext } from "../lib/AppContext";

export default function ThemeToggle() {
  const { themeMode, setThemeMode } = useAppContext();

  return (
    <div className="flex items-center gap-1 bg-brand-deep/40 border border-white/10 rounded-xl p-1">
      <button aria-label="Light mode" onClick={() => setThemeMode("light")} className={`px-2 py-1 rounded-lg text-xs ${themeMode === "light" ? "bg-brand-gold text-brand-deep" : "text-white/70"}`}><Sun className="w-3.5 h-3.5" /></button>
      <button aria-label="Dark mode" onClick={() => setThemeMode("dark")} className={`px-2 py-1 rounded-lg text-xs ${themeMode === "dark" ? "bg-brand-gold text-brand-deep" : "text-white/70"}`}><Moon className="w-3.5 h-3.5" /></button>
      <button aria-label="System theme" onClick={() => setThemeMode("system")} className={`px-2 py-1 rounded-lg text-[10px] font-bold ${themeMode === "system" ? "bg-brand-gold text-brand-deep" : "text-white/70"}`}>Auto</button>
    </div>
  );
}
