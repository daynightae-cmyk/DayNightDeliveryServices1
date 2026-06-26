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
    <section className={cx("dn-page-shell", className)}>
      {(kicker || title || subtitle || actions) && (
        <div className="dn-page-head">
          <div className="min-w-0">
            {kicker && <div className="dn-kicker mb-3">{kicker}</div>}
            {title && <h1 className="dn-page-title">{title}</h1>}
            {subtitle && <p className="dn-page-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="dn-page-actions">{actions}</div>}
        </div>
      )}
      {children}
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
  return <span className={cx("dn-badge", `dn-badge-${tone}`, className)}>{children}</span>;
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
    <DNCard className="p-5" premium={tone === "gold"}>
      <p className="text-xs font-black text-white/45">{label}</p>
      <p className={cx("mt-2 text-3xl font-black tracking-tight", `dn-stat-${tone}`)}>{value}</p>
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
    <div className="dn-empty-state">
      {icon && <div className="dn-empty-icon">{icon}</div>}
      <h3 className="text-xl font-black text-white">{title}</h3>
      {body && <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
