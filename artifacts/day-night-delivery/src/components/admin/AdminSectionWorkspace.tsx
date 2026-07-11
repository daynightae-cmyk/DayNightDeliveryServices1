import { useMemo, useState } from "react";
import { FileText, Filter, Search, Sparkles } from "lucide-react";
import { IconizedActionTile, IconizedEmptyState, IconizedMetricCard, AdminIconBadge } from "./adminIconSystem";
import AdminLiveOperationsMap from "./AdminLiveOperationsMap";
import AdminPdfExportButton from "./AdminPdfExportButton";
import { adminSectionById, type AdminSectionId } from "./AdminSectionRegistry";
import type { Merchant, Order } from "../../types";
import type { FinanceSummary, FinanceSummarySource } from "../../lib/adminData";
import { actionLabel, fieldLabel as translatedFieldLabel, kpiLabel, sectionFallbackLabel, statusLabel, tableColumnLabel } from "../../data/adminTranslations";
import AdminOrderDetailsDrawer from "./AdminOrderDetailsDrawer";
import AdminMerchantDetailsDrawer from "./AdminMerchantDetailsDrawer";
import AdminStatusUpdateModal from "./AdminStatusUpdateModal";
import AdminDriverAssignmentModal from "./AdminDriverAssignmentModal";
import AdminDailyClosingPanel from "./AdminDailyClosingPanel";
import AdminProfessionalOrdersWorkspace, { ORDER_SECTION_IDS } from "./AdminProfessionalOrdersWorkspace";
import "../../styles/dn-admin-sections.css";

type Props = { id: AdminSectionId; isArabic: boolean; orders: Order[]; merchants: Merchant[]; financeSummary: FinanceSummary | null; financeSummarySource?: FinanceSummarySource; financeWarning?: string; onNavigate?: (id: AdminSectionId) => void; onRefresh?: () => Promise<void> };
const professionalOrderSections = new Set<AdminSectionId>(ORDER_SECTION_IDS as AdminSectionId[]);
const n = (v: unknown) => String(v ?? "").toLowerCase();
const money = (v: number) => `${Number(v || 0).toFixed(2)} AED`;
const orderExtra = (o: Order) => o as Order & { total?: number; total_amount?: number; service_fee?: number; pickup_city?: string; delivery_city?: string };
const amount = (o: Order) => { const x = orderExtra(o); return Number(o.cod_amount || o.delivery_price || o.price || x.total || x.total_amount || 0); };
const income = (o: Order) => { const x = orderExtra(o); return Number(o.delivery_price || o.price || x.service_fee || 0); };
const tracking = (o: Order) => o.tracking_number || o.invoice_number || o.coupon_number || o.id || "—";
const route = (o: Order) => { const x = orderExtra(o); return `${o.sender_city || x.pickup_city || "—"} → ${o.receiver_city || x.delivery_city || o.destination_country || "—"}`; };
function statusMatch(o: Order, id: AdminSectionId) {
  const s = n(o.status); const text = n(`${o.sender_city} ${o.receiver_city} ${orderExtra(o).pickup_city || ""} ${orderExtra(o).delivery_city || ""} ${o.destination_country} ${o.service_type} ${o.shipping_scope} ${o.notes}`);
  if (["all_orders","reports","print"].includes(id)) return true;
  if (id === "cancelled") return /cancel|fail/.test(s);
  if (id === "review") return /review|pending|confirm|hold/.test(s);
  if (id === "postponed") return /postpone|defer|schedule/.test(s);
  if (id === "returned") return /return/.test(s);
  if (id === "pickup") return /pick|assign|collect/.test(s);
  if (id === "abu_dhabi") return /abu dhabi|mussafah|khalifa|mbz|al ain|أبوظبي|ابوظبي/.test(text);
  if (id === "external") return /international|external|gcc|world|sa|kw|qa|bh|om/.test(text);
  if (id === "out_scope") return /out.?of.?scope|unsupported|خارج النطاق/.test(text) || /scope/.test(s);
  return true;
}
function derivedRows(id: AdminSectionId, orders: Order[]) { return orders.filter((o) => statusMatch(o, id)); }

