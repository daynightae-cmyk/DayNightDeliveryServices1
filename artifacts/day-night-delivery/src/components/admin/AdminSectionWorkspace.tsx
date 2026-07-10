import { useMemo, useState } from "react";
import { FileText, Filter, Search, Sparkles } from "lucide-react";
import AdminLiveOperationsMap from "./AdminLiveOperationsMap";
import AdminPdfExportButton from "./AdminPdfExportButton";
import { adminSectionById, type AdminSectionId } from "./AdminSectionRegistry";
import type { Merchant, Order } from "../../types";
import type { FinanceSummary } from "../../lib/adminData";
import { actionLabel, fieldLabel as translatedFieldLabel, kpiLabel, statusLabel } from "../../data/adminTranslations";
import "../../styles/dn-admin-sections.css";

type Props = { id: AdminSectionId; isArabic: boolean; orders: Order[]; merchants: Merchant[]; financeSummary: FinanceSummary | null; onNavigate?: (id: AdminSectionId) => void; onRefresh?: () => Promise<void> };
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
export default function AdminSectionWorkspace({ id, isArabic, orders, merchants, financeSummary, onNavigate, onRefresh }: Props) {
  const config = adminSectionById[id]; const [query,setQuery] = useState(""); const [filters,setFilters] = useState<Record<string,string>>({});
  const base = useMemo(()=>derivedRows(id, orders),[id,orders]);
  const rows = useMemo(()=>base.filter((o)=>!query || [tracking(o), o.receiver_phone, o.sender_phone, o.receiver_name, o.customer_name, o.merchant_name, o.sender_name].join(" ").toLowerCase().includes(query.toLowerCase())).slice(0,80),[base,query]);
  const title = isArabic ? config.titleAr : config.titleEn; const subtitle = isArabic ? config.subtitleAr : config.subtitleEn;
  const totals = { orders: base.length, visible: rows.length, cod: money(base.reduce((s,o)=>s+Number(o.cod_amount||0),0)), income: money(base.reduce((s,o)=>s+income(o),0)) };
  return <section className="dn-section-workspace" dir={isArabic ? "rtl" : "ltr"}>
    <header className="dn-section-hero"><div><span>{isArabic ? "وحدة تشغيلية" : config.category} · {isArabic ? "بيانات محملة / اشتقاق آمن" : config.dataSource}</span><h1>{title}</h1><p>{subtitle}</p></div><div className="dn-section-hero-actions"><button onClick={()=>void onRefresh?.()}>{isArabic?"تحديث":"Refresh"}</button><AdminPdfExportButton payload={{ language: isArabic ? "ar":"en", sectionTitle: title, filters: Object.entries(filters).map(([k,v])=>`${k}: ${v || "all"}`).join(" | ") || (isArabic?"بدون فلاتر":"No filters"), totals, columns: [{key:"tracking",label:isArabic?"التتبع":"Tracking"},{key:"status",label:isArabic?"الحالة":"Status"},{key:"merchant",label:isArabic?"التاجر":"Merchant"},{key:"route",label:isArabic?"المسار":"Route"},{key:"amount",label:isArabic?"المبلغ":"Amount"},{key:"date",label:isArabic?"التاريخ":"Date"}], rows: rows.map(o=>({tracking:tracking(o),status:statusLabel(o.status||"", isArabic),merchant:o.merchant_name||o.sender_name||"—",route:route(o),amount:money(amount(o)),date:o.created_at?new Date(o.created_at).toLocaleString(isArabic?"ar-AE":"en-AE"):"—"})) }} /></div></header>
    {id === "dashboard" && <AdminLiveOperationsMap isArabic={isArabic} orders={orders} />}
    <div className="dn-section-kpis">{config.kpis.slice(0,8).map((k)=><article key={k}><span>{kpiLabel(k,isArabic)}</span><strong>{metricValue(k, base.length ? base : orders, merchants, financeSummary)}</strong></article>)}</div>
    <div className="dn-section-panels"><article><h3><Filter />{isArabic?"الفلاتر والمدخلات":"Filters & inputs"}</h3><div className="dn-section-form"><label><span>{isArabic?"بحث":"Search"}</span><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder={isArabic?"تتبع، هاتف، تاجر...":"Tracking, phone, merchant..."}/></label>{[...config.filters, ...config.inputFields].slice(0,18).map((f)=><label key={f}><span>{translatedFieldLabel(f,isArabic)}</span><input value={filters[f] || ""} onChange={(e)=>setFilters((p)=>({...p,[f]:e.target.value}))} placeholder={translatedFieldLabel(f,isArabic)} /></label>)}</div></article><article><h3><Sparkles />{isArabic?"إجراءات جاهزة":"Ready actions"}</h3><div className="dn-action-grid">{config.actions.map((a)=><button key={a} onClick={()=> a.includes("openFinance") ? onNavigate?.("finance_dashboard") : a.includes("addOrder") ? onNavigate?.("new_order") : a.includes("addMerchant") ? onNavigate?.("new_merchant") : undefined}>{actionLabel(a,isArabic)}</button>)}</div><p className="dn-clean-note">{isArabic?"إذا كان جدول متخصص غير متاح، يتم الاشتقاق بأمان من الطلبات دون عرض أخطاء Supabase الخام.":"If a specialized table is unavailable, this workspace safely derives from orders without exposing raw Supabase schema errors."}</p></article></div>
    <article className="dn-section-table-card"><h3><FileText />{isArabic?"الصفوف الحالية":"Current rows"}</h3><div className="dn-section-table-wrap"><table><thead><tr><th>{isArabic?"التتبع":"Tracking"}</th><th>{isArabic?"الحالة":"Status"}</th><th>{isArabic?"التاجر/المرسل":"Merchant/Sender"}</th><th>{isArabic?"المسار":"Route"}</th><th>{isArabic?"المستلم":"Receiver"}</th><th>{isArabic?"المبلغ":"Amount"}</th><th>{isArabic?"إجراء":"Action"}</th></tr></thead><tbody>{rows.map((o)=><tr key={String(o.id || tracking(o))}><td>{tracking(o)}</td><td>{statusLabel(o.status || "", isArabic)}</td><td>{o.merchant_name || o.sender_name || "—"}</td><td>{route(o)}</td><td>{o.receiver_name || o.customer_name || "—"}</td><td>{money(amount(o))}</td><td><button>{isArabic?"فتح":"Open"}</button></td></tr>)}</tbody></table>{!rows.length && <div className="dn-empty-state"><Search />{isArabic?"لا توجد بيانات حقيقية مطابقة حالياً.":"No real matching data right now."}</div>}</div></article>
  </section>;
}
