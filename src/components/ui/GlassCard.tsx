import type { ReactNode } from "react";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  variant?: "default" | "gold" | "premium";
};

export default function GlassCard({ children, className = "", variant = "default" }: GlassCardProps) {
  const variantClass =
    variant === "gold"
      ? "glass-gold"
      : variant === "premium"
        ? "glass-premium"
        : "glass";

  return (
    <div className={`${variantClass} rounded-2xl border border-white/12 backdrop-blur-[16px] ${className}`}>
      {children}
    </div>
  );
}
