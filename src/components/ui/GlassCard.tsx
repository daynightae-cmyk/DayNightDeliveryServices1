/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactNode } from "react";
import { motion } from "framer-motion";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  active?: boolean;
  onClick?: () => void;
}

export default function GlassCard({ children, className = "", active = false, onClick }: GlassCardProps) {
  const baseClasses = `backdrop-blur-2xl transition-all duration-300`;
  
  const darkActiveClasses = `
    bg-gradient-to-br from-[rgba(18,43,78,0.92)] to-[rgba(10,28,58,0.82)]
    border border-[rgba(246,201,74,0.42)]
    shadow-[0_0_32px_rgba(246,201,74,0.20),0_20px_60px_rgba(0,0,0,0.35)]
  `;
  
  const darkNormalClasses = `
    bg-gradient-to-br from-[rgba(16,35,63,0.88)] to-[rgba(6,18,37,0.72)]
    border border-[rgba(56,139,253,0.25)]
    shadow-[0_24px_80px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06),0_0_40px_rgba(30,144,255,0.12)]
  `;
  
  const lightClasses = `
    bg-gradient-to-br from-[rgba(255,255,255,0.86)] to-[rgba(248,250,252,0.78)]
    border border-[rgba(30,144,255,0.20)]
    shadow-[0_24px_80px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8),0_0_40px_rgba(30,144,255,0.08)]
  `;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`
        ${baseClasses}
        ${active ? darkActiveClasses : darkNormalClasses}
        light-theme:${lightClasses}
        rounded-3xl
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}
