import { useEffect } from "react";
import { CheckCircle2, Database, ShieldCheck, Sparkles } from "lucide-react";
import "../../styles/dn-khalifa-final.css";
import "../../styles/dn-premium-auth-assets.css";

const premiumAssets = {
  loadingBridge: "/assets/daynight/premium-auth/dn-auth-loading-bridge.png",
  khalifaRobot: "/assets/daynight/premium-auth/dn-khalifa-robot.png",
  khalifaAssistant: "/assets/daynight/premium-auth/dn-khalifa-assistant-card.png",
};

export function CartoonMascot({ small = false }: { small?: boolean }) {
  return (
    <div className={`dn-khalifa-real-mascot ${small ? "is-small" : ""}`} aria-label="Ø®Ù„ÙŠÙØ©">
      <img
        src={premiumAssets.khalifaRobot}
        alt="Ø®Ù„ÙŠÙØ© - Ù…Ø³Ø§Ø¹Ø¯ DAY NIGHT"
        className="dn-khalifa-real-image"
      />

      {!small && (
        <div className="dn-khalifa-speech" dir="rtl">
          <strong>Ù‡Ù„Ø§ Ø£Ø¨Ùˆ Ø®Ù„ÙŠÙØ© ÙŠØ§ Ù‚ÙŠØ§Ø¯Ø©</strong>
          <span>Ø£Ù†Ø§ Ø®Ù„ÙŠÙØ© Ù…Ø³Ø§Ø¹Ø¯Ùƒ Ø§Ù„Ø°ÙƒÙŠ Ø¯Ø§Ø®Ù„ Ø¨ÙˆØ§Ø¨Ø© Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©</span>
        </div>
      )}
    </div>
  );
}

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

  const ui = isArabic
    ? {
        title: "Ø¬Ø§Ø±ÙŠ ØªØ¬Ù‡ÙŠØ² Ù…Ø±ÙƒØ² Ø§Ù„Ù‚ÙŠØ§Ø¯Ø©",
        subtitle: "Ù†Ù‚ÙˆÙ… Ø§Ù„Ø¢Ù† Ø¨Ø¥Ø¹Ø¯Ø§Ø¯ Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ… Ø§Ù„Ø¥Ø¯Ø§Ø±ÙŠØ© Ø§Ù„Ø®Ø§ØµØ© Ø¨Ùƒ Ù„Ø¶Ù…Ø§Ù† ØªØ¬Ø±Ø¨Ø© Ø³Ù„Ø³Ø© ÙˆØ¢Ù…Ù†Ø©.",
        step1: "ÙØ­Øµ Ø§Ù„Ø£Ù…Ø§Ù†",
        step2: "Ø¬Ù„Ø¨ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª",
        step3: "ØªÙ‡ÙŠØ¦Ø© Ø§Ù„Ù†Ø¸Ø§Ù…",
        quick: "Ø¯Ø®ÙˆÙ„ Ø³Ø±ÙŠØ¹",
      }
    : {
        title: "Preparing Command Center",
        subtitle: "Preparing your admin control center for a smooth and secure experience.",
        step1: "Security check",
        step2: "Fetching data",
        step3: "System setup",
        quick: "Quick entry",
      };

  return (
    <div className="dn-premium-loading-overlay" role="status" aria-label="DAY NIGHT admin loading" dir={isArabic ? "rtl" : "ltr"}>
      <div className="dn-premium-loading-bg" aria-hidden="true" />
      <section className="dn-premium-loading-card">
        {onComplete && (
          <button type="button" onClick={onComplete} className="dn-premium-loading-skip">
            {ui.quick}
          </button>
        )}

        <div className="dn-premium-loading-image">
          <img src={premiumAssets.loadingBridge} alt={ui.title} />
        </div>

        <div className="dn-premium-loading-live">
          <span><Sparkles /> DAY NIGHT DELIVERY</span>
          <h2>{ui.title}</h2>
          <p>{ui.subtitle}</p>

          <div className="dn-premium-loading-progress">
            <i />
          </div>

          <div className="dn-premium-loading-steps">
            <strong><ShieldCheck />{ui.step1}</strong>
            <strong><Database />{ui.step2}</strong>
            <strong><CheckCircle2 />{ui.step3}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}