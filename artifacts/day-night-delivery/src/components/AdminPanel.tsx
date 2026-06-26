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
import { exportOrderPDF, exportOrderTXT, type ExportLanguage, type OrderPDFData } from "../lib/exportUtils";
import { useAppContext } from "../lib/AppContext";
import {
  AlertTriangle,
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

const CSV_HEADERS_EN = [
  "Tracking Code",
  "Created At",
  "Sender Name",
  "Sender Phone",
  "Sender City",
  "Receiver Name",
  "Receiver Phone",
  "Receiver City",
  "Package Type",
  "Weight Kg",
  "Pieces",
  "Service Type",
  "Payment Method",
  "Delivery Fee AED",
  "COD Amount AED",
  "Status",
  "Notes",
];

const CSV_HEADERS_AR = [
  "رقم التتبع",
  "تاريخ الطلب",
  "اسم الراسل",
  "هاتف الراسل",
  "مدينة الاستلام",
  "اسم المستلم",
  "هاتف المستلم",
  "مدينة التسليم",
  "نوع الشحنة",
  "الوزن كجم",
  "عدد القطع",
  "نوع الخدمة",
  "طريقة الدفع",
  "رسوم التوصيل درهم",
  "مبلغ COD درهم",
  "الحالة",
  "ملاحظات",
];

const UI = {
  ar: {
    title: "لوحة إدارة الطلبات الحية",
    subtitle: "عرض، تصفية، تصدير، وتحديث حالات الشحنات مباشرة من Supabase.",
    badge: "Admin Live Operations",
    refresh: "تحديث",
    csv: "CSV للنتائج",
    codCsv: "COD CSV",
    dailyPdf: "تقرير PDF",
    searchPlaceholder: "تتبع / هاتف / اسم / مدينة",
    allStatuses: "كل الحالات",
    allCities: "كل المدن",
    allPayments: "كل طرق الدفع",
    codOnly: "COD فقط",
    nonCod: "غير COD",
    results: "النتائج الحالية",
    reset: "تصفير الفلاتر",
    loading: "جاري تحميل الطلبات من Supabase...",
    empty: "لا توجد طلبات تطابق البحث الحالي.",
    details: "تفاصيل وإدارة",
    sender: "بيانات الراسل",
    receiver: "بيانات المستلم",
    packageFinance: "الشحنة والمالية",
    updateStatus: "تحديث حالة الشحنة",
    notePlaceholder: "ملاحظة داخل سجل الحركة: تم التواصل مع العميل، جار التوصيل، محاولة فاشلة...",
    saveStatus: "حفظ تحديث الحالة",
    saving: "جاري الحفظ...",
    timeline: "سجل الحركة Timeline",
    quickExport: "أوامر سريعة وتصدير",
    copy: "نسخ التتبع",
    tracking: "فتح التتبع",
    whatsapp: "واتساب",
    pdf: "PDF",
    txt: "TXT",
    orderDetails: "تفاصيل الطلب وإدارة الحالة",
    lastUpdate: "آخر تحديث",
    statusError: "تعذر حفظ الحالة. تحقق من صلاحيات admin/RLS أو RPC admin_update_order_status.",
    stats: {
      total: "إجمالي الطلبات",
      processing: "قيد المعالجة",
      assigned: "تم التعيين",
      picked: "تم الاستلام",
      transit: "في الطريق",
      delivered: "تم التسليم",
      cancelled: "ملغي أو فشل",
      cod: "COD إجمالي",
    },
    pdfLabels: {
      title: "تقرير الطلبات اليومي للإدارة",
      filtered: "الطلبات بعد الفلترة",
      all: "كل الطلبات الحية",
      cod: "إجمالي COD",
      fees: "إجمالي رسوم التوصيل",
      recent: "أحدث الطلبات",
    },
  },
  en: {
    title: "Live Orders Admin Panel",
    subtitle: "View, filter, export, and update shipment status directly from Supabase.",
    badge: "Admin Live Operations",
    refresh: "Refresh",
    csv: "Filtered CSV",
    codCsv: "COD CSV",
    dailyPdf: "Daily PDF",
    searchPlaceholder: "Tracking / phone / name / city",
    allStatuses: "All statuses",
    allCities: "All cities",
    allPayments: "All payments",
    codOnly: "COD only",
    nonCod: "Non COD",
    results: "Current results",
    reset: "Reset filters",
    loading: "Loading orders from Supabase...",
    empty: "No orders match the current filters.",
    details: "Details & Manage",
    sender: "Sender Details",
    receiver: "Receiver Details",
    packageFinance: "Package & Finance",
    updateStatus: "Update Shipment Status",
    notePlaceholder: "Internal timeline note: contacted customer, out for delivery, failed attempt...",
    saveStatus: "Save Status Update",
    saving: "Saving...",
    timeline: "Timeline",
    quickExport: "Quick Actions & Export",
    copy: "Copy Tracking",
    tracking: "Open Tracking",
    whatsapp: "WhatsApp",
    pdf: "PDF",
    txt: "TXT",
    orderDetails: "Order Details & Status Management",
    lastUpdate: "Last update",
    statusError: "Status could not be saved. Check admin/RLS permissions or RPC admin_update_order_status.",
    stats: {
      total: "Total Orders",
      processing: "Processing",
      assigned: "Assigned",
      picked: "Picked Up",
      transit: "In Transit",
      delivered: "Delivered",
      cancelled: "Cancelled / Failed",
      cod: "COD Total",
    },
    pdfLabels: {
      title: "Admin Daily Orders Report",
      filtered: "Filtered orders",
      all: "All live orders",
      cod: "COD total",
      fees: "Delivery fees total",
      recent: "Recent Orders",
    },
  },
};

function text(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function money(value: unknown) {
  const n = Number(value || 0);
  return `${n.toFixed(2)} AED`;
}

function dateText(value?: string, language: ExportLanguage = "en") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(language === "ar" ? "ar-AE" : "en-AE", { dateStyle: "medium", timeStyle: "short" });
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

function buildCsv(orders: Order[], language: ExportLanguage) {
  const headers = language === "ar" ? CSV_HEADERS_AR : CSV_HEADERS_EN;
  const rows = orders.map((order) => [
    trackingCode(order),
    dateText(order.created_at, language),
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
    Number(order.delivery_price || order.price || 0).toFixed(2),
    Number(order.cod_amount || 0).toFixed(2),
    order.status,
    order.notes || "",
  ].map(csvCell).join(","));

  return `\uFEFF${headers.map(csvCell).join(",")}\n${rows.join("\n")}`;
}

function toOrderPdfData(order: Order, language: ExportLanguage): OrderPDFData {
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
    createdAt: dateText(order.created_at, language),
  };
}

function pdfText(doc: any, value: unknown, language: ExportLanguage) {
  const raw = String(value ?? "—");
  return language === "ar" && typeof doc.processArabic === "function" ? doc.processArabic(raw) : raw;
}

export default function AdminPanel() {
  const { language } = useAppContext();
  const exportLanguage: ExportLanguage = language === "ar" ? "ar" : "en";
  const isArabic = exportLanguage === "ar";
  const ui = UI[exportLanguage];

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
      setLastRefresh(new Date().toLocaleTimeString(exportLanguage === "ar" ? "ar-AE" : "en-AE"));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [exportLanguage]);

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
    return () => { active = false; };
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
      const searchable = [order.id, order.tracking_code, order.tracking_number, order.sender_name, order.sender_phone, order.sender_city, order.receiver_name, order.receiver_phone, order.receiver_city, order.receiver_address, order.status, order.notes].map((item) => String(item || "").toLowerCase()).join(" ");
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
      { label: ui.stats.total, value: String(orders.length), hint: isArabic ? "كل الطلبات الحية من Supabase" : "All live Supabase orders", tone: "white" },
      { label: ui.stats.processing, value: String(pending), hint: "Pending / Confirmed / Accepted", tone: "gold" },
      { label: ui.stats.assigned, value: String(assigned), hint: isArabic ? "طلبات لها سائق أو كابتن" : "Orders with assigned driver", tone: "blue" },
      { label: ui.stats.picked, value: String(picked), hint: "Picked Up", tone: "blue" },
      { label: ui.stats.transit, value: String(transit), hint: "In Transit / Out for Delivery", tone: "blue" },
      { label: ui.stats.delivered, value: String(delivered), hint: "Delivered", tone: "green" },
      { label: ui.stats.cancelled, value: String(cancelled), hint: "Cancelled / Failed", tone: "red" },
      { label: ui.stats.cod, value: money(codTotal), hint: isArabic ? "كل مبالغ التحصيل المسجلة" : "All recorded COD amounts", tone: "green" },
    ];
  }, [isArabic, orders, ui]);

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
      setStatusError(ui.statusError);
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
    const prefix = exportLanguage === "ar" ? "DayNight_طلبات_مفلترة" : "DayNight_Admin_Orders";
    downloadTextFile(`${prefix}_${dayKey(new Date().toISOString()) || "export"}.csv`, buildCsv(filteredOrders, exportLanguage), "text/csv;charset=utf-8");
  }

  function exportCodCsv() {
    const codOrders = filteredOrders.filter((order) => order.payment_method === "cod" || Number(order.cod_amount || 0) > 0);
    const prefix = exportLanguage === "ar" ? "DayNight_تقرير_COD" : "DayNight_COD_Report";
    downloadTextFile(`${prefix}_${dayKey(new Date().toISOString()) || "export"}.csv`, buildCsv(codOrders, exportLanguage), "text/csv;charset=utf-8");
  }

  async function exportDailyReportPdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const today = new Date().toLocaleDateString(exportLanguage === "ar" ? "ar-AE" : "en-AE", { dateStyle: "medium" });
    const codTotal = filteredOrders.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0);
    const deliveryTotal = filteredOrders.reduce((sum, order) => sum + Number(order.delivery_price || order.price || 0), 0);
    const rtl = exportLanguage === "ar";

    doc.setFillColor(7, 26, 51);
    doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(212, 175, 55);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("DAY NIGHT DELIVERY SERVICES", 105, 14, { align: "center" });
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(pdfText(doc, ui.pdfLabels.title, exportLanguage), 105, 24, { align: "center" });
    doc.setTextColor(212, 175, 55);
    doc.text(pdfText(doc, today, exportLanguage), 105, 32, { align: "center" });

    let y = 54;
    const summaryRows = [
      [ui.pdfLabels.filtered, filteredOrders.length],
      [ui.pdfLabels.all, orders.length],
      [ui.pdfLabels.cod, `${codTotal.toFixed(2)} AED`],
      [ui.pdfLabels.fees, `${deliveryTotal.toFixed(2)} AED`],
    ];

    doc.setFontSize(11);
    summaryRows.forEach(([label, value], index) => {
      doc.setFillColor(index % 2 === 0 ? 245 : 255, 247, 252);
      doc.rect(14, y - 5, 182, 9, "F");
      doc.setTextColor(80, 90, 110);
      doc.setFont("helvetica", "normal");
      doc.text(pdfText(doc, String(label), exportLanguage), rtl ? 190 : 18, y, { align: rtl ? "right" : "left" });
      doc.setTextColor(7, 26, 51);
      doc.setFont("helvetica", "bold");
      doc.text(pdfText(doc, String(value), exportLanguage), rtl ? 18 : 190, y, { align: rtl ? "left" : "right" });
      y += 10;
    });

    y += 8;
    doc.setFillColor(7, 26, 51);
    doc.rect(14, y - 6, 182, 9, "F");
    doc.setTextColor(212, 175, 55);
    doc.setFontSize(9);
    doc.text(pdfText(doc, ui.pdfLabels.recent, exportLanguage), rtl ? 190 : 18, y, { align: rtl ? "right" : "left" });
    y += 9;

    filteredOrders.slice(0, 18).forEach((order) => {
      if (y > 275) return;
      doc.setTextColor(7, 26, 51);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(trackingCode(order), rtl ? 190 : 18, y, { align: rtl ? "right" : "left" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(90, 100, 120);
      doc.text(pdfText(doc, `${order.sender_city || "-"} -> ${order.receiver_city || "-"}`, exportLanguage), rtl ? 115 : 70, y, { align: rtl ? "right" : "left" });
      doc.text(pdfText(doc, String(order.status || "-"), exportLanguage), rtl ? 70 : 135, y, { align: rtl ? "right" : "left" });
      doc.text(money(order.delivery_price || order.price || 0), rtl ? 18 : 190, y, { align: rtl ? "left" : "right" });
      y += 7;
    });

    doc.setFillColor(7, 26, 51);
    doc.rect(0, 282, 210, 15, "F");
    doc.setTextColor(212, 175, 55);
    doc.setFontSize(7);
    doc.text("daynightae.com | Admin@daynightae.com | +971 56 875 7331", 105, 289, { align: "center" });
    doc.setTextColor(255, 255, 255);
    doc.text("Creating by Eng Sadek Elgazar", 105, 294, { align: "center" });
    doc.save(`${exportLanguage === "ar" ? "DayNight_تقرير_الإدارة" : "DayNight_Daily_Admin_Report"}_${dayKey(new Date().toISOString())}.pdf`);
  }

  function exportSelected(type: "invoice" | "summary" | "label" | "txt") {
    if (!selectedOrder) return;
    const data = toOrderPdfData(selectedOrder, exportLanguage);
    if (type === "txt") {
      exportOrderTXT(data, exportLanguage);
      return;
    }
    exportOrderPDF(data, type, exportLanguage);
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

  const timelineItems = selectedOrder ? (orderHistory.length ? orderHistory : [{ status: selectedOrder.status, note: selectedOrder.notes, date: selectedOrder.updated_at || selectedOrder.created_at }]) : [];

  return (
    <div className="space-y-8 text-right" dir={isArabic ? "rtl" : "ltr"}>
      <section className="bg-brand-cool/25 border border-white/10 rounded-3xl p-5 sm:p-7 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/20 text-brand-gold rounded-full px-3 py-1 text-[11px] font-black tracking-wide">
              <ShieldCheck className="w-4 h-4" /> {ui.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-3">{ui.title}</h2>
            <p className="text-white/55 text-sm mt-1">{ui.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button onClick={loadOrders} disabled={loading} className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-xs font-bold flex items-center gap-2"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> {ui.refresh}</button>
            <button onClick={exportFilteredCsv} className="px-4 py-2.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white rounded-xl text-xs font-black flex items-center gap-2"><Download className="w-4 h-4" /> {ui.csv}</button>
            <button onClick={exportCodCsv} className="px-4 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 rounded-xl border border-emerald-500/20 text-xs font-bold flex items-center gap-2"><FileText className="w-4 h-4" /> {ui.codCsv}</button>
            <button onClick={exportDailyReportPdf} className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-xs font-bold flex items-center gap-2"><FileText className="w-4 h-4" /> {ui.dailyPdf}</button>
          </div>
        </div>
        <div className="text-[11px] text-white/40 font-mono" dir="ltr">Supabase: {supabase ? "connected" : "not configured"} {lastRefresh ? ` | last refresh ${lastRefresh}` : ""}</div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-brand-cool/25 border border-white/10 rounded-2xl p-4">
            <p className="text-white/45 text-xs font-bold">{stat.label}</p>
            <p className={`text-2xl font-black mt-2 ${stat.tone === "gold" ? "text-brand-gold" : stat.tone === "green" ? "text-emerald-300" : stat.tone === "red" ? "text-rose-300" : stat.tone === "blue" ? "text-brand-sky" : "text-white"}`}>{stat.value}</p>
            <p className="text-white/35 text-[11px] mt-1">{stat.hint}</p>
          </div>
        ))}
      </section>

      {notifications.length > 0 && (
        <section className="bg-brand-gold/10 border border-brand-gold/20 rounded-2xl p-4 space-y-2">
          {notifications.slice(0, 3).map((item) => <p key={item.id} className="text-brand-gold text-xs font-bold">• {item.title} — {item.body}</p>)}
        </section>
      )}

      <section className="bg-brand-cool/25 border border-white/10 rounded-3xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-brand-gold font-black text-sm"><Filter className="w-4 h-4" /> Filters</div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="relative"><Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" /><input id="admin_search_bar" type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={ui.searchPlaceholder} className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 pl-9 text-white text-xs placeholder:text-white/25 focus:outline-none focus:border-brand-gold" /></div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-brand-gold [color-scheme:dark]"><option value="all">{ui.allStatuses}</option>{STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select>
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-brand-gold [color-scheme:dark]"><option value="all">{ui.allCities}</option>{cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}</select>
          <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-brand-gold [color-scheme:dark]" />
          <select value={codFilter} onChange={(e) => setCodFilter(e.target.value as CodFilter)} className="bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-brand-gold [color-scheme:dark]"><option value="all">{ui.allPayments}</option><option value="cod">{ui.codOnly}</option><option value="non_cod">{ui.nonCod}</option></select>
        </div>
        <div className="flex flex-wrap justify-between items-center gap-3 text-xs"><p className="text-white/45">{ui.results}: <span className="text-brand-gold font-mono font-bold">{filteredOrders.length}</span> / <span className="text-white font-mono">{orders.length}</span></p><button onClick={resetFilters} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 font-bold flex items-center gap-2"><RotateCcw className="w-4 h-4" /> {ui.reset}</button></div>
      </section>

      <section className="bg-brand-cool/20 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-sans min-w-[1100px]">
            <thead className="bg-brand-deep/80 text-white/45 font-bold border-b border-white/10"><tr><th className="p-3 text-start">Tracking</th><th className="p-3 text-start">Date</th><th className="p-3 text-start">Sender</th><th className="p-3 text-start">Receiver</th><th className="p-3 text-start">Route</th><th className="p-3 text-start">Package</th><th className="p-3 text-start">Finance</th><th className="p-3 text-start">Status</th><th className="p-3 text-center">Manage</th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {loading ? <tr><td colSpan={9} className="p-8 text-center text-white/40 font-bold">{ui.loading}</td></tr> : filteredOrders.length > 0 ? filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-white/5 transition-colors align-top">
                  <td className="p-4 font-mono font-extrabold text-brand-gold" dir="ltr">{trackingCode(order)}</td>
                  <td className="p-4 text-white/55 font-mono" dir="ltr">{dateText(order.created_at, exportLanguage)}</td>
                  <td className="p-4"><p className="font-bold text-white">{text(order.sender_name)}</p><p className="text-white/40 font-mono mt-0.5" dir="ltr">{text(order.sender_phone)}</p></td>
                  <td className="p-4"><p className="font-bold text-white">{text(order.receiver_name)}</p><p className="text-white/40 font-mono mt-0.5" dir="ltr">{text(order.receiver_phone)}</p></td>
                  <td className="p-4 text-white/75"><p><span className="text-white font-semibold">{text(order.sender_city)}</span> ← <span className="text-white font-semibold">{text(order.receiver_city)}</span></p><p className="text-white/35 mt-1 max-w-[220px] truncate">{text(order.receiver_address)}</p></td>
                  <td className="p-4"><p className="text-white/85">{text(order.package_type)} · {text(order.service_type)}</p><p className="text-white/40 font-mono mt-1" dir="ltr">{Number(order.weight || 0)} kg · {Number(order.pieces || 0)} pcs</p></td>
                  <td className="p-4"><p className="text-brand-gold font-black font-mono" dir="ltr">{money(order.delivery_price || order.price || 0)}</p><p className="text-white/40 font-mono mt-1" dir="ltr">{order.payment_method === "cod" ? `COD ${money(order.cod_amount || 0)}` : text(order.payment_method)}</p></td>
                  <td className="p-4"><span className={`inline-flex px-2.5 py-1 rounded-full border text-[10px] font-black ${statusBadgeClass(order.status)}`}>{text(order.status)}</span></td>
                  <td className="p-4 text-center"><button onClick={() => setSelectedOrder(order)} className="px-3.5 py-2 bg-brand-deep hover:bg-brand-gold hover:text-brand-deep font-bold rounded-lg text-white text-[10px] border border-white/10 transition-colors inline-flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> {ui.details}</button></td>
                </tr>
              )) : <tr><td colSpan={9} className="p-8 text-center text-white/30 leading-relaxed font-bold">{ui.empty}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {selectedOrder && (
        <div className="fixed inset-0 bg-brand-deep/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 z-50 text-right">
          <div className="bg-brand-cool rounded-3xl border border-white/15 max-w-6xl w-full max-h-[92vh] overflow-hidden shadow-2xl flex flex-col" dir={isArabic ? "rtl" : "ltr"}>
            <div className="p-5 sm:p-6 border-b border-white/10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div><p className="text-brand-gold font-mono font-black text-xs" dir="ltr">{trackingCode(selectedOrder)}</p><h4 className="text-xl font-black text-white mt-1">{ui.orderDetails}</h4><p className="text-white/45 text-xs mt-1">{ui.lastUpdate}: {dateText(selectedOrder.updated_at || selectedOrder.created_at, exportLanguage)}</p></div>
              <button onClick={() => { setSelectedOrder(null); setOrderHistory([]); setStatusError(""); }} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-brand-deep/55 border border-white/10 rounded-2xl p-4 space-y-2"><h5 className="text-brand-gold font-black text-sm flex items-center gap-2"><Package className="w-4 h-4" /> {ui.sender}</h5><p className="text-white font-bold">{text(selectedOrder.sender_name)}</p><p className="text-white/50 font-mono" dir="ltr">{text(selectedOrder.sender_phone)}</p><p className="text-white/65">{text(selectedOrder.sender_city)}</p><p className="text-white/40 text-xs leading-relaxed">{text(selectedOrder.sender_address)}</p></div>
                <div className="bg-brand-deep/55 border border-white/10 rounded-2xl p-4 space-y-2"><h5 className="text-brand-gold font-black text-sm flex items-center gap-2"><MapPin className="w-4 h-4" /> {ui.receiver}</h5><p className="text-white font-bold">{text(selectedOrder.receiver_name)}</p><p className="text-white/50 font-mono" dir="ltr">{text(selectedOrder.receiver_phone)}</p><p className="text-white/65">{text(selectedOrder.receiver_city)}</p><p className="text-white/40 text-xs leading-relaxed">{text(selectedOrder.receiver_address)}</p></div>
                <div className="bg-brand-deep/55 border border-white/10 rounded-2xl p-4 space-y-2"><h5 className="text-brand-gold font-black text-sm flex items-center gap-2"><Truck className="w-4 h-4" /> {ui.packageFinance}</h5><p className="text-white/80">{text(selectedOrder.package_type)} · {text(selectedOrder.service_type)}</p><p className="text-white/50 font-mono" dir="ltr">{Number(selectedOrder.weight || 0)} kg · {Number(selectedOrder.pieces || 0)} pieces</p><p className="text-brand-gold font-black font-mono" dir="ltr">Delivery {money(selectedOrder.delivery_price || selectedOrder.price || 0)}</p><p className="text-emerald-300 font-bold font-mono" dir="ltr">COD {money(selectedOrder.cod_amount || 0)}</p></div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-brand-deep/55 border border-white/10 rounded-2xl p-4 space-y-4"><h5 className="text-white font-black text-sm">{ui.updateStatus}</h5><select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)} className="w-full bg-brand-cool/80 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-brand-gold [color-scheme:dark]">{STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select><textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder={ui.notePlaceholder} className="w-full min-h-24 bg-brand-cool/80 border border-white/10 rounded-xl px-4 py-3 text-white text-xs placeholder:text-white/25 focus:outline-none focus:border-brand-gold" />{statusError && <p className="text-rose-300 text-xs flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {statusError}</p>}<button onClick={handleSaveStatus} disabled={savingStatus || draftStatus === selectedOrder.status} className="w-full py-3 bg-brand-gold hover:bg-brand-blue disabled:bg-white/10 disabled:text-white/30 text-brand-deep hover:text-white font-black rounded-xl text-xs transition-colors flex items-center justify-center gap-2"><Save className="w-4 h-4" /> {savingStatus ? ui.saving : ui.saveStatus}</button></div>
                <div className="bg-brand-deep/55 border border-white/10 rounded-2xl p-4 space-y-3"><h5 className="text-white font-black text-sm">{ui.timeline}</h5><div className="space-y-3 max-h-72 overflow-auto pr-1">{timelineItems.map((item, index) => <div key={`${item.status}-${index}`} className="border-r-2 border-brand-gold/45 pr-3 pb-3"><p className="text-brand-gold font-black text-xs">{text(item.status)}</p><p className="text-white/40 text-[11px] font-mono" dir="ltr">{dateText(item.created_at || item.timestamp || item.date || item.updated_at, exportLanguage)}</p>{item.note && <p className="text-white/65 text-xs mt-1">{item.note}</p>}</div>)}</div></div>
              </div>

              <div className="bg-brand-deep/55 border border-white/10 rounded-2xl p-4 space-y-3"><h5 className="text-white font-black text-sm">{ui.quickExport}</h5><div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2"><button onClick={() => copyTracking(selectedOrder)} className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-[11px] font-bold flex items-center justify-center gap-1.5"><Copy className="w-3.5 h-3.5" /> {ui.copy}</button><button onClick={() => openTracking(selectedOrder)} className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-[11px] font-bold flex items-center justify-center gap-1.5"><Eye className="w-3.5 h-3.5" /> {ui.tracking}</button><button onClick={() => openWhatsapp(selectedOrder)} className="px-3 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 rounded-xl border border-emerald-500/20 text-[11px] font-bold flex items-center justify-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> {ui.whatsapp}</button><button onClick={() => exportSelected("invoice")} className="px-3 py-2.5 bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold rounded-xl border border-brand-gold/20 text-[11px] font-bold">Invoice PDF</button><button onClick={() => exportSelected("summary")} className="px-3 py-2.5 bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold rounded-xl border border-brand-gold/20 text-[11px] font-bold">Summary PDF</button><button onClick={() => exportSelected("label")} className="px-3 py-2.5 bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold rounded-xl border border-brand-gold/20 text-[11px] font-bold">Label PDF</button><button onClick={() => exportSelected("txt")} className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-[11px] font-bold">{ui.txt}</button></div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
