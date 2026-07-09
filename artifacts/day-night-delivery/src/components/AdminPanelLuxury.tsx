import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  Database,
  FileText,
  Headphones,
  Home,
  Import,
  Languages,
  LogOut,
  Menu,
  Package,
  PackageCheck,
  PackagePlus,
  Printer,
  ReceiptText,
  RotateCcw,
  Settings,
  ShieldCheck,
  Store,
  Truck,
  UserRound,
  UserRoundPlus,
  Wallet,
  X,
} from "lucide-react";
import companyMeta from "../data/companyMeta";
import { supabase } from "../supabase";
import { fetchAdminStats, fetchFinanceSummary, fetchExpenses, createExpense, voidExpense, fetchLedgerEntries, fetchMerchantStatements, fetchDriverStatements, fetchMerchants, fetchAdminOrders, updateOrderStatus, type AdminStats, type FinanceSummary, type FinanceRow } from "../lib/adminData";
import type { Merchant } from "../types";
import { useAppContext } from "../lib/AppContext";
import AdminMerchantIntelligence from "./AdminMerchantIntelligence";
import AdminProspectingLinks from "./AdminProspectingLinks";
import AdminNewMerchant from "./admin/AdminNewMerchant";
import AdminNewOrder from "./admin/AdminNewOrder";
import AdminLiveOperationsMap from "./admin/AdminLiveOperationsMap";
import KhalifaGuidanceFeed from "./admin/KhalifaGuidanceFeed";
import AdminPdfExportButton from "./admin/AdminPdfExportButton";
import khalifaAssets from "./admin/khalifaAssets";
import "../styles/dn-dashboard-map.css";
import "../styles/dn-khalifa-final.css";
import "../styles/dn-admin-task2.css";
import "../styles/dn-admin-task3.css";
import "../styles/dn-admin-pdf.css";

const menu = [
  { id: "dashboard", ar: "لوحة التحكم", en: "Dashboard", groupAr: "القيادة", groupEn: "Command", Icon: Home },
  { id: "new_order", ar: "إضافة طلب جديد", en: "New Order", groupAr: "العمليات", groupEn: "Operations", Icon: PackagePlus },
  { id: "new_merchant", ar: "إضافة تاجر", en: "New Merchant", groupAr: "العمليات", groupEn: "Operations", Icon: UserRoundPlus },
  { id: "merchants", ar: "التجار", en: "Merchants", groupAr: "العمليات", groupEn: "Operations", Icon: Store },
  { id: "all_orders", ar: "كافة الطلبات", en: "All Orders", groupAr: "الطلبات", groupEn: "Orders", Icon: ClipboardList },
  { id: "cancelled", ar: "الطلبات الملغية", en: "Cancelled Orders", groupAr: "الطلبات", groupEn: "Orders", Icon: X },
  { id: "review", ar: "الطلبات قيد المراجعة", en: "Under Review", groupAr: "الطلبات", groupEn: "Orders", Icon: ShieldCheck },
  { id: "postponed", ar: "الطلبات المؤجلة", en: "Postponed Orders", groupAr: "الطلبات", groupEn: "Orders", Icon: PackageCheck },
  { id: "returned", ar: "الطلبات الراجعة", en: "Returned Orders", groupAr: "الطلبات", groupEn: "Orders", Icon: RotateCcw },
  { id: "pickup", ar: "الطلبات قيد الإحضار", en: "Pickup Orders", groupAr: "التوزيع", groupEn: "Dispatch", Icon: Truck },
  { id: "abu_dhabi", ar: "طلبات أبوظبي", en: "Abu Dhabi Orders", groupAr: "التوزيع", groupEn: "Dispatch", Icon: Truck },
  { id: "external", ar: "الطلبات الخارجية", en: "External Orders", groupAr: "التوزيع", groupEn: "Dispatch", Icon: Import },
  { id: "out_scope", ar: "الطلبات خارج النطاق", en: "Out of Scope", groupAr: "التوزيع", groupEn: "Dispatch", Icon: AlertTriangle },
  { id: "finance_dashboard", ar: "لوحة المالية", en: "Finance Dashboard", groupAr: "المالية", groupEn: "Finance", Icon: BarChart3 },
  { id: "driver_statements", ar: "كشوفات المناديب", en: "Driver Statements", groupAr: "المالية", groupEn: "Finance", Icon: FileText },
  { id: "merchant_statements", ar: "كشوفات التجار", en: "Merchant Statements", groupAr: "المالية", groupEn: "Finance", Icon: ReceiptText },
  { id: "income", ar: "الدخل", en: "Income", groupAr: "المالية", groupEn: "Finance", Icon: Wallet },
  { id: "cod", ar: "التحصيل COD", en: "COD Collection", groupAr: "المالية", groupEn: "Finance", Icon: Wallet },
  { id: "expenses", ar: "المصروفات", en: "Expenses", groupAr: "المالية", groupEn: "Finance", Icon: Database },
  { id: "accounts", ar: "الحسابات", en: "Accounts", groupAr: "المالية", groupEn: "Finance", Icon: Database },
  { id: "adjustments", ar: "التسويات", en: "Adjustments", groupAr: "المالية", groupEn: "Finance", Icon: RotateCcw },
  { id: "audit_log", ar: "سجل التدقيق", en: "Audit Log", groupAr: "المالية", groupEn: "Finance", Icon: ShieldCheck },
  { id: "import", ar: "استيراد الشحنات", en: "Import Shipments", groupAr: "الأدوات", groupEn: "Tools", Icon: Import },
  { id: "print", ar: "طباعة فواتير", en: "Print Invoices", groupAr: "الأدوات", groupEn: "Tools", Icon: Printer },
  { id: "reports", ar: "التقارير", en: "Reports", groupAr: "الأدوات", groupEn: "Tools", Icon: BarChart3 },
  { id: "settings", ar: "الإعدادات", en: "Settings", groupAr: "النظام", groupEn: "System", Icon: Settings },
  { id: "support", ar: "الدعم الفني", en: "Technical Support", groupAr: "النظام", groupEn: "System", Icon: Headphones },
  { id: "logout", ar: "تسجيل الخروج", en: "Logout", groupAr: "النظام", groupEn: "System", Icon: LogOut },
] as const;

