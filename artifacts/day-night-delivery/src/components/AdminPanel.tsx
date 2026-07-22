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
import type { Merchant, Order, OrderStatusHistoryItem } from "../types";
import { subscribeToNewOrdersForAdmin, subscribeToOrderStatusChanges, type AppNotification } from "../lib/notifications";
import { exportOrderPDF, exportOrderTXT, type ExportLanguage, type OrderPDFData } from "../lib/exportUtils";
import { downloadInvoicePdf, invoiceNumberForOrder } from "../lib/invoice";
import { calculateAdminOrderPrice, createAdminOrder, createMerchant, fetchMerchants, type AdminOrderInput, type MerchantInput } from "../lib/adminData";
import { useAppContext } from "../lib/AppContext";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  Eye,
  FileText,
  Filter,
  MapPin,
  MessageCircle,
  Package,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Store,
  Truck,
  Users,
  X,
} from "lucide-react";

type CodFilter = "all" | "cod" | "non_cod";
type AdminTab = "orders" | "merchant" | "new_order";

type StatCard = {
  label: string;
  value: string;
  hint: string;
  tone: "gold" | "blue" | "green" | "red" | "white";
};

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending — قيد الانتظار" },
  { value: "confirmed", label: "Confirmed — تم التأكيد" },
  { value: "assigned", label: "Assigned — تم التعيين" },
  { value: "picked_up", label: "Picked Up — تم الاستلام" },
  { value: "in_transit", label: "In Transit — في الطريق" },
  { value: "delivered", label: "Delivered — تم التسليم" },
  { value: "cancelled", label: "Cancelled — ملغي" },
];

const UAE_EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah", "Al Ain", "Western Region"];
const UAE_CITIES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah", "Khorfakkan", "Al Ain", "Mussafah", "Khalifa City", "Mohammed Bin Zayed City", "Western Region"];
const DESTINATIONS = ["SA", "KW", "BH", "OM", "QA", "WORLD", "USA", "UK", "EU", "CA", "AU"];

const EMPTY_MERCHANT: MerchantInput = {
  trade_name: "",
  owner_name: "",
  phone: "",
  alt_phone: "",
  email: "",
  emirate: "Abu Dhabi",
  city: "Abu Dhabi",
  address: "",
  pickup_address: "",
  license_number: "",
  trn: "",
  tax_number: "",
  logo_url: "",
  bank_name: "",
  iban: "",
  settlement_cycle: "weekly",
  commission_type: "fixed_delivery_fee",
  default_payment_method: "sender_pays",
  notes: "",
  status: "active",
};

const EMPTY_ORDER: AdminOrderInput = {
  merchant: null,
  merchant_id: "",
  merchant_name: "",
  merchant_code: "",
  coupon_number: "",
  shipping_scope: "local",
  order_count: 1,
  pickup_city: "Abu Dhabi",
  delivery_city: "Dubai",
  destination_country: "SA",
  receiver_name: "",
  receiver_phone: "",
  receiver_address: "",
  package_type: "",
  package_description: "",
  weight: 1,
  payment_method: "sender_pays",
  cod_amount: "",
  notes: "",
  status: "pending",
};

