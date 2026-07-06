import { useEffect } from "react";
import { CheckCircle2, Database, ShieldCheck } from "lucide-react";
import khalifaAssets from "./khalifaAssets";
import "../../styles/dn-khalifa-final.css";
import "../../styles/dn-auth-gateway-phase1.css";

export function CartoonMascot({ small = false }: { small?: boolean }) {
  return (
    <div className={`dn-khalifa-real-mascot ${small ? "is-small" : ""}`} aria-label="خليفة">
      <img
        src={khalifaAssets.staticMascot}
        alt="خليفة - مساعد DAY NIGHT"
        className="dn-khalifa-real-image"
      />

      {!small && (
        <div className="dn-khalifa-speech" dir="rtl">
          <strong>هلا أبو خليفة يا قيادة</strong>
          <span>أنا خليفة مساعدك الذكي داخل بوابة الإدارة</span>
        </div>
      )}
    </div>
  );
}

export default function AdminMascotWelcome({ onComplete, isArabic = true }: { onComplete?: () => void; isArabic?: boolean }) {
  useEffect(() => {
    if (!onComplete) return;
    const timer = window.setTimeout(onComplete, 2600);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  const ui = isArabic
    ? {
        title: "جاري تجهيز مركز القيادة",
        subtitle: "خليفة يحمّل بيانات الطلبات والتشغيل والتحصيل قبل فتح لوحة التحكم.",
        step1: "تم التحقق من الحساب",
        step2: "تحميل بيانات التشغيل",
        step3: "فتح لوحة الإدارة",
        quick: "دخول سريع",
      }
    : {
        title: "Preparing Command Center",
        subtitle: "Khalifa is loading orders, operations, and collections before opening the dashboard.",
        step1: "Account verified",
        step2: "Loading operations data",
        step3: "Opening admin dashboard",
        quick: "Quick entry",
      };

  return (
    <div className="dn-admin-intro-overlay dn-loading-bridge" role="status" aria-label="DAY NIGHT admin loading" dir={isArabic ? "rtl" : "ltr"}>
      <div className="dn-admin-intro-card dn-loading-bridge-card">
        {onComplete && (
          <button type="button" onClick={onComplete} className="dn-loading-bridge-skip">
            {ui.quick}
          </button>
        )}

        <div className="dn-loading-logo-orbit">
          <img src={khalifaAssets.staticMascot} alt="Khalifa" />
        </div>

        <div className="dn-loading-bridge-copy">
          <span>DAY NIGHT DELIVERY SERVICES</span>
          <h2>{ui.title}</h2>
          <p>{ui.subtitle}</p>
        </div>

        <div className="dn-loading-steps">
          <div><ShieldCheck className="h-4 w-4" />{ui.step1}</div>
          <div><Database className="h-4 w-4" />{ui.step2}</div>
          <div><CheckCircle2 className="h-4 w-4" />{ui.step3}</div>
        </div>

        <div className="dn-admin-loading dn-loading-progress"><i /></div>
      </div>
    </div>
  );
}
