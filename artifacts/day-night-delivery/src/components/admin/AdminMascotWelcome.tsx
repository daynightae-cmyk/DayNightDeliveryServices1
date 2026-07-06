import { useEffect } from "react";
import "../../styles/dn-premium-auth-assets.css";

const assets = { loading: "/assets/daynight/premium-auth/03-auth-loading-screen.png" };

export default function AdminMascotWelcome({
  onComplete,
  isArabic = true,
}: {
  onComplete?: () => void;
  isArabic?: boolean;
}) {
  useEffect(() => {
    if (!onComplete) return;
    const timer = window.setTimeout(onComplete, 2600);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  const quick = isArabic ? "دخول سريع" : "Quick entry";

  return (
    <div className="dn-clean-loading-root" role="status" aria-label="DAY NIGHT admin loading" dir={isArabic ? "rtl" : "ltr"}>
      <img className="dn-clean-loading-image" src={assets.loading} alt="DAY NIGHT loading" />
      {onComplete && <button type="button" onClick={onComplete} className="dn-clean-loading-skip">{quick}</button>}
    </div>
  );
}
