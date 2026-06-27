import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Activity, Box, Clock3, Globe2, PackageCheck, Radar, ShieldCheck, Truck, Zap } from "lucide-react";
import "../../styles/dn-dashboard-map.css";

const MAP_IMAGE_URL = "https://i.postimg.cc/GhGvg7Bw/Chat-GPT-Image-27-ywnyw-2026-04-49-00-s.png";

const liveStats = [
  { label: "شحنة نشطة", value: "505+" },
  { label: "مناطق تغطية", value: "36" },
  { label: "تحديث مباشر", value: "30s" },
];

const bottomFeatures = [
  { icon: ShieldCheck, title: "تغطية موثوقة", description: "في جميع أنحاء الدولة", tone: "blue" },
  { icon: Zap, title: "تسعير لحظي", description: "حسب المسافة والوقت", tone: "gold" },
  { icon: Clock3, title: "خدمة 24 / 7", description: "نهاراً وليلاً", tone: "gold" },
  { icon: Box, title: "تتبع مباشر", description: "لحظة بلحظة", tone: "blue" },
];

const glassStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.13)",
  background: "linear-gradient(135deg,rgba(255,255,255,0.14),rgba(255,255,255,0.045))",
  backdropFilter: "blur(24px)",
  boxShadow: "0 28px 80px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.14)",
};

