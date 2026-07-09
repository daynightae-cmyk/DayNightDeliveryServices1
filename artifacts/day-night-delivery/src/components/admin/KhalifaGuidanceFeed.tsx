import { AlertTriangle, CheckCircle2, Clock3, RotateCcw, Truck, Wallet } from "lucide-react";
import type { Merchant } from "../../types";
import type { FinanceSummary } from "../../lib/adminData";

type Props = { isArabic: boolean; orders: any[]; merchants: Merchant[]; financeSummary?: FinanceSummary | null; sectionTitle?: string };

function amount(value: unknown) { return `${Number(value || 0).toFixed(2)} AED`; }
function norm(value: unknown) { return String(value || "").toLowerCase().replace(/[_-]/g, " "); }

export default function KhalifaGuidanceFeed({ isArabic, orders, merchants, financeSummary, sectionTitle }: Props) {
  const pending = orders.filter((o) => /pending|review|confirm/.test(norm(o.status))).length;
  const returned = orders.filter((o) => norm(o.status).includes("return")).length;
  const unassigned = orders.filter((o) => !o.driver_id && !o.assigned_driver_id && !o.driver_name && !/deliver|cancel|return/.test(norm(o.status))).length;
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter((o) => String(o.created_at || "").slice(0, 10) === today).length;
  const codPending = financeSummary?.cod_pending ?? orders.reduce((sum, o) => /pending|assigned|transit|pickup/.test(norm(o.status)) ? sum + Number(o.cod_amount || 0) : sum, 0);

  const sectionPrefix = sectionTitle ? (isArabic ? `قسم ${sectionTitle}: ` : `${sectionTitle}: `) : "";

  const alerts = [
    pending > 0 && { icon: AlertTriangle, severity: isArabic ? "عاجل" : "Urgent", tone: "gold", title: isArabic ? "طلبات تحتاج قرار" : "Orders need action", message: isArabic ? `${sectionPrefix}${pending} طلب قيد الانتظار أو المراجعة. راجع البيانات قبل التحريك.` : `${sectionPrefix}${pending} pending/review orders need a decision before dispatch.` },
    unassigned > 0 && { icon: Truck, severity: isArabic ? "متابعة" : "Follow-up", tone: "blue", title: isArabic ? "فجوة توزيع" : "Assignment gap", message: isArabic ? `${unassigned} طلب نشط بدون مندوب. افتح التوزيع لتقليل التأخير.` : `${unassigned} active orders have no driver assignment yet.` },
    Number(codPending) > 0 && { icon: Wallet, severity: isArabic ? "متابعة" : "Follow-up", tone: "gold", title: isArabic ? "تذكير COD" : "COD reminder", message: isArabic ? `التحصيل المعلق ${amount(codPending)}. تأكد من إغلاق المبالغ مع المناديب.` : `Pending COD is ${amount(codPending)}. Confirm collection closure with drivers.` },
    returned > 0 && { icon: RotateCcw, severity: isArabic ? "متابعة" : "Follow-up", tone: "gold", title: isArabic ? "طلبات راجعة" : "Returned orders", message: isArabic ? `${returned} طلب راجع يحتاج سبب إغلاق واضح مع التاجر.` : `${returned} returned orders need a clear closure reason with merchants.` },
    { icon: Clock3, severity: isArabic ? "معلومة" : "Info", tone: "blue", title: isArabic ? "ملخص اليوم" : "Today summary", message: isArabic ? `${todayOrders} طلب جديد اليوم، و${merchants.length} تاجر متاح في النظام.` : `${todayOrders} new orders today, with ${merchants.length} merchants in the system.` },
    financeSummary && { icon: Wallet, severity: isArabic ? "معلومة" : "Info", tone: "blue", title: isArabic ? "مستحق التجار" : "Merchant balance", message: isArabic ? `مستحق التجار الحالي ${amount(financeSummary.merchant_payable)}.` : `Current merchant payable is ${amount(financeSummary.merchant_payable)}.` },
  ].filter(Boolean) as { icon: typeof AlertTriangle; severity: string; tone: string; title: string; message: string }[];

  const visibleAlerts = alerts.length ? alerts : [{ icon: CheckCircle2, severity: isArabic ? "معلومة" : "Info", tone: "blue", title: isArabic ? "العمليات مستقرة" : "Operations stable", message: isArabic ? "لا توجد تنبيهات عاجلة الآن. كل شيء مستقر." : "No urgent alerts right now. Operations look stable." }];

  return (
    <section className="dn-khalifa-feed" aria-label={isArabic ? "تغذية خليفة" : "Khalifa Feed"}>
      <header><span>{isArabic ? "تغذية خليفة" : "Khalifa Feed"}</span><strong>{sectionTitle || (isArabic ? "تنبيهات وإرشادات" : "Notifications & Guidance")}</strong></header>
      <div className="dn-khalifa-feed-list">
        {visibleAlerts.map((alert, index) => {
          const Icon = alert.icon;
          return <article key={`${alert.title}-${index}`} className={`is-${alert.tone}`}><div className="dn-khalifa-feed-icon"><Icon className="h-4 w-4" /></div><div><strong>{alert.title}</strong><p>{alert.message}</p></div><span>{alert.severity}</span></article>;
        })}
      </div>
    </section>
  );
}
