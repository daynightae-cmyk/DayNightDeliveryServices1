export const adminTranslations = {
  ar: { exportPdf: "تصدير PDF", refresh: "تحديث", search: "بحث", cleanFinanceFallback: "تم حساب الأرقام من الطلبات لأن جداول المالية غير مكتملة." },
  en: { exportPdf: "Export PDF", refresh: "Refresh", search: "Search", cleanFinanceFallback: "Calculated from orders because finance tables are not fully available." },
} as const;
export type AdminLanguage = keyof typeof adminTranslations;

const labels = {
  field: {
    dateRange: ["نطاق التاريخ", "Date range"], serviceType: ["نوع الخدمة", "Service type"], merchant: ["التاجر", "Merchant"], status: ["الحالة", "Status"], period: ["الفترة", "Period"], driver: ["المندوب", "Driver"], emirate: ["الإمارة", "Emirate"], codOnly: ["COD فقط", "COD only"], paymentMethod: ["طريقة الدفع", "Payment method"], category: ["التصنيف", "Category"], amount: ["المبلغ", "Amount"], date: ["التاريخ", "Date"], notes: ["ملاحظات", "Notes"], reference: ["رقم المرجع", "Reference number"], supplier: ["المورد", "Supplier/vendor"], vehicle: ["المركبة", "Vehicle"], settlementStatus: ["حالة التسوية", "Settlement status"], paymentStatus: ["حالة الدفع", "Payment status"], deliveryStatus: ["حالة التوصيل", "Delivery status"], statementStatus: ["حالة الكشف", "Statement status"], language: ["اللغة", "Language"], documentType: ["نوع المستند", "Document type"], includeQr: ["تضمين QR", "Include QR"], includeCod: ["تضمين COD", "Include COD"], branding: ["هوية الشركة", "Company branding"]
  },
  action: {
    exportPdf: ["تصدير PDF", "Export PDF"], focusMap: ["تركيز الخريطة", "Focus map"], assignRegionalDriver: ["تعيين مندوب للمنطقة", "Assign regional driver"], openIncome: ["فتح الدخل", "Open income"], openExpenses: ["فتح المصروفات", "Open expenses"], openCod: ["فتح التحصيل COD", "Open COD"], openStatements: ["فتح الكشوفات", "Open statements"], addExpense: ["إضافة مصروف", "Add expense"], approve: ["اعتماد", "Approve"], void: ["إلغاء", "Void"], createAdjustment: ["إنشاء تسوية", "Create adjustment"], markCollected: ["تعليم كمحصّل", "Mark collected"], markReconciled: ["تعليم كمسوّى", "Mark reconciled"], markDisputed: ["تعليم كمتنازع", "Mark disputed"], printStatement: ["طباعة الكشف", "Print statement"], printSelected: ["طباعة المحدد", "Print selected"], createPrintJob: ["إنشاء مهمة طباعة", "Create print job"], generatePreview: ["إنشاء معاينة", "Generate preview"], commitRows: ["اعتماد الصفوف الصحيحة", "Commit valid rows"], clear: ["مسح", "Clear"], send: ["إرسال", "Send"]
  },
  kpi: {
    driverWorkload: ["عبء المناديب", "Driver workload"], unassignedPickups: ["إحضارات بدون مندوب", "Unassigned pickups"], assignedPickups: ["إحضارات معينة", "Assigned pickups"], pickupQueue: ["طابور الإحضار", "Pickup queue"], grossDeliveryRevenue: ["إجمالي دخل التوصيل", "Gross delivery revenue"], codTotal: ["إجمالي COD", "COD total"], codPending: ["COD معلق", "COD pending"], codCollected: ["COD محصّل", "COD collected"], codReconciled: ["COD مسوّى", "COD reconciled"], merchantPayable: ["مستحقات التجار", "Merchant payable"], driverPayable: ["مستحقات المناديب", "Driver payable"], expensesTotal: ["إجمالي المصروفات", "Expenses total"], adjustmentsNet: ["صافي التسويات", "Adjustments net"], netOperationalEstimate: ["صافي التشغيل التقديري", "Net operational estimate"], averageRevenuePerOrder: ["متوسط دخل الطلب", "Average revenue per order"], averageCodPerOrder: ["متوسط COD للطلب", "Average COD per order"], returnImpact: ["أثر الإرجاع", "Return impact"], cancellationImpact: ["أثر الإلغاء", "Cancellation impact"], breakEvenStatus: ["حالة كسر التعادل", "Break-even status"], cashInHandEstimate: ["النقد المتوقع بالصندوق", "Cash in hand estimate"], bankEstimate: ["تقدير البنك/الحساب", "Bank/account estimate"]
  },
  status: { pending: ["قيد الانتظار", "Pending"], draft: ["مسودة", "Draft"], approved: ["معتمد", "Approved"], void: ["ملغي", "Void"], queued: ["في الطابور", "Queued"], printed: ["تمت الطباعة", "Printed"], failed: ["فشل", "Failed"], collected: ["محصّل", "Collected"], reconciled: ["مسوّى", "Reconciled"], disputed: ["متنازع", "Disputed"], valid: ["صحيح", "Valid"], invalid: ["غير صحيح", "Invalid"] },
  finance: { fuel: ["وقود", "Fuel"], driver: ["مندوب", "Driver"], maintenance: ["صيانة", "Maintenance"], tolls: ["رسوم طرق", "Tolls"], office: ["مكتب", "Office"], software: ["برمجيات", "Software"], marketing: ["تسويق", "Marketing"], rent: ["إيجار", "Rent"], salary: ["رواتب", "Salary"], telecom: ["اتصالات", "Telecom"], bank_fees: ["رسوم بنكية", "Bank fees"], other: ["أخرى", "Other"], cod_correction: ["تصحيح COD", "COD correction"], merchant_correction: ["تصحيح تاجر", "Merchant correction"], driver_deduction: ["خصم مندوب", "Driver deduction"], refund: ["استرداد", "Refund"], payout_correction: ["تصحيح دفعة", "Payout correction"], delivery_fee_correction: ["تصحيح رسوم توصيل", "Delivery fee correction"], manual_finance_adjustment: ["تسوية مالية يدوية", "Manual finance adjustment"], positive: ["موجب", "Positive"], negative: ["سالب", "Negative"] }
} as const;

