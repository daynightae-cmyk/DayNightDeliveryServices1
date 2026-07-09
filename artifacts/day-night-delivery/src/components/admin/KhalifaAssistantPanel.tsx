import { Activity, Clock3, Package, Store, Wallet } from "lucide-react";
import type { Merchant } from "../../types";
import type { FinanceSummary } from "../../lib/adminData";
import khalifaAssets from "./khalifaAssets";
import KhalifaGuidanceFeed from "./KhalifaGuidanceFeed";

type Props = { isArabic: boolean; activeSection: string; activeTitle: string; orders: any[]; merchants: Merchant[]; financeSummary?: FinanceSummary | null; lastSyncAt?: Date | null };
function norm(value: unknown) { return String(value || "").toLowerCase().replace(/[_-]/g, " "); }
function money(value: unknown) { return `${Number(value || 0).toFixed(2)} AED`; }

export default function KhalifaAssistantPanel({ isArabic, activeSection, activeTitle, orders, merchants, financeSummary, lastSyncAt }: Props) {
  const activeOrders = orders.filter((order) => !/deliver|cancel|return/.test(norm(order.status))).length;
  const codPending = financeSummary?.cod_pending ?? orders.reduce((sum, order) => /pending|assigned|pickup|transit/.test(norm(order.status)) ? sum + Number(order.cod_amount || 0) : sum, 0);
  const lastSync = lastSyncAt ? lastSyncAt.toLocaleTimeString(isArabic ? "ar-AE" : "en-AE", { hour: "2-digit", minute: "2-digit" }) : (isArabic ? "بانتظار المزامنة" : "Waiting for sync");
  return <aside className="dn-khalifa-persistent-shell" aria-label={isArabic ? "لوحة خليفة" : "Khalifa assistant panel"} data-section={activeSection}>
    <div className="dn-khalifa-assistant-panel">
      <div className="dn-khalifa-identity">
        <img src={khalifaAssets.bot} alt={isArabic ? "خليفة" : "Khalifa"} />
        <div><strong>{isArabic ? "خليفة" : "Khalifa"}</strong><span>{isArabic ? "مساعد العمليات الذكي" : "Smart operations assistant"}</span></div>
      </div>
      <div className="dn-khalifa-live">
        <span><Activity className="mb-1 h-4 w-4 text-brand-sky" /><b>{isArabic ? "الحالة" : "Status"}</b>{isArabic ? "متصل بالبيانات" : "Live data"}</span>
        <span><Clock3 className="mb-1 h-4 w-4 text-brand-gold" /><b>{isArabic ? "آخر مزامنة" : "Last sync"}</b>{lastSync}</span>
      </div>
      <div className="dn-khalifa-kpis">
        <span><Package className="mb-1 h-4 w-4 text-brand-gold" /><b>{orders.length}</b>{isArabic ? "طلبات" : "Orders"}</span>
        <span><Store className="mb-1 h-4 w-4 text-brand-sky" /><b>{merchants.length}</b>{isArabic ? "تجار" : "Merchants"}</span>
        <span><Wallet className="mb-1 h-4 w-4 text-brand-gold" /><b>{money(codPending)}</b>COD</span>
      </div>
      <KhalifaGuidanceFeed key={activeSection} isArabic={isArabic} orders={orders} merchants={merchants} financeSummary={financeSummary} sectionTitle={activeTitle} activeSection={activeSection} activeOrders={activeOrders} />
    </div>
  </aside>;
}
