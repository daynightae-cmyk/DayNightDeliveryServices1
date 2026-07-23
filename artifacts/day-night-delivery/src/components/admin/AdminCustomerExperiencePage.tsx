import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertOctagon,
  ArrowLeft,
  BarChart3,
  BellRing,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  Languages,
  Loader2,
  MessageCircle,
  MessagesSquare,
  RefreshCw,
  Save,
  Settings2,
  ShieldAlert,
  Star,
  Store,
  Truck,
  UserRoundCheck,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppContext } from "../../lib/AppContext";
import { supabase } from "../../supabase";
import localAssets from "../../data/localAssets";
import {
  loadAdminCustomerExperience,
  loadComplaintDetails,
  saveMessageTemplate,
  subscribeCustomerExperience,
  updateComplaint,
  type AdminExperienceSnapshot,
} from "../../services/customerExperienceService";
import {
  openPreparedWhatsApp,
  prepareWhatsAppMessage,
} from "../../services/whatsappMessageService";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  MESSAGE_TEMPLATE_VARIABLES,
  getDefaultMessageTemplate,
  type MessageTemplateKey,
} from "../../config/messageTemplates";
import { getTrackingUrl } from "../../config/companyContact";
import { playAdminAudioEvent, readAdminAudioSettings, unlockAdminAudio } from "../../lib/adminAudio";

type TabId = "overview" | "ratings" | "complaints" | "drivers" | "merchants" | "messages" | "templates";

const TABS: Array<{ id: TabId; ar: string; en: string; Icon: typeof Star }> = [
  { id: "overview", ar: "نظرة عامة", en: "Overview", Icon: BarChart3 },
  { id: "ratings", ar: "التقييمات", en: "Ratings", Icon: Star },
  { id: "complaints", ar: "الشكاوى", en: "Complaints", Icon: ShieldAlert },
  { id: "drivers", ar: "تقييمات المندوبين", en: "Driver ratings", Icon: Truck },
  { id: "merchants", ar: "تقييمات التجار", en: "Merchant ratings", Icon: Store },
  { id: "messages", ar: "الرسائل المرسلة", en: "Message logs", Icon: MessagesSquare },
  { id: "templates", ar: "إعدادات القوالب", en: "Template settings", Icon: Settings2 },
];

const STATUS_OPTIONS = [
  ["new", "جديدة", "New"],
  ["under_review", "قيد المراجعة", "Under review"],
  ["waiting_customer", "بانتظار العميل", "Waiting for customer"],
  ["waiting_driver", "بانتظار المندوب", "Waiting for driver"],
  ["waiting_merchant", "بانتظار التاجر", "Waiting for merchant"],
  ["escalated", "تم التصعيد", "Escalated"],
  ["resolved", "تم الحل", "Resolved"],
  ["closed", "مغلقة", "Closed"],
  ["rejected", "مرفوضة", "Rejected"],
] as const;

const SEVERITY_OPTIONS = [
  ["low", "منخفضة", "Low"],
  ["medium", "متوسطة", "Medium"],
  ["high", "مرتفعة", "High"],
  ["critical", "حرجة", "Critical"],
] as const;

function average(values: unknown[]) {
  const valid = values.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function fmt(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "0.0";
}

function dayKey(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}

function safeDate(value?: string | null, locale = "ar-AE") {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale);
}

function idFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("complaint") || "";
}

function initialTab(): TabId {
  const value = new URLSearchParams(window.location.search).get("tab") as TabId | null;
  return TABS.some((tab) => tab.id === value) ? value! : "overview";
}

function StarsCell({ value }: { value: number }) {
  const rating = Math.max(0, Math.min(5, Number(value || 0)));
  return <span className="inline-flex items-center gap-1 font-black text-[#9A6F00]"><Star className="h-4 w-4 fill-[#D4AF37] text-[#D4AF37]" />{fmt(rating)}</span>;
}

