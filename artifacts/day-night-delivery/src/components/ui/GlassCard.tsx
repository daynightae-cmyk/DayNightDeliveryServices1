import type { ReactNode } from "react";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  variant?: "default" | "gold" | "premium";
  hover?: boolean;
  shine?: boolean;
};

export default function GlassCard({
  children,
  className = "",
  variant = "default",
  hover = false,
  shine = false,
}: GlassCardProps) {
  const variantClass =
    variant === "gold"
      ? "glass-gold"
      : variant === "premium"
        ? "glass-strong"
        : "glass";

  return (
    <div
      className={`
        ${variantClass}
        ${hover ? "glass-hover" : ""}
        ${shine ? "card-shine" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