type SectionId = typeof menu[number]["id"];
type MetricMap = { total: number; cancelled: number; review: number; postponed: number; returned: number; pickup: number; abuDhabi: number; external: number; outScope: number; codTotal: number; income: number };

const filteredSectionIds = new Set<SectionId>(["all_orders", "cancelled", "review", "postponed", "returned", "pickup", "abu_dhabi", "external", "out_scope", "import", "print", "reports", "settings"]);
const financeSections: SectionId[] = ["finance_dashboard", "expenses", "income", "cod", "merchant_statements", "driver_statements", "accounts", "adjustments", "audit_log"];
const siteLinks = [
  { ar: "الموقع الرئيسي", en: "Website", href: "/" },
  { ar: "من نحن", en: "About", href: "/about" },
  { ar: "الخدمات", en: "Services", href: "/services" },
  { ar: "الأسعار", en: "Pricing", href: "/pricing" },
  { ar: "تتبع شحنة", en: "Tracking", href: "/tracking" },
  { ar: "طلب توصيل", en: "Request", href: "/request-delivery" },
  { ar: "QR Hub", en: "QR Hub", href: "/qr" },
  { ar: "تواصل معنا", en: "Contact", href: "/contact" },
];

const copy = {
  ar: {
    owner: "أبو خليفة", role: "مدير النظام", helper: "خليفة", helperRole: "مساعد العمليات الذكي", helperText: "متصل بالبيانات الحية ويغيّر إرشاداته حسب القسم الحالي.", ask: "اسألني أي شيء", language: "English", menu: "قائمة الإدارة", websiteNav: "روابط الموقع الأساسي", commandCenter: "مركز القيادة", welcome: "مرحباً بك في مركز القيادة", subtitle: "تحكم كامل بشحناتك من نقطة إلى نقطة", totalOrders: "إجمالي الطلبات", sectionCount: "عدد هذا القسم", codTotal: "إجمالي التحصيل COD", income: "دخل التوصيل", filteredData: "البيانات المفلترة لهذا القسم", tableTracking: "التتبع", tableStatus: "الحالة", tableMerchant: "التاجر / المرسل", tableRoute: "المسار", tableReceiver: "المستلم", tableAmount: "المبلغ", tableDate: "التاريخ", tableAction: "الإجراء", noSectionOrders: "لا توجد بيانات مطابقة لهذا القسم حالياً.", liveFilter: "فلتر حي من بيانات Supabase", rowsShown: "صفوف معروضة", actionPlan: "خطة العمل داخل القسم", quickActions: "إجراءات سريعة", openOperations: "فتح مستودع العمليات الكامل", latest: "آخر التحديثات", shipmentInfo: "معلومات الشحنة", details: "تفاصيل الشحنة", quickHelp: "مساعدة سريعة", noUpdates: "لا توجد تنبيهات عاجلة حالياً", noData: "البيانات الحية جاهزة داخل مستودع العمليات", preparing: "خليفة يقرأ ملخص الطلبات ويقترح عليك الإجراء التالي.", refresh: "تحديث البيانات", loading: "تحميل البيانات الحية...", lastSync: "آخر مزامنة", liveData: "متصل بالبيانات الحية"
  },
  en: {
    owner: "Abu Khalifa", role: "System Manager", helper: "Khalifa", helperRole: "Smart Operations Assistant", helperText: "Connected to live data and changes guidance by section.", ask: "Ask me anything", language: "العربية", menu: "Admin Menu", websiteNav: "Main website links", commandCenter: "Command Center", welcome: "Welcome to the Command Center", subtitle: "Full control of shipments from point to point", totalOrders: "Total Orders", sectionCount: "Section Count", codTotal: "COD Total", income: "Delivery Income", filteredData: "Filtered data for this section", tableTracking: "Tracking", tableStatus: "Status", tableMerchant: "Merchant / Sender", tableRoute: "Route", tableReceiver: "Receiver", tableAmount: "Amount", tableDate: "Date", tableAction: "Action", noSectionOrders: "No matching data for this section right now.", liveFilter: "Live filter from Supabase data", rowsShown: "Rows shown", actionPlan: "Section Action Plan", quickActions: "Quick Actions", openOperations: "Open Full Operations Warehouse", latest: "Latest Updates", shipmentInfo: "Shipment Info", details: "Shipment Details", quickHelp: "Quick Help", noUpdates: "No urgent alerts right now", noData: "Live data is ready inside the operations warehouse", preparing: "Khalifa reads the order summary and suggests the next action.", refresh: "Refresh data", loading: "Loading live data...", lastSync: "Last sync", liveData: "Connected to live data"
  },
};

