import { useEffect, useRef } from "react";
import { LogOut, X } from "lucide-react";
import { t } from "../../i18n";
import { merchantNavigationGroups } from "./MerchantDesktopSidebar";
import type { MerchantNavigate, MerchantProfileViewModel, MerchantSectionId } from "./merchantViewModels";

export interface MerchantMobileMoreSheetProps {
  open: boolean;
  currentSection: MerchantSectionId;
  merchant: MerchantProfileViewModel;
  isArabic: boolean;
  companyLogoUrl?: string;
  onClose(): void;
  onNavigate: MerchantNavigate;
  onLogout(): Promise<void> | void;
}

const descriptions: Partial<Record<MerchantSectionId, { ar: string; en: string }>> = {
  dashboard: { ar: "ملخص التشغيل والأداء", en: "Operations and performance summary" },
  new_order: { ar: "إنشاء شحنة جديدة", en: "Create a new shipment" },
  orders: { ar: "إدارة ومتابعة جميع الطلبات", en: "Manage and follow every order" },
  tracking: { ar: "مواقع المندوبين والشحنات", en: "Courier and shipment locations" },
  cod: { ar: "التحصيلات النقدية المستحقة", en: "Cash collection control" },
  settlements: { ar: "التسويات والتحويلات المالية", en: "Settlements and payouts" },
  invoices: { ar: "الفواتير القابلة للتنزيل", en: "Downloadable invoices" },
  transactions: { ar: "سجل الحركات المالية", en: "Financial transaction history" },
  branches: { ar: "إدارة فروع النشاط", en: "Manage business branches" },
  address_book: { ar: "العناوين والعملاء المحفوظون", en: "Saved addresses and customers" },
  profile: { ar: "بيانات المتجر والحساب", en: "Store and account details" },
  documents: { ar: "الرخص والملفات الرسمية", en: "Licences and official files" },
  team: { ar: "المستخدمون والصلاحيات", en: "Users and permissions" },
  notifications: { ar: "التنبيهات والتحديثات", en: "Alerts and updates" },
  support: { ar: "التواصل مع فريق داي نايت", en: "Contact DAY NIGHT support" },
  settings: { ar: "اللغة والمظهر والتفضيلات", en: "Language, appearance and preferences" },
};

export function MerchantMobileMoreSheet({
  open,
  currentSection,
  merchant,
  isArabic,
  companyLogoUrl,
  onClose,
  onNavigate,
  onLogout,
}: MerchantMobileMoreSheetProps) {
  const historyMarker = useRef(`dn-merchant-drawer-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const marker = historyMarker.current;
    window.history.pushState({ ...(window.history.state || {}), dnMerchantDrawer: marker }, "", window.location.href);

    const closeFromHistory = () => onClose();
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    const closeFromNative = () => requestClose();

    window.addEventListener("popstate", closeFromHistory);
    window.addEventListener("keydown", closeFromKeyboard);
    window.addEventListener("dn-native-back", closeFromNative as EventListener);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("popstate", closeFromHistory);
      window.removeEventListener("keydown", closeFromKeyboard);
      window.removeEventListener("dn-native-back", closeFromNative as EventListener);
    };
  }, [open, onClose]);

  function requestClose() {
    if (window.history.state?.dnMerchantDrawer === historyMarker.current) {
      window.history.back();
    } else {
      onClose();
    }
  }

  function navigate(section: MerchantSectionId) {
    onNavigate(section, undefined as never);
    requestClose();
  }

  async function logout() {
    await onLogout();
    requestClose();
  }

  if (!open) return null;
  const language = isArabic ? "ar" : "en";

  return (
    <div
      className="dn-merchant-mobile-drawer-backdrop"
      role="presentation"
      onPointerDown={(event) => event.currentTarget === event.target && requestClose()}
    >
      <aside
        className="dn-merchant-mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dn-merchant-mobile-drawer-title"
        dir={isArabic ? "rtl" : "ltr"}
      >
        <header className="dn-merchant-mobile-drawer-header">
          <div className="dn-merchant-mobile-drawer-appmark">
            {companyLogoUrl ? <img src={companyLogoUrl} alt="DAY NIGHT" /> : <strong>DN</strong>}
          </div>
          <div className="dn-merchant-mobile-drawer-identity">
            <small>DAY NIGHT MERCHANT</small>
            <h2 id="dn-merchant-mobile-drawer-title">{merchant.tradeName}</h2>
            <span dir="ltr">{merchant.merchantCode || merchant.email || merchant.phone || "—"}</span>
          </div>
          <button type="button" className="dn-merchant-mobile-drawer-close" onClick={requestClose} aria-label={t(language, "close")}>
            <X aria-hidden />
          </button>
        </header>

        <div className="dn-merchant-mobile-drawer-intro">
          <strong>{t(language, "merchantMenu")}</strong>
          <span>{t(language, "merchantMenuHint")}</span>
        </div>

        <div className="dn-merchant-mobile-drawer-scroll">
          {merchantNavigationGroups.map((group) => (
            <section className="dn-merchant-mobile-drawer-group" key={group.en}>
              <h3>{isArabic ? group.ar : group.en}</h3>
              <nav aria-label={isArabic ? group.ar : group.en}>
                {group.items.map(({ id, ar, en, icon: Icon }) => {
                  const description = descriptions[id];
                  const selected = currentSection === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={selected ? "is-active" : ""}
                      aria-current={selected ? "page" : undefined}
                      onClick={() => navigate(id)}
                    >
                      <span className="dn-merchant-mobile-drawer-icon"><Icon aria-hidden /></span>
                      <span className="dn-merchant-mobile-drawer-copy">
                        <strong>{isArabic ? ar : en}</strong>
                        {description ? <small>{isArabic ? description.ar : description.en}</small> : null}
                      </span>
                      <span className="dn-merchant-mobile-drawer-chevron" aria-hidden>{isArabic ? "‹" : "›"}</span>
                    </button>
                  );
                })}
              </nav>
            </section>
          ))}
        </div>

        <footer className="dn-merchant-mobile-drawer-footer">
          <button type="button" onClick={() => void logout()}>
            <LogOut aria-hidden />
            <span>{t(language, "signOut")}</span>
          </button>
        </footer>
      </aside>
    </div>
  );
}
