import { useAppContext } from "../../lib/AppContext";

type SectionHeaderProps = {
  badge?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "start";
  gold?: boolean;
};

export default function SectionHeader({
  badge,
  title,
  subtitle,
  align = "center",
  gold = false,
}: SectionHeaderProps) {
  const { theme } = useAppContext();
  const isLight = theme === "light";
  const alignClass = align === "center" ? "text-center mx-auto" : "text-start";

  return (
    <div className={`max-w-3xl space-y-4 ${alignClass}`}>
      {badge && (
        <span
          className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border ${
            gold
              ? "bg-amber-500/10 text-amber-500 border-amber-400/25"
              : "bg-brand-blue/10 text-brand-blue border-brand-blue/25"
          }`}
        >
          {badge}
        </span>
      )}
      <h2
        className={`text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight leading-tight ${
          isLight ? "text-[#071A33]" : "text-white"
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`text-sm sm:text-base leading-relaxed ${
            isLight ? "text-[#071A33]/65" : "text-white/60"
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
