/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "framer-motion";
import { X } from "lucide-react";

interface SplashScreenProps {
  isLoading: boolean;
  onComplete: () => void;
}

export default function SplashScreen({ isLoading, onComplete }: SplashScreenProps) {
  if (!isLoading) return null;

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-deep"
      style={{
        background: `
          radial-gradient(circle at 70% 20%, rgba(30,144,255,0.16), transparent 35%),
          radial-gradient(circle at 20% 80%, rgba(212,175,55,0.10), transparent 30%),
          linear-gradient(135deg, #020817 0%, #061225 45%, #0A1C3A 100%)
        `
      }}
    >
      <div className="relative flex flex-col items-center justify-center gap-6">
        {/* Animated Logo Container */}
        <div className="relative">
          {/* Pulse Rings */}
          <motion.div
            animate={{ scale: [1, 1.2, 1.5], opacity: [0.8, 0.4, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
            className="absolute inset-0 rounded-full border-2 border-brand-gold/30"
          />
          <motion.div
            animate={{ scale: [1, 1.3, 1.6], opacity: [0.6, 0.2, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
            className="absolute inset-0 rounded-full border border-brand-blue/20"
          />
          
          {/* Logo */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-2 border-brand-gold/40 shadow-[0_0_40px_rgba(212,175,55,0.3)] bg-brand-deep"
          >
            <img
              src="/logo-daynight.png"
              alt="Day Night Logo"
              className="w-full h-full object-cover"
            />
          </motion.div>
        </div>

        {/* Company Name */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center space-y-1"
        >
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight uppercase">
            DAY NIGHT
            <span className="text-brand-gold font-semibold ml-2 text-sm">DELIVERY</span>
          </h1>
          <p className="text-xs text-white/50 font-bold">داي نايت لخدمات التوصيل والشحن</p>
        </motion.div>

        {/* Loading Progress Bar */}
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: "200px", opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="h-1 bg-white/10 rounded-full overflow-hidden mt-4"
        >
          <motion.div
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="h-full w-full bg-gradient-to-r from-transparent via-brand-gold to-transparent"
          />
        </motion.div>

        {/* Loading Dots */}
        <div className="flex gap-2 mt-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              className="w-2 h-2 rounded-full bg-brand-gold"
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
