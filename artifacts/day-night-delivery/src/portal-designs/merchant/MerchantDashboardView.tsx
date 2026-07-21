import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Camera,
  FileSpreadsheet,
  MapPin,
  PackageCheck,
  PackagePlus,
  Truck,
  WalletCards,
} from "lucide-react";
import type { MerchantPortalCallbacks } from "./merchantCallbacks";
import { merchantDate, merchantMoney } from "./merchantFormatters";
import { isMerchantOrderActive, normalizeMerchantStatus } from "./merchantStatusMapping";
import type { MerchantPortalData } from "./merchantViewModels";
import { MerchantButton, MerchantCard, MerchantSectionHeader, MerchantSourceBadge, MerchantStatePanel, MerchantStatusBadge } from "./MerchantUi";

export interface MerchantDashboardViewProps {
  data: MerchantPortalData;
  callbacks: MerchantPortalCallbacks;
  isArabic: boolean;
}

export function MerchantDashboardView({ data, callbacks, isArabic }: MerchantDashboardViewProps) {
  const locale = isArabic ? "ar-AE" : "en-AE";
  const activeOrders = useMemo(() => data.orders.filter((order) => isMerchantOrderActive(order.status)), [data.orders]);
  const attentionOrders = useMemo(() => data.orders.filter((order) => ["failed", "delivery_failed", "under_review", "review", "postponed", "return_requested"].includes(normalizeMerchantStatus(order.status))), [data.orders]);
  const recentOrders = data.orders.slice(0, 6);
  const profileFields = [data.merchant.logoUrl, data.merchant.phone, data.merchant.email, data.merchant.address, data.merchant.pickupAddress, data.merchant.licenseNumber, data.merchant.trn, data.merchant.maskedIban];
  const readiness = Math.round((profileFields.filter(Boolean).length / profileFields.length) * 100);

  const quickActions = [
    { icon: PackagePlus, ar: "إنشاء طلب", en: "Create order", action: () => callbacks.onNavigate("new_order", undefined), tone: "gold" },
    { icon: Camera, ar: "تصوير كوبون", en: "Capture coupon", action: () => callbacks.onNavigate("new_order", { couponImageUrl: "" }), tone: "blue" },
    { icon: FileSpreadsheet, ar: "استيراد شحنات", en: "Import shipments", action: () => callbacks.onNavigate("import_shipments", undefined), tone: "navy" },
    { icon: Truck, ar: "طلب استلام", en: "Request pickup", action: () => callbacks.onNavigate("pickup_requests", undefined), tone: "green" },
    { icon: MapPin, ar: "تتبع مباشر", en: "Live tracking", action: () => callbacks.onNavigate("tracking", undefined), tone: "blue" },
    { icon: WalletCards, ar: "مركز COD", en: "COD center", action: () => callbacks.onNavigate("cod", undefined), tone: "gold" },
  ];

  return (
    <div className="dn-merchant-stack">
      <section className="dn-merchant-dashboard-hero">
        <div>
          <span>{isArabic ? "مركز تشغيل المتجر" : "STORE OPERATIONS CENTER"}</span>
          <h2>{isArabic ? `مرحباً، ${data.merchant.tradeName}` : `Welcome, ${data.merchant.tradeName}`}</h2>
          <p>{isArabic ? "أنشئ الطلبات، تابع المندوب، راجع التحصيل والتسويات، وأدر بيانات نشاطك من مكان واحد." : "Create shipments, follow couriers, review COD and settlements, and manage your business from one workspace."}</p>
          <div>
            <MerchantButton variant="gold" onClick={() => callbacks.onNavigate("new_order", undefined)}><PackagePlus className="h-5 w-5" />{isArabic ? "طلب جديد" : "New order"}</MerchantButton>
            <MerchantButton variant="secondary" onClick={() => callbacks.onNavigate("orders", undefined)}><PackageCheck className="h-5 w-5" />{isArabic ? "فتح الطلبات" : "Open orders"}</MerchantButton>
          </div>
        </div>
        <aside>
          <span>{isArabic ? "جاهزية الحساب" : "Account readiness"}</span>
          <strong>{readiness}%</strong>
          <div><i style={{ width: `${readiness}%` }} /></div>
          <small>{isArabic ? "مؤشر مشتق من اكتمال بيانات النشاط والمستندات الأساسية." : "Derived from the completeness of business and document data."}</small>
        </aside>
      </section>

      <section className="dn-merchant-metrics-grid">
        {data.metrics.map((metric) => (
          <button key={metric.id} type="button" className={`dn-merchant-metric is-${metric.status || "neutral"}`} onClick={() => metric.actionSection && callbacks.onNavigate(metric.actionSection, undefined as never)}>
            <span>{isArabic ? metric.labelAr : metric.labelEn}</span>
            <strong>{metric.value === null ? "—" : metric.currency ? merchantMoney(Number(metric.value), metric.currency, locale) : metric.value}</strong>
            <MerchantSourceBadge source={metric.source} isArabic={isArabic} />
          </button>
        ))}
      </section>

      <MerchantSectionHeader
        eyebrowAr="الوصول السريع"
        eyebrowEn="QUICK ACTIONS"
        titleAr="ابدأ المهمة المطلوبة فوراً"
        titleEn="Start the required task immediately"
        descriptionAr="كل إجراء يقود إلى أداة تشغيل حقيقية أو حالة عدم توفر واضحة."
        descriptionEn="Every action opens an operational tool or an explicit unavailable state."
        isArabic={isArabic}
      />
      <section className="dn-merchant-quick-grid">
        {quickActions.map(({ icon: Icon, ar, en, action, tone }) => (
          <button key={en} type="button" className={`is-${tone}`} onClick={action}>
            <span><Icon className="h-6 w-6" /></span><strong>{isArabic ? ar : en}</strong><ArrowUpRight className="h-4 w-4" />
          </button>
        ))}
      </section>

      <div className="dn-merchant-dashboard-columns">
        <MerchantCard>
          <header className="dn-merchant-card-header">
            <div><span>{isArabic ? "الطلبات الأخيرة" : "RECENT ORDERS"}</span><h3>{isArabic ? "آخر حركة على متجرك" : "Latest store activity"}</h3></div>
            <MerchantButton variant="ghost" onClick={() => callbacks.onNavigate("orders", undefined)}>{isArabic ? "عرض الكل" : "View all"}</MerchantButton>
          </header>
          {recentOrders.length === 0 ? <MerchantStatePanel type="empty" isArabic={isArabic} /> : (
            <div className="dn-merchant-recent-orders">
              {recentOrders.map((order) => (
                <button key={order.id} type="button" onClick={() => callbacks.onOpenOrder(order.id)}>
                  <div><strong dir="ltr">{order.trackingNumber}</strong><span>{order.recipientName}</span><small>{order.deliveryCity || order.deliveryAddress || "—"}</small></div>
                  <div><MerchantStatusBadge status={order.status} isArabic={isArabic} /><span>{merchantMoney(order.codAmount, "AED", locale)}</span><small>{merchantDate(order.updatedAt || order.createdAt, isArabic)}</small></div>
                </button>
              ))}
            </div>
          )}
        </MerchantCard>

        <div className="dn-merchant-dashboard-side">
          <MerchantCard tone={attentionOrders.length ? "warning" : "default"}>
            <header className="dn-merchant-card-header"><div><span>{isArabic ? "تحتاج انتباهك" : "NEEDS ATTENTION"}</span><h3>{isArabic ? "الاستثناءات التشغيلية" : "Operational exceptions"}</h3></div><AlertTriangle className="h-5 w-5" /></header>
            {attentionOrders.length ? (
              <div className="dn-merchant-alert-list">
                {attentionOrders.slice(0, 4).map((order) => <button type="button" key={order.id} onClick={() => callbacks.onOpenOrder(order.id)}><MerchantStatusBadge status={order.status} isArabic={isArabic} /><strong dir="ltr">{order.trackingNumber}</strong><span>{order.recipientName}</span></button>)}
              </div>
            ) : <p className="dn-merchant-calm-message">{isArabic ? "لا توجد طلبات حرجة في البيانات الحالية." : "No critical orders in the current data."}</p>}
          </MerchantCard>

          <MerchantCard tone="gold">
            <header className="dn-merchant-card-header"><div><span>{isArabic ? "المالية" : "FINANCE"}</span><h3>{isArabic ? "ملخص التحصيل" : "Collection summary"}</h3></div><WalletCards className="h-5 w-5" /></header>
            <dl className="dn-merchant-finance-mini">
              <div><dt>{isArabic ? "COD قيد التحصيل" : "COD pending"}</dt><dd>{merchantMoney(data.codSummary.pending, "AED", locale)}</dd></div>
              <div><dt>{isArabic ? "تم التحصيل" : "Collected"}</dt><dd>{merchantMoney(data.codSummary.collected, "AED", locale)}</dd></div>
              <div><dt>{isArabic ? "متاح للتسوية" : "Available"}</dt><dd>{merchantMoney(data.codSummary.available, "AED", locale)}</dd></div>
            </dl>
            <MerchantButton variant="secondary" onClick={() => callbacks.onNavigate("cod", undefined)}>{isArabic ? "فتح مركز المالية" : "Open finance center"}</MerchantButton>
          </MerchantCard>

          <MerchantCard>
            <header className="dn-merchant-card-header"><div><span>{isArabic ? "الاستلام" : "PICKUPS"}</span><h3>{isArabic ? "طلبات الاستلام القادمة" : "Upcoming pickup requests"}</h3></div><Truck className="h-5 w-5" /></header>
            <strong className="dn-merchant-large-number">{data.pickupRequests.filter((request) => !["completed", "cancelled"].includes(normalizeMerchantStatus(request.status))).length}</strong>
            <p>{activeOrders.length ? (isArabic ? `${activeOrders.length} طلباً نشطاً ينتظر استكمال التشغيل.` : `${activeOrders.length} active orders are still moving through operations.`) : (isArabic ? "لا توجد طلبات نشطة حالياً." : "There are no active orders right now.")}</p>
            <MerchantButton variant="ghost" onClick={() => callbacks.onNavigate("pickup_requests", undefined)}>{isArabic ? "إدارة الاستلام" : "Manage pickups"}</MerchantButton>
          </MerchantCard>
        </div>
      </div>
    </div>
  );
}
