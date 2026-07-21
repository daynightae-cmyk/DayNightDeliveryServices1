import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AlertTriangle, Database, Loader2, RefreshCw, SearchX, WifiOff } from "lucide-react";
import { merchantStatusClass, merchantStatusLabel } from "./merchantStatusMapping";

export function MerchantSectionHeader({
  eyebrowAr,
  eyebrowEn,
  titleAr,
  titleEn,
  descriptionAr,
  descriptionEn,
  isArabic,
  actions,
}: {
  eyebrowAr?: string;
  eyebrowEn?: string;
  titleAr: string;
  titleEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  isArabic: boolean;
  actions?: ReactNode;
}) {
  return (
    <header className="dn-merchant-section-header">
      <div>
        {eyebrowAr || eyebrowEn ? <span>{isArabic ? eyebrowAr : eyebrowEn}</span> : null}
        <h2>{isArabic ? titleAr : titleEn}</h2>
        {descriptionAr || descriptionEn ? <p>{isArabic ? descriptionAr : descriptionEn}</p> : null}
      </div>
      {actions ? <div className="dn-merchant-section-actions">{actions}</div> : null}
    </header>
  );
}

export function MerchantCard({ children, className = "", tone = "default" }: { children: ReactNode; className?: string; tone?: "default" | "navy" | "gold" | "danger" | "warning" }) {
  return <section className={`dn-merchant-card is-${tone} ${className}`}>{children}</section>;
}

export function MerchantButton({ children, variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "gold" }) {
  return <button {...props} className={`dn-merchant-button is-${variant} ${className}`}>{children}</button>;
}

export function MerchantStatusBadge({ status, isArabic }: { status: string; isArabic: boolean }) {
  return <span className={merchantStatusClass(status)}>{merchantStatusLabel(status, isArabic)}</span>;
}

export function MerchantSourceBadge({ source, isArabic }: { source: "live" | "derived" | "unavailable"; isArabic: boolean }) {
  const label = source === "live" ? (isArabic ? "مباشر" : "Live") : source === "derived" ? (isArabic ? "محسوب" : "Derived") : (isArabic ? "غير متاح" : "Unavailable");
  return <span className={`dn-merchant-source is-${source}`}><Database className="h-3.5 w-3.5" />{label}</span>;
}

export function MerchantStatePanel({
  type,
  isArabic,
  titleAr,
  titleEn,
  descriptionAr,
  descriptionEn,
  onRetry,
}: {
  type: "loading" | "empty" | "filtered" | "error" | "offline" | "unavailable";
  isArabic: boolean;
  titleAr?: string;
  titleEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  onRetry?: () => void;
}) {
  const Icon = type === "loading" ? Loader2 : type === "offline" ? WifiOff : type === "error" ? AlertTriangle : SearchX;
  const defaults = {
    loading: { ar: "جاري تحميل البيانات", en: "Loading data", dar: "يرجى الانتظار لحين اكتمال الطلب.", den: "Please wait while the request completes." },
    empty: { ar: "لا توجد بيانات بعد", en: "No data yet", dar: "ستظهر البيانات هنا بمجرد توفرها من النظام.", den: "Data will appear here when it becomes available." },
    filtered: { ar: "لا توجد نتائج مطابقة", en: "No matching results", dar: "غيّر البحث أو الفلاتر الحالية.", den: "Adjust the current search or filters." },
    error: { ar: "تعذر تحميل البيانات", en: "Data could not be loaded", dar: "أعد المحاولة أو تواصل مع الدعم إذا استمرت المشكلة.", den: "Retry, or contact support if the problem continues." },
    offline: { ar: "أنت غير متصل", en: "You are offline", dar: "يمكنك مراجعة البيانات المحمّلة، لكن العمليات لن تُحفظ عن بعد الآن.", den: "Loaded data remains available, but remote changes cannot be saved now." },
    unavailable: { ar: "الخدمة غير متاحة في البيئة الحالية", en: "This service is unavailable in the current environment", dar: "لم يتم تفعيل مصدر بيانات موثوق لهذه الأداة بعد.", den: "No authoritative data source is enabled for this tool yet." },
  }[type];
  return (
    <div className={`dn-merchant-state-panel is-${type}`}>
      <span><Icon className={`h-7 w-7 ${type === "loading" ? "animate-spin" : ""}`} /></span>
      <h3>{isArabic ? titleAr || defaults.ar : titleEn || defaults.en}</h3>
      <p>{isArabic ? descriptionAr || defaults.dar : descriptionEn || defaults.den}</p>
      {onRetry ? <MerchantButton variant="secondary" onClick={onRetry}><RefreshCw className="h-4 w-4" />{isArabic ? "إعادة المحاولة" : "Retry"}</MerchantButton> : null}
    </div>
  );
}

export function MerchantField({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return <label className="dn-merchant-field"><span>{label}{required ? <b>*</b> : null}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

export function MerchantModal({ open, title, children, onClose, footer }: { open: boolean; title: string; children: ReactNode; onClose(): void; footer?: ReactNode }) {
  if (!open) return null;
  return (
    <div className="dn-merchant-modal-backdrop" role="dialog" aria-modal="true" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section className="dn-merchant-modal">
        <header><h2>{title}</h2><button type="button" onClick={onClose}>×</button></header>
        <div className="dn-merchant-modal-body">{children}</div>
        {footer ? <footer>{footer}</footer> : null}
      </section>
    </div>
  );
}
