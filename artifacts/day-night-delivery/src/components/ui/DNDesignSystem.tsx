import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

type Tone = "gold" | "blue" | "green" | "red" | "neutral";
type ButtonVariant = "primary" | "secondary" | "ghost" | "whatsapp" | "danger";
type ButtonSize = "sm" | "md" | "lg";

function cx(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
}

const toneClass: Record<Tone, string> = {
  gold: "border-brand-gold/30 bg-brand-gold/10 text-brand-gold",
  blue: "border-brand-sky/25 bg-brand-sky/10 text-brand-sky",
  green: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
  red: "border-rose-400/25 bg-rose-500/10 text-rose-200",
  neutral: "border-white/10 bg-white/5 text-white/75",
};

const statClass: Record<Tone, string> = {
  gold: "text-brand-gold drop-shadow-[0_0_18px_rgba(212,175,55,0.25)]",
  blue: "text-brand-sky drop-shadow-[0_0_18px_rgba(43,184,255,0.22)]",
  green: "text-emerald-200 drop-shadow-[0_0_18px_rgba(37,211,102,0.18)]",
  red: "text-rose-200 drop-shadow-[0_0_18px_rgba(244,63,94,0.18)]",
  neutral: "text-white",
};

export function DNPageShell({
  kicker,
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  kicker?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(16,35,63,0.72),rgba(6,18,37,0.66))] p-5 shadow-2xl shadow-black/25 backdrop-blur-2xl sm:p-8",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.13),transparent_26rem)] before:content-['']",
        className,
      )}
    >
      {(kicker || title || subtitle || actions) && (
        <div className="relative z-10 mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            {kicker && <div className="mb-3"><DNBadge tone="gold">{kicker}</DNBadge></div>}
            {title && <h1 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-5xl">{title}</h1>}
            {subtitle && <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-white/55 sm:text-base">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2 lg:justify-end">{actions}</div>}
        </div>
      )}
      <div className="relative z-10">{children}</div>
    </section>
  );
}

export function DNCard({
  children,
  className,
  premium = false,
  hover = true,
  ...props
}: HTMLAttributes<HTMLDivElement> & { premium?: boolean; hover?: boolean }) {
  return (
    <div
      className={cx(
        premium ? "dn-card-premium" : "dn-card",
        hover && "dn-card-hover",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DNButton({
  children,
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button className={cx("dn-btn", `dn-btn-${variant}`, `dn-btn-${size}`, className)} {...props}>
      {children}
    </button>
  );
}

export function DNInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx("dn-input-control", className)} {...props} />;
}

export function DNSelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx("dn-input-control dn-select-control", className)} {...props}>
      {children}
    </select>
  );
}

export function DNBadge({
  children,
  tone = "gold",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return <span className={cx("inline-flex w-fit max-w-full items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wide", toneClass[tone], className)}>{children}</span>;
}

export function DNStat({
  label,
  value,
  hint,
  tone = "gold",
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
}) {
  return (
    <DNCard className="p-5 text-center" premium={tone === "gold"}>
      <p className="text-xs font-black text-white/45">{label}</p>
      <p className={cx("mt-2 text-3xl font-black tracking-tight", statClass[tone])}>{value}</p>
      {hint && <p className="mt-1 text-[11px] font-bold text-white/35">{hint}</p>}
    </DNCard>
  );
}

export function DNEmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-[1.65rem] border border-dashed border-brand-gold/25 bg-white/[0.035] p-8 text-center">
      {icon && <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-gold/25 bg-brand-gold/10 text-brand-gold shadow-lg shadow-brand-gold/10">{icon}</div>}
      <h3 className="text-xl font-black text-white">{title}</h3>
      {body && <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
