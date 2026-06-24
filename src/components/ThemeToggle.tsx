import { Moon, Sun } from "lucide-react";
import { useAppContext } from "../lib/AppContext";

export default function ThemeToggle() {
  const { themeMode, setThemeMode } = useAppContext();

  return (
    <div className="flex items-center gap-0.5 bg-white/8 border border-white/12 rounded-xl p-1">
      <button
        aria-label="Light mode"
        onClick={() => setThemeMode("light")}
        title="Light mode"
        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
          themeMode === "light"
            ? "bg-brand-gold text-brand-deep shadow-sm"
            : "text-white/60 hover:text-white/85"
        }`}
      >
        <Sun className="w-3.5 h-3.5" />
      </button>
      <button
        aria-label="Dark mode"
        onClick={() => setThemeMode("dark")}
        title="Dark mode"
        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
          themeMode === "dark"
            ? "bg-brand-gold text-brand-deep shadow-sm"
            : "text-white/60 hover:text-white/85"
        }`}
      >
        <Moon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
