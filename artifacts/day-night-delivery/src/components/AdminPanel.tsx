/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAllOrders,
  fetchOrderStatusHistory,
  updateExistingOrderStatus,
  supabase,
} from "../supabase";
import { Order, OrderStatusHistoryItem } from "../types";
import { subscribeToNewOrdersForAdmin, subscribeToOrderStatusChanges, type AppNotification } from "../lib/notifications";
import { exportOrderPDF, exportOrderTXT, type OrderPDFData } from "../lib/exportUtils";
import {
  AlertTriangle,
  CheckSquare,
  Copy,
  Download,
  Eye,
  FileText,
  Filter,
  MapPin,
  MessageCircle,
  Package,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";

type CodFilter = "all" | "cod" | "non_cod";

type StatCard = {
  label: string;
  value: string;
  hint: string;
  tone: "gold" | "blue" | "green" | "red" | "white";
};

const STATUS_OPTIONS = [
  { value: "Pending", label: "Pending — قيد الانتظار" },
  { value: "Confirmed", label: "Confirmed — تم التأكيد" },
  { value: "Accepted", label: "Accepted — تم القبول" },
  { value: "Assigned", label: "Assigned — تم التعيين" },
  { value: "Driver Assigned", label: "Driver Assigned — تم تعيين السائق" },
  { value: "Picked Up", label: "Picked Up — تم الاستلام" },
  { value: "In Transit", label: "In Transit — في الطريق" },
  { value: "Out for Delivery", label: "Out for Delivery — خارج للتسليم" },
  { value: "Delivered", label: "Delivered — تم التسليم" },
  { value: "Failed", label: "Failed Attempt — محاولة فاشلة" },
  { value: "Cancelled", label: "Cancelled — ملغي" },
];

const CSV_HEADERS = [
  "tracking_code",
  "created_at",
  "sender_name",
  "sender_phone",
  "sender_city",
  "receiver_name",
  "receiver_phone",
  "receiver_city",
  "package_type",
  "weight",
  "pieces",
  "service_type",
  "payment_method",
  "delivery_price",
  "cod_amount",
  "status",
  "notes",
];

function text(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function money(value: unknown) {
  const n = Number(value || 0);
  return `${n.toFixed(2)} AED`;
}

function dateText(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-AE", { dateStyle: "medium", timeStyle: "short" });
}

function dayKey(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function trackingCode(order: Order) {
  return order.tracking_code || order.tracking_number || order.id;
}

function normalizeStatus(status?: string) {
  return String(status || "").toLowerCase().replace(/[_-]/g, " ").trim();
}

function statusBadgeClass(status?: string) {
  const s = normalizeStatus(status);
  if (s.includes("delivered")) return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
  if (s.includes("cancel") || s.includes("fail")) return "bg-rose-500/10 text-rose-300 border-rose-500/20";
  if (s.includes("transit") || s.includes("out for delivery")) return "bg-brand-blue/10 text-brand-sky border-brand-blue/20";
  if (s.includes("assign") || s.includes("pick")) return "bg-sky-500/10 text-sky-300 border-sky-500/20";
  return "bg-brand-gold/10 text-brand-gold border-brand-gold/20";
}

function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildCsv(orders: Order[]) {
  const rows = orders.map((order) => [
    trackingCode(order),
    order.created_at,
    order.sender_name,
    order.sender_phone,
    order.sender_city,
    order.receiver_name,
    order.receiver_phone,
    order.receiver_city,
    order.package_type,
    order.weight,
    order.pieces,
    order.service_type,
    order.payment_method,
    order.delivery_price,
    order.cod_amount || 0,
    order.status,
    order.notes || "",
  ].map(csvCell).join(","));

  return `\uFEFF${CSV_HEADERS.map(csvCell).join(",")}\n${rows.join("\n")}`;
}

function toOrderPdfData(order: Order): OrderPDFData {
  return {
    trackingCode: trackingCode(order),
    senderName: text(order.sender_name),
    senderPhone: text(order.sender_phone),
    senderCity: text(order.sender_city),
    senderAddress: text(order.sender_address),
    receiverName: text(order.receiver_name),
    receiverPhone: text(order.receiver_phone),
    receiverCity: text(order.receiver_city),
    receiverAddress: text(order.receiver_address),
    packageType: text(order.package_type),
    pieces: Number(order.pieces || 0),
    weight: Number(order.weight || 0),
    serviceType: text(order.service_type),
    paymentMethod: text(order.payment_method),
    codAmount: order.cod_amount ? String(order.cod_amount) : "",
    deliveryFee: Number(order.delivery_price || order.price || 0),
    notes: order.notes || "N/A",
    createdAt: dateText(order.created_at),
  };
}

export default function AdminPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [codFilter, setCodFilter] = useState<CodFilter>("all");
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderHistory, setOrderHistory] = useState<OrderStatusHistoryItem[]>([]);
  const [draftStatus, setDraftStatus] = useState("Pending");
  const [statusNote, setStatusNote] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchAllOrders();
      setOrders(all);
      setLastRefresh(new Date().toLocaleTimeString("en-AE"));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();

    const onNotify = (item: AppNotification) => {
      setNotifications((prev) => [item, ...prev].slice(0, 12));
      loadOrders();
    };

    const stopNew = subscribeToNewOrdersForAdmin(onNotify);
    const stopStatus = subscribeToOrderStatusChanges(onNotify);

    return () => {
      stopNew();
      stopStatus();
    };
  }, [loadOrders]);

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      if (!selectedOrder) return;
      setDraftStatus(selectedOrder.status || "Pending");
      setStatusNote("");
      setStatusError("");

      const remoteHistory = await fetchOrderStatusHistory(selectedOrder.id);
      if (!active) return;
      setOrderHistory(remoteHistory.length ? remoteHistory : selectedOrder.status_history || []);
    }

    loadHistory();
    return () => {
      active = false;
    };
  }, [selectedOrder]);

  const cityOptions = useMemo(() => {
    const cities = new Set<string>();
    orders.forEach((order) => {
      if (order.sender_city) cities.add(order.sender_city);
      if (order.receiver_city) cities.add(order.receiver_city);
    });
    return Array.from(cities).sort((a, b) => a.localeCompare(b));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();

    return orders.filter((order) => {
      const searchable = [
        order.id,
        order.tracking_code,
        order.tracking_number,
        order.sender_name,
        order.sender_phone,
        order.sender_city,
        order.receiver_name,
        order.receiver_phone,
        order.receiver_city,
        order.receiver_address,
        order.status,
        order.notes,
      ].map((item) => String(item || "").toLowerCase()).join(" ");

      const status = normalizeStatus(order.status);
      const matchesSearch = !term || searchable.includes(term);
      const matchesStatus = statusFilter === "all" || status === normalizeStatus(statusFilter);
      const matchesCity = cityFilter === "all" || order.sender_city === cityFilter || order.receiver_city === cityFilter;
      const matchesDate = !dateFilter || dayKey(order.created_at) === dateFilter;
      const isCod = order.payment_method === "cod" || Number(order.cod_amount || 0) > 0;
      const matchesCod = codFilter === "all" || (codFilter === "cod" ? isCod : !isCod);

      return matchesSearch && matchesStatus && matchesCity && matchesDate && matchesCod;
    });
  }, [orders, searchQuery, statusFilter, cityFilter, dateFilter, codFilter]);

  const stats = useMemo<StatCard[]>(() => {
    const count = (needle: string) => orders.filter((order) => normalizeStatus(order.status).includes(needle)).length;
    const pending = orders.filter((order) => ["pending", "confirmed", "accepted"].some((needle) => normalizeStatus(order.status).includes(needle))).length;
    const assigned = orders.filter((order) => normalizeStatus(order.status).includes("assign")).length;
    const picked = orders.filter((order) => normalizeStatus(order.status).includes("pick")).length;
    const transit = orders.filter((order) => ["transit", "out for delivery"].some((needle) => normalizeStatus(order.status).includes(needle))).length;
    const delivered = count("delivered");
    const cancelled = orders.filter((order) => ["cancel", "fail"].some((needle) => normalizeStatus(order.status).includes(needle))).length;
    const codTotal = orders.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0);

    return [
      { label: "إجمالي الطلبات", value: String(orders.length), hint: "كل الطلبات الحية من Supabase", tone: "white" },
      { label: "قيد المعالجة", value: String(pending), hint: "Pending / Confirmed / Accepted", tone: "gold" },
      { label: "تم التعيين", value: String(assigned), hint: "طلبات لها سائق أو كابتن", tone: "blue" },
      { label: "تم الاستلام", value: String(picked), hint: "Picked Up", tone: "blue" },
      { label: "في الطريق", value: String(transit), hint: "In Transit / Out for Delivery", tone: "blue" },
      { label: "تم التسليم", value: String(delivered), hint: "Delivered", tone: "green" },
      { label: "ملغي أو فشل", value: String(cancelled), hint: "Cancelled / Failed", tone: "red" },
      { label: "COD إجمالي", value: money(codTotal), hint: "كل مبالغ التحصيل المسجلة", tone: "green" },
    ];
  }, [orders]);

  function resetFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setCityFilter("all");
    setDateFilter("");
    setCodFilter("all");
  }

  async function handleSaveStatus() {
    if (!selectedOrder) return;

    setSavingStatus(true);
    setStatusError("");

    const ok = await updateExistingOrderStatus(selectedOrder.id, draftStatus, statusNote);
    if (!ok) {
      setStatusError("تعذر حفظ الحالة. تحقق من صلاحيات admin/RLS أو RPC admin_update_order_status.");
      setSavingStatus(false);
      return;
    }

    const updatedOrder = { ...selectedOrder, status: draftStatus, updated_at: new Date().toISOString() };
    setSelectedOrder(updatedOrder);
    await loadOrders();
    const remoteHistory = await fetchOrderStatusHistory(selectedOrder.id);
    setOrderHistory(remoteHistory.length ? remoteHistory : [
      ...(selectedOrder.status_history || []),
      { status: draftStatus, note: statusNote || "Admin status update", date: new Date().toISOString() },
    ]);
    setStatusNote("");
    setSavingStatus(false);
  }

  function exportFilteredCsv() {
    downloadTextFile(`DayNight_Admin_Orders_${dayKey(new Date().toISOString()) || "export"}.csv`, buildCsv(filteredOrders), "text/csv;charset=utf-8");
  }

  function exportCodCsv() {
    const codOrders = filteredOrders.filter((order) => order.payment_method === "cod" || Number(order.cod_amount || 0) > 0);
    downloadTextFile(`DayNight_COD_Report_${dayKey(new Date().toISOString()) || "export"}.csv`, buildCsv(codOrders), "text/csv;charset=utf-8");
  }

  async function exportDailyReportPdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const today = new Date().toLocaleDateString("en-AE", { dateStyle: "medium" });
    const codTotal = filteredOrders.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0);
    const deliveryTotal = filteredOrders.reduce((sum, order) => sum + Number(order.delivery_price || order.price || 0), 0);

    doc.setFillColor(7, 26, 51);
    doc.rect(0, 0, 210, 38, "F");
    doc.setTextColor(212, 175, 55);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("DAY NIGHT DELIVERY SERVICES", 105, 14, { align: "center" });
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text("Admin Daily Orders Report", 105, 23, { align: "center" });
    doc.setTextColor(212, 175, 55);
    doc.text(today, 105, 31, { align: "center" });

    let y = 52;
    const summaryRows = [
      ["Filtered orders", filteredOrders.length],
      ["All live orders", orders.length],
      ["COD total", `${codTotal.toFixed(2)} AED`],
      ["Delivery fees total", `${deliveryTotal.toFixed(2)} AED`],
    ];

    doc.setFontSize(11);
    summaryRows.forEach(([label, value], index) => {
      doc.setFillColor(index % 2 === 0 ? 245 : 255, 247, 252);
      doc.rect(14, y - 5, 182, 9, "F");
      doc.setTextColor(80, 90, 110);
      doc.setFont("helvetica", "normal");
      doc.text(String(label), 18, y);
      doc.setTextColor(7, 26, 51);
      doc.setFont("helvetica", "bold");
      doc.text(String(value), 190, y, { align: "right" });
      y += 10;
    });

    y += 8;
    doc.setFillColor(7, 26, 51);
    doc.rect(14, y - 6, 182, 9, "F");
    doc.setTextColor(212, 175, 55);
    doc.setFontSize(9);
    doc.text("Recent Orders", 18, y);
    y += 9;

    filteredOrders.slice(0, 18).forEach((order) => {
      if (y > 275) return;
      doc.setTextColor(7, 26, 51);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(trackingCode(order), 18, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(90, 100, 120);
      doc.text(`${order.sender_city || "-"} -> ${order.receiver_city || "-"}`, 70, y);
      doc.text(String(order.status || "-"), 135, y);
      doc.text(money(order.delivery_price || order.price || 0), 190, y, { align: "right" });
      y += 7;
    });

    doc.setFillColor(7, 26, 51);
    doc.rect(0, 282, 210, 15, "F");
    doc.setTextColor(212, 175, 55);
    doc.setFontSize(7);
    doc.text("daynightae.com | Admin@daynightae.com | +971 56 875 7331", 105, 291, { align: "center" });
    doc.save(`DayNight_Daily_Admin_Report_${dayKey(new Date().toISOString())}.pdf`);
  }

  function exportSelected(type: "invoice" | "summary" | "label" | "txt") {
    if (!selectedOrder) return;
    const data = toOrderPdfData(selectedOrder);
    if (type === "txt") {
      exportOrderTXT(data);
      return;
    }
    exportOrderPDF(data, type);
  }

  function copyTracking(order: Order) {
    navigator.clipboard?.writeText(trackingCode(order));
  }

  function openTracking(order: Order) {
    window.open(`/tracking?code=${encodeURIComponent(trackingCode(order))}`, "_blank", "noopener,noreferrer");
  }

  function openWhatsapp(order: Order) {
    const body = `DAY NIGHT DELIVERY SERVICES%0ATracking: ${encodeURIComponent(trackingCode(order))}%0AStatus: ${encodeURIComponent(order.status || "Pending")}`;
    window.open(`https://wa.me/${String(order.receiver_phone || "").replace(/\D/g, "")}?text=${body}`, "_blank", "noopener,noreferrer");
  }

  const timelineItems = selectedOrder
    ? (orderHistory.length ? orderHistory : [{ status: selectedOrder.status, note: selectedOrder.notes, date: selectedOrder.updated_at || selectedOrder.created_at }])
    : [];

  return (
    <div className="space-y-8 text-right" dir="rtl">
      <section className="bg-brand-cool/25 border border-white/10 rounded-3xl p-5 sm:p-7 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/20 text-brand-gold rounded-full px-3 py-1 text-[11px] font-black tracking-wide">
              <ShieldCheck className="w-4 h-4" /> Admin Live Operations
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-3">لوحة إدارة الطلبات الحية</h2>
            <p className="text-white/55 text-sm mt-1">عرض، تصفية، تصدير، وتحديث حالات الشحنات مباشرة من Supabase.</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button onClick={loadOrders} disabled={loading} className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-xs font-bold flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> تحديث
            </button>
            <button onClick={exportFilteredCsv} className="px-4 py-2.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white rounded-xl text-xs font-black flex items-center gap-2">
              <Download className="w-4 h-4" /> CSV للنتائج
            </button>
            <button onClick={exportCodCsv} className="px-4 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 rounded-xl border border-emerald-500/20 text-xs font-bold flex items-center gap-2">
              <FileText className="w-4 h-4" /> COD CSV
            </button>
            <button onClick={exportDailyReportPdf} className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-xs font-bold flex items-center gap-2">
              <FileText className="w-4 h-4" /> تقرير PDF
            </button>
          </div>
        </div>
        <div className="text-[11px] text-white/40 font-mono" dir="ltr">
          Supabase: {supabase ? "connected" : "not configured"} {lastRefresh ? ` | last refresh ${lastRefresh}` : ""}
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-brand-cool/30 border border-white/10 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${
              stat.tone === "green" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" :
              stat.tone === "red" ? "bg-rose-500/10 border-rose-500/20 text-rose-300" :
              stat.tone === "blue" ? "bg-brand-blue/10 border-brand-blue/20 text-brand-sky" :
              stat.tone === "gold" ? "bg-brand-gold/10 border-brand-gold/20 text-brand-gold" :
              "bg-white/5 border-white/10 text-white"
            }`}>
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-white/45 text-[11px] font-bold">{stat.label}</p>
              <p className="text-2xl font-black text-white font-mono mt-1" dir="ltr">{stat.value}</p>
              <p className="text-white/35 text-[10px] mt-1">{stat.hint}</p>
            </div>
          </div>
        ))}
      </section>

      {notifications.length > 0 && (
        <section className="bg-brand-cool/20 border border-white/10 rounded-2xl p-4 space-y-3">
          <h3 className="text-white font-extrabold text-sm">تنبيهات مباشرة</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {notifications.slice(0, 6).map((note) => (
              <div key={note.id} className="bg-brand-deep/60 border border-white/10 rounded-xl p-3 text-xs">
                <p className="text-brand-gold font-bold">{note.title}</p>
                <p className="text-white/70">{note.body}</p>
                <p className="text-white/40 font-mono" dir="ltr">{dateText(note.created_at)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-brand-cool/30 p-5 rounded-2xl border border-white/10 space-y-4">
        <div className="flex items-center gap-2 text-white font-black text-sm">
          <Filter className="w-4 h-4 text-brand-gold" /> أدوات البحث والتصفية
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="admin_search_bar"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="تتبع / هاتف / اسم / مدينة"
              className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 pl-9 text-white text-xs placeholder:text-white/25 focus:outline-none focus:border-brand-gold text-right"
            />
          </div>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-brand-gold [color-scheme:dark]">
            <option value="all">كل الحالات</option>
            {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>

          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-brand-gold [color-scheme:dark]">
            <option value="all">كل المدن</option>
            {cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>

          <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-brand-gold [color-scheme:dark]" />

          <select value={codFilter} onChange={(e) => setCodFilter(e.target.value as CodFilter)} className="bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-brand-gold [color-scheme:dark]">
            <option value="all">كل طرق الدفع</option>
            <option value="cod">COD فقط</option>
            <option value="non_cod">غير COD</option>
          </select>
        </div>
        <div className="flex flex-wrap justify-between items-center gap-3 text-xs">
          <p className="text-white/45">النتائج الحالية: <span className="text-brand-gold font-mono font-bold">{filteredOrders.length}</span> من <span className="text-white font-mono">{orders.length}</span></p>
          <button onClick={resetFilters} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 font-bold flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> تصفير الفلاتر
          </button>
        </div>
      </section>

      <section className="bg-brand-cool/20 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto text-right">
          <table className="w-full text-xs font-sans min-w-[1100px]">
            <thead className="bg-brand-deep/80 text-white/45 font-bold border-b border-white/10">
              <tr>
                <th className="p-3 text-right">التتبع</th>
                <th className="p-3 text-right">التاريخ</th>
                <th className="p-3 text-right">الراسل</th>
                <th className="p-3 text-right">المستلم</th>
                <th className="p-3 text-right">المسار</th>
                <th className="p-3 text-right">الشحنة</th>
                <th className="p-3 text-right">المالية</th>
                <th className="p-3 text-right">الحالة</th>
                <th className="p-3 text-center">إدارة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={9} className="p-8 text-center text-white/40 font-bold">جاري تحميل الطلبات من Supabase...</td></tr>
              ) : filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-white/5 transition-colors align-top">
                    <td className="p-4 font-mono font-extrabold text-brand-gold" dir="ltr">{trackingCode(order)}</td>
                    <td className="p-4 text-white/55 font-mono" dir="ltr">{dateText(order.created_at)}</td>
                    <td className="p-4"><p className="font-bold text-white">{text(order.sender_name)}</p><p className="text-white/40 font-mono mt-0.5" dir="ltr">{text(order.sender_phone)}</p></td>
                    <td className="p-4"><p className="font-bold text-white">{text(order.receiver_name)}</p><p className="text-white/40 font-mono mt-0.5" dir="ltr">{text(order.receiver_phone)}</p></td>
                    <td className="p-4 text-white/75"><p><span className="text-white font-semibold">{text(order.sender_city)}</span> ← <span className="text-white font-semibold">{text(order.receiver_city)}</span></p><p className="text-white/35 mt-1 max-w-[220px] truncate">{text(order.receiver_address)}</p></td>
                    <td className="p-4"><p className="text-white/85">{text(order.package_type)} · {text(order.service_type)}</p><p className="text-white/40 font-mono mt-1" dir="ltr">{Number(order.weight || 0)} kg · {Number(order.pieces || 0)} pcs</p></td>
                    <td className="p-4"><p className="text-brand-gold font-black font-mono" dir="ltr">{money(order.delivery_price || order.price || 0)}</p><p className="text-white/40 font-mono mt-1" dir="ltr">{order.payment_method === "cod" ? `COD ${money(order.cod_amount || 0)}` : text(order.payment_method)}</p></td>
                    <td className="p-4"><span className={`inline-flex px-2.5 py-1 rounded-full border text-[10px] font-black ${statusBadgeClass(order.status)}`}>{text(order.status)}</span></td>
                    <td className="p-4 text-center">
                      <button onClick={() => setSelectedOrder(order)} className="px-3.5 py-2 bg-brand-deep hover:bg-brand-gold hover:text-brand-deep font-bold rounded-lg text-white text-[10px] border border-white/10 transition-colors inline-flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" /> تفاصيل وإدارة
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={9} className="p-8 text-center text-white/30 leading-relaxed font-bold">لا توجد طلبات تطابق البحث الحالي.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedOrder && (
        <div className="fixed inset-0 bg-brand-deep/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 z-50 text-right">
          <div className="bg-brand-cool rounded-3xl border border-white/15 max-w-6xl w-full max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-5 sm:p-6 border-b border-white/10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="text-brand-gold font-mono font-black text-xs" dir="ltr">{trackingCode(selectedOrder)}</p>
                <h4 className="text-xl font-black text-white mt-1">تفاصيل الطلب وإدارة الحالة</h4>
                <p className="text-white/45 text-xs mt-1">آخر تحديث: {dateText(selectedOrder.updated_at || selectedOrder.created_at)}</p>
              </div>
              <button onClick={() => { setSelectedOrder(null); setOrderHistory([]); setStatusError(""); }} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-brand-deep/55 border border-white/10 rounded-2xl p-4 space-y-2">
                  <h5 className="text-brand-gold font-black text-sm flex items-center gap-2"><Package className="w-4 h-4" /> بيانات الراسل</h5>
                  <p className="text-white font-bold">{text(selectedOrder.sender_name)}</p>
                  <p className="text-white/50 font-mono" dir="ltr">{text(selectedOrder.sender_phone)}</p>
                  <p className="text-white/65">{text(selectedOrder.sender_city)}</p>
                  <p className="text-white/40 text-xs leading-relaxed">{text(selectedOrder.sender_address)}</p>
                </div>

                <div className="bg-brand-deep/55 border border-white/10 rounded-2xl p-4 space-y-2">
                  <h5 className="text-brand-gold font-black text-sm flex items-center gap-2"><MapPin className="w-4 h-4" /> بيانات المستلم</h5>
                  <p className="text-white font-bold">{text(selectedOrder.receiver_name)}</p>
                  <p className="text-white/50 font-mono" dir="ltr">{text(selectedOrder.receiver_phone)}</p>
                  <p className="text-white/65">{text(selectedOrder.receiver_city)}</p>
                  <p className="text-white/40 text-xs leading-relaxed">{text(selectedOrder.receiver_address)}</p>
                </div>

                <div className="bg-brand-deep/55 border border-white/10 rounded-2xl p-4 space-y-2">
                  <h5 className="text-brand-gold font-black text-sm flex items-center gap-2"><Truck className="w-4 h-4" /> الشحنة والمالية</h5>
                  <p className="text-white/80">{text(selectedOrder.package_type)} · {text(selectedOrder.service_type)}</p>
                  <p className="text-white/50 font-mono" dir="ltr">{Number(selectedOrder.weight || 0)} kg · {Number(selectedOrder.pieces || 0)} pieces</p>
                  <p className="text-brand-gold font-black font-mono" dir="ltr">Delivery {money(selectedOrder.delivery_price || selectedOrder.price || 0)}</p>
                  <p className="text-emerald-300 font-bold font-mono" dir="ltr">COD {money(selectedOrder.cod_amount || 0)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-brand-deep/55 border border-white/10 rounded-2xl p-4 space-y-4">
                  <h5 className="text-white font-black text-sm">تحديث حالة الشحنة</h5>
                  <select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)} className="w-full bg-brand-cool/80 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-brand-gold [color-scheme:dark]">
                    {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                  <textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="ملاحظة داخل سجل الحركة: تم التواصل مع العميل، جار التوصيل، محاولة فاشلة..." className="w-full min-h-24 bg-brand-cool/80 border border-white/10 rounded-xl px-4 py-3 text-white text-xs placeholder:text-white/25 focus:outline-none focus:border-brand-gold text-right" />
                  {statusError && <p className="text-rose-300 text-xs flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {statusError}</p>}
                  <button onClick={handleSaveStatus} disabled={savingStatus || draftStatus === selectedOrder.status} className="w-full py-3 bg-brand-gold hover:bg-brand-blue disabled:bg-white/10 disabled:text-white/30 text-brand-deep hover:text-white font-black rounded-xl text-xs transition-colors flex items-center justify-center gap-2">
                    <Save className="w-4 h-4" /> {savingStatus ? "جاري الحفظ..." : "حفظ تحديث الحالة"}
                  </button>
                </div>

                <div className="bg-brand-deep/55 border border-white/10 rounded-2xl p-4 space-y-3">
                  <h5 className="text-white font-black text-sm">سجل الحركة Timeline</h5>
                  <div className="space-y-3 max-h-72 overflow-auto pr-1">
                    {timelineItems.map((item, index) => (
                      <div key={`${item.status}-${index}`} className="border-r-2 border-brand-gold/45 pr-3 pb-3">
                        <p className="text-brand-gold font-black text-xs">{text(item.status)}</p>
                        <p className="text-white/40 text-[11px] font-mono" dir="ltr">{dateText(item.created_at || item.timestamp || item.date || item.updated_at)}</p>
                        {item.note && <p className="text-white/65 text-xs mt-1">{item.note}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-brand-deep/55 border border-white/10 rounded-2xl p-4 space-y-3">
                <h5 className="text-white font-black text-sm">أوامر سريعة وتصدير</h5>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
                  <button onClick={() => copyTracking(selectedOrder)} className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-[11px] font-bold flex items-center justify-center gap-1.5"><Copy className="w-3.5 h-3.5" /> نسخ التتبع</button>
                  <button onClick={() => openTracking(selectedOrder)} className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-[11px] font-bold flex items-center justify-center gap-1.5"><Eye className="w-3.5 h-3.5" /> فتح التتبع</button>
                  <button onClick={() => exportSelected("invoice")} className="px-3 py-2.5 bg-brand-gold/15 hover:bg-brand-gold/25 text-brand-gold rounded-xl border border-brand-gold/20 text-[11px] font-bold flex items-center justify-center gap-1.5"><FileText className="w-3.5 h-3.5" /> فاتورة PDF</button>
                  <button onClick={() => exportSelected("label")} className="px-3 py-2.5 bg-brand-gold/15 hover:bg-brand-gold/25 text-brand-gold rounded-xl border border-brand-gold/20 text-[11px] font-bold flex items-center justify-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Label PDF</button>
                  <button onClick={() => exportSelected("summary")} className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-[11px] font-bold flex items-center justify-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Summary PDF</button>
                  <button onClick={() => exportSelected("txt")} className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-[11px] font-bold flex items-center justify-center gap-1.5"><Download className="w-3.5 h-3.5" /> TXT</button>
                  <button onClick={() => openWhatsapp(selectedOrder)} className="px-3 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 rounded-xl border border-emerald-500/20 text-[11px] font-bold flex items-center justify-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> واتساب</button>
                </div>
              </div>

              <div className="bg-brand-deep/35 border border-white/10 rounded-2xl p-4">
                <h5 className="text-white font-black text-sm mb-2">ملاحظات الطلب</h5>
                <p className="text-white/60 text-sm leading-relaxed whitespace-pre-wrap">{text(selectedOrder.notes)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