type LabelGroup = keyof typeof labels;
function getLabel(group: LabelGroup, key: string, isArabic: boolean) { const pair = (labels[group] as Record<string, readonly [string,string]>)[key]; return pair ? pair[isArabic ? 0 : 1] : key; }
export const fieldLabel = (field: string, isArabic: boolean) => getLabel("field", field, isArabic);
export const actionLabel = (action: string, isArabic: boolean) => getLabel("action", action, isArabic);
export const kpiLabel = (kpi: string, isArabic: boolean) => getLabel("kpi", kpi, isArabic);
export const statusLabel = (status: string, isArabic: boolean) => getLabel("status", status, isArabic);
export const financeTypeLabel = (type: string, isArabic: boolean) => getLabel("finance", type, isArabic);

export const adminSectionWorkspaceCopy = {
  ar: { filters: "الفلاتر والمدخلات", actions: "إجراءات جاهزة", currentRows: "الصفوف الحالية", empty: "لا توجد بيانات حقيقية مطابقة حالياً.", safeFallback: "إذا كان جدول متخصص غير متاح، يتم الاشتقاق بأمان من الطلبات دون عرض أخطاء Supabase الخام." },
  en: { filters: "Filters & inputs", actions: "Ready actions", currentRows: "Current rows", empty: "No real matching data right now.", safeFallback: "If a specialized table is unavailable, this workspace safely derives from orders without exposing raw Supabase schema errors." },
} as const;
