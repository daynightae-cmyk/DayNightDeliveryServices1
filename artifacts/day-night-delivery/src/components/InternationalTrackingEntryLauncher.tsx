import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  CheckCircle2,
  Globe2,
  Headphones,
  MapPinned,
  PackageSearch,
  Plane,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import "../styles/dn-international-tracking.css";

function usePortalSlot(pathname: string) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let ownedSlot: HTMLElement | null = null;
    const install = () => {
      if (disposed) return;
      const existing = document.getElementById("dn-international-tracking-entry-slot");
      if (existing) {
        setSlot(existing);
        return;
      }
      const footer = document.querySelector("footer");
      if (!footer?.parentElement) return;
      ownedSlot = document.createElement("div");
      ownedSlot.id = "dn-international-tracking-entry-slot";
      footer.parentElement.insertBefore(ownedSlot, footer);
      setSlot(ownedSlot);
    };
    install();
    const observer = new MutationObserver(install);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      disposed = true;
      observer.disconnect();
      ownedSlot?.remove();
      setSlot(null);
    };
  }, [pathname]);

  return slot;
}

const faq = {
  ar: [
    ["كيف أتتبع شحنتي؟", "أدخل رقم DAY NIGHT أو رقم الطلب أو بوليصة أرامكس في صفحة التتبع الدولي."],
    ["أين أجد رقم البوليصة؟", "يظهر رقم AWB على ملصق أرامكس ورسالة تأكيد الشحن."],
    ["ماذا تعني In Transit؟", "تعني أن الشحنة تتحرك بين مراكز أرامكس أو في طريقها إلى بلد الوجهة."],
    ["ماذا أفعل عند التأخير؟", "راجع آخر نقطة مسجلة ثم تواصل مع دعم DAY NIGHT من صفحة النتيجة."],
    ["ماذا يحدث في الجمارك؟", "قد تخضع الشحنة للمراجعة أو الرسوم حسب بلد الوجهة ومحتواها."],
    ["كيف أتواصل مع الدعم؟", "زر WhatsApp والدعم متاحان مباشرة داخل صفحة التتبع."],
  ],
  en: [
    ["How do I track my shipment?", "Enter a DAY NIGHT reference, order number, or Aramex AWB on the international tracking page."],
    ["Where is the AWB number?", "The AWB appears on the Aramex label and the shipment confirmation."],
    ["What does In Transit mean?", "The shipment is moving between Aramex facilities or toward the destination country."],
    ["What should I do if delayed?", "Review the latest checkpoint and contact DAY NIGHT support from the results page."],
    ["What happens at customs?", "A shipment may be inspected or charged duties according to its destination and contents."],
    ["How do I contact support?", "WhatsApp and support actions are available directly in the tracking result."],
  ],
};

export default function InternationalTrackingEntryLauncher() {
  const pathname = typeof window !== "undefined" ? window.location.pathname.replace(/\/+$/, "") || "/" : "/";
  const relevant = pathname === "/" || pathname === "/tracking" || pathname === "/international-shipping";
  const slot = usePortalSlot(relevant ? pathname : "disabled");
  const { language } = useAppContext();
  const isArabic = language === "ar";

  if (!relevant || !slot) return null;

  const compact = pathname === "/tracking";
  const internationalPage = pathname === "/international-shipping";

  return createPortal(
    <section className={`dn-it-entry ${compact ? "is-compact" : ""} ${internationalPage ? "is-service-page" : ""}`} dir={isArabic ? "rtl" : "ltr"}>
      <div className="dn-it-entry-inner">
        <div className="dn-it-entry-visual" aria-hidden="true">
          <div><Globe2 /></div>
          <span><Plane /></span>
          <i><MapPinned /></i>
        </div>
        <div className="dn-it-entry-copy">
          <span className="dn-it-entry-kicker"><PackageSearch />{isArabic ? "مركز التتبع الدولي" : "INTERNATIONAL TRACKING CENTER"}</span>
          <h2>{compact
            ? (isArabic ? "هل تبحث عن شحنة أرامكس دولية؟" : "Tracking an international Aramex shipment?")
            : (isArabic ? "الشحن الدولي أصبح أوضح مع DAY NIGHT" : "International shipping is clearer with DAY NIGHT")}</h2>
          <p>{isArabic
            ? "تتبّع بوليصة أرامكس، آخر نقطة مسجلة، حالة الجمارك، والرحلة الكاملة من داخل موقع DAY NIGHT."
            : "Track an Aramex AWB, the latest carrier checkpoint, customs status, and the complete journey inside DAY NIGHT."}</p>
          <div className="dn-it-entry-features">
            <span><CheckCircle2 />{isArabic ? "دول الخليج" : "GCC destinations"}</span>
            <span><Globe2 />{isArabic ? "جميع دول العالم" : "Worldwide shipping"}</span>
            <span><ShieldCheck />{isArabic ? "بيانات آمنة" : "Secure data"}</span>
            <span><Headphones />{isArabic ? "دعم مباشر" : "Direct support"}</span>
          </div>
          <div className="dn-it-entry-actions">
            <a href="/international-tracking"><Search />{isArabic ? "تتبع شحنة دولية" : "Track international shipment"}<ArrowRight /></a>
            {!compact && <a href="/request" className="is-secondary"><Plane />{isArabic ? "طلب شحن دولي" : "Request international shipping"}</a>}
          </div>
        </div>
      </div>

      {internationalPage && (
        <div className="dn-it-faq-block">
          <header><span>{isArabic ? "معلومات سريعة" : "QUICK INFORMATION"}</span><h2>{isArabic ? "أسئلة الشحن والتتبع الدولي" : "International shipping and tracking FAQ"}</h2></header>
          <div className="dn-it-faq-grid">
            {faq[isArabic ? "ar" : "en"].map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
          </div>
        </div>
      )}
    </section>,
    slot,
  );
}
