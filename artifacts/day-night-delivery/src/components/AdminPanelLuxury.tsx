import { useMemo, useRef, useState } from "react";
import {
  Activity,
  Ban,
  BarChart3,
  ChevronDown,
  ClipboardList,
  Clock3,
  Database,
  Download,
  FileText,
  MapPin,
  Menu,
  PackageCheck,
  PlusCircle,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Store,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import companyMeta from "../data/companyMeta";
import AdminPanelCore from "./AdminPanel";
import "../styles/dn-dashboard-map.css";
import "../styles/dn-admin-drawer.css";

type AdminCoreTab = "orders" | "merchant" | "new_order";
type MenuAction =
  | { type: "tab"; tab: AdminCoreTab }
  | { type: "search"; term: string }
  | { type: "export"; labelIncludes: string[] }
  | { type: "focus-search" };

type AdminMenuItem = {
  id: string;
  labelAr: string;
  labelEn: string;
  hintAr: string;
  hintEn: string;
  icon: typeof ClipboardList;
  action: MenuAction;
  badge?: string;
};

type AdminMenuGroup = {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: typeof ClipboardList;
  items: AdminMenuItem[];
};

const coreTabLabels: Record<AdminCoreTab, string[]> = {
  orders: ["كل الطلبات", "All Orders"],
  merchant: ["إضافة تاجر", "Add Merchant"],
  new_order: ["إضافة طلبية", "Add Order"],
};

const menuGroups: AdminMenuGroup[] = [
  {
    id: "control",
    labelAr: "لوحة التحكم",
    labelEn: "Control Panel",
    icon: Activity,
    items: [
      {
        id: "dashboard",
        labelAr: "لوحة التحكم",
        labelEn: "Dashboard",
        hintAr: "الملخص المباشر والفلاتر",
        hintEn: "Live summary and filters",
        icon: BarChart3,
        action: { type: "tab", tab: "orders" },
        badge: "Live",
      },
      {
        id: "new-order",
        labelAr: "إضافة طلب جديد",
        labelEn: "Add New Order",
        hintAr: "طلبية بالكوبون، التاجر، المستلم، والبيانات",
        hintEn: "Coupon, merchant, receiver, and order data",
        icon: PlusCircle,
        action: { type: "tab", tab: "new_order" },
        badge: "30 AED",
      },
      {
        id: "new-merchant",
        labelAr: "إضافة تاجر",
        labelEn: "Add Merchant",
        hintAr: "تعاقد جديد وبيانات المتجر",
        hintEn: "New contract and store details",
        icon: Store,
        action: { type: "tab", tab: "merchant" },
      },
      {
        id: "merchant-directory",
        labelAr: "التجار",
        labelEn: "Merchants",
        hintAr: "قائمة التجار والمنسدلة الذكية",
        hintEn: "Merchant directory and autocomplete",
        icon: Users,
        action: { type: "tab", tab: "merchant" },
      },
    ],
  },
  {
    id: "orders",
    labelAr: "إدارة الطلبات",
    labelEn: "Orders Management",
    icon: ClipboardList,
    items: [
      {
        id: "all-orders",
        labelAr: "كافة الطلبات",
        labelEn: "All Orders",
        hintAr: "عرض كل الطلبات الحية",
        hintEn: "Show all live orders",
        icon: ClipboardList,
        action: { type: "search", term: "" },
      },
      {
        id: "cancelled-orders",
        labelAr: "الطلبات الملغية",
        labelEn: "Cancelled Orders",
        hintAr: "بحث سريع عن الملغي والفشل",
        hintEn: "Quick cancelled/failed search",
        icon: Ban,
        action: { type: "search", term: "cancelled" },
      },
      {
        id: "review-orders",
        labelAr: "الطلبات قيد المراجعة",
        labelEn: "Under Review",
        hintAr: "طلبات تحتاج مراجعة تشغيلية",
        hintEn: "Orders needing operational review",
        icon: Search,
        action: { type: "search", term: "review" },
      },
      {
        id: "assigned-orders",
        labelAr: "الطلبات المؤجلة / الموجهة",
        labelEn: "Assigned / Scheduled",
        hintAr: "الموجهة للمندوب أو المؤجلة",
        hintEn: "Assigned or scheduled shipments",
        icon: Clock3,
        action: { type: "search", term: "assigned" },
      },
      {
        id: "returned-orders",
        labelAr: "الطلبات الراجعة",
        labelEn: "Returned Orders",
        hintAr: "بحث عن الراجع أو المحاولة الفاشلة",
        hintEn: "Returned or failed-attempt search",
        icon: RotateCcw,
        action: { type: "search", term: "return" },
      },
      {
        id: "pickup-orders",
        labelAr: "الطلبات قيد الإحضار",
        labelEn: "Pickup In Progress",
        hintAr: "تم الاستلام أو في الطريق للاستلام",
        hintEn: "Picked up / pickup flow",
        icon: PackageCheck,
        action: { type: "search", term: "picked_up" },
      },
    ],
  },
  {
    id: "zones",
    labelAr: "المناطق والتشغيل",
    labelEn: "Zones & Operations",
    icon: MapPin,
    items: [
      {
        id: "abu-dhabi",
        labelAr: "طلبات أبوظبي",
        labelEn: "Abu Dhabi Orders",
        hintAr: "فلترة المدينة أو الإمارة",
        hintEn: "Filter by city/emirate",
        icon: MapPin,
        action: { type: "search", term: "Abu Dhabi" },
      },
      {
        id: "external",
        labelAr: "الطلبات الخارجية",
        labelEn: "External Orders",
        hintAr: "الدولي والخارج عن الإمارات",
        hintEn: "International and external orders",
        icon: Truck,
        action: { type: "search", term: "international" },
      },
      {
        id: "out-zone",
        labelAr: "الطلبات خارج النطاق",
        labelEn: "Out of Zone",
        hintAr: "الغربية، العين، والمناطق الممتدة",
        hintEn: "Extended zones and far areas",
        icon: MapPin,
        action: { type: "search", term: "Western Region" },
      },
    ],
  },
  {
    id: "finance",
    labelAr: "الكشوفات والمالية",
    labelEn: "Statements & Finance",
    icon: Wallet,
    items: [
      {
        id: "courier-statements",
        labelAr: "كشوفات المناديب",
        labelEn: "Driver Statements",
        hintAr: "افتح البحث للمناديب وحركة التشغيل",
        hintEn: "Driver and operation search",
        icon: Truck,
        action: { type: "search", term: "driver" },
      },
      {
        id: "merchant-statements",
        labelAr: "كشوفات التجار",
        labelEn: "Merchant Statements",
        hintAr: "بحث سريع باسم التاجر أو الكوبون",
        hintEn: "Merchant/coupon quick search",
        icon: Store,
        action: { type: "focus-search" },
      },
      {
        id: "income",
        labelAr: "الدخل",
        labelEn: "Income",
        hintAr: "مبالغ التوصيل والتحصيل",
        hintEn: "Delivery and COD totals",
        icon: Wallet,
        action: { type: "search", term: "cod" },
      },
      {
        id: "expenses",
        labelAr: "المصروفات",
        labelEn: "Expenses",
        hintAr: "بحث تشغيلي للمصاريف والملاحظات",
        hintEn: "Expense and note search",
        icon: FileText,
        action: { type: "search", term: "expense" },
      },
      {
        id: "voucher",
        labelAr: "استخراج سند صرف",
        labelEn: "Payment Voucher",
        hintAr: "انتقل للتقرير ثم اطبع السند",
        hintEn: "Open report flow for voucher printing",
        icon: Printer,
        action: { type: "export", labelIncludes: ["تقرير PDF", "Daily PDF"] },
      },
      {
        id: "invoice-print",
        labelAr: "طباعة فاتورة",
        labelEn: "Print Invoice",
        hintAr: "ابحث برقم الفاتورة ثم صدّرها",
        hintEn: "Search invoice then export",
        icon: Printer,
        action: { type: "focus-search" },
      },
      {
        id: "reports",
        labelAr: "التقارير",
        labelEn: "Reports",
        hintAr: "تقرير PDF يومي للنتائج الحالية",
        hintEn: "Daily PDF for current results",
        icon: FileText,
        action: { type: "export", labelIncludes: ["تقرير PDF", "Daily PDF"] },
      },
    ],
  },
];

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(input, "value")?.set;
  const prototype = Object.getPrototypeOf(input);
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) prototypeValueSetter.call(input, value);
  else if (valueSetter) valueSetter.call(input, value);
  else input.value = value;

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function AdminPanelLuxury() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const adminCoreRef = useRef<HTMLDivElement | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ control: true, orders: true, zones: true, finance: true });
  const [activeItem, setActiveItem] = useState("dashboard");
  const [menuSearch, setMenuSearch] = useState("");

  const cards = [
    { icon: Activity, value: "Live", label: isArabic ? "متابعة مباشرة" : "Live view" },
    { icon: Database, value: "Data", label: isArabic ? "بيانات الطلبات" : "Order data" },
    { icon: Download, value: "Export", label: isArabic ? "تصدير فوري" : "Quick export" },
    { icon: Truck, value: "Fleet", label: isArabic ? "تشغيل الشحنات" : "Shipment flow" },
  ];

  const filteredGroups = useMemo(() => {
    const term = menuSearch.trim().toLowerCase();
    if (!term) return menuGroups;
    return menuGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          [item.labelAr, item.labelEn, item.hintAr, item.hintEn, item.badge]
            .join(" ")
            .toLowerCase()
            .includes(term),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [menuSearch]);

  function clickCoreTab(tab: AdminCoreTab) {
    const root = adminCoreRef.current;
    if (!root) return;
    const labels = coreTabLabels[tab];
    const buttons = Array.from(root.querySelectorAll("button"));
    const target = buttons.find((button) => labels.some((label) => button.textContent?.includes(label)));
    target?.click();
  }

  function applyCoreSearch(term: string, focus = false) {
    clickCoreTab("orders");
    window.setTimeout(() => {
      const input = adminCoreRef.current?.querySelector<HTMLInputElement>("#admin_search_bar");
      if (!input) return;
      setNativeInputValue(input, term);
      if (focus) input.focus();
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 140);
  }

  function clickCoreButtonByLabel(labels: string[]) {
    const root = adminCoreRef.current;
    if (!root) return;
    const buttons = Array.from(root.querySelectorAll("button"));
    const target = buttons.find((button) => labels.some((label) => button.textContent?.includes(label)));
    target?.click();
  }

  function runMenuAction(item: AdminMenuItem) {
    setActiveItem(item.id);
    setDrawerOpen(false);

    if (item.action.type === "tab") clickCoreTab(item.action.tab);
    if (item.action.type === "search") applyCoreSearch(item.action.term);
    if (item.action.type === "focus-search") applyCoreSearch("", true);
    if (item.action.type === "export") clickCoreButtonByLabel(item.action.labelIncludes);

    window.setTimeout(() => adminCoreRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  return (
    <div className="dn-admin-luxury-shell space-y-7" dir={isArabic ? "rtl" : "ltr"}>
      <section className="relative overflow-hidden rounded-[2.35rem] border border-brand-sky/20 bg-[#031226] p-5 shadow-2xl shadow-black/30 sm:p-7 lg:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_8%,rgba(212,166,42,0.18),transparent_24rem),radial-gradient(circle_at_90%_12%,rgba(25,167,255,0.24),transparent_30rem)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(79,215,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(79,215,255,0.045)_1px,transparent_1px)] bg-[size:48px_48px] opacity-70" />
        <div className="relative z-10 grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-center">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <img src={companyMeta.logoUrl} alt="DAY NIGHT" className="h-16 w-16 rounded-full border-2 border-brand-gold/55 bg-white object-contain shadow-xl shadow-brand-sky/10" />
              <div><p className="text-xs font-black uppercase tracking-[0.28em] text-brand-gold">DAY NIGHT</p><p className="text-sm font-black text-white/78">{isArabic ? "مركز الإدارة" : "Admin Center"}</p></div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-1.5 text-xs font-black text-brand-gold"><ShieldCheck className="h-4 w-4" /> {isArabic ? "لوحة تشغيل الطلبات" : "Orders workspace"}</span>
            <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight text-white sm:text-5xl">{isArabic ? "لوحة فاخرة لإدارة الشحنات والطلبات" : "Premium dashboard for shipments and orders"}</h1>
            <p className="mt-4 max-w-3xl text-sm font-bold leading-7 text-white/58">{isArabic ? "قائمة جانبية احترافية للتاجر، الطلبية، الكوبون، الفاتورة، المناطق، الكشوفات، والتقارير بنفس هوية DAY NIGHT." : "A professional side menu for merchants, coupon orders, invoices, zones, statements, and reports in the DAY NIGHT identity."}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {cards.map(({ icon: Icon, value, label }) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl"><Icon className="mb-3 h-5 w-5 text-brand-gold" /><p className="font-mono text-xl font-black text-brand-gold" dir="ltr">{value}</p><p className="mt-1 text-xs font-bold text-white/58">{label}</p></div>)}
            <div className="col-span-2 rounded-2xl border border-brand-gold/25 bg-brand-gold/10 p-4"><div className="flex items-center gap-3"><BarChart3 className="h-5 w-5 text-brand-gold" /><div><p className="text-sm font-black text-white">{isArabic ? "مستودع تشغيلي" : "Operational warehouse"}</p><p className="text-xs font-bold text-white/50">{isArabic ? "قوائم منسدلة، فلاتر، وإجراءات سريعة" : "Dropdown menus, filters, and quick actions"}</p></div></div></div>
          </div>
        </div>
      </section>

      <div className="dn-admin-workspace">
        <button
          type="button"
          className="dn-admin-mobile-menu-button"
          onClick={() => setDrawerOpen(true)}
          aria-label={isArabic ? "فتح قائمة الإدارة" : "Open admin menu"}
        >
          <Menu className="h-5 w-5" />
          <span>{isArabic ? "قائمة الإدارة" : "Admin Menu"}</span>
        </button>

        {drawerOpen && <button type="button" aria-label="Close admin drawer" className="dn-admin-drawer-backdrop" onClick={() => setDrawerOpen(false)} />}

        <aside className={`dn-admin-side-drawer ${drawerOpen ? "is-open" : ""}`} aria-label={isArabic ? "قائمة لوحة الإدارة" : "Admin dashboard menu"}>
          <div className="dn-admin-drawer-head">
            <img src={companyMeta.logoUrl} alt="DAY NIGHT" />
            <button type="button" className="dn-admin-drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
            <strong>{isArabic ? "داي نايت" : "DAY NIGHT"}</strong>
            <span>{isArabic ? "مستودع الإدارة والتشغيل" : "Admin operations warehouse"}</span>
          </div>

          <div className="dn-admin-drawer-search">
            <Search className="h-4 w-4" />
            <input
              value={menuSearch}
              onChange={(event) => setMenuSearch(event.target.value)}
              placeholder={isArabic ? "ابحث داخل القائمة..." : "Search menu..."}
            />
          </div>

          <div className="dn-admin-drawer-groups">
            {filteredGroups.map((group) => {
              const GroupIcon = group.icon;
              const isOpen = openGroups[group.id] ?? true;
              return (
                <section key={group.id} className="dn-admin-drawer-group">
                  <button
                    type="button"
                    className="dn-admin-group-toggle"
                    onClick={() => setOpenGroups((prev) => ({ ...prev, [group.id]: !isOpen }))}
                  >
                    <span><GroupIcon className="h-4 w-4" /> {isArabic ? group.labelAr : group.labelEn}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isOpen && (
                    <div className="dn-admin-drawer-items">
                      {group.items.map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <button
                            type="button"
                            key={item.id}
                            className={`dn-admin-drawer-item ${activeItem === item.id ? "is-active" : ""}`}
                            onClick={() => runMenuAction(item)}
                          >
                            <span className="dn-admin-item-icon"><ItemIcon className="h-4 w-4" /></span>
                            <span className="dn-admin-item-copy">
                              <strong>{isArabic ? item.labelAr : item.labelEn}</strong>
                              <small>{isArabic ? item.hintAr : item.hintEn}</small>
                            </span>
                            {item.badge && <em>{item.badge}</em>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </aside>

        <div ref={adminCoreRef} className="dn-admin-core-area">
          <AdminPanelCore />
        </div>
      </div>
    </div>
  );
}