export default function UAEInteractiveMap() {
  const [tick, setTick] = useState(1);
  const [imageLoaded, setImageLoaded] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick((value) => value + 1);
      setLastUpdated(new Date());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const formattedUpdateTime = useMemo(() => lastUpdated.toLocaleTimeString("ar-AE", { hour: "2-digit", minute: "2-digit" }), [lastUpdated]);

  return (
    <section
      className="relative w-full overflow-hidden px-4 py-16 text-white sm:px-8 lg:px-12"
      dir="rtl"
      style={{
        background: "radial-gradient(circle at 16% 18%,rgba(0,123,255,.24),transparent 34%),radial-gradient(circle at 84% 12%,rgba(245,183,0,.16),transparent 30%),linear-gradient(135deg,#030a18 0%,#071a33 48%,#01050f 100%)",
      }}
    >
      <div className="pointer-events-none absolute right-[5%] top-[10%] h-60 w-60 rounded-full bg-blue-500/15 blur-2xl" />
      <div className="pointer-events-none absolute bottom-[16%] left-[9%] h-48 w-48 rounded-full bg-yellow-400/10 blur-2xl" />

      <div className="relative z-[3] mx-auto mb-7 flex w-[min(1180px,100%)] flex-col items-stretch justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-[780px]">
          <span className="mb-3 inline-flex text-xs font-black uppercase tracking-[0.14em] text-[#f5b700]">DAY NIGHT DELIVERY SERVICES</span>
          <h2 className="m-0 text-[clamp(30px,4vw,54px)] font-black leading-[1.08] text-white">خريطة تغطية الإمارات الحية</h2>
          <p className="mt-4 max-w-[760px] text-[clamp(15px,1.5vw,18px)] font-bold leading-[1.95] text-white/70">
            واجهة بصرية احترافية تعرض تغطية DAY NIGHT داخل الإمارات بأسلوب ثلاثي الأبعاد، مع إحساس مباشر بحركة الشحن، المسارات، والمناطق النشطة على مدار الساعة.
          </p>
        </div>

        <div className="flex min-w-[245px] items-center gap-3 rounded-[22px] p-4" style={glassStyle}>
          <span className="grid h-[46px] w-[46px] place-items-center rounded-2xl border border-[#18a8e8]/20 bg-[#18a8e8]/15 text-[#18a8e8]"><Activity size={23} /></span>
          <div><strong className="block text-sm font-black text-white">نظام متابعة مباشر</strong><span className="mt-1 block text-xs font-bold text-white/60">آخر تحديث: {formattedUpdateTime}</span></div>
        </div>
      </div>

      <div
        className="relative z-[3] mx-auto min-h-[720px] w-[min(1180px,100%)] overflow-hidden rounded-[36px] max-lg:min-h-[690px] max-md:min-h-[820px]"
        style={{
          border: "1px solid rgba(24,168,232,0.19)",
          background: "radial-gradient(circle at 50% 42%,rgba(0,87,184,.34),transparent 42%),linear-gradient(145deg,rgba(4,17,39,.95),rgba(1,7,20,.99))",
          boxShadow: "0 44px 120px rgba(0,0,0,.58), inset 0 1px 0 rgba(255,255,255,.13), inset 0 0 90px rgba(0,123,255,.11)",
        }}
      >
        <div className="pointer-events-none absolute left-[30px] right-[30px] top-[30px] z-10 flex items-start justify-between gap-4 max-md:left-4 max-md:right-4 max-md:top-4 max-md:flex-col">
          <div className="flex w-[278px] items-center gap-3 rounded-3xl p-[18px] max-md:w-full" style={glassStyle}>
            <div className="grid h-[68px] w-[68px] place-items-center rounded-full border border-white/15 text-[#18a8e8] max-md:h-14 max-md:w-14" style={{ background: "radial-gradient(circle,rgba(24,168,232,.25),rgba(255,255,255,.06))" }}><Radar size={30} /></div>
            <div className="min-w-0"><strong className="block text-sm font-black text-white">تحديث لحظي</strong><span className="mt-1 block text-xs font-bold text-white/70">حركة الشحن والمناطق</span><small className="mt-1 block text-[11px] font-bold text-white/45">تحديث كل 30 ثانية</small></div>
            <i className="ms-auto h-[9px] w-[9px] shrink-0 animate-pulse rounded-full bg-[#24ff92] shadow-[0_0_18px_rgba(36,255,146,0.9)]" />
          </div>

          <div className="flex min-w-[190px] items-center gap-3 rounded-[20px] p-4 max-md:w-full" style={glassStyle}>
            <PackageCheck size={23} className="text-[#18a8e8]" />
            <div><strong className="block text-2xl font-black leading-none text-white">505+</strong><span className="mt-1 block text-xs font-bold text-white/60">شحنة نشطة اليوم</span></div>
          </div>
        </div>

        <div className="absolute z-[2] overflow-hidden rounded-[30px] max-lg:inset-[16px_16px_156px_16px] max-md:inset-[14px_14px_298px_14px]" style={{ inset: "18px 18px 118px 18px", background: "radial-gradient(circle at 50% 56%,rgba(8,61,128,.68),transparent 46%),linear-gradient(145deg,rgba(5,17,41,.78),rgba(0,4,13,.92))" }}>
          {imageLoaded ? (
            <img
              className="absolute inset-0 h-full w-full object-cover object-center max-md:scale-[1.06]"
              src={MAP_IMAGE_URL}
              alt="DAY NIGHT UAE 3D delivery coverage map"
              loading="eager"
              decoding="async"
              onError={() => setImageLoaded(false)}
              style={{ opacity: 0.98, transform: "scale(1.01)", filter: "saturate(1.12) contrast(1.08) brightness(.96) drop-shadow(0 38px 44px rgba(0,0,0,.48))" }}
            />
          ) : (
            <div className="absolute inset-0 grid place-content-center justify-items-center gap-3 bg-[#071a33] text-center text-white"><Globe2 size={56} className="text-[#18a8e8]" /><strong className="text-xl font-black">تعذر تحميل صورة الخريطة</strong><span className="text-sm text-white/60">تحقق من رابط الصورة أو ضعها داخل public/assets</span></div>
          )}

          <div className="pointer-events-none absolute inset-0 z-[4]" style={{ background: "radial-gradient(circle at 50% 50%,transparent 0%,transparent 48%,rgba(0,0,0,.36) 100%)" }} />
          <div className="pointer-events-none absolute inset-0 z-[5] mix-blend-screen" style={{ background: "radial-gradient(circle at 24% 82%,rgba(0,123,255,.18),transparent 28%),radial-gradient(circle at 84% 72%,rgba(24,168,232,.12),transparent 24%)" }} />
          <div className="pointer-events-none absolute inset-0 z-[7] animate-pulse mix-blend-screen" style={{ background: "linear-gradient(180deg,transparent 0%,transparent 46%,rgba(24,168,232,.09) 49%,rgba(255,255,255,.08) 50%,transparent 54%)" }} />

          {Array.from({ length: 36 }).map((_, index) => (
            <span
              key={index}
              className="pointer-events-none absolute z-[8] h-[3px] w-[3px] animate-pulse rounded-full bg-[#ffe7a6] shadow-[0_0_10px_rgba(245,183,0,0.85)]"
              style={{ left: `${6 + ((index * 19) % 88)}%`, top: `${9 + ((index * 31) % 78)}%`, animationDelay: `${(index % 9) * 0.32}s`, transform: `scale(${0.75 + (index % 4) * 0.2})` }}
            />
          ))}

          <div className="pointer-events-none absolute bottom-[30px] left-[28px] z-[12] flex items-center gap-3 rounded-[18px] px-4 py-3 max-md:hidden" style={glassStyle}><Truck size={24} className="text-[#f5b700]" /><div><strong className="block text-xs font-black text-white">حركة تشغيل نشطة</strong><span className="mt-1 block text-[11px] font-bold text-white/55">توزيع مستمر بين الإمارات</span></div></div>
          <div className="pointer-events-none absolute right-[28px] top-[128px] z-[12] flex items-center gap-3 rounded-[18px] px-4 py-3 max-lg:bottom-[30px] max-lg:top-auto max-md:hidden" style={glassStyle}><Globe2 size={24} className="text-[#f5b700]" /><div><strong className="block text-xs font-black text-white">ربط محلي ودولي</strong><span className="mt-1 block text-[11px] font-bold text-white/55">UAE • GCC • Worldwide</span></div></div>
        </div>

        <div className="absolute left-[30px] right-[30px] bottom-[94px] z-[13] grid grid-cols-3 gap-3 max-md:left-4 max-md:right-4 max-md:bottom-[174px] max-md:grid-cols-1">
          {liveStats.map((item) => <div key={item.label} className="rounded-[18px] p-3 text-center" style={glassStyle}><strong className="block text-[22px] font-black leading-none text-white">{item.value}</strong><span className="mt-2 block text-xs font-bold text-white/55">{item.label}</span></div>)}
        </div>

        <div className="absolute bottom-6 left-[28px] right-[28px] z-[14] grid grid-cols-4 items-center rounded-[22px] px-5 py-3 max-lg:grid-cols-2 max-lg:gap-2 max-md:left-4 max-md:right-4 max-md:bottom-4 max-md:grid-cols-1" style={glassStyle}>
          {bottomFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div className="grid min-w-0 grid-cols-[1fr_auto] items-center max-lg:block" key={feature.title}>
                <div className="flex min-w-0 items-center gap-3 px-2"><Icon size={24} className={feature.tone === "blue" ? "shrink-0 text-[#18a8e8]" : "shrink-0 text-[#f5b700]"} /><div className="min-w-0"><strong className="block whitespace-nowrap text-xs font-black text-white max-md:whitespace-normal">{feature.title}</strong><span className="mt-1 block whitespace-nowrap text-xs font-bold text-white/55 max-md:whitespace-normal">{feature.description}</span></div></div>
                {index < bottomFeatures.length - 1 && <div className="mx-2 h-9 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent max-lg:hidden" />}
              </div>
            );
          })}
        </div>

        <div className="pointer-events-none absolute bottom-[94px] right-[30px] z-[15] inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-white/70 max-md:right-4 max-md:bottom-[246px]" style={glassStyle}><Activity size={18} className="text-[#24ff92]" /><span>نبضة تشغيل #{tick}</span></div>
      </div>
    </section>
  );
}
