import { useEffect } from "react";
import khalifaAssets from "./khalifaAssets";
import "../../styles/dn-khalifa-final.css";

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

export default function AdminMascotWelcome({ onComplete }: { onComplete?: () => void }) {
  useEffect(() => {
    if (!onComplete) return;
    const timer = window.setTimeout(onComplete, 2600);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="dn-admin-intro-overlay" role="status" aria-label="DAY NIGHT admin loading">
      <div className="dn-admin-intro-card">
        {onComplete && (
          <button
            type="button"
            onClick={onComplete}
            className="absolute left-5 top-5 z-20 rounded-full border border-brand-gold/25 bg-brand-gold/10 px-4 py-2 text-xs font-black text-brand-gold"
          >
            دخول سريع
          </button>
        )}

        <div className="dn-cartoon-stage">
          <CartoonMascot />
          <div className="dn-admin-loading"><i /></div>
          <p className="text-center text-xs font-black text-white/45">
            جاري تجهيز بوابة الإدارة...
          </p>
        </div>
      </div>
    </div>
  );
}
