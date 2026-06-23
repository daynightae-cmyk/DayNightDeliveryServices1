/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { MapPin, Clock, DollarSign, CheckCircle, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "../ui/GlassCard";

interface CityData {
  nameAr: string;
  nameEn: string;
  type: string;
  basePrice: number;
  deliveryTime: string;
  status: "active" | "limited" | "coming-soon";
  lat: number;
  lng: number;
}

const uaeCities: CityData[] = [
  { nameAr: "أبوظبي", nameEn: "Abu Dhabi", type: "العاصمة", basePrice: 30, deliveryTime: "2-4 ساعات", status: "active", lat: 24.4539, lng: 54.3773 },
  { nameAr: "دبي", nameEn: "Dubai", type: "مدينة تجارية", basePrice: 30, deliveryTime: "2-4 ساعات", status: "active", lat: 25.2048, lng: 55.2708 },
  { nameAr: "الشارقة", nameEn: "Sharjah", type: "مدينة صناعية", basePrice: 30, deliveryTime: "3-5 ساعات", status: "active", lat: 25.3463, lng: 55.4209 },
  { nameAr: "عجمان", nameEn: "Ajman", type: "إمارة شمالية", basePrice: 30, deliveryTime: "3-5 ساعات", status: "active", lat: 25.4052, lng: 55.5136 },
  { nameAr: "أم القيوين", nameEn: "Umm Al Quwain", type: "إمارة شمالية", basePrice: 30, deliveryTime: "4-6 ساعات", status: "active", lat: 25.5647, lng: 55.5552 },
  { nameAr: "رأس الخيمة", nameEn: "Ras Al Khaimah", type: "إمارة شمالية", basePrice: 30, deliveryTime: "4-6 ساعات", status: "active", lat: 25.7896, lng: 55.9433 },
  { nameAr: "الفجيرة", nameEn: "Fujairah", type: "ساحل شرقي", basePrice: 30, deliveryTime: "5-7 ساعات", status: "active", lat: 25.1288, lng: 56.3265 },
  { nameAr: "العين", nameEn: "Al Ain", type: "واحة", basePrice: 50, deliveryTime: "4-6 ساعات", status: "active", lat: 24.1302, lng: 55.8023 },
];

export default function UAEInteractiveMap() {
  const [selectedCity, setSelectedCity] = useState<CityData>(uaeCities[0]);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      {/* Info Card - Left Side */}
      <GlassCard className="p-6 sm:p-8 space-y-6">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/20 rounded-full px-4 py-1.5 text-xs text-brand-gold font-bold uppercase tracking-widest">
          <MapPin className="w-4 h-4" />
          <span>خريطة التغطية — الإمارات</span>
        </div>

        {/* Header */}
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
            نقاط تشغيل نشطة عبر الإمارات
          </h2>
          <p className="text-white/60 text-sm leading-relaxed">
            اختر مدينة أو منطقة لمعرفة وقت التسعير والسعر النهائي المعروض للعميل.
          </p>
        </div>

        {/* Selected City Info */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedCity.nameEn}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* City Name */}
            <div className="flex items-center justify-between p-4 bg-brand-deep/50 rounded-2xl border border-white/10">
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider font-bold">{selectedCity.type}</p>
                <h3 className="text-xl font-extrabold text-white">{selectedCity.nameAr}</h3>
                <p className="text-sm text-white/50 font-mono">{selectedCity.nameEn}</p>
              </div>
              <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                selectedCity.status === "active" 
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              }`}>
                {selectedCity.status === "active" ? "نشطة" : "قريباً"}
              </div>
            </div>

            {/* Price & Time Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-brand-deep/50 rounded-2xl border border-white/10 space-y-2">
                <div className="flex items-center gap-2 text-white/40 text-xs font-bold uppercase">
                  <DollarSign className="w-4 h-4" />
                  <span>السعر الابتدائي</span>
                </div>
                <p className="text-2xl font-extrabold text-brand-gold">{selectedCity.basePrice} AED</p>
                <p className="text-xs text-white/40">{(selectedCity.basePrice * 1.05).toFixed(2)} AED شامل الضريبة</p>
              </div>

              <div className="p-4 bg-brand-deep/50 rounded-2xl border border-white/10 space-y-2">
                <div className="flex items-center gap-2 text-white/40 text-xs font-bold uppercase">
                  <Clock className="w-4 h-4" />
                  <span>مدة التوصيل</span>
                </div>
                <p className="text-2xl font-extrabold text-brand-blue">{selectedCity.deliveryTime}</p>
                <p className="text-xs text-white/40">من استلام الشحنة</p>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 pt-4 border-t border-white/10">
              <div className="flex-1 text-center">
                <p className="text-2xl font-extrabold text-white">50+</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">مسار يومي</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="flex-1 text-center">
                <p className="text-2xl font-extrabold text-white">23</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">منطقة تغطية</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* City Selection Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4">
          {uaeCities.map((city) => (
            <button
              key={city.nameEn}
              onClick={() => setSelectedCity(city)}
              onMouseEnter={() => setHoveredCity(city.nameEn)}
              onMouseLeave={() => setHoveredCity(null)}
              className={`p-3 rounded-xl text-xs font-bold transition-all ${
                selectedCity.nameEn === city.nameEn
                  ? "bg-brand-gold text-brand-deep shadow-lg shadow-brand-gold/20"
                  : "bg-brand-deep/50 text-white/60 hover:bg-brand-deep hover:text-white border border-white/10"
              }`}
            >
              {city.nameAr}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Map Visualization - Right Side */}
      <GlassCard className="p-6 sm:p-8 min-h-[500px] relative overflow-hidden">
        {/* SVG Map of UAE */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 400 300" className="w-full h-full max-w-md">
            {/* UAE Outline Simplified */}
            <defs>
              <linearGradient id="uaeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(30,144,255,0.15)" />
                <stop offset="100%" stopColor="rgba(10,28,58,0.25)" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            {/* Simplified UAE Shape */}
            <path
              d="M 80 180 L 100 160 L 140 150 L 180 140 L 220 130 L 260 120 L 300 110 L 340 100 L 360 90 L 370 110 L 350 140 L 320 170 L 280 200 L 240 220 L 200 230 L 160 235 L 120 230 L 90 210 L 70 190 Z"
              fill="url(#uaeGradient)"
              stroke="rgba(30,144,255,0.4)"
              strokeWidth="2"
              filter="url(#glow)"
              className="transition-all duration-300"
            />

            {/* City Markers */}
            {uaeCities.map((city, index) => {
              const x = 80 + (index * 35);
              const y = 120 + (Math.sin(index) * 40);
              const isSelected = selectedCity.nameEn === city.nameEn;
              const isHovered = hoveredCity === city.nameEn;

              return (
                <g key={city.nameEn} onClick={() => setSelectedCity(city)} className="cursor-pointer">
                  {/* Pulse Ring for Active */}
                  {isSelected && (
                    <circle cx={x} cy={y} r="20" fill="none" stroke="rgba(212,175,55,0.3)" strokeWidth="1">
                      <animate attributeName="r" from="10" to="25" dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.8" to="0" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                  )}
                  
                  {/* Marker Pin */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected || isHovered ? 8 : 5}
                    fill={isSelected ? "#D4AF37" : "#1E90FF"}
                    stroke={isSelected ? "#F6C94A" : "#2BB8FF"}
                    strokeWidth="2"
                    className="transition-all duration-300"
                    filter={isSelected ? "url(#glow)" : ""}
                  />
                  
                  {/* City Label */}
                  <text
                    x={x}
                    y={y - 15}
                    textAnchor="middle"
                    fill={isSelected ? "#F6C94A" : "#5BCBFF"}
                    fontSize="10"
                    fontWeight="bold"
                    className="transition-all duration-300"
                  >
                    {city.nameAr}
                  </text>
                </g>
              );
            })}

            {/* Route Lines */}
            <path
              d="M 115 140 Q 180 160 250 140 T 340 120"
              fill="none"
              stroke="rgba(212,175,55,0.3)"
              strokeWidth="1.5"
              strokeDasharray="5,5"
              className="animate-pulse"
            />
          </svg>
        </div>

        {/* Bottom Info Bar */}
        <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between gap-4 p-4 bg-brand-deep/70 backdrop-blur-md rounded-2xl border border-white/10">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-white/70 font-bold">تغطية موثوقة</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-brand-gold" />
            <span className="text-xs text-white/70 font-bold">تسعير لحظي</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-blue" />
            <span className="text-xs text-white/70 font-bold">خدمة 24/7</span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