function CodReconciliationPreview({ orders, isArabic }: { orders: Order[]; isArabic: boolean }) {
  const codOrders = orders.filter((order) => Number(order.cod_amount || 0) > 0);
  const collected = codOrders.filter((order) => /deliver|complete|collect/.test(n(order.status))).reduce((sum, order) => sum + Number(order.cod_amount || 0), 0);
  const total = codOrders.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0);
  const pending = Math.max(0, total - collected);
  const reconciled = codOrders.filter((order) => /reconcile|closed/.test(n(order.status))).reduce((sum, order) => sum + Number(order.cod_amount || 0), 0);
  const progress = total ? Math.min(100, Math.round((reconciled / total) * 100)) : 0;
  const now = Date.now();
  const aging = { today: 0, oneToThree: 0, fourToSeven: 0, overSeven: 0 };
  codOrders.forEach((order) => { const age = Math.floor((now - new Date(String(order.created_at || new Date())).getTime()) / 86400000); if (age <= 0) aging.today += 1; else if (age <= 3) aging.oneToThree += 1; else if (age <= 7) aging.fourToSeven += 1; else aging.overSeven += 1; });
  const driverBalances = new Set(codOrders.map((order) => order.driver_name || (order as Order & { driver_id?: string }).driver_id).filter(Boolean)).size;
  const merchantBalances = new Set(codOrders.map((order) => order.merchant_name || order.merchant_id).filter(Boolean)).size;
  return <article className="dn-section-table-card"><h3>{isArabic ? "تسوية COD" : "COD reconciliation"}</h3><div className="dn-source-badge">{isArabic ? "تقدم التسوية" : "Reconciliation progress"}: {progress}%</div><div className="dn-closing-grid"><article><span>{isArabic ? "COD محصل" : "COD collected"}</span><b>{money(collected)}</b></article><article><span>{isArabic ? "COD معلق" : "COD pending"}</span><b>{money(pending)}</b></article><article><span>{isArabic ? "COD مسوى" : "COD reconciled"}</span><b>{money(reconciled)}</b></article><article><span>{isArabic ? "أرصدة المناديب" : "Driver COD balances"}</span><b>{driverBalances}</b></article><article><span>{isArabic ? "أرصدة التجار" : "Merchant COD balances"}</span><b>{merchantBalances}</b></article><article><span>{isArabic ? "COD متأخر" : "Overdue COD count"}</span><b>{aging.overSeven}</b></article><article><span>{isArabic ? "اليوم" : "Today"}</span><b>{aging.today}</b></article><article><span>{isArabic ? "١–٣ أيام" : "1–3 days"}</span><b>{aging.oneToThree}</b></article><article><span>{isArabic ? "٤–٧ أيام" : "4–7 days"}</span><b>{aging.fourToSeven}</b></article><article><span>{isArabic ? "أكثر من ٧ أيام" : "Over 7 days"}</span><b>{aging.overSeven}</b></article></div><p className="dn-clean-note">{isArabic ? "إجراءات: تحصيل، تسوية، نزاع، وتصدير تقرير التسوية تستخدم الصف المحدد ولا تعرض أخطاء تقنية خام." : "Actions: mark collected, mark reconciled, mark disputed, and export reconciliation report use the selected row and hide raw technical errors."}</p></article>;
}
function metricValue(key: string, orders: Order[], merchants: Merchant[], summary: FinanceSummary | null) {
  const today = new Date().toISOString().slice(0, 10); const delivered = orders.filter((o) => /deliver|complete/.test(n(o.status))); const cancelled = orders.filter((o) => /cancel|fail/.test(n(o.status))); const cod = orders.reduce((s,o)=>s+Number(o.cod_amount||0),0); const rev = orders.reduce((s,o)=>s+income(o),0);
  if (/merchant/i.test(key) && !/payable|balance/i.test(key)) return merchants.length;
  if (/today/i.test(key)) return orders.filter((o)=>String(o.created_at||"").slice(0,10)===today).length;
  if (/delivered|deliveries/i.test(key)) return delivered.length;
  if (/cancel/i.test(key)) return cancelled.length;
  if (/rate/i.test(key)) return orders.length ? `${Math.round((cancelled.length/orders.length)*100)}%` : "0%";
  if (/cod|balance|payable|revenue|income|expense|net|value|amount|fee|earning/i.test(key)) return money(key.includes("expense") ? (summary?.total_expenses || 0) : key.includes("pending") ? (summary?.cod_pending || cod) : key.includes("collected") ? (summary?.cod_collected || 0) : rev || cod);
  if (/active|assigned|queue|external|returned|pending|overdue|high|problem|risk|row|order|request|label|action/i.test(key)) return orders.length;
  return orders.length ? orders.length : "—";
}
function iconForKpi(key: string) {
  if (/cod/i.test(key)) return "cod" as const;
  if (/income|revenue|earning/i.test(key)) return "income" as const;
  if (/deliver/i.test(key)) return "delivered-orders" as const;
  if (/active|queue|pending/i.test(key)) return "active-orders" as const;
  if (/unassigned|driver/i.test(key)) return "unassigned-orders" as const;
  return "orders" as const;
}
function iconForAction(action: string) {
  if (/addOrder|createOrder/.test(action)) return "add-order" as const;
  if (/addMerchant/.test(action)) return "add-merchant" as const;
  if (/review/.test(action)) return "review-orders" as const;
  if (/finance|Income|Expenses|Cod|Statements/.test(action)) return "finance" as const;
  if (/Pdf|print|export/i.test(action)) return "pdf-export" as const;
  if (/Map/i.test(action)) return "map" as const;
  if (/assign|driver/i.test(action)) return "driver" as const;
  return "click" as const;
}

