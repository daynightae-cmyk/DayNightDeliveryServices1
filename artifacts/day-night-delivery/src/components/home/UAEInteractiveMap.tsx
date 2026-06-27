import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  Activity,
  Box,
  Clock3,
  Globe2,
  PackageCheck,
  Radar,
  ShieldCheck,
  Truck,
  Zap,
} from "lucide-react";
import "../../styles/dn-dashboard-map.css";

const MAP_IMAGE_URL =
  "https://i.postimg.cc/GhGvg7Bw/Chat-GPT-Image-27-ywnyw-2026-04-49-00-s.png";

const liveStats = [
  { label: "شحنة نشطة", value: "505+" },
  { label: "مناطق تغطية", value: "36" },
  { label: "تحديث مباشر", value: "30s" },
];

const bottomFeatures = [
  {
    icon: ShieldCheck,
    title: "تغطية موثوقة",
    description: "في جميع أنحاء الدولة",
    tone: "blue",
  },
  {
    icon: Zap,
    title: "تسعير لحظي",
    description: "حسب المسافة والوقت",
    tone: "gold",
  },
  {
    icon: Clock3,
    title: "خدمة 24 / 7",
    description: "نهاراً وليلاً",
    tone: "gold",
  },
  {
    icon: Box,
    title: "تتبع مباشر",
    description: "لحظة بلحظة",
    tone: "blue",
  },
];

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

  const formattedUpdateTime = useMemo(() => {
    return lastUpdated.toLocaleTimeString("ar-AE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [lastUpdated]);

  return (
    <section className="dn-uae-map-section" dir="rtl">
      <div className="dn-map-orb dn-map-orb-one" />
      <div className="dn-map-orb dn-map-orb-two" />

      <div className="dn-map-header">
        <div className="dn-map-header-copy">
          <span className="dn-map-kicker">DAY NIGHT DELIVERY SERVICES</span>
          <h2>خريطة تغطية الإمارات الحية</h2>
          <p>
            واجهة بصرية احترافية تعرض تغطية DAY NIGHT داخل الإمارات بأسلوب
            ثلاثي الأبعاد، مع إحساس مباشر بحركة الشحن، المسارات، والمناطق
            النشطة على مدار الساعة.
          </p>
        </div>

        <div className="dn-map-header-card">
          <span className="dn-map-header-icon">
            <Activity size={23} />
          </span>
          <div>
            <strong>نظام متابعة مباشر</strong>
            <span>آخر تحديث: {formattedUpdateTime}</span>
          </div>
        </div>
      </div>

      <div className="dn-uae-map-shell">
        <div className="dn-map-top-glass">
          <div className="dn-live-card">
            <div className="dn-live-icon">
              <Radar size={30} />
            </div>

            <div className="dn-live-content">
              <strong>تحديث لحظي</strong>
              <span>حركة الشحن والمناطق</span>
              <small>تحديث كل 30 ثانية</small>
            </div>

            <i aria-hidden="true" />
          </div>

          <div className="dn-total-card">
            <PackageCheck size={23} />
            <div>
              <strong>505+</strong>
              <span>شحنة نشطة اليوم</span>
            </div>
          </div>
        </div>

        <div className="dn-map-stage">
          {imageLoaded ? (
            <img
              className="dn-map-artwork"
              src={MAP_IMAGE_URL}
              alt="DAY NIGHT UAE 3D delivery coverage map"
              loading="eager"
              decoding="async"
              onError={() => setImageLoaded(false)}
            />
          ) : (
            <div className="dn-map-fallback">
              <Globe2 size={56} />
              <strong>تعذر تحميل صورة الخريطة</strong>
              <span>تحقق من رابط الصورة أو ضعها داخل public/assets</span>
            </div>
          )}

          <div className="dn-map-vignette" />
          <div className="dn-map-blue-edge" />
          <div className="dn-map-gold-sweep" />
          <div className="dn-map-scan-line" />

          <div className="dn-map-sparks" aria-hidden="true">
            {Array.from({ length: 36 }).map((_, index) => (
              <span
                key={index}
                style={
                  {
                    "--sx": `${6 + ((index * 19) % 88)}%`,
                    "--sy": `${9 + ((index * 31) % 78)}%`,
                    "--sd": `${(index % 9) * 0.32}s`,
                    "--ss": `${0.75 + (index % 4) * 0.2}`,
                  } as CSSProperties
                }
              />
            ))}
          </div>

          <div className="dn-map-floating-panel dn-map-panel-left">
            <Truck size={24} />
            <div>
              <strong>حركة تشغيل نشطة</strong>
              <span>توزيع مستمر بين الإمارات</span>
            </div>
          </div>

          <div className="dn-map-floating-panel dn-map-panel-right">
            <Globe2 size={24} />
            <div>
              <strong>ربط محلي ودولي</strong>
              <span>UAE • GCC • Worldwide</span>
            </div>
          </div>
        </div>

        <div className="dn-live-stats">
          {liveStats.map((item) => (
            <div key={item.label} className="dn-live-stat">
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <div className="dn-map-bottom-bar">
          {bottomFeatures.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <div className="dn-map-bottom-item-wrap" key={feature.title}>
                <div className={`dn-map-feature is-${feature.tone}`}>
                  <Icon size={24} />
                  <div>
                    <strong>{feature.title}</strong>
                    <span>{feature.description}</span>
                  </div>
                </div>

                {index < bottomFeatures.length - 1 && (
                  <div className="dn-map-separator" />
                )}
              </div>
            );
          })}
        </div>

        <div className="dn-map-pulse-counter">
          <Activity size={18} />
          <span>نبضة تشغيل #{tick}</span>
        </div>
      </div>
    </section>
  );
}
