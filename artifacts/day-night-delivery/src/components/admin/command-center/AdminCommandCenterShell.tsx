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

export type AdminCommandSectionId = AdminSectionId | "new_employee" | "employees";

export type AdminCommandMenuItem = {
  id: AdminCommandSectionId;
  ar: string;
  en: string;
  groupAr: string;
  groupEn: string;
  Icon: LucideIcon;
};

export type AdminCommandSearchItem = {
  key: string;
  sectionId: AdminCommandSectionId;
  labelAr: string;
  labelEn: string;
  secondaryAr?: string;
  secondaryEn?: string;
  kind: "section" | "order" | "merchant";
};

type AdminCommandCenterShellProps = {
  isArabic: boolean;
  theme: "light" | "dark";
  active: AdminCommandSectionId;
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
  onNavigate: (id: AdminCommandSectionId) => void;
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
                    data-dn-command-section={item.id}
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
    </aside>
  );

  return (
    <div className={`dncc-root ${theme === "light" ? "is-light" : ""}`} dir={isArabic ? "rtl" : "ltr"}>
      <button type="button" className="dncc-mobile-menu" onClick={() => setMobileOpen(true)} aria-label={isArabic ? "فتح القائمة" : "Open menu"}><Menu /></button>
      <div className={`dncc-mobile-overlay ${mobileOpen ? "is-open" : ""}`} onClick={() => setMobileOpen(false)} />
      <div className={`dncc-sidebar-wrap ${mobileOpen ? "is-open" : ""}`}>
        <button type="button" className="dncc-mobile-close" onClick={() => setMobileOpen(false)} aria-label={isArabic ? "إغلاق القائمة" : "Close menu"}><X /></button>
        {sidebar}
      </div>

      <main className="dncc-main">
        <header className="dncc-topbar">
          <div className="dncc-topbar-start">
            <button type="button" onClick={onBack} aria-label={isArabic ? "رجوع" : "Back"}>{isArabic ? <ArrowRight /> : <ArrowLeft />}</button>
            <button type="button" onClick={onOpenWebsite} aria-label={isArabic ? "الموقع" : "Website"}><House /></button>
            <div><span>{activeGroup}</span><strong>{activeTitle}</strong></div>
          </div>

          <div className="dncc-search" ref={searchRef}>
            <Search />
            <input
              value={query}
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchOpen(true);
              }}
              placeholder={isArabic ? "ابحث عن طلب أو تاجر أو قسم..." : "Search orders, merchants, or sections..."}
            />
            <kbd>⌘K</kbd>
            {searchOpen && (
              <div className="dncc-search-results">
                {filteredSearch.map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    onClick={() => {
                      onSearchSelect(item);
                      setSearchOpen(false);
                      setQuery("");
                    }}
                  >
                    <strong>{isArabic ? item.labelAr : item.labelEn}</strong>
                    <small>{isArabic ? item.secondaryAr : item.secondaryEn}</small>
                  </button>
                ))}
                {!filteredSearch.length && <span>{isArabic ? "لا توجد نتائج" : "No results"}</span>}
              </div>
            )}
          </div>

          <div className="dncc-actions">
            <button type="button" onClick={onRefresh} aria-label={isArabic ? "تحديث" : "Refresh"}><RefreshCw /></button>
            <button type="button" onClick={onToggleTheme} aria-label={isArabic ? "تبديل المظهر" : "Toggle theme"}>{theme === "dark" ? <Sun /> : <Moon />}</button>
            <button type="button" onClick={onToggleLanguage} aria-label={isArabic ? "English" : "العربية"}><Languages /></button>
            {notificationSlot}
            <button type="button" onClick={onToggleKhalifa} aria-label={isArabic ? "خليفة" : "Khalifa AI"}><Bot /></button>
          </div>
        </header>

        <section className="dncc-statusbar">
          <div><strong>{operatorLabel}</strong><span>{operatorRole}</span></div>
          <div className={error ? "is-error" : loading ? "is-loading" : "is-ready"}>
            <i />
            <span>{error || (loading ? (isArabic ? "جارٍ المزامنة" : "Syncing") : (isArabic ? "متصل ومحدث" : "Live and synced"))}</span>
            <small>{formatSyncTime(lastSyncAt, isArabic)}</small>
          </div>
        </section>

        <section className="dncc-content">{children}</section>
      </main>

      <aside className={`dncc-khalifa ${khalifaOpen ? "is-open" : ""}`}>
        <header><Bot /><div><strong>{isArabic ? "خليفة" : "Khalifa"}</strong><span>{isArabic ? "مساعد العمليات" : "Operations assistant"}</span></div><button type="button" onClick={onToggleKhalifa}><X /></button></header>
        <div><p>{isArabic ? "اسأل عن الطلبات أو التجار أو التحصيل أو حالة التشغيل." : "Ask about orders, merchants, collection, or operations."}</p></div>
      </aside>
    </div>
  );
}
