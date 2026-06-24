import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, TimerReset, Globe2 } from "lucide-react";
import { useAppContext } from "../../lib/AppContext";
import { pageCopy } from "../../data/pageCopy";

type Region = {
  id: string;
  labelEn: string;
  labelAr: string;
  timezone: string;
  offset: string;
};

const regions: Region[] = [
  { id: "uae", labelEn: "UAE (Dubai)", labelAr: "الإمارات (دبي)", timezone: "Asia/Dubai", offset: "UTC+04:00" },
  { id: "sa", labelEn: "Saudi Arabia", labelAr: "السعودية", timezone: "Asia/Riyadh", offset: "UTC+03:00" },
  { id: "qa", labelEn: "Qatar", labelAr: "قطر", timezone: "Asia/Qatar", offset: "UTC+03:00" },
  { id: "kw", labelEn: "Kuwait", labelAr: "الكويت", timezone: "Asia/Kuwait", offset: "UTC+03:00" },
  { id: "om", labelEn: "Oman", labelAr: "عُمان", timezone: "Asia/Muscat", offset: "UTC+04:00" },
  { id: "bh", labelEn: "Bahrain", labelAr: "البحرين", timezone: "Asia/Bahrain", offset: "UTC+03:00" },
  { id: "uk", labelEn: "United Kingdom", labelAr: "المملكة المتحدة", timezone: "Europe/London", offset: "UTC+00:00" },
  { id: "us", labelEn: "USA (New York)", labelAr: "أمريكا (نيويورك)", timezone: "America/New_York", offset: "UTC-05:00" },
  { id: "ca", labelEn: "Canada (Toronto)", labelAr: "كندا (Toronto)", timezone: "America/Toronto", offset: "UTC-05:00" },
  { id: "au", labelEn: "Australia (Sydney)", labelAr: "أستراليا (Sydney)", timezone: "Australia/Sydney", offset: "UTC+11:00" }
];

function getCutoffCountdown(now: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "numeric", minute: "numeric", hour12: false });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  const secondsNow = hour * 3600 + minute * 60 + now.getSeconds();
  const cutoff = 18 * 3600;
  let diff = cutoff - secondsNow;
  if (diff <= 0) diff += 24 * 3600;
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return { h, m, s };
}

export default function WorldClock() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const t = pageCopy[language].clockPage;
  const [now, setNow] = useState(() => new Date());
  const [regionId, setRegionId] = useState("uae");

  const region = regions.find((r) => r.id === regionId) || regions[0];

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const locale = isArabic ? "ar-AE" : "en-AE";

  const time = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: region.timezone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }).format(now),
    [locale, now, region.timezone]
  );

  const date = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: region.timezone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      }).format(now),
    [locale, now, region.timezone]
  );

  const countdown = getCutoffCountdown(now, region.timezone);
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 }), [locale]);
  const countdownText = [countdown.h, countdown.m, countdown.s].map((n) => numberFormatter.format(n)).join(":");

  return (
    <section className="glass rounded-[28px] border border-brand-gold/15 p-5 sm:p-6 relative overflow-hidden" dir={isArabic ? "rtl" : "ltr"}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(212,175,55,0.18),transparent_34%),radial-gradient(circle_at_80%_90%,rgba(24,168,232,0.16),transparent_38%)] pointer-events-none" />

      <div className="relative z-10 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/25 bg-brand-gold/10 px-3 py-1 text-xs font-bold text-brand-gold">
            <Globe2 className="w-4 h-4" />
            <span>{t.badge}</span>
          </div>
          <label className="flex items-center gap-2 text-xs text-white/60">
            <span className="font-bold whitespace-nowrap">{t.selectRegion}</span>
            <select
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              className="bg-brand-deep/80 border border-white/15 rounded-xl px-3 py-2 text-white text-xs min-w-[160px] [color-scheme:dark]"
            >
              {regions.map((r) => (
                <option key={r.id} value={r.id}>{isArabic ? r.labelAr : r.labelEn}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[0.9fr_1.1fr] gap-5 items-center">
          <div className="space-y-3">
            <p className="text-white/50 text-xs font-bold">{t.timezoneLabel}</p>
            <p className="text-4xl sm:text-5xl lg:text-6xl font-black text-white font-mono tracking-normal" dir="ltr">{time}</p>
            <p className="text-brand-gold text-sm font-bold">{region.timezone} • {region.offset}</p>
            <p className="text-white/60 text-sm">{isArabic ? region.labelAr : region.labelEn}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-brand-deep/65 p-4">
              <CalendarDays className="w-7 h-7 text-brand-gold mb-3" />
              <p className="text-white/45 text-xs font-bold">{t.today}</p>
              <p className="text-white font-bold leading-relaxed text-sm">{date}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-brand-deep/65 p-4">
              <TimerReset className="w-7 h-7 text-brand-gold mb-3" />
              <p className="text-white/45 text-xs font-bold">{t.countdown}</p>
              <p className="text-brand-gold font-black text-2xl font-mono" dir="ltr">{countdownText}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/45">
          <Clock3 className="w-4 h-4 text-brand-gold" />
          <span>{t.liveTime}</span>
        </div>
      </div>
    </section>
  );
}
