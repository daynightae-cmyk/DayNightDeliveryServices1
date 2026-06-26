import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useAppContext } from "../../lib/AppContext";

const cx = (...items: Array<string | false | null | undefined>) => items.filter(Boolean).join(" ");

export function PageHero({ eyebrow, title, subtitle, actions, children, className, ...props }: HTMLAttributes<HTMLElement> & { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  const { language, theme } = useAppContext();
  const isArabic = language === "ar";
  const isLight = theme === "light";
  return (
    <section className={cx("dn-hero px-6 py-12 sm:px-10 sm:py-16", className)} dir={isArabic ? "rtl" : "ltr"} {...props}>
      <div className="absolute inset-0 bg-grid-pattern opacity-35 pointer-events-none" />
      <div className={cx("relative z-10 max-w-4xl", isArabic ? "text-right" : "text-left")}>
        {eyebrow && <div className="dn-badge mb-5">{eyebrow}</div>}
        <h1 className={cx("text-3xl sm:text-5xl font-black tracking-tight leading-tight", isLight ? "text-[#071A33]" : "text-white")}>{title}</h1>
        {subtitle && <p className={cx("mt-4 max-w-2xl text-sm sm:text-base leading-8", isLight ? "text-[#071A33]/66" : "text-white/66")}>{subtitle}</p>}
        {actions && <div className={cx("mt-7 flex flex-wrap gap-3", isArabic ? "justify-end" : "justify-start")}>{actions}</div>}
      </div>
      {children && <div className="relative z-10 mt-8">{children}</div>}
    </section>
  );
}

export function PremiumSection({ title, subtitle, eyebrow, children, className, ...props }: HTMLAttributes<HTMLElement> & { title?: ReactNode; subtitle?: ReactNode; eyebrow?: ReactNode }) {
  const { language, theme } = useAppContext();
  const isArabic = language === "ar";
  const isLight = theme === "light";
  return (
    <section className={cx("dn-section", className)} dir={isArabic ? "rtl" : "ltr"} {...props}>
      {(eyebrow || title || subtitle) && <div className={cx("mb-8 max-w-3xl", isArabic ? "text-right" : "text-left")}>
        {eyebrow && <div className="dn-badge mb-3">{eyebrow}</div>}
        {title && <h2 className={cx("text-2xl sm:text-3xl font-black tracking-tight", isLight ? "text-[#071A33]" : "text-white")}>{title}</h2>}
        {subtitle && <p className={cx("mt-3 text-sm leading-7", isLight ? "text-[#071A33]/64" : "text-white/64")}>{subtitle}</p>}
      </div>}
      {children}
    </section>
  );
}

export function DNCard({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("dn-card card-shine", className)} {...props}>{children}</div>;
}

export function DNButton({ variant = "primary", className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  return <button className={cx("inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black transition-all", variant === "primary" && "btn-gold", variant === "secondary" && "btn-glass", variant === "ghost" && "border border-white/10 bg-white/5 text-white hover:bg-white/10", className)} {...props}>{children}</button>;
}

export function DNInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx("dn-input", className)} {...props} />;
}

export function DNSelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx("dn-select", className)} {...props}>{children}</select>;
}

export function DNBadge({ className, children, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx("dn-badge", className)} {...props}>{children}</span>;
}

export function DNEmptyState({ title, description, action, className, ...props }: HTMLAttributes<HTMLDivElement> & { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  const { theme } = useAppContext();
  const isLight = theme === "light";
  return <div className={cx("dn-card p-8 text-center", className)} {...props}><h3 className={cx("text-lg font-black", isLight ? "text-[#071A33]" : "text-white")}>{title}</h3>{description && <p className={cx("mx-auto mt-2 max-w-md text-sm leading-7", isLight ? "text-[#071A33]/60" : "text-white/60")}>{description}</p>}{action && <div className="mt-5">{action}</div>}</div>;
}

export function DNModal({ open, children, className, ...props }: HTMLAttributes<HTMLDivElement> & { open: boolean }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"><div className={cx("dn-card w-full max-w-lg p-6", className)} {...props}>{children}</div></div>;
}

export function DNTable({ className, children, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <div className="dn-card overflow-hidden"><div className="overflow-x-auto"><table className={cx("min-w-full text-sm", className)} {...props}>{children}</table></div></div>;
}
