import { Moon, Sparkles } from "lucide-react";

export default function ThemeToggle() {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-xl border border-brand-gold/25 bg-brand-gold/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-brand-gold shadow-[0_0_24px_rgba(245,183,0,0.10)]"
      title="DAY NIGHT premium night theme"
      aria-label="DAY NIGHT premium night theme"
    >
      <Moon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Night</span>
      <Sparkles className="h-3 w-3 text-brand-sky" />
    </div>
  );
}
