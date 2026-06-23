type SectionHeaderProps = {
  badge?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "start";
};

export default function SectionHeader({ badge, title, subtitle, align = "center" }: SectionHeaderProps) {
  const alignClass = align === "center" ? "text-center mx-auto" : "text-start";

  return (
    <div className={`max-w-3xl space-y-4 ${alignClass}`}>
      {badge && (
        <span className="bg-brand-gold/10 text-brand-gold text-xs px-3.5 py-1 rounded-full font-bold uppercase tracking-widest inline-block">
          {badge}
        </span>
      )}
      <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">{title}</h2>
      {subtitle && <p className="text-white/65 text-sm leading-relaxed">{subtitle}</p>}
    </div>
  );
}
