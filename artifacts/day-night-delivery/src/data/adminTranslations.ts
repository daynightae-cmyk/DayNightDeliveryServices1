export const adminTranslations = {
  ar: { exportPdf: "تصدير PDF", refresh: "تحديث", search: "بحث", cleanFinanceFallback: "تم حساب الأرقام من الطلبات لأن جداول المالية غير مكتملة." },
  en: { exportPdf: "Export PDF", refresh: "Refresh", search: "Search", cleanFinanceFallback: "Calculated from orders because finance tables are not fully available." },
} as const;
export type AdminLanguage = keyof typeof adminTranslations;
