import { useAppContext } from "../../lib/AppContext";
import { CheckCircle2, Circle, AlertCircle, PackageCheck, Truck, Route, Home } from "lucide-react";

interface ShipmentProgressBarProps { status?: string | null; }

type StageKey = "processing" | "dispatched" | "transit" | "delivered";

const stageRank: Record<StageKey, number> = { processing: 0, dispatched: 1, transit: 2, delivered: 3 };

function normalizeStatus(value?: string | null) {
  return String(value || "processing").toLowerCase().replace(/[_-]/g, " ").trim();
}

function resolveStage(status?: string | null): StageKey | "issue" {
  const raw = normalizeStatus(status);
  if (["cancelled", "canceled", "failed", "failed delivery", "returned", "rejected"].some((x) => raw.includes(x))) return "issue";
  if (["delivered", "completed", "complete", "closed"].some((x) => raw.includes(x))) return "delivered";
  if (["in transit", "transit", "out for delivery", "on the way", "en route", "moving"].some((x) => raw.includes(x))) return "transit";
  if (["dispatched", "dispatch", "driver assigned", "assigned", "picked up", "pickup", "collected", "shipped"].some((x) => raw.includes(x))) return "dispatched";
  return "processing";
}

export default function ShipmentProgressBar({ status }: ShipmentProgressBarProps) {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const stage = resolveStage(status);

  if (stage === "issue") {
    return <div className="glass glass-premium rounded-2xl p-5 mt-6 mb-8"><div className={`flex items-center gap-3 ${isArabic ? "flex-row-reverse" : ""}`}><AlertCircle className="w-6 h-6 text-red-500" /><p className="text-red-400 font-bold text-sm">{isArabic ? "تحتاج الشحنة إلى مراجعة من الدعم" : "This shipment needs support review"}</p></div></div>;
  }

  const currentIndex = stageRank[stage];
  const progress = (currentIndex / 3) * 100;
  const steps = [
    { key: "processing", en: "Processing", ar: "معالجة", icon: PackageCheck },
    { key: "dispatched", en: "Dispatched", ar: "تم الإرسال", icon: Truck },
    { key: "transit", en: "In Transit", ar: "في الطريق", icon: Route },
    { key: "delivered", en: "Delivered", ar: "تم التسليم", icon: Home },
  ] as const;

  return (
    <div className="glass glass-premium rounded-2xl p-5 sm:p-7 mt-6 mb-8">
      <div className={`mb-5 flex items-center justify-between gap-3 ${isArabic ? "flex-row-reverse" : ""}`}>
        <h3 className="text-white font-black text-sm sm:text-base">{isArabic ? "مراحل الشحنة" : "Shipment Progress"}</h3>
        <span className="rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 py-1 text-xs font-black text-brand-gold">{Math.round(progress)}%</span>
      </div>
      <div className="relative pt-1">
        <div className="absolute left-0 right-0 top-5 h-1.5 rounded-full bg-white/10" />
        <div className={`absolute top-5 h-1.5 rounded-full bg-brand-gold transition-all duration-700 ${isArabic ? "right-0" : "left-0"}`} style={{ width: `${progress}%` }} />
        <div className={`relative z-10 flex items-start justify-between gap-2 ${isArabic ? "flex-row-reverse" : ""}`}>
          {steps.map((item, index) => {
            const Icon = item.icon;
            const done = index < currentIndex;
            const active = index === currentIndex;
            return <div key={item.key} className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center"><div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${done ? "border-brand-gold bg-brand-gold text-brand-deep" : active ? "border-brand-blue bg-brand-blue text-white shadow-[0_0_18px_rgba(30,144,255,.45)]" : "border-white/20 bg-brand-deep text-white/35"}`}>{done ? <CheckCircle2 className="h-5 w-5" /> : active ? <Icon className="h-5 w-5" /> : <Circle className="h-4 w-4" />}</div><span className={`max-w-[88px] text-[10px] sm:text-xs font-black leading-tight ${done || active ? "text-white" : "text-white/40"}`}>{isArabic ? item.ar : item.en}</span></div>;
          })}
        </div>
      </div>
    </div>
  );
}
