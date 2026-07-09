import type { FinanceSummary } from "../lib/adminData";
import type { Merchant } from "../types";

export type AdminMapRegion = { id: string; ar: string; en: string; center: [number, number]; zoom: number; keywords: string[] };
export const adminMapRegions: AdminMapRegion[] = [
  { id: "all", ar: "كل الإمارات", en: "All UAE", center: [24.4539, 54.3773], zoom: 8, keywords: [] },
  { id: "abu_dhabi", ar: "أبوظبي", en: "Abu Dhabi", center: [24.4539, 54.3773], zoom: 10, keywords: ["abu dhabi", "أبوظبي", "ابوظبي", "mussafah", "khalifa", "mbz", "al ain", "العين"] },
  { id: "dubai", ar: "دبي", en: "Dubai", center: [25.2048, 55.2708], zoom: 11, keywords: ["dubai", "دبي", "jebel ali", "deira", "bur dubai"] },
  { id: "sharjah", ar: "الشارقة", en: "Sharjah", center: [25.3463, 55.4209], zoom: 11, keywords: ["sharjah", "الشارقة"] },
  { id: "ajman", ar: "عجمان", en: "Ajman", center: [25.4052, 55.5136], zoom: 12, keywords: ["ajman", "عجمان"] },
  { id: "al_ain", ar: "العين", en: "Al Ain", center: [24.1302, 55.8023], zoom: 11, keywords: ["al ain", "العين"] },
  { id: "external", ar: "خارجي", en: "External", center: [24.4539, 54.3773], zoom: 5, keywords: ["international", "external", "gcc", "worldwide", "خارج", "دولي"] },
];
export const adminSettingsCatalog = [
  { id: "company", ar: "ملف الشركة", en: "Company profile", fieldsAr: ["اسم الشركة", "الشعار", "البريد", "الهاتف"], fieldsEn: ["Company name", "Logo", "Email", "Phone"] },
  { id: "interface", ar: "واجهة الإدارة", en: "Admin interface", fieldsAr: ["اللغة الافتراضية", "الوضع النهاري", "كثافة البطاقات", "المنطقة الافتراضية"], fieldsEn: ["Default language", "Day mode", "Card density", "Default region"] },
  { id: "map", ar: "إعدادات الخريطة", en: "Map defaults", fieldsAr: ["طبقة الخريطة", "الإمارة الافتراضية", "عرض المسار", "تحديث البلاطات"], fieldsEn: ["Map layer", "Default emirate", "Route display", "Tile refresh"] },
  { id: "finance", ar: "المالية والحسابات", en: "Finance & accounts", fieldsAr: ["حد تحذير COD", "تكلفة تشغيل تقديرية", "VAT", "تصدير PDF"], fieldsEn: ["COD warning threshold", "Estimated operating cost", "VAT", "PDF export"] },
] as const;
function norm(value: unknown) { return String(value || "").toLowerCase().replace(/[_-]/g, " "); }
function amountFrom(order: any, keys: string[]) { for (const key of keys) { const value = Number(order?.[key] || 0); if (Number.isFinite(value) && value > 0) return value; } return 0; }
export function orderRegionId(order: any) { const text = `${order?.sender_city || ""} ${order?.pickup_city || ""} ${order?.receiver_city || ""} ${order?.delivery_city || ""} ${order?.destination_country || ""} ${order?.shipping_scope || ""} ${order?.service_type || ""}`.toLowerCase(); return adminMapRegions.find((region) => region.id !== "all" && region.keywords.some((keyword) => text.includes(keyword.toLowerCase())))?.id || "all"; }
export function deriveCommandMetrics(orders: any[], merchants: Merchant[] = [], financeSummary?: FinanceSummary | null) {
  const delivered = orders.filter((order) => /deliver|complete/.test(norm(order.status)));
  const cancelled = orders.filter((order) => /cancel|fail/.test(norm(order.status)));
  const active = orders.filter((order) => !/deliver|complete|cancel|fail|return/.test(norm(order.status)));
  const unassigned = active.filter((order) => !order.driver_id && !order.assigned_driver_id && !order.driver_name);
  const review = orders.filter((order) => /pending|review|confirm/.test(norm(order.status)));
  const returned = orders.filter((order) => /return/.test(norm(order.status)));
  const revenue = orders.reduce((sum, order) => sum + amountFrom(order, ["delivery_price", "price", "service_fee", "total_amount"]), 0);
  const deliveredRevenue = delivered.reduce((sum, order) => sum + amountFrom(order, ["delivery_price", "price", "service_fee", "total_amount"]), 0);
  const codTotal = orders.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0);
  const codPending = financeSummary?.cod_pending ?? active.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0);
  const expenses = Number(financeSummary?.total_expenses || 0);
  const netEstimate = revenue - expenses;
  const averageOrderRevenue = orders.length ? revenue / orders.length : 0;
  const codRatio = revenue > 0 ? (codTotal / revenue) * 100 : 0;
  const regionCounts = adminMapRegions.reduce<Record<string, number>>((acc, region) => ({ ...acc, [region.id]: 0 }), {});
  orders.forEach((order) => { const id = orderRegionId(order); regionCounts[id] = (regionCounts[id] || 0) + 1; });
  const bestRegion = Object.entries(regionCounts).filter(([id]) => id !== "all").sort((a, b) => b[1] - a[1])[0];
  return { orders: orders.length, merchants: merchants.length, active: active.length, delivered: delivered.length, cancelled: cancelled.length, review: review.length, returned: returned.length, unassigned: unassigned.length, revenue, deliveredRevenue, codTotal, codPending, expenses, netEstimate, averageOrderRevenue, codRatio, regionCounts, bestRegionId: bestRegion?.[0] || "all", bestRegionCount: bestRegion?.[1] || 0, breakEvenStatus: netEstimate >= 0 ? "positive" : "warning" };
}