export default function AdminSectionWorkspace({ id, isArabic, orders, merchants, financeSummary, financeSummarySource = "derived", financeWarning, onNavigate, onRefresh }: Props) {
  if (professionalOrderSections.has(id)) {
    return <AdminProfessionalOrdersWorkspace id={id as (typeof ORDER_SECTION_IDS)[number]} isArabic={isArabic} orders={orders} merchants={merchants} onRefresh={onRefresh} onNavigate={onNavigate} />;
  }
  const config = adminSectionById[id]; const [query,setQuery] = useState(""); const [filters,setFilters] = useState<Record<string,string>>({}); const [selectedOrder,setSelectedOrder] = useState<Order | null>(null); const [selectedMerchant,setSelectedMerchant] = useState<Merchant | null>(null); const [statusOrder,setStatusOrder] = useState<Order | null>(null); const [assignOrder,setAssignOrder] = useState<Order | null>(null); const [notice,setNotice] = useState("");
  const base = useMemo(()=>derivedRows(id, orders),[id,orders]);
  const rows = useMemo(()=>base.filter((o)=>{ const haystack = [tracking(o), o.receiver_phone, o.sender_phone, o.receiver_name, o.customer_name, o.merchant_name, o.sender_name, o.status, o.service_type, o.payment_method, o.sender_city, o.receiver_city].join(" ").toLowerCase(); if (query && !haystack.includes(query.toLowerCase())) return false; if (filters.status && !n(o.status).includes(n(filters.status))) return false; if (filters.merchant && !n(`${o.merchant_id || ""} ${o.merchant_name || ""} ${o.sender_name || ""}`).includes(n(filters.merchant))) return false; if (filters.driver && !n(`${o.driver_code || ""} ${o.driver_name || ""} ${o.driver_phone || ""}`).includes(n(filters.driver))) return false; if ((filters.emirate || filters.city) && !n(`${o.sender_city} ${o.receiver_city}`).includes(n(filters.emirate || filters.city))) return false; if (filters.serviceType && !n(o.service_type).includes(n(filters.serviceType))) return false; if (filters.paymentType && !n(o.payment_method).includes(n(filters.paymentType))) return false; if (filters.codOnly && Number(o.cod_amount || 0) <= 0) return false; if (filters.dateRange && !String(o.created_at || "").includes(filters.dateRange)) return false; return true; }).slice(0,80),[base,query,filters]);
  const title = isArabic ? config.titleAr : config.titleEn; const subtitle = isArabic ? config.subtitleAr : config.subtitleEn;
  const totals = { orders: base.length, visible: rows.length, cod: money(base.reduce((s,o)=>s+Number(o.cod_amount||0),0)), income: money(base.reduce((s,o)=>s+income(o),0)) };
  const navigate = (target: AdminSectionId) => onNavigate?.(target);
  const doAction = (action: string) => { if (action === "addOrder") navigate("new_order"); else if (action === "addMerchant") navigate("new_merchant"); else if (action === "reviewPending") navigate("review"); else if (action === "openFinance") navigate("finance_dashboard"); else if (action === "openIncome") navigate("income"); else if (action === "openExpenses") navigate("expenses"); else if (action === "openCod") navigate("cod"); else if (action === "openStatements") navigate("merchant_statements"); else if (action === "assignDriver") setAssignOrder(rows[0] || null); else if (action === "editStatus" || action === "reopen" || action === "markPickedUp" || action === "updateInternationalStatus") setStatusOrder(rows[0] || null); else if (action === "openMap" || action === "focusMap") navigate("dashboard"); else if (action === "view") rows[0] ? setSelectedOrder(rows[0]) : setNotice(isArabic ? "لا توجد صفوف لفتحها." : "No rows to open."); else setNotice(isArabic ? "تم فتح إجراء معاينة آمن: " + actionLabel(action,true) : "Opened safe preview action: " + actionLabel(action,false)); };
  return <section className="dn-section-workspace" dir={isArabic ? "rtl" : "ltr"}>
    <header className="dn-section-hero"><div><span>{isArabic ? "وحدة تشغيلية" : config.category} · {isArabic ? "بيانات محملة / اشتقاق آمن" : config.dataSource}</span><h1>{title}</h1><p>{subtitle}</p></div><div className="dn-section-hero-actions"><button onClick={()=>void onRefresh?.()}>{isArabic?"تحديث":"Refresh"}</button><AdminPdfExportButton payload={{ language: isArabic ? "ar":"en", sectionTitle: title, filters: Object.entries(filters).map(([k,v])=>`${translatedFieldLabel(k, isArabic)}: ${v || (isArabic ? "الكل" : "All")}`).join(" | ") || (isArabic?"بدون فلاتر":"No filters"), totals, columns: [{key:"tracking",label:isArabic?"التتبع":"Tracking"},{key:"status",label:isArabic?"الحالة":"Status"},{key:"merchant",label:isArabic?"التاجر":"Merchant"},{key:"route",label:isArabic?"المسار":"Route"},{key:"amount",label:isArabic?"المبلغ":"Amount"},{key:"date",label:isArabic?"التاريخ":"Date"}], rows: rows.map(o=>({tracking:tracking(o),status:statusLabel(o.status||"", isArabic),merchant:o.merchant_name||o.sender_name||"—",route:route(o),amount:money(amount(o)),date:o.created_at?new Date(o.created_at).toLocaleString(isArabic?"ar-AE":"en-AE"):"—"})) }} /></div></header>
    {id === "dashboard" && <AdminLiveOperationsMap isArabic={isArabic} orders={orders} />}
    {id === "cod" && <CodReconciliationPreview orders={orders} isArabic={isArabic} />}
    {["dashboard","finance_dashboard","cod","accounts"].includes(id) && <AdminDailyClosingPanel isArabic={isArabic} orders={orders} financeSummary={financeSummary} financeSummarySource={financeSummarySource} onNavigate={(target)=>navigate(target as AdminSectionId)} />}
    {financeWarning && <p className="dn-clean-note">{isArabic ? "ملخص مالي مشتق مؤقتاً من الطلبات" : "Finance summary temporarily derived from orders"}</p>}
    <div className="dn-section-kpis">{config.kpis.slice(0,8).map((k)=><IconizedMetricCard key={k} icon={iconForKpi(k)} title={kpiLabel(k,isArabic)} value={metricValue(k, base.length ? base : orders, merchants, financeSummary)} tone="info" />)}</div>
    <div className="dn-section-panels"><article><h3><Filter />{isArabic?"الفلاتر والمدخلات":"Filters & inputs"}</h3><div className="dn-section-form"><label><span>{isArabic?"بحث":"Search"}</span><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder={isArabic?"تتبع، هاتف، تاجر...":"Tracking, phone, merchant..."}/></label>{[...config.filters, ...config.inputFields].slice(0,18).map((f)=><label key={f}><span>{translatedFieldLabel(f,isArabic)}</span><input value={filters[f] || ""} onChange={(e)=>setFilters((p)=>({...p,[f]:e.target.value}))} placeholder={translatedFieldLabel(f,isArabic)} /></label>)}</div></article><article><h3><Sparkles />{isArabic?"إجراءات جاهزة":"Ready actions"}</h3><div className="dn-action-grid">{config.actions.map((a)=><IconizedActionTile key={a} icon={iconForAction(a)} title={actionLabel(a,isArabic)} hint={isArabic ? "إجراء آمن ومترجم" : "Safe translated action"} ariaLabel={actionLabel(a,isArabic)} onClick={()=>doAction(a)} />)}</div><p className="dn-clean-note">{isArabic?"إذا كان جدول متخصص غير متاح، يتم الاشتقاق بأمان من الطلبات دون عرض أخطاء Supabase الخام.":"If a specialized table is unavailable, this workspace safely derives from orders without exposing raw Supabase schema errors."}</p></article></div>
    <article className="dn-section-table-card"><h3><FileText />{isArabic?"الصفوف الحالية":"Current rows"}</h3>{notice && <p className="dn-clean-note">{notice}</p>}<div className="dn-section-table-wrap"><table><thead><tr><th>{tableColumnLabel("tracking",isArabic)}</th><th>{tableColumnLabel("status",isArabic)}</th><th>{tableColumnLabel("merchantSender",isArabic)}</th><th>{tableColumnLabel("route",isArabic)}</th><th>{tableColumnLabel("receiver",isArabic)}</th><th>{tableColumnLabel("amount",isArabic)}</th><th>{tableColumnLabel("action",isArabic)}</th></tr></thead><tbody>{rows.map((o)=><tr key={String(o.id || tracking(o))} onClick={()=>setSelectedOrder(o)}><td><button type="button" onClick={(event)=>{event.stopPropagation(); setSelectedOrder(o);}}>{tracking(o)}</button></td><td>{statusLabel(o.status || "", isArabic)}</td><td><button type="button" onClick={(event)=>{event.stopPropagation(); const merchant = merchants.find((m)=>m.id===o.merchant_id || m.trade_name===o.merchant_name); if (merchant) setSelectedMerchant(merchant); else setNotice(isArabic?"لا يوجد ملف تاجر مرتبط بهذا الصف.":"No merchant profile is linked to this row.");}}>{o.merchant_name || o.sender_name || "—"}</button></td><td>{route(o)}</td><td>{o.receiver_name || o.customer_name || "—"}</td><td>{money(amount(o))}</td><td><div className="dn-row-actions"><button type="button" onClick={(event)=>{event.stopPropagation(); setSelectedOrder(o);}}>{actionLabel("view",isArabic)}</button><button type="button" onClick={(event)=>{event.stopPropagation(); setStatusOrder(o);}}>{actionLabel("editStatus",isArabic)}</button><button type="button" onClick={(event)=>{event.stopPropagation(); setAssignOrder(o);}}>{actionLabel("assignDriver",isArabic)}</button></div></td></tr>)}</tbody></table>{!rows.length && <IconizedEmptyState icon="empty-state" title={isArabic ? "لا توجد سجلات بعد" : "No records yet"} message={sectionFallbackLabel("noMatchingOrders",isArabic)} action={<button type="button" onClick={()=>navigate("dashboard")}>{isArabic ? "افتح لوحة التحكم" : "Open dashboard"}</button>} />}</div></article><AdminOrderDetailsDrawer order={selectedOrder} merchants={merchants} isArabic={isArabic} onClose={()=>setSelectedOrder(null)} onStatus={(order)=>setStatusOrder(order)} onAssign={(order)=>setAssignOrder(order)} onMerchant={(merchant)=>setSelectedMerchant(merchant)} onPreview={setNotice} /><AdminMerchantDetailsDrawer merchant={selectedMerchant} orders={orders} isArabic={isArabic} onClose={()=>setSelectedMerchant(null)} onNavigate={(target)=>navigate(target)} onPreview={setNotice} /><AdminStatusUpdateModal open={Boolean(statusOrder)} order={statusOrder} isArabic={isArabic} onClose={()=>setStatusOrder(null)} onSaved={onRefresh} /><AdminDriverAssignmentModal open={Boolean(assignOrder)} order={assignOrder} isArabic={isArabic} onClose={()=>setAssignOrder(null)} onSaved={onRefresh} />
  </section>;
}
