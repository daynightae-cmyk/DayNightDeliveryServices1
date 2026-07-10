export const adminTranslations = {
  ar: { exportPdf: "تصدير PDF", refresh: "تحديث", search: "بحث", cleanFinanceFallback: "تم حساب الأرقام من الطلبات لأن جداول المالية غير مكتملة." },
  en: { exportPdf: "Export PDF", refresh: "Refresh", search: "Search", cleanFinanceFallback: "Calculated from orders because finance tables are not fully available." },
} as const;
export type AdminLanguage = keyof typeof adminTranslations;

export const adminSectionWorkspaceCopy = {
  ar: {
    filters: "الفلاتر والمدخلات",
    actions: "إجراءات جاهزة",
    currentRows: "الصفوف الحالية",
    empty: "لا توجد بيانات حقيقية مطابقة حالياً.",
    safeFallback: "إذا كان جدول متخصص غير متاح، يتم الاشتقاق بأمان من الطلبات دون عرض أخطاء Supabase الخام.",
  },
  en: {
    filters: "Filters & inputs",
    actions: "Ready actions",
    currentRows: "Current rows",
    empty: "No real matching data right now.",
    safeFallback: "If a specialized table is unavailable, this workspace safely derives from orders without exposing raw Supabase schema errors.",
  },
} as const;