function getMenuLabel(item: typeof menu[number], isArabic: boolean) { return isArabic ? item.ar : item.en; }
function normalize(value: unknown) { return String(value || "").toLowerCase().replace(/[_-]/g, " ").trim(); }
function money(value: number) { return `${Number(value || 0).toFixed(2)} AED`; }
function getOrderAmount(order: any) { return Number(order.cod_amount || order.delivery_price || order.price || order.total_amount || 0); }
function getOrderIncome(order: any) { return Number(order.delivery_price || order.price || order.service_fee || 0); }
function getRoute(order: any) { const from = order.sender_city || order.pickup_city || order.origin_city || order.from_city || "—"; const to = order.receiver_city || order.delivery_city || order.destination_city || order.to_city || "—"; return `${from} → ${to}`; }
function getTracking(order: any) { return order.tracking_number || order.tracking_code || order.invoice_number || order.id || "—"; }
function translateStatus(status: unknown, isArabic: boolean) {
  const raw = normalize(status);
  if (!raw) return isArabic ? "غير محدد" : "Unspecified";
  if (raw.includes("pending")) return isArabic ? "قيد الانتظار" : "Pending";
  if (raw.includes("confirm")) return isArabic ? "مؤكد" : "Confirmed";
  if (raw.includes("review")) return isArabic ? "قيد المراجعة" : "Under Review";
  if (raw.includes("postpone") || raw.includes("defer") || raw.includes("schedule")) return isArabic ? "مؤجل" : "Postponed";
  if (raw.includes("return")) return isArabic ? "راجع" : "Returned";
  if (raw.includes("cancel") || raw.includes("fail")) return isArabic ? "ملغي" : "Cancelled";
  if (raw.includes("assign")) return isArabic ? "تم التعيين" : "Assigned";
  if (raw.includes("pick") || raw.includes("collect")) return isArabic ? "قيد الإحضار" : "Pickup";
  if (raw.includes("transit") || raw.includes("progress")) return isArabic ? "جاري التوصيل" : "In Transit";
  if (raw.includes("deliver") || raw.includes("complete")) return isArabic ? "تم التسليم" : "Delivered";
  return String(status).replace(/_/g, " ");
}

function filterOrdersForSection(id: SectionId, orders: any[]) {
  return orders.filter((order) => {
    const status = normalize(order.status);
    const route = `${order.sender_city || ""} ${order.receiver_city || ""} ${order.pickup_city || ""} ${order.delivery_city || ""}`;
    const routeLower = route.toLowerCase();
    const notes = normalize(order.notes || order.internal_notes || order.admin_notes);
    const scope = normalize(order.shipping_scope || order.scope || order.service_type);
    const destination = normalize(order.destination_country || order.country || order.receiver_country);
    switch (id) {
      case "all_orders": case "reports": case "print": return true;
      case "cancelled": return status.includes("cancel") || status.includes("fail");
      case "review": return status.includes("pending") || status.includes("confirm") || status.includes("review");
      case "postponed": return status.includes("postpone") || status.includes("defer") || status.includes("schedule");
      case "returned": return status.includes("return");
      case "pickup": return status.includes("pick") || status.includes("assign") || status.includes("collect");
      case "abu_dhabi": return routeLower.includes("abu dhabi") || routeLower.includes("mussafah") || routeLower.includes("khalifa") || routeLower.includes("al ain") || route.includes("أبوظبي") || route.includes("ابوظبي");
      case "external": return scope.includes("international") || scope.includes("external") || Boolean(destination && !destination.includes("uae") && !destination.includes("emirates"));
      case "out_scope": return status.includes("scope") || notes.includes("out of scope") || notes.includes("خارج النطاق");
      default: return true;
    }
  });
}

