import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bot,
  ChevronLeft,
  ChevronRight,
  House,
  Languages,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Sun,
  X,
} from "lucide-react";
import type { AdminSectionId } from "../AdminSectionRegistry";

export type AdminCommandMenuItem = {
  id: AdminSectionId;
  ar: string;
  en: string;
  groupAr: string;
  groupEn: string;
  Icon: LucideIcon;
};

export type AdminCommandSearchItem = {
  key: string;
  sectionId: AdminSectionId;
  labelAr: string;
  labelEn: string;
  secondaryAr?: string;
  secondaryEn?: string;
  kind: "section" | "order" | "merchant";
};

type AdminCommandCenterShellProps = {
  isArabic: boolean;
  theme: "light" | "dark";
  active: AdminSectionId;
  menu: readonly AdminCommandMenuItem[];
  logoUrl: string;
  companyName: string;
  companyNameAr?: string;
  operatorLabel: string;
  operatorRole: string;
  activeTitle: string;
  activeGroup: string;
  lastSyncAt: Date | null;
  loading: boolean;
  error?: string;
  searchItems: AdminCommandSearchItem[];
  khalifaOpen: boolean;
  onNavigate: (id: AdminSectionId) => void;
  onSearchSelect: (item: AdminCommandSearchItem) => void;
  onToggleLanguage: () => void;
  onToggleTheme: () => void;
  onToggleKhalifa: () => void;
  onBack: () => void;
  onOpenWebsite: () => void;
  onRefresh: () => void;
  notificationSlot: React.ReactNode;
  children: React.ReactNode;
};

