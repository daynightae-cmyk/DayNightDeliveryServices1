import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, TimerReset } from "lucide-react";
import { useAppContext } from "../../lib/AppContext";

function getCutoffCountdown(now: Date) {
  const target = new Date(now);
  target.setHours(18, 0, 0, 0);

  if (now.getTime() > target.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  const diff = Math.max(0, target.getTime() - now.getTime());
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1_000);

  return { hours, minutes, seconds };
}

export default function WorldClock() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const locale = isArabic ? "ar-AE" : "en-AE";
  const time = useMemo(() => new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Dubai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(now), [locale, now]);

  const date = useMemo(() => new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Dubai",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(now), [locale, now]);

  const countdown = getCutoffCountdown(now);
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 }), [locale]);
  const countdownText = [
    numberFormatter.format(countdown.hours),
    numberFormatter.format(countdown.minutes),
    numberFormatter.format(countdown.seconds)
  ].join(":");

  return (
    <section className="glass rounded-[28px] border border-brand-gold/15 p-5 sm:p-6 relative overflow-hidden" dir={isArabic ? "rtl" : "ltr"}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(212,175,55,0.18),transparent_34%),radial-gradient(circle_at_80%_90%,rgba(24,168,232,0.16),transparent_38%)] pointer-events-none" />
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-[0.9fr_1.1fr] gap-5 items-center">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/25 bg-brand-gold/10 px-3 py-1 text-xs font-bold text-brand-gold">
            <Clock3 className="w-4 h-4" />
            <span>{isArabic ? "توقيت الإمارات المباشر" : "Live UAE Time"}</span>
          </div>
          <div>
            <p className="text-5xl sm:text-6xl font-black text-white font-mono tracking-normal" dir="ltr">{time}</p>
            <p className="text-brand-gold text-sm font-bold mt-2">Asia/Dubai • UTC+04:00</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-brand-deep/65 p-4">
            <CalendarDays className="w-7 h-7 text-brand-gold mb-3" />
            <p className="text-white/45 text-xs font-bold">{isArabic ? "التاريخ اليوم" : "Today"}</p>
            <p className="text-white font-bold leading-relaxed">{date}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-brand-deep/65 p-4">
            <TimerReset className="w-7 h-7 text-brand-gold mb-3" />
            <p className="text-white/45 text-xs font-bold">{isArabic ? "الوقت المتبقي لجدولة اليوم" : "Daily dispatch countdown"}</p>
            <p className="text-brand-gold font-black text-2xl font-mono" dir="ltr">{countdownText}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