function sectionDescription(id: SectionId, isArabic: boolean) {
  const ar: Partial<Record<SectionId, string>> = { all_orders: "كل الطلبات مع بحث وتحديث وتصدير PDF.", cancelled: "مراجعة الطلبات الملغية والفاشلة.", review: "طلبات تحتاج مراجعة أو تأكيد قبل التحريك.", postponed: "إدارة الطلبات المؤجلة والمجدولة.", returned: "متابعة الشحنات الراجعة وإغلاق أسباب الرجوع.", pickup: "طلبات الاستلام والتعيين قبل التوزيع.", abu_dhabi: "طلبات أبوظبي ومصفح وخليفة والعين.", external: "الشحنات الخارجية والدولية.", out_scope: "طلبات خارج النطاق تحتاج قرار إداري.", reports: "تقارير تشغيلية قابلة للتصدير.", settings: "حالة إعدادات النظام دون إظهار أسرار.", print: "تجهيز طباعة الفواتير والملصقات." };
  const en: Partial<Record<SectionId, string>> = { all_orders: "All orders with search, refresh and PDF export.", cancelled: "Cancelled and failed orders review.", review: "Orders needing review or confirmation before dispatch.", postponed: "Postponed and scheduled order management.", returned: "Returned shipments and return closure.", pickup: "Pickup and assignment orders before dispatch.", abu_dhabi: "Abu Dhabi, Mussafah, Khalifa City and Al Ain orders.", external: "External and international shipments.", out_scope: "Out-of-scope requests requiring admin decision.", reports: "Exportable operational reports.", settings: "System settings status without secrets.", print: "Invoice and label printing workspace." };
  return isArabic ? ar[id] || "مركز عمل إداري مرتبط بالبيانات الحية." : en[id] || "Admin workspace connected to live operational data.";
}

function buildOrderPdfPayload(isArabic: boolean, title: string, query: string, rows: any[], totals: Record<string, string | number>) {
  return { language: isArabic ? "ar" as const : "en" as const, sectionTitle: title, filters: query || (isArabic ? "بدون بحث" : "No search"), totals, columns: [
    { key: "tracking", label: isArabic ? "التتبع" : "Tracking" }, { key: "status", label: isArabic ? "الحالة" : "Status" }, { key: "merchant", label: isArabic ? "التاجر / المرسل" : "Merchant / Sender" }, { key: "route", label: isArabic ? "المسار" : "Route" }, { key: "receiver", label: isArabic ? "المستلم" : "Receiver" }, { key: "amount", label: isArabic ? "المبلغ" : "Amount" }, { key: "date", label: isArabic ? "التاريخ" : "Date" }
  ], rows: rows.map((order) => ({ tracking: getTracking(order), status: translateStatus(order.status, isArabic), merchant: order.merchant_name || order.sender_name || order.customer_name || "—", route: getRoute(order), receiver: order.receiver_name || order.recipient_name || order.customer_name || "—", amount: money(getOrderAmount(order)), date: order.created_at ? new Date(order.created_at).toLocaleDateString(isArabic ? "ar-AE" : "en-AE") : "—" })) };
}

function KhalifaPanel({ isArabic, ui, active, activeTitle, orders, merchants, financeSummary, lastSyncAt }: { isArabic: boolean; ui: typeof copy.ar; active: SectionId; activeTitle: string; orders: any[]; merchants: Merchant[]; financeSummary: FinanceSummary | null; lastSyncAt: Date | null }) {
  const unassigned = orders.filter((order) => !order.driver_id && !order.assigned_driver_id && !/deliver|cancel|return/.test(normalize(order.status))).length;
  return <aside className="dn-admin-left-ai" aria-label={isArabic ? "لوحة خليفة" : "Khalifa panel"}>
    <div className="dn-admin-user-head"><img src={khalifaAssets.bot} alt={ui.helper} /><div><strong>{ui.owner}</strong><span>{ui.role}</span></div></div>
    <div className="dn-admin-khalifa-card">
      <img src={khalifaAssets.bot} alt={ui.helper} />
      <h2>{ui.helper}</h2><p>{ui.helperRole}</p><small>{ui.helperText}</small>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black text-white/80"><span>{ui.liveData}</span><span>{activeTitle}</span><span>{ui.lastSync}</span><span>{lastSyncAt ? lastSyncAt.toLocaleTimeString(isArabic ? "ar-AE" : "en-AE") : "—"}</span><span>{isArabic ? "بدون مندوب" : "Unassigned"}</span><span>{unassigned}</span></div>
      <button type="button">{ui.ask}</button>
    </div>
    <KhalifaGuidanceFeed key={`${active}-${orders.length}-${merchants.length}`} isArabic={isArabic} orders={orders} merchants={merchants} financeSummary={financeSummary} sectionTitle={activeTitle} />
  </aside>;
}