function formatSyncTime(date: Date | null, isArabic: boolean) {
  if (!date) return isArabic ? "لم تتم المزامنة بعد" : "Not synced yet";
  return date.toLocaleTimeString(isArabic ? "ar-AE" : "en-AE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminCommandCenterShell({
  isArabic,
  theme,
  active,
  menu,
  logoUrl,
  companyName,
  companyNameAr,
  operatorLabel,
  operatorRole,
  activeTitle,
  activeGroup,
  lastSyncAt,
  loading,
  error,
  searchItems,
  khalifaOpen,
  onNavigate,
  onSearchSelect,
  onToggleLanguage,
  onToggleTheme,
  onToggleKhalifa,
  onBack,
  onOpenWebsite,
  onRefresh,
  notificationSlot,
  children,
}: AdminCommandCenterShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);

  const groupedMenu = useMemo(
    () =>
      menu.reduce<Record<string, AdminCommandMenuItem[]>>((groups, item) => {
        const group = isArabic ? item.groupAr : item.groupEn;
        (groups[group] ||= []).push(item);
        return groups;
      }, {}),
    [isArabic, menu],
  );

  const filteredSearch = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const source = normalized
      ? searchItems.filter((item) =>
          [item.labelAr, item.labelEn, item.secondaryAr, item.secondaryEn]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalized)),
        )
      : searchItems;
    return source.slice(0, 12);
  }, [query, searchItems]);

  useEffect(() => {
    const handlePointer = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setMobileOpen(false);
        if (khalifaOpen) onToggleKhalifa();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.querySelector("input")?.focus();
        setSearchOpen(true);
      }
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [khalifaOpen, onToggleKhalifa]);

  const sidebar = (
    <aside className={`dncc-sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <header className="dncc-brand">
        <img src={logoUrl} alt={companyName} />
        {!collapsed && (
          <div>
            <strong>{isArabic ? companyNameAr || companyName : companyName}</strong>
            <span>{isArabic ? "مركز عمليات التوصيل" : "Delivery Operations Center"}</span>
          </div>
        )}
        <button
          type="button"
          className="dncc-collapse"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={
            collapsed
              ? isArabic
                ? "توسيع القائمة"
                : "Expand navigation"
              : isArabic
                ? "طي القائمة"
                : "Collapse navigation"
          }
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </button>
      </header>

      <nav className="dncc-navigation" aria-label={isArabic ? "أقسام لوحة الإدارة" : "Admin sections"}>
        {Object.entries(groupedMenu).map(([group, items]) => (
          <section key={group}>
            {!collapsed && <h2>{group}</h2>}
            <div>
              {items.map((item) => {
                const selected = active === item.id;
                const Icon = item.Icon;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={selected ? "is-active" : ""}
                    onClick={() => {
                      onNavigate(item.id);
                      setMobileOpen(false);
                    }}
                    title={collapsed ? (isArabic ? item.ar : item.en) : undefined}
                    aria-current={selected ? "page" : undefined}
                  >
                    <span className="dncc-nav-icon"><Icon /></span>
                    {!collapsed && (
                      <span className="dncc-nav-copy">
                        <strong>{isArabic ? item.ar : item.en}</strong>
                        <small>{isArabic ? item.en : item.ar}</small>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <footer className="dncc-operator">
        <span className="dncc-operator-avatar" aria-hidden="true">
          {operatorLabel.trim().charAt(0).toUpperCase() || "D"}
        </span>
        {!collapsed && (
          <div>
            <strong>{operatorLabel}</strong>
            <span>{operatorRole}</span>
          </div>
        )}
        <button type="button" onClick={() => onNavigate("logout")} aria-label={isArabic ? "تسجيل الخروج" : "Sign out"}>
          <LogOut />
        </button>
      </footer>
    </aside>
  );

  return (
    <div
      className={`dncc-shell ${khalifaOpen ? "is-khalifa-open" : ""}`}
      dir={isArabic ? "rtl" : "ltr"}
      data-theme={theme}
    >
      <div className="dncc-desktop-sidebar">{sidebar}</div>

      {mobileOpen && (
        <div className="dncc-mobile-layer" role="dialog" aria-modal="true">
          <button
            type="button"
            className="dncc-mobile-backdrop"
            onClick={() => setMobileOpen(false)}
            aria-label={isArabic ? "إغلاق القائمة" : "Close navigation"}
          />
          <div className="dncc-mobile-drawer">
            <button
              type="button"
              className="dncc-mobile-close"
              onClick={() => setMobileOpen(false)}
              aria-label={isArabic ? "إغلاق" : "Close"}
            >
              <X />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      {khalifaOpen && (
        <button
          type="button"
          className="dncc-khalifa-backdrop"
          onClick={onToggleKhalifa}
          aria-label={isArabic ? "إغلاق خليفة" : "Close Khalifa"}
        />
      )}

      <div className="dncc-stage">
        <header className="dncc-topbar">
          <div className="dncc-topbar-start">
            <button
              type="button"
              className="dncc-mobile-menu"
              onClick={() => setMobileOpen(true)}
              aria-label={isArabic ? "فتح القائمة" : "Open navigation"}
            >
              <Menu />
            </button>

            <div className="dncc-history-actions">
              <button type="button" onClick={onBack} aria-label={isArabic ? "رجوع" : "Back"} title={isArabic ? "رجوع" : "Back"}>
                {isArabic ? <ArrowRight /> : <ArrowLeft />}
              </button>
              <button type="button" onClick={onOpenWebsite} aria-label={isArabic ? "الموقع الرئيسي" : "Main website"} title={isArabic ? "الموقع الرئيسي" : "Main website"}>
                <House />
              </button>
            </div>

            <div className="dncc-page-title">
              <span>{activeGroup}</span>
              <strong>{activeTitle}</strong>
            </div>
          </div>

          <div className="dncc-search" ref={searchRef}>
            <Search aria-hidden="true" />
            <input
              value={query}
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchOpen(true);
              }}
              placeholder={isArabic ? "ابحث عن طلب أو تاجر أو قسم..." : "Search orders, merchants, or sections..."}
              aria-label={isArabic ? "البحث العام" : "Global search"}
            />
            <kbd>⌘K</kbd>
            {searchOpen && (
              <div className="dncc-search-results">
                {filteredSearch.length === 0 ? (
                  <p>{isArabic ? "لا توجد نتائج مطابقة" : "No matching results"}</p>
                ) : (
                  filteredSearch.map((item) => (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => {
                        onSearchSelect(item);
                        setQuery("");
                        setSearchOpen(false);
                      }}
                    >
                      <span data-kind={item.kind}>
                        {item.kind === "order"
                          ? isArabic ? "طلب" : "Order"
                          : item.kind === "merchant"
                            ? isArabic ? "تاجر" : "Merchant"
                            : isArabic ? "قسم" : "Section"}
                      </span>
                      <div>
                        <strong>{isArabic ? item.labelAr : item.labelEn}</strong>
                        {(item.secondaryAr || item.secondaryEn) && (
                          <small>{isArabic ? item.secondaryAr : item.secondaryEn}</small>
                        )}
                      </div>
                      {isArabic ? <ChevronLeft /> : <ChevronRight />}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="dncc-topbar-actions">
            <div className={`dncc-sync-state ${error ? "is-error" : loading ? "is-loading" : "is-ready"}`}>
              <span />
              <div>
                <strong>
                  {error
                    ? isArabic ? "تعذر التحديث" : "Sync issue"
                    : loading
                      ? isArabic ? "جارٍ التحديث" : "Refreshing"
                      : isArabic ? "تمت المزامنة" : "Synced"}
                </strong>
                <small>{formatSyncTime(lastSyncAt, isArabic)}</small>
              </div>
            </div>

            <button type="button" onClick={onRefresh} aria-label={isArabic ? "تحديث البيانات" : "Refresh data"} title={isArabic ? "تحديث البيانات" : "Refresh data"}>
              <RefreshCw className={loading ? "is-spinning" : ""} />
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === "light" ? (isArabic ? "الوضع الليلي" : "Dark mode") : (isArabic ? "الوضع النهاري" : "Light mode")}
              title={theme === "light" ? (isArabic ? "الوضع الليلي" : "Dark mode") : (isArabic ? "الوضع النهاري" : "Light mode")}
            >
              {theme === "light" ? <Moon /> : <Sun />}
            </button>

            <button type="button" onClick={onToggleLanguage} aria-label={isArabic ? "Switch to English" : "التبديل إلى العربية"}>
              <Languages />
              <span>{isArabic ? "EN" : "ع"}</span>
            </button>

            <button
              type="button"
              className={khalifaOpen ? "is-active" : ""}
              onClick={onToggleKhalifa}
              aria-label={isArabic ? "فتح مساعد خليفة" : "Open Khalifa assistant"}
              title={isArabic ? "خليفة" : "Khalifa"}
            >
              <Bot />
              <span>{isArabic ? "خليفة" : "Khalifa"}</span>
            </button>

            <div className="dncc-notification-slot">{notificationSlot || <Bell />}</div>
          </div>
        </header>

        <main className="dncc-main">{children}</main>
      </div>
    </div>
  );
}
