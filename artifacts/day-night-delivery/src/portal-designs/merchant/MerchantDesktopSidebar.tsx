import type { ComponentType } from "react";
import {
  BarChart3,
  Bell,
  BookUser,
  Boxes,
  Building2,
  FileSpreadsheet,
  FileText,
  Headphones,
  Landmark,
  LayoutDashboard,
  MapPin,
  PackageCheck,
  PackagePlus,
  ReceiptText,
  RotateCcw,
  Settings,
  ShieldCheck,
  Store,
  UploadCloud,
  UserCog,
  WalletCards,
} from "lucide-react";
import localAssets, { withRemoteFallback } from "../../data/localAssets";
import type { MerchantNavigate, MerchantProfileViewModel, MerchantSectionId } from "./merchantViewModels";

export type MerchantNavItem = {
  id: MerchantSectionId;
  ar: string;
  en: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

export const merchantNavigationGroups: Array<{ ar: string; en: string; items: MerchantNavItem[] }> = [
  {
    ar: "نظرة عامة",
    en: "Overview",
    items: [
      { id: "dashboard", ar: "الرئيسية", en: "Dashboard", icon: LayoutDashboard },
      { id: "new_order", ar: "إنشاء طلب", en: "Create order", icon: PackagePlus },
      { id: "orders", ar: "جميع الطلبات", en: "All orders", icon: PackageCheck },
      { id: "tracking", ar: "التتبع المباشر", en: "Live tracking", icon: MapPin },
    ],
  },
  {
    ar: "العمليات",
    en: "Operations",
    items: [
      { id: "pickup_requests", ar: "طلبات الاستلام", en: "Pickup requests", icon: Boxes },
      { id: "returns", ar: "المرتجعات", en: "Returns", icon: RotateCcw },
      { id: "under_review", ar: "قيد المراجعة", en: "Under review", icon: ShieldCheck },
      { id: "import_shipments", ar: "استيراد الشحنات", en: "Import shipments", icon: UploadCloud },
    ],
  },
  {
    ar: "المالية",
    en: "Finance",
    items: [
      { id: "cod", ar: "التحصيل COD", en: "COD center", icon: WalletCards },
      { id: "settlements", ar: "التسويات", en: "Settlements", icon: Landmark },
      { id: "statements", ar: "كشوف الحساب", en: "Statements", icon: FileSpreadsheet },
      { id: "invoices", ar: "الفواتير", en: "Invoices", icon: ReceiptText },
      { id: "transactions", ar: "الحركات", en: "Transactions", icon: FileText },
    ],
  },
  {
    ar: "إدارة النشاط",
    en: "Business",
    items: [
      { id: "analytics", ar: "التحليلات", en: "Analytics", icon: BarChart3 },
      { id: "branches", ar: "الفروع", en: "Branches", icon: Building2 },
      { id: "address_book", ar: "دفتر العناوين", en: "Address book", icon: BookUser },
      { id: "profile", ar: "ملف المتجر", en: "Store profile", icon: Store },
      { id: "documents", ar: "المستندات", en: "Documents", icon: FileText },
      { id: "team", ar: "الفريق والصلاحيات", en: "Team & access", icon: UserCog },
    ],
  },
  {
    ar: "التحكم",
    en: "Control",
    items: [
      { id: "notifications", ar: "الإشعارات", en: "Notifications", icon: Bell },
      { id: "support", ar: "الدعم", en: "Support", icon: Headphones },
      { id: "settings", ar: "الإعدادات", en: "Settings", icon: Settings },
    ],
  },
];

export interface MerchantDesktopSidebarProps {
  currentSection: MerchantSectionId;
  merchant: MerchantProfileViewModel;
  isArabic: boolean;
  companyLogoUrl?: string;
  activeOrdersCount?: number;
  onNavigate: MerchantNavigate;
}

export function MerchantDesktopSidebar({
  currentSection,
  merchant,
  isArabic,
  companyLogoUrl,
  activeOrdersCount = 0,
  onNavigate,
}: MerchantDesktopSidebarProps) {
  const officialLogo = companyLogoUrl || localAssets.logo;

  return (
    <aside className="dn-merchant-sidebar" aria-label={isArabic ? "تنقل بوابة التاجر" : "Merchant portal navigation"}>
      <button className="dn-merchant-brand" type="button" onClick={() => onNavigate("dashboard", undefined)}>
        <img src={officialLogo} onError={(event) => withRemoteFallback(event, localAssets.remote.logo)} alt="DAY NIGHT" />
        <span>
          <strong>DAY NIGHT</strong>
          <small>{isArabic ? "مركز أعمال التاجر" : "Merchant Business Center"}</small>
        </span>
      </button>

      <div className="dn-merchant-store-chip">
        <div className="dn-merchant-store-avatar">
          {merchant.logoUrl ? (
            <img src={merchant.logoUrl} onError={(event) => withRemoteFallback(event, localAssets.remote.logo)} alt={merchant.tradeName} />
          ) : (
            <img src={localAssets.logo} onError={(event) => withRemoteFallback(event, localAssets.remote.logo)} alt="DAY NIGHT" />
          )}
        </div>
        <div>
          <strong>{merchant.tradeName}</strong>
          <span dir="ltr">{merchant.merchantCode || merchant.email || merchant.phone || "—"}</span>
        </div>
      </div>

      <nav className="dn-merchant-sidebar-nav">
        {merchantNavigationGroups.map((group) => (
          <section key={group.en}>
            <h2>{isArabic ? group.ar : group.en}</h2>
            {group.items.map(({ id, ar, en, icon: Icon }) => {
              const selected = currentSection === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={selected ? "is-active" : ""}
                  aria-current={selected ? "page" : undefined}
                  onClick={() => onNavigate(id, undefined as never)}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  <span>{isArabic ? ar : en}</span>
                  {id === "orders" && activeOrdersCount > 0 ? <b>{activeOrdersCount}</b> : null}
                </button>
              );
            })}
          </section>
        ))}
      </nav>
    </aside>
  );
}