export default function AdminCustomerExperiencePage() {
  const { language, toggleLanguage } = useAppContext();
  const isArabic = language === "ar";
  const locale = isArabic ? "ar-AE" : "en-AE";
  const [tab, setTab] = useState<TabId>(initialTab);
  const [data, setData] = useState<AdminExperienceSnapshot | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<any | null>(null);
  const [complaintDetails, setComplaintDetails] = useState<any | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [templateDrafts, setTemplateDrafts] = useState<Record<string, string>>({});
  const [templateBusy, setTemplateBusy] = useState("");
  const [merchantMessageBusy, setMerchantMessageBusy] = useState("");
  const previousCritical = useRef(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!supabase) throw new Error("supabase_not_configured");
      const [snapshot, ordersResult, driversResult] = await Promise.all([
        loadAdminCustomerExperience(),
        supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("driver_profiles").select("*").order("created_at", { ascending: false }).limit(500),
      ]);
      if (ordersResult.error) throw ordersResult.error;
      if (driversResult.error) throw driversResult.error;
      setData(snapshot);
      setOrders(ordersResult.data || []);
      setDrivers(driversResult.data || []);
      setTemplateDrafts(Object.fromEntries(snapshot.templates.map((item: any) => [item.id, String(item.body || "")])));
      setLastSync(new Date());
    } catch (cause) {
      console.warn("Customer experience admin load failed", cause);
      setError(isArabic ? "تعذر تحميل مركز تجربة العملاء. تأكد من تطبيق ترحيل قاعدة البيانات والصلاحيات." : "Customer Experience could not load. Verify the database migration and permissions.");
    } finally {
      setLoading(false);
    }
  }, [isArabic]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => subscribeCustomerExperience(() => void refresh()), [refresh]);

  const criticalCount = useMemo(() => (data?.complaints || []).filter((item: any) => item.severity === "critical" && !["resolved", "closed", "rejected"].includes(item.status)).length, [data]);

  useEffect(() => {
    if (criticalCount > previousCritical.current) {
      unlockAdminAudio();
      playAdminAudioEvent("warning", readAdminAudioSettings());
    }
    previousCritical.current = criticalCount;
  }, [criticalCount]);

  useEffect(() => {
    const complaintId = idFromQuery();
    if (!complaintId || !data?.complaints?.length) return;
    const row = data.complaints.find((item: any) => item.id === complaintId);
    if (row) void openComplaint(row);
  }, [data?.complaints]);

  const orderById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
  const driverById = useMemo(() => new Map(drivers.map((driver) => [driver.id, driver])), [drivers]);
  const merchantById = useMemo(() => new Map((data?.merchants || []).map((merchant: any) => [merchant.id, merchant])), [data?.merchants]);

  const feedback = data?.feedback || [];
  const complaints = useMemo(() => [...(data?.complaints || [])].sort((a: any, b: any) => {
    const rank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    return (rank[b.severity] || 0) - (rank[a.severity] || 0) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  }), [data?.complaints]);
  const messages = data?.messages || [];
  const templates = data?.templates || [];

  const overview = useMemo(() => {
    const now = Date.now();
    const today = feedback.filter((item: any) => now - new Date(item.submitted_at).getTime() < 86_400_000).length;
    const week = feedback.filter((item: any) => now - new Date(item.submitted_at).getTime() < 7 * 86_400_000).length;
    const open = complaints.filter((item: any) => !["resolved", "closed", "rejected"].includes(item.status)).length;
    const satisfied = feedback.filter((item: any) => Number(item.overall_rating) >= 4).length;
    return {
      company: average(feedback.map((item: any) => item.company_rating)),
      driver: average(feedback.map((item: any) => item.driver_rating)),
      today,
      week,
      open,
      critical: criticalCount,
      satisfaction: feedback.length ? (satisfied / feedback.length) * 100 : 0,
    };
  }, [feedback, complaints, criticalCount]);

  const trend = useMemo(() => {
    const grouped = new Map<string, number[]>();
    feedback.forEach((item: any) => {
      const key = dayKey(item.submitted_at);
      grouped.set(key, [...(grouped.get(key) || []), Number(item.overall_rating || 0)]);
    });
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-30).map(([date, values]) => ({ date: date.slice(5), rating: Number(fmt(average(values))) }));
  }, [feedback]);

  const complaintReasons = useMemo(() => {
    const counts = new Map<string, number>();
    complaints.forEach((item: any) => counts.set(item.category, (counts.get(item.category) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [complaints]);

  const driverScores = useMemo(() => {
    const grouped = new Map<string, number[]>();
    feedback.forEach((item: any) => item.driver_id && grouped.set(item.driver_id, [...(grouped.get(item.driver_id) || []), Number(item.driver_rating || 0)]));
    return [...grouped.entries()].map(([id, values]) => ({ id, name: driverById.get(id)?.full_name || driverById.get(id)?.name || id, rating: average(values), count: values.length })).sort((a, b) => b.rating - a.rating);
  }, [feedback, driverById]);

  const merchantScores = useMemo(() => {
    const grouped = new Map<string, { ratings: number[]; complaints: number }>();
    feedback.forEach((item: any) => {
      if (!item.merchant_id) return;
      const row = grouped.get(item.merchant_id) || { ratings: [], complaints: 0 };
      row.ratings.push(Number(item.company_rating || item.overall_rating || 0));
      grouped.set(item.merchant_id, row);
    });
    complaints.forEach((item: any) => {
      if (!item.merchant_id) return;
      const row = grouped.get(item.merchant_id) || { ratings: [], complaints: 0 };
      row.complaints += 1;
      grouped.set(item.merchant_id, row);
    });
    return [...grouped.entries()].map(([id, row]) => ({ id, name: merchantById.get(id)?.trade_name || id, rating: average(row.ratings), count: row.ratings.length, complaints: row.complaints })).sort((a, b) => b.rating - a.rating);
  }, [feedback, complaints, merchantById]);

  async function openComplaint(row: any) {
    setSelectedComplaint(row);
    setDetailBusy(true);
    setComplaintDetails(null);
    try {
      setComplaintDetails(await loadComplaintDetails(row.id));
      setResolution(row.resolution || "");
    } catch {
      setError(isArabic ? "تعذر تحميل تفاصيل الشكوى." : "Complaint details could not load.");
    } finally {
      setDetailBusy(false);
    }
  }

  async function changeComplaint(input: { status?: string; severity?: string; assignedTo?: string | null }) {
    if (!selectedComplaint) return;
    setDetailBusy(true);
    try {
      await updateComplaint({ complaintId: selectedComplaint.id, ...input, note: adminNote.trim() || undefined, resolution: resolution.trim() || undefined });
      setAdminNote("");
      await refresh();
      const updated = (await loadComplaintDetails(selectedComplaint.id));
      setComplaintDetails(updated);
      setSelectedComplaint(updated.complaint);
    } catch {
      setError(isArabic ? "تعذر تحديث الشكوى. تحقق من صلاحيات الإدارة." : "Complaint update failed. Check admin permissions.");
    } finally {
      setDetailBusy(false);
    }
  }

  async function contactForComplaint(target: "customer" | "driver" | "merchant") {
    if (!selectedComplaint) return;
    const order = orderById.get(selectedComplaint.order_id) || {};
    const driver = driverById.get(selectedComplaint.driver_id) || {};
    const merchant = merchantById.get(selectedComplaint.merchant_id) || {};
    const phone = target === "customer" ? order.receiver_phone || order.customer_phone : target === "driver" ? driver.phone || order.driver_phone : merchant.phone;
    try {
      const prepared = await prepareWhatsAppMessage({
        messageType: "admin_order_contact",
        customerPhone: phone,
        trackingNumber: selectedComplaint.tracking_number,
        orderStatus: order.status || selectedComplaint.status,
        trackingUrl: getTrackingUrl(selectedComplaint.tracking_number),
        orderId: selectedComplaint.order_id,
        merchantId: selectedComplaint.merchant_id,
        driverId: selectedComplaint.driver_id,
        locale: isArabic ? "ar" : "en",
        metadata: { surface: "admin_complaint_detail", complaint_id: selectedComplaint.id, target },
      });
      await openPreparedWhatsApp(prepared);
    } catch {
      setError(isArabic ? "لا يوجد رقم واتساب صالح للطرف المحدد." : "The selected party has no valid WhatsApp number.");
    }
  }

  async function messageMerchant(merchant: any, type: "merchant_welcome" | "merchant_orders_today") {
    const key = `${merchant.id}:${type}`;
    setMerchantMessageBusy(key);
    try {
      const prepared = await prepareWhatsAppMessage({
        messageType: type,
        merchantId: merchant.id,
        merchantName: merchant.trade_name,
        merchantPhone: merchant.phone,
        trackingUrl: "https://www.daynightae.com/tracking",
        merchantPortalUrl: "https://www.daynightae.com/merchant",
        feedbackUrl: "https://www.daynightae.com/contact",
        locale: isArabic ? "ar" : "en",
        metadata: { surface: "admin_customer_experience_merchants" },
      });
      await openPreparedWhatsApp(prepared);
    } catch {
      setError(isArabic ? "تعذر تجهيز رسالة التاجر. تحقق من رقم الهاتف." : "Merchant message could not be prepared. Check the phone number.");
    } finally {
      setMerchantMessageBusy("");
    }
  }

  async function saveTemplate(template: any) {
    setTemplateBusy(template.id);
    setError("");
    try {
      await saveMessageTemplate({ id: template.id, body: templateDrafts[template.id] ?? template.body, isActive: template.is_active });
      await refresh();
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "template_save_failed";
      setError(isArabic ? `تعذر حفظ القالب: ${text}` : `Template save failed: ${text}`);
    } finally {
      setTemplateBusy("");
    }
  }

  function setTabAndUrl(value: TabId) {
    setTab(value);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    url.searchParams.delete("complaint");
    window.history.replaceState({}, "", url);
  }

  const kpis = [
    [isArabic ? "متوسط الشركة" : "Company average", fmt(overview.company), Star],
    [isArabic ? "متوسط المندوبين" : "Driver average", fmt(overview.driver), Truck],
    [isArabic ? "تقييمات اليوم" : "Ratings today", overview.today, ClipboardList],
    [isArabic ? "هذا الأسبوع" : "This week", overview.week, BarChart3],
    [isArabic ? "شكاوى مفتوحة" : "Open complaints", overview.open, ShieldAlert],
    [isArabic ? "شكاوى حرجة" : "Critical complaints", overview.critical, AlertOctagon],
    [isArabic ? "نسبة الرضا" : "Satisfaction", `${fmt(overview.satisfaction, 0)}%`, UserRoundCheck],
  ] as const;

  return (
    <main className="min-h-dvh bg-[#EAF1FC] text-[#071A33]" dir={isArabic ? "rtl" : "ltr"}>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#071A33]/95 px-3 py-3 text-white shadow-xl backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3">
          <a href="/admin" className="rounded-2xl border border-white/10 bg-white/5 p-2.5 hover:bg-white/10" aria-label={isArabic ? "العودة للإدارة" : "Back to admin"}><ArrowLeft className={`h-5 w-5 ${isArabic ? "rotate-180" : ""}`} /></a>
          <img src={localAssets.logo} alt="DAY NIGHT" className="h-11 w-11 rounded-full object-cover ring-2 ring-[#D4AF37]/35" />
          <div className="min-w-0 flex-1"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F5D46E]">Customer Experience Command</span><h1 className="truncate text-base font-black sm:text-xl">{isArabic ? "تجربة العملاء" : "Customer Experience"}</h1></div>
          {criticalCount > 0 && <button onClick={() => setTabAndUrl("complaints")} className="inline-flex items-center gap-2 rounded-2xl bg-red-500 px-3 py-2 text-xs font-black shadow-lg"><BellRing className="h-4 w-4 animate-pulse" />{criticalCount}</button>}
          <button onClick={toggleLanguage} className="rounded-2xl border border-white/10 bg-white/5 p-2.5"><Languages className="h-5 w-5" /></button>
          <button onClick={() => void refresh()} disabled={loading} className="rounded-2xl border border-white/10 bg-white/5 p-2.5 disabled:opacity-50"><RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} /></button>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-6 sm:py-6">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          {TABS.map(({ id, ar, en, Icon }) => <button type="button" key={id} onClick={() => setTabAndUrl(id)} className={`inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black transition ${tab === id ? "border-[#0057B8] bg-[#0057B8] text-white shadow-lg" : "border-[#071A33]/10 bg-white text-[#52627A]"}`}><Icon className="h-4 w-4" />{isArabic ? ar : en}{id === "complaints" && overview.open > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] text-white">{overview.open}</span>}</button>)}
        </div>

        {error && <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-50 p-4 text-sm font-bold text-red-800"><span>{error}</span><button onClick={() => setError("")}><X className="h-4 w-4" /></button></div>}

        {loading && !data ? <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-[#0057B8]" /></div> : null}

        {data && tab === "overview" && (
          <div className="space-y-5">
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">{kpis.map(([label, value, Icon]) => <article key={label} className="rounded-3xl border border-[#071A33]/8 bg-white p-4 shadow-sm"><Icon className="h-5 w-5 text-[#0057B8]" /><strong className="mt-3 block text-2xl font-black">{value}</strong><span className="mt-1 block text-xs font-bold text-[#52627A]">{label}</span></article>)}</section>
            <section className="grid gap-5 xl:grid-cols-[2fr_1fr]">
              <article className="rounded-3xl border border-[#071A33]/8 bg-white p-5 shadow-sm"><div className="mb-4"><span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#0057B8]">30 DAY TREND</span><h2 className="mt-1 text-lg font-black">{isArabic ? "تغير رضا العملاء" : "Customer satisfaction trend"}</h2></div><div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" opacity={0.2} /><XAxis dataKey="date" fontSize={11} /><YAxis domain={[0, 5]} fontSize={11} /><Tooltip /><Line type="monotone" dataKey="rating" stroke="#0057B8" strokeWidth={3} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div></article>
              <article className="rounded-3xl border border-[#071A33]/8 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">{isArabic ? "أكثر أسباب الشكاوى" : "Top complaint reasons"}</h2><div className="mt-4 space-y-3">{complaintReasons.length ? complaintReasons.map(([reason, count]) => <div key={reason}><div className="flex justify-between text-xs font-black"><span>{reason}</span><span>{count}</span></div><div className="mt-1 h-2 rounded-full bg-[#EAF1FC]"><div className="h-2 rounded-full bg-gradient-to-r from-[#0057B8] to-[#18A8E8]" style={{ width: `${Math.max(8, (count / Math.max(...complaintReasons.map(([, item]) => item))) * 100)}%` }} /></div></div>) : <p className="text-sm text-[#52627A]">{isArabic ? "لا توجد شكاوى مسجلة." : "No complaints recorded."}</p>}</div></article>
            </section>
            <section className="grid gap-5 lg:grid-cols-2"><article className="rounded-3xl border border-[#071A33]/8 bg-white p-5"><h2 className="font-black">{isArabic ? "أفضل المندوبين تقييمًا" : "Top-rated drivers"}</h2><div className="mt-4 space-y-2">{driverScores.slice(0, 5).map((driver) => <div key={driver.id} className="flex items-center justify-between rounded-2xl bg-[#F4F8FF] p-3"><span className="font-bold">{driver.name}</span><span><StarsCell value={driver.rating} /> <small className="text-[#52627A]">({driver.count})</small></span></div>)}</div></article><article className="rounded-3xl border border-[#071A33]/8 bg-white p-5"><h2 className="font-black">{isArabic ? "التجار الأكثر ورودًا في الشكاوى" : "Merchants most cited in complaints"}</h2><div className="mt-4 space-y-2">{[...merchantScores].sort((a,b) => b.complaints-a.complaints).slice(0,5).map((merchant) => <div key={merchant.id} className="flex items-center justify-between rounded-2xl bg-[#FFF8EE] p-3"><span className="font-bold">{merchant.name}</span><strong className="text-amber-700">{merchant.complaints}</strong></div>)}</div></article></section>
          </div>
        )}

        {data && tab === "ratings" && (
          <section className="overflow-hidden rounded-3xl border border-[#071A33]/8 bg-white shadow-sm"><div className="border-b border-[#071A33]/8 p-5"><h2 className="text-xl font-black">{isArabic ? "كل التقييمات" : "All ratings"}</h2><p className="mt-1 text-xs text-[#52627A]">{feedback.length} {isArabic ? "تقييم حقيقي" : "real feedback records"}</p></div><div className="overflow-x-auto"><table className="min-w-[1100px] w-full text-sm"><thead className="bg-[#F4F8FF] text-xs text-[#52627A]"><tr>{[isArabic?"الشحنة":"Tracking",isArabic?"العميل":"Customer",isArabic?"المندوب":"Driver",isArabic?"التاجر":"Merchant",isArabic?"العام":"Overall",isArabic?"المندوب":"Driver",isArabic?"التعليق":"Comment",isArabic?"التاريخ":"Date",isArabic?"إجراء":"Action"].map((head) => <th key={head} className="p-3 text-start font-black">{head}</th>)}</tr></thead><tbody className="divide-y divide-[#071A33]/7">{feedback.map((item:any) => { const order=orderById.get(item.order_id)||{}; const driver=driverById.get(item.driver_id)||{}; const merchant=merchantById.get(item.merchant_id)||{}; return <tr key={item.id} className="hover:bg-[#F9FBFF]"><td className="p-3 font-mono text-xs font-black text-[#0057B8]">{item.tracking_number}</td><td className="p-3 font-bold">{order.receiver_name||order.customer_name||"—"}</td><td className="p-3">{driver.full_name||driver.name||order.driver_name||"—"}</td><td className="p-3">{merchant.trade_name||order.merchant_name||"—"}</td><td className="p-3"><StarsCell value={item.overall_rating}/></td><td className="p-3"><StarsCell value={item.driver_rating}/></td><td className="max-w-xs p-3 text-xs text-[#52627A]">{item.comment||"—"}</td><td className="p-3 text-xs">{safeDate(item.submitted_at,locale)}</td><td className="p-3"><button onClick={() => void prepareWhatsAppMessage({messageType:"admin_order_contact",customerPhone:order.receiver_phone||order.customer_phone,trackingNumber:item.tracking_number,orderStatus:order.status,orderId:item.order_id,locale:isArabic?"ar":"en",metadata:{surface:"admin_feedback_table"}}).then(openPreparedWhatsApp).catch(()=>setError(isArabic?"رقم العميل غير صالح.":"Invalid customer phone."))} className="rounded-xl bg-[#25D366] p-2 text-[#071A33]"><MessageCircle className="h-4 w-4"/></button></td></tr>; })}</tbody></table></div></section>
        )}

        {data && tab === "complaints" && (
          <section className="space-y-3">{complaints.map((item:any) => { const order=orderById.get(item.order_id)||{}; return <button type="button" onClick={() => void openComplaint(item)} key={item.id} className={`w-full rounded-3xl border p-4 text-start shadow-sm transition hover:-translate-y-0.5 ${item.severity==="critical"?"border-red-500 bg-red-50":item.severity==="high"?"border-amber-400 bg-amber-50":"border-[#071A33]/8 bg-white"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="font-mono text-xs font-black text-[#0057B8]">{item.complaint_number}</span><h3 className="mt-1 font-black">{item.category} · {item.tracking_number}</h3><p className="mt-1 line-clamp-2 text-xs leading-6 text-[#52627A]">{item.description}</p></div><div className="flex flex-wrap gap-2"><span className={`rounded-full px-3 py-1 text-[10px] font-black ${item.severity==="critical"?"bg-red-600 text-white":"bg-[#071A33]/8"}`}>{item.severity}</span><span className="rounded-full bg-[#0057B8]/10 px-3 py-1 text-[10px] font-black text-[#0057B8]">{item.status}</span></div></div><div className="mt-3 flex flex-wrap gap-3 text-[11px] font-bold text-[#52627A]"><span>{order.receiver_name||order.customer_name||"—"}</span><span>{safeDate(item.created_at,locale)}</span><span>{isArabic?"المسؤول":"Assigned"}: {item.assigned_to||"—"}</span></div></button>; })}{!complaints.length&&<div className="rounded-3xl bg-white p-10 text-center text-[#52627A]">{isArabic?"لا توجد شكاوى.":"No complaints."}</div>}</section>
        )}

        {data && tab === "drivers" && <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{driverScores.map((driver,index) => <article key={driver.id} className="rounded-3xl border border-[#071A33]/8 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className="rounded-full bg-[#0057B8]/10 px-3 py-1 text-xs font-black text-[#0057B8]">#{index+1}</span><StarsCell value={driver.rating}/></div><h3 className="mt-4 text-lg font-black">{driver.name}</h3><p className="mt-1 text-xs text-[#52627A]">{driver.count} {isArabic?"تقييمات":"ratings"}</p><div className="mt-4 h-2 rounded-full bg-[#EAF1FC]"><div className="h-2 rounded-full bg-[#0057B8]" style={{width:`${driver.rating/5*100}%`}}/></div></article>)}</section>}

        {data && tab === "merchants" && <section className="space-y-5"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{merchantScores.map((merchant) => <article key={merchant.id} className="rounded-3xl border border-[#071A33]/8 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><Store className="h-6 w-6 text-[#0057B8]"/><StarsCell value={merchant.rating}/></div><h3 className="mt-4 text-lg font-black">{merchant.name}</h3><p className="mt-1 text-xs text-[#52627A]">{merchant.count} {isArabic?"تقييمات":"ratings"} · {merchant.complaints} {isArabic?"شكاوى":"complaints"}</p></article>)}</div><article className="rounded-3xl border border-[#071A33]/8 bg-white p-5"><h2 className="text-lg font-black">{isArabic?"رسائل سريعة للتجار":"Merchant quick messages"}</h2><div className="mt-4 grid gap-3 lg:grid-cols-2">{data.merchants.map((merchant:any) => <div key={merchant.id} className="rounded-2xl border border-[#071A33]/8 bg-[#F8FAFD] p-4"><div className="flex justify-between gap-3"><div><strong>{merchant.trade_name}</strong><small className="block text-[#52627A]" dir="ltr">{merchant.phone||"—"}</small></div><span className="text-[10px] font-black text-[#0057B8]">{merchant.status}</span></div><div className="mt-3 grid grid-cols-2 gap-2"><button disabled={merchantMessageBusy===`${merchant.id}:merchant_welcome`} onClick={()=>void messageMerchant(merchant,"merchant_welcome")} className="rounded-xl bg-[#0057B8] px-3 py-2 text-xs font-black text-white disabled:opacity-50">{isArabic?"رسالة الترحيب":"Welcome"}</button><button disabled={merchantMessageBusy===`${merchant.id}:merchant_orders_today`} onClick={()=>void messageMerchant(merchant,"merchant_orders_today")} className="rounded-xl bg-[#25D366] px-3 py-2 text-xs font-black text-[#071A33] disabled:opacity-50">{isArabic?"طلبات اليوم":"Today's orders"}</button></div></div>)}</div></article></section>}

        {data && tab === "messages" && <section className="overflow-hidden rounded-3xl border border-[#071A33]/8 bg-white shadow-sm"><div className="border-b border-[#071A33]/8 p-5"><h2 className="text-xl font-black">{isArabic?"السجل المركزي للرسائل":"Central message log"}</h2><p className="mt-1 text-xs text-[#52627A]">{isArabic?"الحالة تعكس التجهيز أو الفتح أو النسخ، ولا تدّعي التسليم.":"Status means generated/opened/copied, never delivery confirmation."}</p></div><div className="overflow-x-auto"><table className="min-w-[1000px] w-full text-sm"><thead className="bg-[#F4F8FF]"><tr>{[isArabic?"القالب":"Template",isArabic?"المستلم":"Recipient",isArabic?"الشحنة":"Order",isArabic?"الحالة":"Status",isArabic?"المستخدم":"Generated by",isArabic?"الوقت":"Time",isArabic?"المعاينة":"Preview"].map(h=><th className="p-3 text-start text-xs font-black text-[#52627A]" key={h}>{h}</th>)}</tr></thead><tbody className="divide-y divide-[#071A33]/7">{messages.map((item:any)=><tr key={item.id}><td className="p-3 font-black">{item.template_key}</td><td className="p-3 font-mono text-xs" dir="ltr">{item.recipient_phone}</td><td className="p-3 font-mono text-xs">{item.order_id||"—"}</td><td className="p-3"><span className={`rounded-full px-3 py-1 text-[10px] font-black ${item.status==="failed"?"bg-red-100 text-red-700":item.status==="opened"?"bg-emerald-100 text-emerald-700":"bg-[#0057B8]/10 text-[#0057B8]"}`}>{item.status}</span></td><td className="p-3 font-mono text-xs">{item.generated_by||"public"}</td><td className="p-3 text-xs">{safeDate(item.generated_at,locale)}</td><td className="max-w-xs p-3 text-xs text-[#52627A]"><span className="line-clamp-2">{item.generated_message}</span></td></tr>)}</tbody></table></div></section>}

        {data && tab === "templates" && <section className="space-y-4"><article className="rounded-3xl border border-[#071A33]/8 bg-white p-5"><h2 className="text-lg font-black">{isArabic?"المتغيرات المتاحة":"Available variables"}</h2><div className="mt-3 flex flex-wrap gap-2">{MESSAGE_TEMPLATE_VARIABLES.map(variable=><code key={variable} className="rounded-xl bg-[#071A33] px-2.5 py-1.5 text-[11px] text-[#F5D46E]">{`{${variable}}`}</code>)}</div></article>{templates.map((template:any) => { const defaultKey=template.template_key as MessageTemplateKey; const hasDefault=Boolean(DEFAULT_MESSAGE_TEMPLATES[defaultKey]); return <article key={template.id} className="rounded-3xl border border-[#071A33]/8 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="font-mono text-xs font-black text-[#0057B8]">{template.template_key} · {template.language}</span><h3 className="mt-1 font-black">{template.title}</h3></div><label className="flex items-center gap-2 text-xs font-black"><input type="checkbox" checked={template.is_active} onChange={(event)=>setData(current=>current?{...current,templates:current.templates.map((row:any)=>row.id===template.id?{...row,is_active:event.target.checked}:row)}:current)} />{isArabic?"مفعّل":"Active"}</label></div><textarea value={templateDrafts[template.id]??template.body} onChange={(event)=>setTemplateDrafts(current=>({...current,[template.id]:event.target.value}))} rows={8} className="mt-4 w-full rounded-2xl border border-[#071A33]/12 bg-[#F8FAFD] p-4 font-mono text-xs leading-6 outline-none focus:border-[#0057B8]"/><div className="mt-3 flex flex-wrap gap-2"><button disabled={templateBusy===template.id} onClick={()=>void saveTemplate(template)} className="inline-flex items-center gap-2 rounded-xl bg-[#0057B8] px-4 py-2 text-xs font-black text-white disabled:opacity-50"><Save className="h-4 w-4"/>{isArabic?"حفظ":"Save"}</button>{hasDefault&&<button onClick={()=>setTemplateDrafts(current=>({...current,[template.id]:getDefaultMessageTemplate(defaultKey,template.language)}))} className="rounded-xl border border-[#071A33]/12 px-4 py-2 text-xs font-black">{isArabic?"إعادة الافتراضي":"Reset default"}</button>}</div></article>; })}</section>}

        <footer className="py-6 text-center text-xs text-[#52627A]">{isArabic?"آخر مزامنة":"Last sync"}: {lastSync?lastSync.toLocaleString(locale):"—"} · DAY NIGHT DELIVERY SERVICES</footer>
      </div>

      {selectedComplaint && (
        <div className="fixed inset-0 z-[100000] flex items-end justify-center bg-[#071A33]/75 backdrop-blur-sm sm:items-center sm:p-5">
          <div className="max-h-[94dvh] w-full max-w-4xl overflow-y-auto rounded-t-[30px] bg-white p-5 shadow-2xl sm:rounded-[30px] sm:p-7">
            <div className="flex items-start justify-between gap-3"><div><span className="font-mono text-xs font-black text-[#0057B8]">{selectedComplaint.complaint_number}</span><h2 className="mt-1 text-xl font-black">{selectedComplaint.category} · {selectedComplaint.tracking_number}</h2></div><button onClick={()=>{setSelectedComplaint(null);setComplaintDetails(null);}} className="rounded-full bg-[#071A33]/5 p-2"><X className="h-5 w-5"/></button></div>
            {detailBusy&&!complaintDetails?<div className="flex h-52 items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-[#0057B8]"/></div>:complaintDetails&&<div className="mt-5 space-y-5"><section className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-[#F4F8FF] p-4"><small className="text-[#52627A]">{isArabic?"الحالة":"Status"}</small><select value={complaintDetails.complaint.status} onChange={(event)=>void changeComplaint({status:event.target.value})} className="mt-2 w-full rounded-xl border border-[#071A33]/10 bg-white p-2 text-sm font-black">{STATUS_OPTIONS.map(([value,ar,en])=><option key={value} value={value}>{isArabic?ar:en}</option>)}</select></div><div className="rounded-2xl bg-[#F4F8FF] p-4"><small className="text-[#52627A]">{isArabic?"الخطورة":"Severity"}</small><select value={complaintDetails.complaint.severity} onChange={(event)=>void changeComplaint({severity:event.target.value})} className="mt-2 w-full rounded-xl border border-[#071A33]/10 bg-white p-2 text-sm font-black">{SEVERITY_OPTIONS.map(([value,ar,en])=><option key={value} value={value}>{isArabic?ar:en}</option>)}</select></div><div className="rounded-2xl bg-[#F4F8FF] p-4"><small className="text-[#52627A]">{isArabic?"المسؤول":"Assigned"}</small><button onClick={async()=>{const user=(await supabase?.auth.getUser())?.data.user; if(user?.id)void changeComplaint({assignedTo:user.id});}} className="mt-2 w-full rounded-xl bg-[#071A33] p-2 text-sm font-black text-white">{isArabic?"تعيينها لي":"Assign to me"}</button></div></section><section className="rounded-2xl border border-[#071A33]/10 p-4"><h3 className="font-black">{isArabic?"نص الشكوى":"Complaint"}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#52627A]">{complaintDetails.complaint.description}</p></section><section className="grid gap-3 sm:grid-cols-3"><button onClick={()=>void contactForComplaint("customer")} className="rounded-2xl bg-[#25D366] p-3 text-sm font-black text-[#071A33]">{isArabic?"واتساب العميل":"Customer WhatsApp"}</button><button onClick={()=>void contactForComplaint("driver")} className="rounded-2xl bg-[#0057B8] p-3 text-sm font-black text-white">{isArabic?"واتساب المندوب":"Driver WhatsApp"}</button><button onClick={()=>void contactForComplaint("merchant")} className="rounded-2xl bg-[#D4AF37] p-3 text-sm font-black text-[#071A33]">{isArabic?"واتساب التاجر":"Merchant WhatsApp"}</button></section><section className="grid gap-4 sm:grid-cols-2"><label className="font-black">{isArabic?"ملاحظة داخلية":"Internal note"}<textarea value={adminNote} onChange={(event)=>setAdminNote(event.target.value)} rows={3} className="mt-2 w-full rounded-2xl border border-[#071A33]/12 bg-[#F8FAFD] p-3 text-sm"/></label><label className="font-black">{isArabic?"الحل أو الرد":"Resolution"}<textarea value={resolution} onChange={(event)=>setResolution(event.target.value)} rows={3} className="mt-2 w-full rounded-2xl border border-[#071A33]/12 bg-[#F8FAFD] p-3 text-sm"/></label></section><div className="flex flex-wrap gap-2"><button onClick={()=>void changeComplaint({})} className="rounded-xl bg-[#0057B8] px-4 py-2 text-xs font-black text-white">{isArabic?"حفظ الملاحظة والحل":"Save note and resolution"}</button><a href={`/admin?section=adjustments&complaint=${selectedComplaint.id}`} className="inline-flex items-center gap-2 rounded-xl border border-[#071A33]/12 px-4 py-2 text-xs font-black"><ExternalLink className="h-4 w-4"/>{isArabic?"فتح الإجراء المالي":"Open financial action"}</a></div><section><h3 className="font-black">{isArabic?"المرفقات":"Attachments"}</h3><div className="mt-2 flex flex-wrap gap-2">{complaintDetails.attachments.map((attachment:any)=><a key={attachment.id} href={attachment.signed_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#F4F8FF] px-3 py-2 text-xs font-black"><FileText className="h-4 w-4"/>{attachment.file_name}</a>)}{!complaintDetails.attachments.length&&<span className="text-xs text-[#52627A]">{isArabic?"لا توجد مرفقات":"No attachments"}</span>}</div></section><section><h3 className="font-black">{isArabic?"سجل الأحداث":"Event timeline"}</h3><div className="mt-3 space-y-2">{complaintDetails.events.map((event:any)=><div key={event.id} className="rounded-2xl border border-[#071A33]/8 bg-[#F8FAFD] p-3 text-xs"><div className="flex justify-between gap-3"><strong>{event.event_type}</strong><span className="text-[#52627A]">{safeDate(event.created_at,locale)}</span></div><p className="mt-1 text-[#52627A]">{event.old_status||"—"} → {event.new_status||"—"} {event.note?`· ${event.note}`:""}</p></div>)}</div></section></div>}
          </div>
        </div>
      )}
    </main>
  );
}