function AdminSectionWorkspace({ id, title, ui, isArabic, metrics, orders, onOpenOperations, onRefresh }: { id: SectionId; title: string; ui: typeof copy.ar; isArabic: boolean; metrics: MetricMap; orders: any[]; onOpenOperations: () => void; onRefresh: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [statusSavingId, setStatusSavingId] = useState("");
  const baseOrders = filterOrdersForSection(id, orders);
  const normalizedQuery = query.toLowerCase().trim();
  const filteredOrders = normalizedQuery ? baseOrders.filter((order) => [getTracking(order), order.receiver_phone, order.sender_phone, order.receiver_name, order.customer_name, order.merchant_name, order.sender_name].join(" ").toLowerCase().includes(normalizedQuery)) : baseOrders;
  const rows = filteredOrders.slice(0, 40);
  const totalAmount = filteredOrders.reduce((sum, order) => sum + getOrderAmount(order), 0);
  const totalIncome = filteredOrders.reduce((sum, order) => sum + getOrderIncome(order), 0);
  async function changeStatus(order: any, status: string) { const idValue = String(order.id || ""); if (!idValue || status === order.status) return; setStatusSavingId(idValue); try { await updateOrderStatus(idValue, status, "Updated from luxury admin control center"); await onRefresh(); } catch (err) { console.warn("Order status update failed:", err); } finally { setStatusSavingId(""); } }
  return <section className="dn-admin-section-workspace">
    <header className="dn-admin-section-hero"><span>{ui.liveFilter}</span><h1>{title}</h1><p>{sectionDescription(id, isArabic)}</p></header>
    <div className="dn-admin-section-kpis"><article><strong>{metrics.total}</strong><span>{ui.totalOrders}</span></article><article><strong>{filteredOrders.length}</strong><span>{ui.sectionCount}</span></article><article><strong>{money(totalAmount)}</strong><span>{ui.codTotal}</span></article><article><strong>{money(totalIncome)}</strong><span>{ui.income}</span></article></div>
    <div className="dn-admin-section-panels"><div><h2>{ui.actionPlan}</h2><p>• {isArabic ? "تصفية مباشرة من بيانات Supabase حسب القسم." : "Direct Supabase filtering by section."}</p><p>• {isArabic ? "بحث وتحديث وتصدير PDF من نفس العرض الحالي." : "Search, refresh, and PDF export from the current view."}</p></div><div><h2>{ui.quickActions}</h2><button type="button" onClick={onOpenOperations}>{ui.openOperations}</button><button type="button" onClick={() => void onRefresh()}>{ui.refresh}</button></div></div>
    <div className="dn-admin-filter-table-card"><div className="mb-3"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isArabic ? "بحث بالتتبع / الهاتف / الاسم / التاجر" : "Search tracking / phone / name / merchant"} className="w-full rounded-2xl border border-white/10 bg-brand-deep/70 px-4 py-3 text-sm font-bold text-white outline-none" /></div><div className="dn-admin-filter-table-head"><div><span>{ui.filteredData}</span><strong>{title}</strong></div><div className="flex flex-wrap items-center gap-2"><p>{ui.rowsShown}: {rows.length} / {filteredOrders.length}</p><AdminPdfExportButton payload={buildOrderPdfPayload(isArabic, title, query, filteredOrders, { [ui.rowsShown]: filteredOrders.length, [ui.codTotal]: money(totalAmount), [ui.income]: money(totalIncome) })} /></div></div>{rows.length === 0 ? <div className="dn-admin-filter-empty"><Package className="h-8 w-8" /><strong>{ui.noSectionOrders}</strong></div> : <div className="dn-admin-filter-table-wrap"><table className="dn-admin-filter-table"><thead><tr><th>{ui.tableTracking}</th><th>{ui.tableStatus}</th><th>{ui.tableMerchant}</th><th>{ui.tableRoute}</th><th>{ui.tableReceiver}</th><th>{ui.tableAmount}</th><th>{ui.tableDate}</th><th>{ui.tableAction}</th></tr></thead><tbody>{rows.map((order, index) => <tr key={String(order.id || order.tracking_number || index)}><td><b dir="ltr">{getTracking(order)}</b></td><td><select disabled={statusSavingId === String(order.id || "")} value={String(order.status || "pending")} onChange={(event) => void changeStatus(order, event.target.value)} className="rounded-xl border border-white/10 bg-brand-deep px-2 py-1 text-xs font-black text-white">{["pending", "confirmed", "assigned", "picked_up", "in_transit", "delivered", "cancelled"].map((status) => <option key={status} value={status}>{translateStatus(status, isArabic)}</option>)}</select></td><td>{order.merchant_name || order.sender_name || order.customer_name || "—"}</td><td>{getRoute(order)}</td><td>{order.receiver_name || order.recipient_name || order.customer_name || "—"}</td><td>{money(getOrderAmount(order))}</td><td>{order.created_at ? new Date(order.created_at).toLocaleDateString(isArabic ? "ar-AE" : "en-AE") : "—"}</td><td><button type="button" onClick={onOpenOperations}>{isArabic ? "فتح" : "Open"}</button></td></tr>)}</tbody></table></div>}</div>
  </section>;
}

function buildFinanceRowsFromOrders(id: SectionId, orders: any[]): FinanceRow[] {
  if (id === "income") return orders.filter((order) => getOrderIncome(order) > 0).map((order, index) => ({ id: getTracking(order) || String(index), status: order.status || "calculated", amount: getOrderIncome(order), created_at: order.created_at } as FinanceRow));
  if (id === "cod") return orders.filter((order) => Number(order.cod_amount || 0) > 0).map((order, index) => ({ id: getTracking(order) || String(index), status: order.status || "calculated", amount: Number(order.cod_amount || 0), created_at: order.created_at } as FinanceRow));
  return [];
}

