import { useMemo, useState, type ReactNode } from "react";
import { MerchantBottomNavigation } from "./MerchantBottomNavigation";
import { MerchantCommandPalette } from "./MerchantCommandPalette";
import { MerchantDesktopSidebar } from "./MerchantDesktopSidebar";
import { MerchantHeader } from "./MerchantHeader";
import { MerchantMobileMoreSheet } from "./MerchantMobileMoreSheet";
import type { MerchantGlobalSearchResult, MerchantPortalCallbacks } from "./merchantCallbacks";
import { isMerchantOrderActive } from "./merchantStatusMapping";
import type { MerchantPortalData, MerchantSectionId } from "./merchantViewModels";

export interface MerchantPortalShellProps {
  currentSection: MerchantSectionId;
  data: MerchantPortalData;
  callbacks: MerchantPortalCallbacks;
  isArabic: boolean;
  isDark: boolean;
  companyLogoUrl?: string;
  refreshing?: boolean;
  children: ReactNode;
}

export function MerchantPortalShell({ currentSection, data, callbacks, isArabic, isDark, companyLogoUrl, refreshing, children }: MerchantPortalShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const unreadCount = useMemo(() => data.notifications.filter((notification) => !notification.read).length, [data.notifications]);
  const activeOrdersCount = useMemo(() => data.orders.filter((order) => isMerchantOrderActive(order.status)).length, [data.orders]);

  function openSearchResult(result: MerchantGlobalSearchResult["results"][number]) {
    if (result.type === "order") callbacks.onNavigate("order_details", { orderId: result.id });
    else if (result.type === "invoice") callbacks.onNavigate("invoices", { invoiceId: result.id });
    else if (result.type === "settlement") callbacks.onNavigate("settlements", { settlementId: result.id });
    else callbacks.onNavigate(result.section as MerchantSectionId, undefined as never);
  }

  return (
    <div className={`dn-merchant-app ${isDark ? "is-dark" : "is-light"}`} dir={isArabic ? "rtl" : "ltr"} data-merchant-authenticated="true">
      <MerchantDesktopSidebar
        currentSection={currentSection}
        merchant={data.merchant}
        isArabic={isArabic}
        companyLogoUrl={companyLogoUrl}
        activeOrdersCount={activeOrdersCount}
        onNavigate={callbacks.onNavigate}
      />
      <div className="dn-merchant-main-column">
        <MerchantHeader
          section={currentSection}
          merchant={data.merchant}
          connection={data.connection}
          isArabic={isArabic}
          isDark={isDark}
          unreadCount={unreadCount}
          refreshing={refreshing}
          onOpenMenu={() => setMobileMenuOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenNotifications={() => callbacks.onNavigate("notifications", undefined)}
          onRefresh={() => void callbacks.onRefreshData()}
          onToggleLanguage={callbacks.onToggleLanguage}
          onToggleTheme={callbacks.onToggleTheme}
          onLogout={() => void callbacks.onLogout()}
        />
        {data.connection.state !== "connected" ? (
          <div className={`dn-merchant-connectivity-banner is-${data.connection.state}`}>
            <strong>{isArabic ? data.connection.messageAr || "الاتصال غير مستقر" : data.connection.messageEn || "Connection is not stable"}</strong>
            <span>{data.connection.lastSuccessfulSyncAt ? (isArabic ? `آخر مزامنة: ${data.connection.lastSuccessfulSyncAt}` : `Last sync: ${data.connection.lastSuccessfulSyncAt}`) : ""}</span>
          </div>
        ) : null}
        <main className="dn-merchant-content"><div className="dn-merchant-content-inner">{children}</div></main>
      </div>
      <MerchantBottomNavigation currentSection={currentSection} isArabic={isArabic} onNavigate={callbacks.onNavigate} />
      <MerchantMobileMoreSheet
        open={mobileMenuOpen}
        currentSection={currentSection}
        merchant={data.merchant}
        isArabic={isArabic}
        companyLogoUrl={companyLogoUrl}
        onClose={() => setMobileMenuOpen(false)}
        onNavigate={callbacks.onNavigate}
        onLogout={callbacks.onLogout}
      />
      <MerchantCommandPalette open={searchOpen} isArabic={isArabic} onClose={() => setSearchOpen(false)} onSearch={callbacks.onGlobalSearch} onOpenResult={openSearchResult} />
    </div>
  );
}
