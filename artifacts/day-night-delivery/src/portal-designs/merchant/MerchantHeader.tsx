import { ArrowLeft, ArrowRight, Bell, Home, Languages, LogOut, Menu, MoonStar, RefreshCw, Search, SunMedium } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import localAssets, { withRemoteFallback } from "../../data/localAssets";
import type { MerchantConnectionViewModel, MerchantProfileViewModel, MerchantSectionId } from "./merchantViewModels";

const sectionTitles: Record<MerchantSectionId, { ar: string; en: string }> = {
  dashboard: { ar: "لوحة التاجر", en: "Merchant dashboard" },
  new_order: { ar: "إنشاء طلب جديد", en: "Create new order" },
  orders: { ar: "جميع الطلبات", en: "All orders" },
  order_details: { ar: "تفاصيل الطلب", en: "Order details" },
  tracking: { ar: "التتبع المباشر", en: "Live tracking" },
  pickup_requests: { ar: "طلبات الاستلام", en: "Pickup requests" },
  returns: { ar: "المرتجعات", en: "Returns" },
  cancelled: { ar: "الطلبات الملغاة", en: "Cancelled orders" },
  postponed: { ar: "الطلبات المؤجلة", en: "Postponed orders" },
  under_review: { ar: "قيد المراجعة", en: "Under review" },
  import_shipments: { ar: "استيراد الشحنات", en: "Import shipments" },
  cod: { ar: "مركز التحصيل", en: "COD center" },
  settlements: { ar: "التسويات", en: "Settlements" },
  statements: { ar: "كشوف الحساب", en: "Statements" },
  invoices: { ar: "الفواتير", en: "Invoices" },
  wallet: { ar: "المحفظة", en: "Wallet" },
  transactions: { ar: "الحركات المالية", en: "Transactions" },
  analytics: { ar: "تحليلات المتجر", en: "Store analytics" },
  reports: { ar: "التقارير", en: "Reports" },
  branches: { ar: "الفروع", en: "Branches" },
  pickup_addresses: { ar: "عناوين الاستلام", en: "Pickup addresses" },
  address_book: { ar: "دفتر العناوين", en: "Address book" },
  profile: { ar: "ملف المتجر", en: "Store profile" },
  branding: { ar: "هوية المتجر", en: "Store branding" },
  business_details: { ar: "بيانات النشاط", en: "Business details" },
  bank_details: { ar: "البيانات البنكية", en: "Bank details" },
  documents: { ar: "المستندات", en: "Documents" },
  team: { ar: "الفريق والصلاحيات", en: "Team & access" },
  notifications: { ar: "الإشعارات", en: "Notifications" },
  support: { ar: "الدعم", en: "Support" },
  integrations: { ar: "التكاملات", en: "Integrations" },
  settings: { ar: "الإعدادات", en: "Settings" },
  security: { ar: "الأمان والجلسات", en: "Security & sessions" },
};

export interface MerchantHeaderProps {
  section: MerchantSectionId;
  merchant: MerchantProfileViewModel;
  connection: MerchantConnectionViewModel;
  isArabic: boolean;
  isDark: boolean;
  unreadCount: number;
  refreshing?: boolean;
  onOpenMenu(): void;
  onOpenSearch(): void;
  onOpenNotifications(): void;
  onRefresh(): void;
  onToggleLanguage(): void;
  onToggleTheme(): void;
  onLogout(): void;
}

export function MerchantHeader(props: MerchantHeaderProps) {
  const navigate = useNavigate();
  const {
    section,
    merchant,
    connection,
    isArabic,
    isDark,
    unreadCount,
    refreshing,
    onOpenMenu,
    onOpenSearch,
    onOpenNotifications,
    onRefresh,
    onToggleLanguage,
    onToggleTheme,
    onLogout,
  } = props;
  const title = sectionTitles[section];
  const connectionLabel = connection.state === "connected"
    ? (isArabic ? "متصل مباشر" : "Live connected")
    : connection.state === "reconnecting"
      ? (isArabic ? "إعادة اتصال" : "Reconnecting")
      : connection.state === "stale"
        ? (isArabic ? "بيانات قديمة" : "Stale data")
        : connection.state === "offline"
          ? (isArabic ? "غير متصل" : "Offline")
          : (isArabic ? "غير متاح" : "Unavailable");

  return (
    <header className="dn-merchant-header">
      <div className="dn-merchant-header-title">
        <button type="button" className="dn-merchant-mobile-menu" onClick={onOpenMenu} aria-label={isArabic ? "فتح القائمة" : "Open menu"}>
          <Menu className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => navigate("/merchant")}
          aria-label="DAY NIGHT"
          style={{
            display: "grid",
            placeItems: "center",
            flex: "0 0 46px",
            width: 46,
            height: 46,
            padding: 3,
            border: "1px solid rgba(212,175,55,.55)",
            borderRadius: 15,
            background: "#071a33",
            overflow: "hidden",
          }}
        >
          <img
            src={localAssets.logo}
            onError={(event) => withRemoteFallback(event, localAssets.remote.logo)}
            alt="DAY NIGHT"
            style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 11, background: "#fff" }}
          />
        </button>
        <div>
          <span>{merchant.tradeName}</span>
          <h1>{isArabic ? title.ar : title.en}</h1>
          <small className={`dn-merchant-connection is-${connection.state}`}><i />{connectionLabel}</small>
        </div>
      </div>
      <div className="dn-merchant-header-actions">
        <button type="button" onClick={() => navigate(-1)} aria-label={isArabic ? "رجوع" : "Back"}>{isArabic ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}</button>
        <Link to="/" aria-label={isArabic ? "الموقع الرئيسي" : "Main website"}><Home className="h-5 w-5" /></Link>
        <button type="button" onClick={onOpenSearch} aria-label={isArabic ? "البحث" : "Search"}><Search className="h-5 w-5" /></button>
        <button type="button" onClick={onRefresh} aria-label={isArabic ? "تحديث البيانات" : "Refresh data"}><RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} /></button>
        <button type="button" onClick={onOpenNotifications} className="is-notification" aria-label={isArabic ? "الإشعارات" : "Notifications"}>
          <Bell className="h-5 w-5" />{unreadCount > 0 ? <b>{unreadCount > 99 ? "99+" : unreadCount}</b> : null}
        </button>
        <button type="button" onClick={onToggleLanguage} aria-label={isArabic ? "English" : "العربية"}><Languages className="h-5 w-5" /><span>{isArabic ? "EN" : "ع"}</span></button>
        <button type="button" onClick={onToggleTheme} aria-label={isArabic ? "تغيير المظهر" : "Change theme"}>{isDark ? <SunMedium className="h-5 w-5" /> : <MoonStar className="h-5 w-5" />}</button>
        <button type="button" className="is-logout" onClick={onLogout} aria-label={isArabic ? "تسجيل الخروج" : "Sign out"}><LogOut className="h-5 w-5" /></button>
      </div>
    </header>
  );
}
