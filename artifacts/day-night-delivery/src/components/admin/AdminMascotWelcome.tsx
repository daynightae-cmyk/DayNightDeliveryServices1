import { useEffect } from "react";
import { CheckCircle2, Database, ShieldCheck } from "lucide-react";
import "../../styles/dn-premium-auth-assets.css";

const assets = { loading: "/assets/daynight/premium-auth/03-auth-loading-screen.png" };

export default function AdminMascotWelcome({ onComplete, isArabic = true }: { onComplete?: () => void; isArabic?: boolean }) {
  useEffect(() => {
    if (!onComplete) return;
    const timer = window.setTimeout(onComplete, 2600);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  const ui = isArabic
    ? {
        quick: "\u062F\u062E\u0648\u0644 \u0633\u0631\u064A\u0639",
        step1: "\u0641\u062D\u0635 \u0627\u0644\u0623\u0645\u0627\u0646",
        step2: "\u062C\u0644\u0628 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A",
        step3: "\u062A\u0647\u064A\u0626\u0629 \u0627\u0644\u0646\u0638\u0627\u0645",
      }
    : { quick: "Quick entry", step1: "Security check", step2: "Fetching data", step3: "System setup" };

  return (
    <div className="dn-clean-loading-root" role="status" aria-label="DAY NIGHT admin loading" dir={isArabic ? "rtl" : "ltr"}>
      <img className="dn-clean-loading-image" src={assets.loading} alt="DAY NIGHT loading" />
      {onComplete && <button type="button" onClick={onComplete} className="dn-clean-loading-skip">{ui.quick}</button>}
      <div className="dn-clean-loading-overlay-card">
        <div className="dn-clean-loading-progress"><i /></div>
        <div className="dn-clean-loading-steps">
          <strong><ShieldCheck />{ui.step1}</strong>
          <strong><Database />{ui.step2}</strong>
          <strong><CheckCircle2 />{ui.step3}</strong>
        </div>
      </div>
    </div>
  );
}