const UI = {
  ar: {
    title: "مستودع الإدارة والعمليات",
    subtitle: "إدارة التجار، إضافة الطلبيات بالكوبون، الفواتير، التتبع، وحالات الشحن من Supabase مباشرة.",
    badge: "Admin Operations Hub",
    refresh: "تحديث",
    csv: "CSV للنتائج",
    codCsv: "COD CSV",
    dailyPdf: "تقرير PDF",
    searchPlaceholder: "فاتورة / تتبع / كوبون / تاجر / هاتف / اسم / مدينة",
    allStatuses: "كل الحالات",
    allCities: "كل المدن",
    allPayments: "كل طرق الدفع",
    codOnly: "COD فقط",
    nonCod: "غير COD",
    results: "النتائج الحالية",
    reset: "تصفير الفلاتر",
    loading: "جاري تحميل البيانات من Supabase...",
    empty: "لا توجد طلبات تطابق البحث الحالي.",
    details: "تفاصيل وإدارة",
    sender: "بيانات الراسل / التاجر",
    receiver: "بيانات المستلم",
    packageFinance: "الشحنة والمالية",
    updateStatus: "تحديث حالة الشحنة",
    notePlaceholder: "ملاحظة داخل سجل الحركة: تم التواصل مع العميل، جار التوصيل، محاولة فاشلة...",
    saveStatus: "حفظ تحديث الحالة",
    saving: "جاري الحفظ...",
    timeline: "سجل الحركة Timeline",
    quickExport: "أوامر سريعة وتصدير",
    copy: "نسخ التتبع",
    copyInvoice: "نسخ الفاتورة",
    tracking: "فتح التتبع",
    whatsapp: "واتساب",
    txt: "TXT",
    orderDetails: "تفاصيل الطلب وإدارة الحالة",
    lastUpdate: "آخر تحديث",
    statusError: "تعذر حفظ الحالة. تحقق من صلاحيات admin/RLS أو RPC admin_update_order_status.",
    invoiceNo: "رقم الفاتورة",
    trackingNo: "رقم التتبع",
    tabs: { orders: "كل الطلبات", merchant: "إضافة تاجر", newOrder: "إضافة طلبية" },
    merchantTitle: "إضافة تاجر جديد",
    merchantHint: "سجل بيانات التاجر مرة واحدة، وبعدها سيظهر تلقائياً في منسدلة التجار عند إضافة أي طلبية.",
    orderTitle: "إضافة طلبية جديدة بالكوبون",
    orderHint: "اختر التاجر من القائمة، اكتب رقم الكوبون ومواصفات الطلبية، وسيتم حفظها في جدول الطلبات الحقيقي.",
    saveMerchant: "حفظ التاجر",
    saveOrder: "حفظ الطلبية",
    merchantSaved: "تم حفظ التاجر بنجاح.",
    orderSaved: "تم إنشاء الطلبية بنجاح.",
    merchantRequired: "اسم التاجر ورقم الهاتف مطلوبان.",
    orderRequired: "اختر تاجر أو اكتب بيانات مرسل، ثم أدخل الكوبون وبيانات المستلم ومحتوى الشحنة.",
    localRule: "محلي: 25 درهم لكل طلبية في المناطق الرئيسية. 2 = 50، 3 = 75. لا توجد زيادة بالكيلو محلياً.",
    internationalRule: "دولي: يتم الحساب بالكيلو حسب الوجهة، والكيلو الإضافي للدولي فقط.",
    stats: {
      total: "إجمالي الطلبات",
      merchants: "التجار المسجلون",
      processing: "قيد المعالجة",
      delivered: "تم التسليم",
      cancelled: "ملغي أو فشل",
      cod: "COD إجمالي",
    },
  },
  en: {
    title: "Admin Operations Warehouse",
    subtitle: "Manage merchants, coupon orders, invoices, tracking, and shipment status directly from Supabase.",
    badge: "Admin Operations Hub",
    refresh: "Refresh",
    csv: "Filtered CSV",
    codCsv: "COD CSV",
    dailyPdf: "Daily PDF",
    searchPlaceholder: "Invoice / tracking / coupon / merchant / phone / name / city",
    allStatuses: "All statuses",
    allCities: "All cities",
    allPayments: "All payments",
    codOnly: "COD only",
    nonCod: "Non COD",
    results: "Current results",
    reset: "Reset filters",
    loading: "Loading data from Supabase...",
    empty: "No orders match the current filters.",
    details: "Details & Manage",
    sender: "Sender / Merchant Details",
    receiver: "Receiver Details",
    packageFinance: "Package & Finance",
    updateStatus: "Update Shipment Status",
    notePlaceholder: "Internal timeline note: contacted customer, out for delivery, failed attempt...",
    saveStatus: "Save Status Update",
    saving: "Saving...",
    timeline: "Timeline",
    quickExport: "Quick Actions & Export",
    copy: "Copy Tracking",
    copyInvoice: "Copy Invoice",
    tracking: "Open Tracking",
    whatsapp: "WhatsApp",
    txt: "TXT",
    orderDetails: "Order Details & Status Management",
    lastUpdate: "Last update",
    statusError: "Status could not be saved. Check admin/RLS permissions or RPC admin_update_order_status.",
    invoiceNo: "Invoice No",
    trackingNo: "Tracking No",
    tabs: { orders: "All Orders", merchant: "Add Merchant", newOrder: "Add Order" },
    merchantTitle: "Add New Merchant",
    merchantHint: "Save merchant details once. Later, the merchant appears in autocomplete when creating orders.",
    orderTitle: "Add New Coupon Order",
    orderHint: "Choose the merchant, enter coupon number and shipment details, and save directly into live orders.",
    saveMerchant: "Save Merchant",
    saveOrder: "Save Order",
    merchantSaved: "Merchant saved successfully.",
    orderSaved: "Order created successfully.",
    merchantRequired: "Merchant trade name and phone are required.",
    orderRequired: "Choose a merchant or sender, then enter coupon, receiver details, and shipment content.",
    localRule: "Local: 25 AED per order in main areas. 2 = 50, 3 = 75. No local kg surcharge.",
    internationalRule: "International: calculated by kg and destination. Extra kg applies only internationally.",
    stats: {
      total: "Total Orders",
      merchants: "Registered Merchants",
      processing: "Processing",
      delivered: "Delivered",
      cancelled: "Cancelled / Failed",
      cod: "COD Total",
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

function invoiceCode(order: Order) {
  return invoiceNumberForOrder(order);
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
  const headers = language === "ar" ? [
    "رقم الفاتورة", "رقم التتبع", "رقم الكوبون", "التاجر", "تاريخ الطلب", "اسم الراسل", "هاتف الراسل", "اسم المستلم", "هاتف المستلم", "مدينة التسليم", "نوع الشحنة", "عدد الطلبيات", "طريقة الدفع", "رسوم التوصيل درهم", "مبلغ COD درهم", "الحالة", "ملاحظات"
  ] : [
    "Invoice Number", "Tracking Code", "Coupon", "Merchant", "Created At", "Sender Name", "Sender Phone", "Receiver Name", "Receiver Phone", "Receiver City", "Package Type", "Order Count", "Payment Method", "Delivery Fee AED", "COD Amount AED", "Status", "Notes"
  ];
  const rows = orders.map((order) => [
    invoiceCode(order), trackingCode(order), order.coupon_number, order.merchant_name, dateText(order.created_at, language), order.sender_name, order.sender_phone, order.receiver_name, order.receiver_phone, order.receiver_city, order.package_type, order.order_count || order.pieces || 1, order.payment_method, Number(order.delivery_price || order.price || 0).toFixed(2), Number(order.cod_amount || 0).toFixed(2), order.status, order.notes || "",
  ].map(csvCell).join(","));
  return `\uFEFF${headers.map(csvCell).join(",")}\n${rows.join("\n")}`;
}

function toOrderPdfData(order: Order, language: ExportLanguage): OrderPDFData {
  return {
    trackingCode: trackingCode(order),
    invoiceNumber: invoiceCode(order),
    senderName: text(order.sender_name),
    senderPhone: text(order.sender_phone),
    senderCity: text(order.sender_city),
    senderAddress: text(order.sender_address),
    receiverName: text(order.receiver_name),
    receiverPhone: text(order.receiver_phone),
    receiverCity: text(order.receiver_city),
    receiverAddress: text(order.receiver_address),
    packageType: text(order.package_type),
    pieces: Number(order.order_count || order.pieces || 1),
    weight: Number(order.weight || 1),
    serviceType: text(order.service_type),
    paymentMethod: text(order.payment_method),
    codAmount: order.cod_amount ? String(order.cod_amount) : "",
    deliveryFee: Number(order.delivery_price || order.price || 0),
    notes: order.notes || "N/A",
    status: order.status,
    customerName: order.customer_name || order.merchant_name || order.sender_name || order.receiver_name,
    customerPhone: order.customer_phone || order.sender_phone || order.receiver_phone,
    customerEmail: order.customer_email || order.sender_email || order.receiver_email,
    createdAt: dateText(order.created_at, language),
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function printHtml(title: string, body: string, language: ExportLanguage) {
  const rtl = language === "ar";
  const dir = rtl ? "rtl" : "ltr";
  const html = `<!DOCTYPE html><html lang="${language}" dir="${dir}"><head><meta charset="UTF-8"/><title>${escapeHtml(title)}</title><style>@page{size:A4;margin:12mm}body{margin:0;padding:22px;background:#eef5ff;color:#0a1c3a;direction:${dir};font-family:${rtl ? "Tahoma,Arial,'Segoe UI',sans-serif" : "Inter,'Segoe UI',Arial,sans-serif"}}.page{background:#fff;border:1px solid #dbe7f6;border-radius:20px;padding:28px}.top{border-bottom:4px solid #d4af37;margin-bottom:18px;padding-bottom:14px}h1{margin:0;color:#071a33;font-size:23px}.muted{color:#52627a;font-size:12px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.box{background:#f5f8fc;border:1px solid #e5edf8;border-radius:12px;padding:10px;font-size:12px}.box strong{display:block;color:#071a33;margin-bottom:4px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{padding:8px;border-bottom:1px solid #e5edf8;text-align:${rtl ? "right" : "left"}}th{background:#071a33;color:#fff}.ltr{direction:ltr;unicode-bidi:embed}@media print{body{background:#fff;padding:0}.page{border:none;border-radius:0}}</style></head><body><div class="page"><div class="top"><h1>DAY NIGHT DELIVERY SERVICES</h1><p class="muted">داي نايت لخدمات التوصيل والشحن • Admin@daynightae.com • +971 56 875 7331</p><h2>${escapeHtml(title)}</h2></div>${body}</div></body></html>`;
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) {
    downloadTextFile(`${title}.html`, html, "text/html;charset=utf-8");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 400);
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`space-y-1.5 ${className}`}><span className="text-[11px] font-black text-white/55">{label}</span>{children}</label>;
}

function inputClass() {
  return "w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-xs placeholder:text-white/25 focus:outline-none focus:border-brand-gold [color-scheme:dark]";
}

export default function AdminPanel() {
  const { language } = useAppContext();
  const exportLanguage: ExportLanguage = language === "ar" ? "ar" : "en";
  const isArabic = exportLanguage === "ar";
  const ui = UI[exportLanguage];

  const [orders, setOrders] = useState<Order[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>("orders");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [codFilter, setCodFilter] = useState<CodFilter>("all");
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderHistory, setOrderHistory] = useState<OrderStatusHistoryItem[]>([]);
  const [draftStatus, setDraftStatus] = useState("pending");
  const [statusNote, setStatusNote] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");
  const [merchantForm, setMerchantForm] = useState<MerchantInput>(EMPTY_MERCHANT);
  const [orderForm, setOrderForm] = useState<AdminOrderInput>(EMPTY_ORDER);
  const [merchantSearch, setMerchantSearch] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [savingForm, setSavingForm] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [allOrders, allMerchants] = await Promise.all([fetchAllOrders(), fetchMerchants()]);
      setOrders(allOrders);
      setMerchants(allMerchants);
      setLastRefresh(new Date().toLocaleTimeString(exportLanguage === "ar" ? "ar-AE" : "en-AE"));
    } finally {
      setLoading(false);
    }
  }, [exportLanguage]);

  useEffect(() => {
    loadAll();
    const onNotify = (item: AppNotification) => {
      setNotifications((prev) => [item, ...prev].slice(0, 12));
      loadAll();
    };
    const stopNew = subscribeToNewOrdersForAdmin(onNotify);
    const stopStatus = subscribeToOrderStatusChanges(onNotify);
    return () => { stopNew(); stopStatus(); };
  }, [loadAll]);

  useEffect(() => {
    let active = true;
    async function loadHistory() {
      if (!selectedOrder) return;
      setDraftStatus(selectedOrder.status || "pending");
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
    const cities = new Set<string>(UAE_CITIES);
    orders.forEach((order) => {
      if (order.sender_city) cities.add(order.sender_city);
      if (order.receiver_city) cities.add(order.receiver_city);
    });
    return Array.from(cities).sort((a, b) => a.localeCompare(b));
  }, [orders]);

  const merchantSuggestions = useMemo(() => {
    const term = merchantSearch.toLowerCase().trim();
    if (!term) return merchants.slice(0, 8);
    return merchants.filter((m) => [m.trade_name, m.merchant_code, m.owner_name, m.phone, m.email, m.city].join(" ").toLowerCase().includes(term)).slice(0, 8);
  }, [merchantSearch, merchants]);

  const selectedMerchant = useMemo(() => {
    return merchants.find((m) => m.id === orderForm.merchant_id) || null;
  }, [merchants, orderForm.merchant_id]);

  const pricePreview = useMemo(() => calculateAdminOrderPrice({ ...orderForm, merchant: selectedMerchant }), [orderForm, selectedMerchant]);

  const filteredOrders = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      const searchable = [invoiceCode(order), trackingCode(order), order.coupon_number, order.merchant_name, order.merchant_code, order.sender_name, order.sender_phone, order.sender_city, order.receiver_name, order.receiver_phone, order.receiver_city, order.receiver_address, order.status, order.notes].map((item) => String(item || "").toLowerCase()).join(" ");
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
    const pending = orders.filter((order) => ["pending", "confirmed"].some((needle) => normalizeStatus(order.status).includes(needle))).length;
    const delivered = orders.filter((order) => normalizeStatus(order.status).includes("delivered")).length;
    const cancelled = orders.filter((order) => ["cancel", "fail"].some((needle) => normalizeStatus(order.status).includes(needle))).length;
    const codTotal = orders.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0);
    return [
      { label: ui.stats.total, value: String(orders.length), hint: isArabic ? "كل الطلبات الحية" : "All live orders", tone: "white" },
      { label: ui.stats.merchants, value: String(merchants.length), hint: isArabic ? "قائمة التجار للتعاقدات" : "Contracted merchant directory", tone: "gold" },
      { label: ui.stats.processing, value: String(pending), hint: "Pending / Confirmed", tone: "blue" },
      { label: ui.stats.delivered, value: String(delivered), hint: "Delivered", tone: "green" },
      { label: ui.stats.cancelled, value: String(cancelled), hint: "Cancelled / Failed", tone: "red" },
      { label: ui.stats.cod, value: money(codTotal), hint: isArabic ? "كل مبالغ التحصيل" : "All COD amounts", tone: "green" },
    ];
  }, [isArabic, merchants.length, orders, ui]);

  function setMerchantField<K extends keyof MerchantInput>(key: K, value: MerchantInput[K]) {
    setMerchantForm((prev) => ({ ...prev, [key]: value }));
  }

  function setOrderField<K extends keyof AdminOrderInput>(key: K, value: AdminOrderInput[K]) {
    setOrderForm((prev) => ({ ...prev, [key]: value }));
  }

  function pickMerchant(merchant: Merchant) {
    setMerchantSearch(`${merchant.trade_name} — ${merchant.phone}`);
    setOrderForm((prev) => ({
      ...prev,
      merchant,
      merchant_id: merchant.id,
      merchant_name: merchant.trade_name,
      merchant_code: merchant.merchant_code || "",
      pickup_city: merchant.city || merchant.emirate || prev.pickup_city,
      payment_method: merchant.default_payment_method || prev.payment_method,
    }));
  }

  async function handleSaveMerchant() {
    setFormMessage("");
    setFormError("");
    if (!merchantForm.trade_name.trim() || !merchantForm.phone.trim()) {
      setFormError(ui.merchantRequired);
      return;
    }
    setSavingForm(true);
    try {
      const saved = await createMerchant(merchantForm);
      setMerchantForm(EMPTY_MERCHANT);
      setFormMessage(`${ui.merchantSaved} ${saved.merchant_code || ""}`);
      setActiveTab("new_order");
      await loadAll();
      pickMerchant(saved);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Merchant could not be saved.");
    } finally {
      setSavingForm(false);
    }
  }

  async function handleSaveOrder() {
    setFormMessage("");
    setFormError("");
    if (!orderForm.coupon_number?.trim() || !orderForm.receiver_name.trim() || !orderForm.receiver_phone.trim() || !orderForm.receiver_address.trim() || !orderForm.package_type.trim()) {
      setFormError(ui.orderRequired);
      return;
    }
    setSavingForm(true);
    try {
      const created = await createAdminOrder({ ...orderForm, merchant: selectedMerchant });
      setOrderForm({ ...EMPTY_ORDER, merchant_id: selectedMerchant?.id || "", merchant_name: selectedMerchant?.trade_name || "", merchant_code: selectedMerchant?.merchant_code || "", merchant: selectedMerchant });
      setFormMessage(`${ui.orderSaved} ${invoiceCode(created)}`);
      setActiveTab("orders");
      await loadAll();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Order could not be created.");
    } finally {
      setSavingForm(false);
    }
  }

  function resetFilters() {
    setSearchQuery(""); setStatusFilter("all"); setCityFilter("all"); setDateFilter(""); setCodFilter("all");
  }

  async function handleSaveStatus() {
    if (!selectedOrder) return;
    setSavingStatus(true);
    setStatusError("");
    const ok = await updateExistingOrderStatus(selectedOrder.id, draftStatus, statusNote);
    if (!ok) { setStatusError(ui.statusError); setSavingStatus(false); return; }
    setSelectedOrder({ ...selectedOrder, status: draftStatus, updated_at: new Date().toISOString() });
    await loadAll();
    const remoteHistory = await fetchOrderStatusHistory(selectedOrder.id);
    setOrderHistory(remoteHistory.length ? remoteHistory : [...(selectedOrder.status_history || []), { status: draftStatus, note: statusNote || "Admin status update", date: new Date().toISOString() }]);
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

  function exportDailyReportPdf() {
    const codTotal = filteredOrders.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0);
    const deliveryTotal = filteredOrders.reduce((sum, order) => sum + Number(order.delivery_price || order.price || 0), 0);
    const rows = filteredOrders.map((order) => `<tr><td class="ltr">${escapeHtml(invoiceCode(order))}</td><td class="ltr">${escapeHtml(trackingCode(order))}</td><td>${escapeHtml(order.coupon_number)}</td><td>${escapeHtml(order.merchant_name || order.sender_name)}</td><td class="ltr">${escapeHtml(order.sender_phone)}</td><td>${escapeHtml(order.receiver_name)}</td><td class="ltr">${escapeHtml(order.receiver_phone)}</td><td>${escapeHtml(order.receiver_city)}</td><td>${escapeHtml(order.package_type)}</td><td>${escapeHtml(order.status)}</td><td class="ltr">${money(order.delivery_price || order.price || 0)}</td></tr>`).join("");
    const title = isArabic ? "تقرير الإدارة اليومي للطلبات" : "Admin Daily Orders Report";
    const body = `<div class="grid"><div class="box"><strong>${isArabic ? "الطلبات بعد الفلترة" : "Filtered Orders"}</strong>${filteredOrders.length}</div><div class="box"><strong>${isArabic ? "كل الطلبات" : "All Orders"}</strong>${orders.length}</div><div class="box"><strong>${isArabic ? "التجار" : "Merchants"}</strong>${merchants.length}</div><div class="box"><strong>COD</strong><span class="ltr">${codTotal.toFixed(2)} AED</span></div><div class="box"><strong>${isArabic ? "رسوم التوصيل" : "Delivery Fees"}</strong><span class="ltr">${deliveryTotal.toFixed(2)} AED</span></div></div><table><thead><tr><th>${ui.invoiceNo}</th><th>${ui.trackingNo}</th><th>Coupon</th><th>Merchant</th><th>Sender Phone</th><th>Receiver</th><th>Receiver Phone</th><th>City</th><th>Package</th><th>Status</th><th>Fee</th></tr></thead><tbody>${rows || `<tr><td colspan="11">—</td></tr>`}</tbody></table>`;
    printHtml(title, body, exportLanguage);
  }

  function exportSelected(type: "invoice" | "summary" | "label" | "txt") {
    if (!selectedOrder) return;
    if (type === "invoice") { downloadInvoicePdf(selectedOrder, exportLanguage); return; }
    const data = toOrderPdfData(selectedOrder, exportLanguage);
    if (type === "txt") { exportOrderTXT(data, exportLanguage); return; }
    exportOrderPDF(data, type, exportLanguage);
  }

  function copyText(value: string) { navigator.clipboard?.writeText(value); }
  function copyTracking(order: Order) { copyText(trackingCode(order)); }
  function openTracking(order: Order) { window.open(`/tracking?code=${encodeURIComponent(invoiceCode(order))}`, "_blank", "noopener,noreferrer"); }
  function openWhatsapp(order: Order) {
    const body = `DAY NIGHT DELIVERY SERVICES%0AInvoice: ${encodeURIComponent(invoiceCode(order))}%0ATracking: ${encodeURIComponent(trackingCode(order))}%0ACoupon: ${encodeURIComponent(order.coupon_number || "")}%0AStatus: ${encodeURIComponent(order.status || "pending")}`;
    window.open(`https://wa.me/${String(order.receiver_phone || "").replace(/\D/g, "")}?text=${body}`, "_blank", "noopener,noreferrer");
  }

  const timelineItems = selectedOrder ? (orderHistory.length ? orderHistory : [{ status: selectedOrder.status, note: selectedOrder.notes, date: selectedOrder.updated_at || selectedOrder.created_at }]) : [];

  return (
    <div className="space-y-8 text-right" dir={isArabic ? "rtl" : "ltr"}>
      <section className="bg-brand-cool/25 border border-white/10 rounded-3xl p-5 sm:p-7 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/20 text-brand-gold rounded-full px-3 py-1 text-[11px] font-black tracking-wide"><ShieldCheck className="w-4 h-4" /> {ui.badge}</span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-3">{ui.title}</h2>
            <p className="text-white/55 text-sm mt-1">{ui.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button onClick={loadAll} disabled={loading} className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-xs font-bold flex items-center gap-2"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> {ui.refresh}</button>
            <button onClick={exportFilteredCsv} className="px-4 py-2.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white rounded-xl text-xs font-black flex items-center gap-2"><Download className="w-4 h-4" /> {ui.csv}</button>
            <button onClick={exportCodCsv} className="px-4 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 rounded-xl border border-emerald-500/20 text-xs font-bold flex items-center gap-2"><FileText className="w-4 h-4" /> {ui.codCsv}</button>
            <button onClick={exportDailyReportPdf} className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-xs font-bold flex items-center gap-2"><FileText className="w-4 h-4" /> {ui.dailyPdf}</button>
          </div>
        </div>
        <div className="text-[11px] text-white/40 font-mono" dir="ltr">Supabase: {supabase ? "connected" : "not configured"} {lastRefresh ? ` | last refresh ${lastRefresh}` : ""}</div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        {stats.map((stat) => <div key={stat.label} className="bg-brand-cool/25 border border-white/10 rounded-2xl p-4"><p className="text-white/45 text-xs font-bold">{stat.label}</p><p className={`text-2xl font-black mt-2 ${stat.tone === "gold" ? "text-brand-gold" : stat.tone === "green" ? "text-emerald-300" : stat.tone === "red" ? "text-rose-300" : stat.tone === "blue" ? "text-brand-sky" : "text-white"}`}>{stat.value}</p><p className="text-white/35 text-[11px] mt-1">{stat.hint}</p></div>)}
      </section>

      <section className="bg-brand-cool/25 border border-white/10 rounded-3xl p-2 grid grid-cols-1 md:grid-cols-3 gap-2">
        {([
          ["orders", ui.tabs.orders, ClipboardList],
          ["merchant", ui.tabs.merchant, Store],
          ["new_order", ui.tabs.newOrder, PlusCircle],
        ] as const).map(([value, label, Icon]) => <button key={value} onClick={() => { setActiveTab(value); setFormError(""); setFormMessage(""); }} className={`rounded-2xl px-4 py-3 text-sm font-black flex items-center justify-center gap-2 border transition-all ${activeTab === value ? "bg-brand-gold text-brand-deep border-brand-gold shadow-lg shadow-brand-gold/20" : "bg-brand-deep/60 text-white/65 border-white/10 hover:text-white"}`}><Icon className="w-4 h-4" /> {label}</button>)}
      </section>

      {(formMessage || formError) && <section className={`rounded-2xl p-4 text-xs font-bold flex items-center gap-2 ${formError ? "bg-rose-500/10 border border-rose-500/30 text-rose-300" : "bg-emerald-500/10 border border-emerald-500/25 text-emerald-300"}`}>{formError ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />} {formError || formMessage}</section>}
      {notifications.length > 0 && <section className="bg-brand-gold/10 border border-brand-gold/20 rounded-2xl p-4 space-y-2">{notifications.slice(0, 3).map((item) => <p key={item.id} className="text-brand-gold text-xs font-bold">• {item.title} — {item.body}</p>)}</section>}

      {activeTab === "merchant" && (
        <section className="bg-brand-cool/25 border border-white/10 rounded-3xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-3"><Building2 className="w-8 h-8 text-brand-gold" /><div><h3 className="text-xl font-black text-white">{ui.merchantTitle}</h3><p className="text-white/45 text-xs mt-1">{ui.merchantHint}</p></div></div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <Field label={isArabic ? "اسم التاجر / المتجر *" : "Merchant / Store Name *"}><input className={inputClass()} value={merchantForm.trade_name} onChange={(e) => setMerchantField("trade_name", e.target.value)} /></Field>
            <Field label={isArabic ? "اسم المسؤول" : "Owner / Contact Person"}><input className={inputClass()} value={merchantForm.owner_name || ""} onChange={(e) => setMerchantField("owner_name", e.target.value)} /></Field>
            <Field label={isArabic ? "هاتف التاجر *" : "Merchant Phone *"}><input className={inputClass()} dir="ltr" value={merchantForm.phone} onChange={(e) => setMerchantField("phone", e.target.value)} placeholder="+971..." /></Field>
            <Field label={isArabic ? "هاتف إضافي" : "Alt Phone"}><input className={inputClass()} dir="ltr" value={merchantForm.alt_phone || ""} onChange={(e) => setMerchantField("alt_phone", e.target.value)} /></Field>
            <Field label={isArabic ? "البريد الإلكتروني" : "Email"}><input className={inputClass()} dir="ltr" value={merchantForm.email || ""} onChange={(e) => setMerchantField("email", e.target.value)} /></Field>
            <Field label={isArabic ? "الإمارة" : "Emirate"}><select className={inputClass()} value={merchantForm.emirate || ""} onChange={(e) => setMerchantField("emirate", e.target.value)}>{UAE_EMIRATES.map((city) => <option key={city} value={city}>{city}</option>)}</select></Field>
            <Field label={isArabic ? "المدينة / المنطقة" : "City / Area"}><input className={inputClass()} list="merchant-city-options" value={merchantForm.city || ""} onChange={(e) => setMerchantField("city", e.target.value)} /></Field>
            <Field label={isArabic ? "رقم الرخصة" : "License No"}><input className={inputClass()} value={merchantForm.license_number || ""} onChange={(e) => setMerchantField("license_number", e.target.value)} /></Field>
            <Field label={isArabic ? "الرقم الضريبي / TRN" : "TRN / Tax No"}><input className={inputClass()} value={merchantForm.trn || ""} onChange={(e) => { setMerchantField("trn", e.target.value); setMerchantField("tax_number", e.target.value); }} /></Field>
            <Field label={isArabic ? "دورة التسوية" : "Settlement Cycle"}><select className={inputClass()} value={merchantForm.settlement_cycle || "weekly"} onChange={(e) => setMerchantField("settlement_cycle", e.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="on_demand">On Demand</option></select></Field>
            <Field label={isArabic ? "طريقة الدفع الافتراضية" : "Default Payment"}><select className={inputClass()} value={merchantForm.default_payment_method || "sender_pays"} onChange={(e) => setMerchantField("default_payment_method", e.target.value)}><option value="sender_pays">Sender Pays</option><option value="receiver_pays">Receiver Pays</option><option value="cod">COD</option></select></Field>
            <Field label={isArabic ? "حالة التاجر" : "Merchant Status"}><select className={inputClass()} value={merchantForm.status || "active"} onChange={(e) => setMerchantField("status", e.target.value)}><option value="active">Active</option><option value="review">Review</option><option value="paused">Paused</option></select></Field>
            <Field label={isArabic ? "العنوان" : "Address"} className="xl:col-span-2"><input className={inputClass()} value={merchantForm.address || ""} onChange={(e) => setMerchantField("address", e.target.value)} /></Field>
            <Field label={isArabic ? "عنوان الاستلام الافتراضي" : "Default Pickup Address"} className="xl:col-span-2"><input className={inputClass()} value={merchantForm.pickup_address || ""} onChange={(e) => setMerchantField("pickup_address", e.target.value)} /></Field>
            <Field label={isArabic ? "ملاحظات التعاقد" : "Contract Notes"} className="xl:col-span-3"><textarea className={`${inputClass()} min-h-24`} value={merchantForm.notes || ""} onChange={(e) => setMerchantField("notes", e.target.value)} /></Field>
          </div>
          <datalist id="merchant-city-options">{UAE_CITIES.map((city) => <option key={city} value={city} />)}</datalist>
          <button onClick={handleSaveMerchant} disabled={savingForm} className="w-full md:w-auto px-8 py-3 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2"><Save className="w-4 h-4" /> {savingForm ? ui.saving : ui.saveMerchant}</button>
        </section>
      )}

      {activeTab === "new_order" && (
        <section className="bg-brand-cool/25 border border-white/10 rounded-3xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-3"><Package className="w-8 h-8 text-brand-gold" /><div><h3 className="text-xl font-black text-white">{ui.orderTitle}</h3><p className="text-white/45 text-xs mt-1">{ui.orderHint}</p></div></div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label={isArabic ? "ابحث عن التاجر" : "Search Merchant"} className="md:col-span-2"><input className={inputClass()} list="merchant-options" value={merchantSearch} onChange={(e) => { setMerchantSearch(e.target.value); const matched = merchants.find((m) => `${m.trade_name} — ${m.phone}` === e.target.value || m.trade_name === e.target.value || m.merchant_code === e.target.value); if (matched) pickMerchant(matched); }} placeholder={isArabic ? "ابدأ بكتابة اسم التاجر أو الهاتف..." : "Start typing merchant name or phone..."} /></Field>
              <datalist id="merchant-options">{merchants.map((m) => <option key={m.id} value={`${m.trade_name} — ${m.phone}`}>{m.merchant_code}</option>)}</datalist>
              {merchantSuggestions.length > 0 && <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-2">{merchantSuggestions.map((m) => <button key={m.id} onClick={() => pickMerchant(m)} className={`text-start rounded-xl border px-3 py-2 text-xs transition-all ${selectedMerchant?.id === m.id ? "border-brand-gold bg-brand-gold/15 text-brand-gold" : "border-white/10 bg-brand-deep/60 text-white/65 hover:text-white"}`}><span className="font-black">{m.trade_name}</span><span className="block font-mono text-[10px] opacity-70" dir="ltr">{m.phone} • {m.merchant_code}</span></button>)}</div>}
              <Field label={isArabic ? "رقم الكوبون / الباركود *" : "Coupon / Barcode No *"}><input className={inputClass()} dir="ltr" value={orderForm.coupon_number || ""} onChange={(e) => setOrderField("coupon_number", e.target.value)} /></Field>
              <Field label={isArabic ? "نوع الشحن" : "Shipping Type"}><select className={inputClass()} value={orderForm.shipping_scope} onChange={(e) => setOrderField("shipping_scope", e.target.value as "local" | "international")}><option value="local">Local UAE</option><option value="international">International</option></select></Field>
              <Field label={isArabic ? "عدد الطلبيات" : "Order Count"}><input className={inputClass()} type="number" min="1" step="1" value={orderForm.order_count} onChange={(e) => setOrderField("order_count", Math.max(1, Math.round(Number(e.target.value) || 1)))} dir="ltr" /></Field>
              <Field label={isArabic ? "مدينة الاستلام" : "Pickup City"}><input className={inputClass()} list="city-options" value={orderForm.pickup_city} onChange={(e) => setOrderField("pickup_city", e.target.value)} /></Field>
              <Field label={orderForm.shipping_scope === "international" ? (isArabic ? "الوجهة الدولية" : "International Destination") : (isArabic ? "مدينة التسليم" : "Delivery City")}><input className={inputClass()} list={orderForm.shipping_scope === "international" ? "destination-options" : "city-options"} value={orderForm.shipping_scope === "international" ? orderForm.destination_country || "" : orderForm.delivery_city} onChange={(e) => orderForm.shipping_scope === "international" ? setOrderField("destination_country", e.target.value) : setOrderField("delivery_city", e.target.value)} /></Field>
              {orderForm.shipping_scope === "international" && <Field label={isArabic ? "الوزن الدولي بالكيلو" : "International Weight Kg"}><input className={inputClass()} type="number" min="1" step="0.1" value={orderForm.weight || 1} onChange={(e) => setOrderField("weight", Math.max(1, Number(e.target.value) || 1))} dir="ltr" /></Field>}
              <Field label={isArabic ? "اسم المستلم *" : "Receiver Name *"}><input className={inputClass()} value={orderForm.receiver_name} onChange={(e) => setOrderField("receiver_name", e.target.value)} /></Field>
              <Field label={isArabic ? "هاتف المستلم *" : "Receiver Phone *"}><input className={inputClass()} dir="ltr" value={orderForm.receiver_phone} onChange={(e) => setOrderField("receiver_phone", e.target.value)} /></Field>
              <Field label={isArabic ? "عنوان المستلم *" : "Receiver Address *"} className="md:col-span-2"><input className={inputClass()} value={orderForm.receiver_address} onChange={(e) => setOrderField("receiver_address", e.target.value)} /></Field>
              <Field label={isArabic ? "وصف العنصر / محتوى الشحنة *" : "Item Description *"} className="md:col-span-2"><textarea className={`${inputClass()} min-h-24`} value={orderForm.package_type} onChange={(e) => { setOrderField("package_type", e.target.value); setOrderField("package_description", e.target.value); }} placeholder={isArabic ? "اكتب ما يرسله التاجر بحرية: مستندات، ملابس، منتجات متجر..." : "Free text: documents, fashion items, store products..."} /></Field>
              <Field label={isArabic ? "طريقة الدفع" : "Payment Method"}><select className={inputClass()} value={orderForm.payment_method} onChange={(e) => setOrderField("payment_method", e.target.value)}><option value="sender_pays">Sender Pays</option><option value="receiver_pays">Receiver Pays</option><option value="cod">COD</option></select></Field>
              {orderForm.payment_method === "cod" && <Field label={isArabic ? "مبلغ COD" : "COD Amount"}><input className={inputClass()} type="number" min="0" step="0.01" value={String(orderForm.cod_amount || "")} onChange={(e) => setOrderField("cod_amount", e.target.value)} dir="ltr" /></Field>}
              <Field label={isArabic ? "حالة الطلب" : "Order Status"}><select className={inputClass()} value={orderForm.status || "pending"} onChange={(e) => setOrderField("status", e.target.value)}>{STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></Field>
              <Field label={isArabic ? "ملاحظات للمندوب أو الإدارة" : "Driver / Admin Notes"} className="md:col-span-2"><textarea className={`${inputClass()} min-h-20`} value={orderForm.notes || ""} onChange={(e) => setOrderField("notes", e.target.value)} /></Field>
            </div>
            <aside className="bg-brand-deep/70 border border-white/10 rounded-3xl p-5 space-y-4 h-fit">
              <div className="flex items-center gap-2 text-brand-gold font-black"><Truck className="w-5 h-5" /> {isArabic ? "معاينة التكلفة" : "Price Preview"}</div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2 text-xs">
                <p className="text-white/55">{orderForm.shipping_scope === "local" ? ui.localRule : ui.internationalRule}</p>
                {pricePreview.breakdown.map((line) => <p key={line} className="text-white/65 font-mono" dir="ltr">✓ {line}</p>)}
                <div className="border-t border-white/10 pt-3 flex items-center justify-between"><span className="text-white font-black">Total</span><span className="text-brand-gold text-2xl font-black font-mono" dir="ltr">{money(pricePreview.total)}</span></div>
              </div>
              {selectedMerchant && <div className="rounded-2xl bg-brand-gold/10 border border-brand-gold/20 p-4 text-xs"><p className="text-brand-gold font-black">{selectedMerchant.trade_name}</p><p className="text-white/55 font-mono" dir="ltr">{selectedMerchant.phone}</p><p className="text-white/45">{selectedMerchant.pickup_address || selectedMerchant.address}</p></div>}
              <button onClick={handleSaveOrder} disabled={savingForm} className="w-full px-8 py-3 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2"><Save className="w-4 h-4" /> {savingForm ? ui.saving : ui.saveOrder}</button>
            </aside>
          </div>
          <datalist id="city-options">{cityOptions.map((city) => <option key={city} value={city} />)}</datalist>
          <datalist id="destination-options">{DESTINATIONS.map((city) => <option key={city} value={city} />)}</datalist>
        </section>
      )}

      {activeTab === "orders" && <>
        <section className="bg-brand-cool/25 border border-white/10 rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-brand-gold font-black text-sm"><Filter className="w-4 h-4" /> Filters</div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <div className="relative"><Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" /><input id="admin_search_bar" type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={ui.searchPlaceholder} className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 pl-9 text-white text-xs placeholder:text-white/25 focus:outline-none focus:border-brand-gold" /></div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass()}><option value="all">{ui.allStatuses}</option>{STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select>
            <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className={inputClass()}><option value="all">{ui.allCities}</option>{cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}</select>
            <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className={inputClass()} />
            <select value={codFilter} onChange={(e) => setCodFilter(e.target.value as CodFilter)} className={inputClass()}><option value="all">{ui.allPayments}</option><option value="cod">{ui.codOnly}</option><option value="non_cod">{ui.nonCod}</option></select>
          </div>
          <div className="flex flex-wrap justify-between items-center gap-3 text-xs"><p className="text-white/45">{ui.results}: <span className="text-brand-gold font-mono font-bold">{filteredOrders.length}</span> / <span className="text-white font-mono">{orders.length}</span></p><button onClick={resetFilters} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 font-bold flex items-center gap-2"><RotateCcw className="w-4 h-4" /> {ui.reset}</button></div>
        </section>

        <section className="bg-brand-cool/20 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto"><table className="w-full text-xs font-sans min-w-[1400px]"><thead className="bg-brand-deep/80 text-white/45 font-bold border-b border-white/10"><tr><th className="p-3 text-start">Invoice</th><th className="p-3 text-start">Tracking</th><th className="p-3 text-start">Coupon</th><th className="p-3 text-start">Merchant</th><th className="p-3 text-start">Date</th><th className="p-3 text-start">Receiver</th><th className="p-3 text-start">Route</th><th className="p-3 text-start">Package</th><th className="p-3 text-start">Finance</th><th className="p-3 text-start">Status</th><th className="p-3 text-center">Manage</th></tr></thead><tbody className="divide-y divide-white/5">
            {loading ? <tr><td colSpan={11} className="p-8 text-center text-white/40 font-bold">{ui.loading}</td></tr> : filteredOrders.length > 0 ? filteredOrders.map((order) => <tr key={order.id} className="hover:bg-white/5 transition-colors align-top"><td className="p-4 font-mono font-extrabold text-brand-gold" dir="ltr">{invoiceCode(order)}</td><td className="p-4 font-mono font-bold text-white/70" dir="ltr">{trackingCode(order)}</td><td className="p-4 font-mono text-brand-sky" dir="ltr">{text(order.coupon_number)}</td><td className="p-4"><p className="font-bold text-white">{text(order.merchant_name || order.sender_name)}</p><p className="text-white/40 font-mono" dir="ltr">{text(order.merchant_code)}</p></td><td className="p-4 text-white/55 font-mono" dir="ltr">{dateText(order.created_at, exportLanguage)}</td><td className="p-4"><p className="font-bold text-white">{text(order.receiver_name)}</p><p className="text-white/40 font-mono mt-0.5" dir="ltr">{text(order.receiver_phone)}</p></td><td className="p-4 text-white/75"><p><span className="text-white font-semibold">{text(order.sender_city)}</span> ← <span className="text-white font-semibold">{text(order.receiver_city)}</span></p><p className="text-white/35 mt-1 max-w-[220px] truncate">{text(order.receiver_address)}</p></td><td className="p-4"><p className="text-white/85 max-w-[240px] truncate">{text(order.package_type)}</p><p className="text-white/40 font-mono mt-1" dir="ltr">{Number(order.order_count || order.pieces || 1)} orders · {text(order.shipping_scope || order.service_type)}</p></td><td className="p-4"><p className="text-brand-gold font-black font-mono" dir="ltr">{money(order.delivery_price || order.price || 0)}</p><p className="text-white/40 font-mono mt-1" dir="ltr">{order.payment_method === "cod" ? `COD ${money(order.cod_amount || 0)}` : text(order.payment_method)}</p></td><td className="p-4"><span className={`inline-flex px-2.5 py-1 rounded-full border text-[10px] font-black ${statusBadgeClass(order.status)}`}>{text(order.status)}</span></td><td className="p-4 text-center"><button onClick={() => setSelectedOrder(order)} className="px-3.5 py-2 bg-brand-deep hover:bg-brand-gold hover:text-brand-deep font-bold rounded-lg text-white text-[10px] border border-white/10 transition-colors inline-flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> {ui.details}</button></td></tr>) : <tr><td colSpan={11} className="p-8 text-center text-white/30 leading-relaxed font-bold">{ui.empty}</td></tr>}
          </tbody></table></div>
        </section>
      </>}

      {selectedOrder && <div className="fixed inset-0 bg-brand-deep/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 z-50 text-right"><div className="bg-brand-cool rounded-3xl border border-white/15 max-w-6xl w-full max-h-[92vh] overflow-hidden shadow-2xl flex flex-col" dir={isArabic ? "rtl" : "ltr"}><div className="p-5 sm:p-6 border-b border-white/10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"><div><p className="text-brand-gold font-mono font-black text-xs" dir="ltr">{invoiceCode(selectedOrder)}</p><p className="text-white/45 font-mono text-[11px]" dir="ltr">{trackingCode(selectedOrder)} {selectedOrder.coupon_number ? `• ${selectedOrder.coupon_number}` : ""}</p><h4 className="text-xl font-black text-white mt-1">{ui.orderDetails}</h4><p className="text-white/45 text-xs mt-1">{ui.lastUpdate}: {dateText(selectedOrder.updated_at || selectedOrder.created_at, exportLanguage)}</p></div><button onClick={() => { setSelectedOrder(null); setOrderHistory([]); setStatusError(""); }} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white"><X className="w-5 h-5" /></button></div>
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6"><div className="grid grid-cols-1 lg:grid-cols-3 gap-4"><div className="bg-brand-deep/55 border border-white/10 rounded-2xl p-4 space-y-2"><h5 className="text-brand-gold font-black text-sm flex items-center gap-2"><Users className="w-4 h-4" /> {ui.sender}</h5><p className="text-white font-bold">{text(selectedOrder.merchant_name || selectedOrder.sender_name)}</p><p className="text-white/50 font-mono" dir="ltr">{text(selectedOrder.sender_phone)}</p><p className="text-white/65">{text(selectedOrder.sender_city)}</p><p className="text-white/40 text-xs leading-relaxed">{text(selectedOrder.sender_address)}</p></div><div className="bg-brand-deep/55 border border-white/10 rounded-2xl p-4 space-y-2"><h5 className="text-brand-gold font-black text-sm flex items-center gap-2"><MapPin className="w-4 h-4" /> {ui.receiver}</h5><p className="text-white font-bold">{text(selectedOrder.receiver_name)}</p><p className="text-white/50 font-mono" dir="ltr">{text(selectedOrder.receiver_phone)}</p><p className="text-white/65">{text(selectedOrder.receiver_city)}</p><p className="text-white/40 text-xs leading-relaxed">{text(selectedOrder.receiver_address)}</p></div><div className="bg-brand-deep/55 border border-white/10 rounded-2xl p-4 space-y-2"><h5 className="text-brand-gold font-black text-sm flex items-center gap-2"><Truck className="w-4 h-4" /> {ui.packageFinance}</h5><p className="text-white/80">{text(selectedOrder.package_type)}</p><p className="text-white/50 font-mono" dir="ltr">{Number(selectedOrder.order_count || selectedOrder.pieces || 1)} orders · {Number(selectedOrder.weight || 1)} kg</p><p className="text-brand-gold font-black font-mono" dir="ltr">Delivery {money(selectedOrder.delivery_price || selectedOrder.price || 0)}</p><p className="text-emerald-300 font-bold font-mono" dir="ltr">COD {money(selectedOrder.cod_amount || 0)}</p></div></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><div className="bg-brand-deep/55 border border-white/10 rounded-2xl p-4 space-y-4"><h5 className="text-white font-black text-sm">{ui.updateStatus}</h5><select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)} className={inputClass()}>{STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select><textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder={ui.notePlaceholder} className={`${inputClass()} min-h-24`} />{statusError && <p className="text-rose-300 text-xs flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {statusError}</p>}<button onClick={handleSaveStatus} disabled={savingStatus || draftStatus === selectedOrder.status} className="w-full py-3 bg-brand-gold hover:bg-brand-blue disabled:bg-white/10 disabled:text-white/30 text-brand-deep hover:text-white font-black rounded-xl text-xs transition-colors flex items-center justify-center gap-2"><Save className="w-4 h-4" /> {savingStatus ? ui.saving : ui.saveStatus}</button></div><div className="bg-brand-deep/55 border border-white/10 rounded-2xl p-4 space-y-3"><h5 className="text-white font-black text-sm">{ui.timeline}</h5><div className="space-y-3 max-h-72 overflow-auto pr-1">{timelineItems.map((item, index) => <div key={`${item.status}-${index}`} className="border-r-2 border-brand-gold/45 pr-3 pb-3"><p className="text-brand-gold font-black text-xs">{text(item.status)}</p><p className="text-white/40 text-[11px] font-mono" dir="ltr">{dateText(item.created_at || item.timestamp || item.date || item.updated_at, exportLanguage)}</p>{item.note && <p className="text-white/65 text-xs mt-1">{item.note}</p>}</div>)}</div></div></div>
        <div className="bg-brand-deep/55 border border-white/10 rounded-2xl p-4 space-y-3"><h5 className="text-white font-black text-sm">{ui.quickExport}</h5><div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2"><button onClick={() => copyText(invoiceCode(selectedOrder))} className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-[11px] font-bold flex items-center justify-center gap-1.5"><Copy className="w-3.5 h-3.5" /> {ui.copyInvoice}</button><button onClick={() => copyTracking(selectedOrder)} className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-[11px] font-bold flex items-center justify-center gap-1.5"><Copy className="w-3.5 h-3.5" /> {ui.copy}</button><button onClick={() => openTracking(selectedOrder)} className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-[11px] font-bold flex items-center justify-center gap-1.5"><Eye className="w-3.5 h-3.5" /> {ui.tracking}</button><button onClick={() => openWhatsapp(selectedOrder)} className="px-3 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 rounded-xl border border-emerald-500/20 text-[11px] font-bold flex items-center justify-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> {ui.whatsapp}</button><button onClick={() => exportSelected("invoice")} className="px-3 py-2.5 bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold rounded-xl border border-brand-gold/20 text-[11px] font-bold">Invoice PDF</button><button onClick={() => exportSelected("summary")} className="px-3 py-2.5 bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold rounded-xl border border-brand-gold/20 text-[11px] font-bold">Summary PDF</button><button onClick={() => exportSelected("txt")} className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-[11px] font-bold">{ui.txt}</button></div></div></div></div></div>}
    </div>
  );
}