function AdminFinanceWorkspace({ id, title, isArabic, summary, orders, merchants, onRefresh }: { id: SectionId; title: string; isArabic: boolean; summary: FinanceSummary | null; orders: any[]; merchants: Merchant[]; onRefresh: () => Promise<void> }) {
  const [rows, setRows] = useState<FinanceRow[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [expenseAmount, setExpenseAmount] = useState(""); const [expenseNotes, setExpenseNotes] = useState("");
  async function loadRows() { setLoading(true); setError(""); try { if (id === "expenses") setRows(await fetchExpenses()); else if (id === "merchant_statements") setRows(await fetchMerchantStatements()); else if (id === "driver_statements") setRows(await fetchDriverStatements()); else if (id === "finance_dashboard") setRows(await fetchLedgerEntries()); else setRows(buildFinanceRowsFromOrders(id, orders)); } catch { setRows(buildFinanceRowsFromOrders(id, orders)); setError(isArabic ? "لا يوجد جدول تفصيلي لهذا القسم بعد. يتم عرض الملخص المحسوب من الطلبات الحالية." : "No detailed table exists for this section yet. Showing calculated summary from current orders."); } finally { setLoading(false); } }
  useEffect(() => { void loadRows(); }, [id, orders.length]);
  async function addExpense(event: React.FormEvent) { event.preventDefault(); setError(""); try { await createExpense({ amount: expenseAmount, notes: expenseNotes, status: "draft", payment_method: "cash" }); setExpenseAmount(""); setExpenseNotes(""); await loadRows(); await onRefresh(); } catch { setError(isArabic ? "تعذر إضافة المصروف. تأكد من تفعيل جدول المصروفات." : "Could not add expense. Make sure the expenses table is enabled."); } }
  async function voidSelectedExpense(row: FinanceRow) { if (!row.id) return; try { await voidExpense(row.id, "Voided from admin finance workspace"); await loadRows(); await onRefresh(); } catch { setError(isArabic ? "تعذر إلغاء المصروف." : "Could not void expense."); } }
  const cards = [[isArabic ? "الدخل" : "Income", summary?.total_income || 0], [isArabic ? "المصروفات" : "Expenses", summary?.total_expenses || 0], ["COD", summary?.cod_collected || 0], [isArabic ? "COD معلق" : "COD pending", summary?.cod_pending || 0], [isArabic ? "مستحق التجار" : "Merchant payable", summary?.merchant_payable || 0], [isArabic ? "مستحق المناديب" : "Driver payable", summary?.driver_payable || 0]];
  const pdfRows = rows.map((row) => ({ id: String(row.id || "—").slice(0, 18), status: String(row.status || row.entry_type || "—"), amount: `${Number(row.amount || row.debit || row.credit || row.current_balance || 0).toFixed(2)} AED`, date: row.created_at ? new Date(String(row.created_at)).toLocaleDateString(isArabic ? "ar-AE" : "en-AE") : "—" }));
  return <section className="dn-admin-section-workspace" dir={isArabic ? "rtl" : "ltr"}><header className="dn-admin-section-hero"><span>{isArabic ? "بيانات مالية حقيقية" : "Live finance data"}</span><h1>{title}</h1><p>{isArabic ? "كل الأرقام تقرأ من Supabase أو تُحسب بأمان من الطلبات عند غياب الجداول التفصيلية." : "Figures read from Supabase or safely calculate from orders when detail tables are missing."}</p></header><div className="dn-admin-section-kpis">{cards.map(([label, value]) => <article key={String(label)}><strong>{Number(value).toFixed(2)}</strong><span>{label as string}</span></article>)}</div><div className="dn-admin-section-panels"><div><h2>{isArabic ? "تدفق العمل" : "Workflow"}</h2><p>• {isArabic ? "لا تظهر أخطاء Supabase الخام للمستخدم." : "Raw Supabase errors are not shown to the user."}</p><p>• {isArabic ? "عدد التجار" : "Merchants"}: {merchants.length}</p><p>• {isArabic ? "عدد الطلبات" : "Orders"}: {orders.length}</p></div><div><h2>{isArabic ? "تحديث" : "Refresh"}</h2><button type="button" onClick={() => { void loadRows(); void onRefresh(); }}>{isArabic ? "تحديث البيانات" : "Refresh data"}</button></div></div>{id === "expenses" && <form onSubmit={addExpense} className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:grid-cols-[180px_1fr_auto]"><input value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} type="number" min="0" placeholder="AED" className="rounded-xl border border-white/10 bg-brand-deep/70 px-3 py-2 text-white" /><input value={expenseNotes} onChange={(e) => setExpenseNotes(e.target.value)} placeholder={isArabic ? "ملاحظات المصروف" : "Expense notes"} className="rounded-xl border border-white/10 bg-brand-deep/70 px-3 py-2 text-white" /><button className="rounded-xl bg-brand-gold px-4 py-2 font-black text-brand-deep">{isArabic ? "إضافة" : "Add"}</button></form>}{error && <div className="mb-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm font-bold text-amber-100">{error}</div>}<div className="dn-admin-filter-table-card"><div className="dn-admin-filter-table-head"><div><span>{loading ? (isArabic ? "تحميل" : "Loading") : (isArabic ? "صفوف حية" : "Live rows")}</span><strong>{title}</strong></div><div className="flex flex-wrap items-center gap-2"><p>{rows.length}</p><AdminPdfExportButton payload={{ language: isArabic ? "ar" : "en", sectionTitle: title, filters: error || (isArabic ? "بدون فلاتر" : "No filters"), totals: Object.fromEntries(cards.map(([label, value]) => [String(label), Number(value).toFixed(2)])), columns: [{ key: "id", label: "ID" }, { key: "status", label: isArabic ? "الحالة" : "Status" }, { key: "amount", label: isArabic ? "المبلغ" : "Amount" }, { key: "date", label: isArabic ? "التاريخ" : "Date" }], rows: pdfRows }} /></div></div><div className="dn-admin-filter-table-wrap"><table className="dn-admin-filter-table"><thead><tr><th>ID</th><th>{isArabic ? "الحالة" : "Status"}</th><th>{isArabic ? "المبلغ" : "Amount"}</th><th>{isArabic ? "التاريخ" : "Date"}</th><th>{isArabic ? "إجراء" : "Action"}</th></tr></thead><tbody>{rows.length ? rows.slice(0, 40).map((row, index) => <tr key={String(row.id || index)}><td><b dir="ltr">{String(row.id || "—").slice(0, 12)}</b></td><td>{String(row.status || row.entry_type || "—")}</td><td>{Number(row.amount || row.debit || row.credit || row.current_balance || 0).toFixed(2)} AED</td><td>{row.created_at ? new Date(String(row.created_at)).toLocaleDateString(isArabic ? "ar-AE" : "en-AE") : "—"}</td><td>{id === "expenses" && row.status !== "void" ? <button type="button" onClick={() => void voidSelectedExpense(row)}>{isArabic ? "إلغاء" : "Void"}</button> : "—"}</td></tr>) : <tr><td colSpan={5}>{isArabic ? "لا توجد بيانات بعد أو لم تطبق الجداول." : "No data yet or finance tables are not applied."}</td></tr>}</tbody></table></div></div></section>;
}

export default function AdminPanelLuxury() {
  const { language, toggleLanguage } = useAppContext(); const isArabic = language === "ar"; const ui = isArabic ? copy.ar : copy.en; const [active, setActive] = useState<SectionId>("dashboard"); const [mobileMenu, setMobileMenu] = useState(false); const [orders, setOrders] = useState<any[]>([]); const [merchants, setMerchants] = useState<Merchant[]>([]); const [liveStats, setLiveStats] = useState<AdminStats | null>(null); const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null); const [adminLoading, setAdminLoading] = useState(true); const [adminError, setAdminError] = useState(""); const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const activeItem = menu.find((item) => item.id === active) || menu[0]; const activeTitle = getMenuLabel(activeItem, isArabic);
  async function refreshAdminData() { setAdminLoading(true); setAdminError(""); const [ordersResult, merchantsResult, statsResult, financeResult] = await Promise.allSettled([fetchAdminOrders(), fetchMerchants(), fetchAdminStats(), fetchFinanceSummary()]); if (ordersResult.status === "fulfilled") setOrders(ordersResult.value); else setAdminError(ordersResult.reason?.message || "Orders request failed"); if (merchantsResult.status === "fulfilled") setMerchants(merchantsResult.value); if (statsResult.status === "fulfilled") setLiveStats(statsResult.value); if (financeResult.status === "fulfilled") setFinanceSummary(financeResult.value); setLastSyncAt(new Date()); setAdminLoading(false); }
  useEffect(() => { void refreshAdminData(); }, []);
  const metrics = useMemo<MetricMap>(() => { const cancelled = filterOrdersForSection("cancelled", orders).length; const review = filterOrdersForSection("review", orders).length; const postponed = filterOrdersForSection("postponed", orders).length; const returned = filterOrdersForSection("returned", orders).length; const pickup = filterOrdersForSection("pickup", orders).length; const abuDhabi = filterOrdersForSection("abu_dhabi", orders).length; const external = filterOrdersForSection("external", orders).length; const outScope = filterOrdersForSection("out_scope", orders).length; const codTotal = orders.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0); const income = orders.reduce((sum, order) => sum + getOrderIncome(order), 0); return { total: orders.length, cancelled, review, postponed, returned, pickup, abuDhabi, external, outScope, codTotal, income }; }, [orders]);
  async function handleLogout() { if (supabase) await supabase.auth.signOut(); window.location.href = "/auth"; }
  function selectSection(id: SectionId) { if (id === "logout") { void handleLogout(); return; } setActive(id); setMobileMenu(false); }
  function openOperations() { setActive("all_orders"); setMobileMenu(false); }
  function renderDashboardCenter() { return <section className="dn-admin-center-zone"><header className="dn-admin-main-title"><span>{ui.commandCenter}</span><h1>{ui.welcome}</h1><p>{ui.subtitle}</p></header><AdminLiveOperationsMap isArabic={isArabic} orders={orders} /><div className="my-3 flex justify-end"><AdminPdfExportButton payload={{ language: isArabic ? "ar" : "en", sectionTitle: activeTitle, filters: isArabic ? "ملخص لوحة التحكم" : "Dashboard summary", totals: { [ui.totalOrders]: metrics.total, [ui.codTotal]: money(metrics.codTotal), [ui.income]: money(metrics.income) }, columns: [{ key: "metric", label: isArabic ? "المؤشر" : "Metric" }, { key: "value", label: isArabic ? "القيمة" : "Value" }], rows: Object.entries(metrics).map(([metric, value]) => ({ metric, value })) }} /></div><div className="dn-admin-bottom-cards">{[[ui.latest, ui.noUpdates, FileText], [ui.shipmentInfo, ui.noData, Package], [ui.details, `${metrics.total} ${isArabic ? "طلبات" : "orders"}`, ClipboardList], [ui.quickHelp, ui.preparing, Headphones]].map(([title, text, Icon]) => { const CardIcon = Icon as typeof FileText; return <article key={String(title)}><div><CardIcon className="h-6 w-6" /></div><strong>{title as string}</strong><p>{text as string}</p></article>; })}</div></section>; }
  function renderWorkspace() { if (active === "dashboard") return renderDashboardCenter(); if (active === "new_merchant") return <section className="dn-admin-center-zone"><AdminNewMerchant isArabic={isArabic} onSaved={() => void refreshAdminData()} /></section>; if (active === "new_order") return <section className="dn-admin-center-zone"><AdminNewOrder isArabic={isArabic} merchants={merchants} onSaved={() => void refreshAdminData()} /></section>; if (active === "merchants") return <section className="dn-admin-center-zone"><div className="dn-admin-core-full"><AdminMerchantIntelligence isArabic={isArabic} onSearchOrders={() => setActive("all_orders")} onCreateOrder={() => setActive("new_order")} /></div></section>; if (financeSections.includes(active)) return <section className="dn-admin-center-zone"><AdminFinanceWorkspace id={active} title={activeTitle} isArabic={isArabic} summary={financeSummary} orders={orders} merchants={merchants} onRefresh={refreshAdminData} /></section>; if (active === "support") return <section className="dn-admin-center-zone"><div className="dn-admin-core-full"><AdminProspectingLinks /></div></section>; return <section className="dn-admin-center-zone"><AdminSectionWorkspace id={active} title={activeTitle} ui={ui} isArabic={isArabic} metrics={metrics} orders={orders} onOpenOperations={openOperations} onRefresh={refreshAdminData} /></section>; }
  return <div className="dn-admin-fullscreen" dir={isArabic ? "rtl" : "ltr"}><button type="button" className="dn-admin-mobile-open" onClick={() => setMobileMenu(true)}><Menu className="h-5 w-5" />{ui.menu}</button>{mobileMenu && <button type="button" className="dn-admin-mobile-shade" aria-label="Close" onClick={() => setMobileMenu(false)} />}<div className="dn-admin-layout-full"><main className="dn-admin-content-full"><div className="dn-admin-top-strip"><nav className="dn-admin-site-links" aria-label={ui.websiteNav}>{siteLinks.map((link) => <a key={link.href} href={link.href}>{isArabic ? link.ar : link.en}</a>)}</nav><button type="button" className="dn-admin-language-button" onClick={toggleLanguage}><Languages className="h-4 w-4" />{ui.language}</button></div>{(adminLoading || adminError) && <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-xs font-black text-white/70"><button type="button" onClick={() => void refreshAdminData()} className="me-3 rounded-xl bg-brand-gold px-3 py-1 text-brand-deep">{isArabic ? "تحديث" : "Refresh"}</button>{adminLoading ? ui.loading : adminError}</div>}<div className="dn-admin-home-full"><KhalifaPanel isArabic={isArabic} ui={ui} active={active} activeTitle={activeTitle} orders={orders} merchants={merchants} financeSummary={financeSummary} lastSyncAt={lastSyncAt} />{renderWorkspace()}</div></main><aside className={`dn-admin-right-sidebar ${mobileMenu ? "is-open" : ""}`}><button type="button" className="dn-admin-sidebar-close-final" onClick={() => setMobileMenu(false)}><X className="h-4 w-4" /></button><div className="dn-admin-brand-card"><img src={companyMeta.logoUrl} onError={(event) => { event.currentTarget.src = companyMeta.logoRemoteUrl; }} alt="DAY NIGHT" /><strong>DAY NIGHT</strong><span>DELIVERY SERVICES</span></div><div className="dn-admin-owner-card"><UserRound className="h-5 w-5" /><strong>{ui.owner}</strong><span>{ui.role}</span></div><nav className="dn-admin-menu-full">{menu.map((item, index) => { const Icon = item.Icon; const label = getMenuLabel(item, isArabic); const groupLabel = isArabic ? item.groupAr : item.groupEn; const previous = menu[index - 1]; const showGroup = index === 0 || previous.groupAr !== item.groupAr; return <div key={item.id} className="dn-admin-menu-row">{showGroup && <p className="dn-admin-menu-group">{groupLabel}</p>}<button type="button" onClick={() => selectSection(item.id)} className={active === item.id ? "is-active" : ""}><span className="dn-admin-nav-icon"><Icon className="dn-admin-nav-svg" size={20} strokeWidth={2.4} /></span><strong>{label}</strong></button></div>; })}</nav></aside></div></div>;
}
