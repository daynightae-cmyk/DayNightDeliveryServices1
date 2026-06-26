import jsPDF from "jspdf";
import companyMeta from "../data/companyMeta";

const NAVY = [7, 26, 51] as const;
const GOLD = [212, 175, 55] as const;
const WHITE = [255, 255, 255] as const;
const LGREY = [245, 247, 252] as const;
const DTEXT = [30, 40, 60] as const;
const MUTED = [100, 115, 140] as const;

export type ExportLanguage = "ar" | "en";

type PdfRow = [string, string];

function getExportLanguage(language?: ExportLanguage): ExportLanguage {
  if (language === "ar" || language === "en") return language;
  if (typeof document !== "undefined" && document.documentElement.lang === "ar") return "ar";
  return "en";
}

function processPdfText(doc: jsPDF, value: unknown, language: ExportLanguage): string {
  const raw = String(value ?? "—");
  const maybe = doc as unknown as { processArabic?: (input: string) => string };
  return language === "ar" && typeof maybe.processArabic === "function" ? maybe.processArabic(raw) : raw;
}

function row(doc: jsPDF, label: string, value: string, y: number, shade: boolean, language: ExportLanguage) {
  const rtl = language === "ar";
  if (shade) {
    doc.setFillColor(LGREY[0], LGREY[1], LGREY[2]);
    doc.rect(14, y - 4, 182, 8, "F");
  }
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(processPdfText(doc, label, language), rtl ? 192 : 18, y, { align: rtl ? "right" : "left" });
  doc.setTextColor(DTEXT[0], DTEXT[1], DTEXT[2]);
  doc.setFont("helvetica", "bold");
  doc.text(processPdfText(doc, value, language), rtl ? 18 : 192, y, { align: rtl ? "left" : "right" });
}

function divider(doc: jsPDF, y: number) {
  doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setLineWidth(0.3);
  doc.line(14, y, 196, y);
}

function addHeader(doc: jsPDF, docTitle: string, language: ExportLanguage = getExportLanguage()) {
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 0, 210, 42, "F");
  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(0, 42, 210, 1.5, "F");

  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("DAY NIGHT DELIVERY SERVICES", 105, 13, { align: "center" });

  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(processPdfText(doc, language === "ar" ? "داي نايت لخدمات التوصيل والشحن" : "Dai Nayt lKhadamat al-Tawseel wal-Shahn", language), 105, 20, { align: "center" });
  doc.text(language === "ar" ? processPdfText(doc, "سريع • موثوق • في كل وقت", language) : "Fast  •  Reliable  •  Every Time", 105, 26, { align: "center" });

  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(processPdfText(doc, language === "ar" ? docTitle : docTitle.toUpperCase(), language), 105, 35, { align: "center" });
}

function addFooter(doc: jsPDF, language: ExportLanguage = getExportLanguage()) {
  const h = doc.internal.pageSize.height;
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, h - 20, 210, 20, "F");
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`${companyMeta.displayWebsite}  •  ${companyMeta.email}  •  ${companyMeta.phone}`, 105, h - 10, { align: "center" });
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFontSize(6);
  doc.text(processPdfText(doc, language === "ar" ? "Creating by Eng Sadek Elgazar" : "Creating by Eng Sadek Elgazar", language), 105, h - 4, { align: "center" });
}

function addSection(doc: jsPDF, title: string, y: number, language: ExportLanguage): number {
  const rtl = language === "ar";
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(14, y, 182, 9, "F");
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(processPdfText(doc, title, language), rtl ? 192 : 18, y + 6.5, { align: rtl ? "right" : "left" });
  return y + 14;
}

const now = (language: ExportLanguage = getExportLanguage()) =>
  new Date().toLocaleDateString(language === "ar" ? "ar-AE" : "en-AE", { dateStyle: "long" });

function savePdf(doc: jsPDF, fileName: string) {
  doc.save(fileName.replace(/[\\/:*?"<>|]/g, "_"));
}

export interface DomesticQuoteData {
  pickupCity: string;
  deliveryCity: string;
  service: string;
  weight: number;
  pieces: number;
  basePrice: number;
  expressCharge: number;
  extraPiecesCharge: number;
  total: number;
}

export function exportDomesticQuotePDF(data: DomesticQuoteData, language: ExportLanguage = getExportLanguage()) {
  const doc = new jsPDF();
  const isArabic = language === "ar";
  addHeader(doc, isArabic ? "عرض سعر التوصيل المحلي" : "Local UAE Delivery Quote", language);

  let y = 54;
  y = addSection(doc, isArabic ? "بيانات الشحنة" : "SHIPMENT DETAILS", y, language);
  const rows1: PdfRow[] = isArabic ? [
    ["مدينة الاستلام", data.pickupCity],
    ["مدينة التسليم", data.deliveryCity],
    ["نوع الخدمة", data.service],
    ["الوزن", `${data.weight} kg`],
    ["عدد القطع", String(data.pieces)],
    ["تاريخ العرض", now(language)],
  ] : [
    ["Pickup City", data.pickupCity],
    ["Delivery City", data.deliveryCity],
    ["Service Type", data.service.charAt(0).toUpperCase() + data.service.slice(1)],
    ["Weight (kg)", `${data.weight} kg`],
    ["Number of Pieces", String(data.pieces)],
    ["Quote Date", now(language)],
  ];
  rows1.forEach((r, i) => { row(doc, r[0], r[1], y, i % 2 === 0, language); y += 9; });

  y += 4;
  y = addSection(doc, isArabic ? "تفاصيل السعر" : "PRICE BREAKDOWN", y, language);
  const rows2: PdfRow[] = isArabic ? [
    ["رسوم التوصيل الأساسية", `${data.basePrice.toFixed(2)} AED`],
    ["رسوم الخدمة السريعة", data.expressCharge > 0 ? `+${data.expressCharge.toFixed(2)} AED` : "Included"],
    ["رسوم القطع الإضافية", data.extraPiecesCharge > 0 ? `+${data.extraPiecesCharge.toFixed(2)} AED` : "Included"],
  ] : [
    ["Base Delivery Fee", `${data.basePrice.toFixed(2)} AED`],
    ["Express Surcharge", data.expressCharge > 0 ? `+${data.expressCharge.toFixed(2)} AED` : "Included"],
    ["Extra Pieces", data.extraPiecesCharge > 0 ? `+${data.extraPiecesCharge.toFixed(2)} AED` : "Included"],
  ];
  rows2.forEach((r, i) => { row(doc, r[0], r[1], y, i % 2 === 0, language); y += 9; });

  y += 6;
  divider(doc, y); y += 8;
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(14, y - 4, 182, 12, "F");
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(processPdfText(doc, isArabic ? "إجمالي رسوم التوصيل" : "TOTAL DELIVERY FEE", language), isArabic ? 192 : 18, y + 4, { align: isArabic ? "right" : "left" });
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`${data.total.toFixed(2)} AED`, isArabic ? 18 : 192, y + 5, { align: isArabic ? "left" : "right" });

  addFooter(doc, language);
  savePdf(doc, isArabic ? `DayNight_عرض_محلي_${data.pickupCity}_to_${data.deliveryCity}.pdf` : `DayNight_UAE_Quote_${data.pickupCity}_to_${data.deliveryCity}.pdf`);
}

export interface IntlQuoteData {
  destination: string;
  weight: number;
  firstKgPrice: number;
  additionalKgPrice: number;
  total: number;
  zone: string;
}

export function exportIntlQuotePDF(data: IntlQuoteData, language: ExportLanguage = getExportLanguage()) {
  const doc = new jsPDF();
  const isArabic = language === "ar";
  addHeader(doc, isArabic ? "عرض سعر الشحن الدولي" : "International Shipping Quote", language);

  let y = 54;
  y = addSection(doc, isArabic ? "بيانات الشحنة" : "SHIPMENT DETAILS", y, language);
  const rows1: PdfRow[] = isArabic ? [
    ["نقطة الانطلاق", "UAE - Abu Dhabi / Dubai"],
    ["الوجهة", data.destination],
    ["النطاق", data.zone],
    ["الوزن", `${data.weight} kg`],
    ["تاريخ العرض", now(language)],
  ] : [
    ["Origin", "UAE - Abu Dhabi / Dubai"],
    ["Destination", data.destination],
    ["Zone", data.zone],
    ["Weight (kg)", `${data.weight} kg`],
    ["Quote Date", now(language)],
  ];
  rows1.forEach((r, i) => { row(doc, r[0], r[1], y, i % 2 === 0, language); y += 9; });

  y += 4;
  y = addSection(doc, isArabic ? "تفاصيل السعر" : "PRICE BREAKDOWN", y, language);
  const addKg = Math.max(0, data.weight - 1);
  const rows2: PdfRow[] = isArabic ? [
    ["سعر أول كيلو", `${data.firstKgPrice.toFixed(2)} AED`],
    ["سعر الكيلو الإضافي", `${data.additionalKgPrice.toFixed(2)} AED/kg`],
    ["الوزن الإضافي", `${addKg.toFixed(1)} kg × ${data.additionalKgPrice} = ${(addKg * data.additionalKgPrice).toFixed(2)} AED`],
  ] : [
    ["First Kg Rate", `${data.firstKgPrice.toFixed(2)} AED`],
    ["Additional Kg Rate", `${data.additionalKgPrice.toFixed(2)} AED/kg`],
    ["Additional Weight", `${addKg.toFixed(1)} kg × ${data.additionalKgPrice} = ${(addKg * data.additionalKgPrice).toFixed(2)} AED`],
  ];
  rows2.forEach((r, i) => { row(doc, r[0], r[1], y, i % 2 === 0, language); y += 9; });

  y += 6;
  divider(doc, y); y += 8;
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(14, y - 4, 182, 12, "F");
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(processPdfText(doc, isArabic ? "إجمالي تكلفة الشحن" : "TOTAL SHIPPING COST", language), isArabic ? 192 : 18, y + 4, { align: isArabic ? "right" : "left" });
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`${data.total.toFixed(2)} AED`, isArabic ? 18 : 192, y + 5, { align: isArabic ? "left" : "right" });

  addFooter(doc, language);
  savePdf(doc, isArabic ? `DayNight_عرض_دولي_${data.destination}.pdf` : `DayNight_Intl_Quote_${data.destination.replace(/\s+/g, "_")}.pdf`);
}

export interface OrderPDFData {
  trackingCode: string;
  senderName: string;
  senderPhone: string;
  senderCity: string;
  senderAddress: string;
  receiverName: string;
  receiverPhone: string;
  receiverCity: string;
  receiverAddress: string;
  packageType: string;
  pieces: number;
  weight: number;
  serviceType: string;
  paymentMethod: string;
  codAmount: string;
  deliveryFee: number;
  notes: string;
  createdAt?: string;
}

export function exportOrderPDF(data: OrderPDFData, type: "invoice" | "summary" | "label" = "invoice", language: ExportLanguage = getExportLanguage()) {
  const doc = new jsPDF();
  const isArabic = language === "ar";
  const title = type === "invoice"
    ? (isArabic ? "فاتورة التوصيل" : "Delivery Invoice")
    : type === "label"
      ? (isArabic ? "ملصق الشحنة" : "Shipping Label")
      : (isArabic ? "ملخص الطلب" : "Order Summary");

  addHeader(doc, title, language);
  let y = 54;

  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(14, y, 182, 14, "F");
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(processPdfText(doc, isArabic ? "رقم التتبع:" : "TRACKING NUMBER:", language), isArabic ? 192 : 18, y + 9.5, { align: isArabic ? "right" : "left" });
  doc.setFontSize(14);
  doc.text(data.trackingCode, isArabic ? 18 : 192, y + 9.5, { align: isArabic ? "left" : "right" });
  y += 20;

  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(processPdfText(doc, `${isArabic ? "التاريخ" : "Date"}: ${data.createdAt || now(language)}`, language), isArabic ? 196 : 14, y, { align: isArabic ? "right" : "left" });
  y += 10;

  y = addSection(doc, isArabic ? "بيانات الراسل" : "SENDER DETAILS", y, language);
  const senderRows: PdfRow[] = isArabic ? [
    ["الاسم / المتجر", data.senderName], ["الهاتف", data.senderPhone], ["المدينة", data.senderCity], ["العنوان", data.senderAddress]
  ] : [
    ["Name / Store", data.senderName], ["Phone", data.senderPhone], ["City", data.senderCity], ["Address", data.senderAddress]
  ];
  senderRows.forEach((r, i) => { row(doc, r[0], r[1], y, i % 2 === 0, language); y += 9; });

  y += 4;
  y = addSection(doc, isArabic ? "بيانات المستلم" : "RECEIVER DETAILS", y, language);
  const receiverRows: PdfRow[] = isArabic ? [
    ["الاسم", data.receiverName], ["الهاتف", data.receiverPhone], ["المدينة", data.receiverCity], ["العنوان", data.receiverAddress]
  ] : [
    ["Name", data.receiverName], ["Phone", data.receiverPhone], ["City", data.receiverCity], ["Address", data.receiverAddress]
  ];
  receiverRows.forEach((r, i) => { row(doc, r[0], r[1], y, i % 2 === 0, language); y += 9; });

  y += 4;
  y = addSection(doc, isArabic ? "الشحنة والخدمة" : "PACKAGE & SERVICE", y, language);
  const packageRows: PdfRow[] = isArabic ? [
    ["نوع الشحنة", data.packageType],
    ["عدد القطع", String(data.pieces)],
    ["الوزن", `${data.weight} kg`],
    ["الخدمة", data.serviceType],
    ["طريقة الدفع", data.paymentMethod.replace(/_/g, " ")],
    ...(data.codAmount ? [["مبلغ COD للتحصيل", `${data.codAmount} AED`] as PdfRow] : []),
    ...(data.notes ? [["ملاحظات السائق", data.notes] as PdfRow] : []),
  ] : [
    ["Package Type", data.packageType],
    ["Number of Pieces", String(data.pieces)],
    ["Weight", `${data.weight} kg`],
    ["Service", data.serviceType.charAt(0).toUpperCase() + data.serviceType.slice(1)],
    ["Payment Method", data.paymentMethod.replace(/_/g, " ").toUpperCase()],
    ...(data.codAmount ? [["COD Amount (collect)", `${data.codAmount} AED`] as PdfRow] : []),
    ...(data.notes ? [["Driver Notes", data.notes] as PdfRow] : []),
  ];
  packageRows.forEach((r, i) => { row(doc, r[0], r[1], y, i % 2 === 0, language); y += 9; });

  y += 6;
  divider(doc, y); y += 8;
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(14, y - 4, 182, 12, "F");
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(processPdfText(doc, isArabic ? "إجمالي رسوم التوصيل" : "DELIVERY FEE TOTAL", language), isArabic ? 192 : 18, y + 4, { align: isArabic ? "right" : "left" });
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`${data.deliveryFee.toFixed(2)} AED`, isArabic ? 18 : 192, y + 5, { align: isArabic ? "left" : "right" });

  addFooter(doc, language);
  savePdf(doc, `DayNight_${isArabic ? "ملف_طلب" : title.replace(/\s/g, "_")}_${data.trackingCode}.pdf`);
}

export function exportOrderTXT(data: OrderPDFData, language: ExportLanguage = getExportLanguage()) {
  const isArabic = language === "ar";
  const lines = isArabic ? [
    "====================================================",
    "  DAY NIGHT DELIVERY SERVICES",
    "  داي نايت لخدمات التوصيل والشحن",
    "====================================================",
    "",
    `رقم التتبع: ${data.trackingCode}`,
    `التاريخ: ${data.createdAt || now(language)}`,
    "",
    "─── الراسل ─────────────────────────────────────────",
    `الاسم / المتجر : ${data.senderName}`,
    `الهاتف         : ${data.senderPhone}`,
    `المدينة        : ${data.senderCity}`,
    `العنوان        : ${data.senderAddress}`,
    "",
    "─── المستلم ────────────────────────────────────────",
    `الاسم          : ${data.receiverName}`,
    `الهاتف         : ${data.receiverPhone}`,
    `المدينة        : ${data.receiverCity}`,
    `العنوان        : ${data.receiverAddress}`,
    "",
    "─── الشحنة والخدمة ─────────────────────────────────",
    `النوع          : ${data.packageType}`,
    `عدد القطع      : ${data.pieces}`,
    `الوزن          : ${data.weight} kg`,
    `الخدمة         : ${data.serviceType}`,
    `الدفع          : ${data.paymentMethod}`,
    ...(data.codAmount ? [`مبلغ COD      : ${data.codAmount} AED`] : []),
    ...(data.notes ? [`ملاحظات        : ${data.notes}`] : []),
    "",
    "─── التكلفة ────────────────────────────────────────",
    `رسوم التوصيل   : ${data.deliveryFee.toFixed(2)} AED`,
    "مبلغ COD منفصل ويتم تحصيله من المستلم.",
    "",
    "====================================================",
    `${companyMeta.displayWebsite}`,
    `${companyMeta.email}  |  ${companyMeta.phone}`,
    "Creating by Eng Sadek Elgazar",
    "====================================================",
  ] : [
    "====================================================",
    "  DAY NIGHT DELIVERY SERVICES",
    "  Fast • Reliable • Every Time",
    "====================================================",
    "",
    `TRACKING NUMBER: ${data.trackingCode}`,
    `Date: ${data.createdAt || now(language)}`,
    "",
    "─── SENDER ──────────────────────────────────────────",
    `Name / Store : ${data.senderName}`,
    `Phone        : ${data.senderPhone}`,
    `City         : ${data.senderCity}`,
    `Address      : ${data.senderAddress}`,
    "",
    "─── RECEIVER ────────────────────────────────────────",
    `Name         : ${data.receiverName}`,
    `Phone        : ${data.receiverPhone}`,
    `City         : ${data.receiverCity}`,
    `Address      : ${data.receiverAddress}`,
    "",
    "─── PACKAGE & SERVICE ───────────────────────────────",
    `Type         : ${data.packageType}`,
    `Pieces       : ${data.pieces}`,
    `Weight       : ${data.weight} kg`,
    `Service      : ${data.serviceType}`,
    `Payment      : ${data.paymentMethod}`,
    ...(data.codAmount ? [`COD Amount   : ${data.codAmount} AED`] : []),
    ...(data.notes ? [`Notes        : ${data.notes}`] : []),
    "",
    "─── COST ────────────────────────────────────────────",
    `Delivery Fee : ${data.deliveryFee.toFixed(2)} AED`,
    "(COD amount is separate and collected from receiver)",
    "",
    "====================================================",
    `${companyMeta.displayWebsite}`,
    `${companyMeta.email}  |  ${companyMeta.phone}`,
    "Creating by Eng Sadek Elgazar",
    "====================================================",
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${isArabic ? "DayNight_طلب" : "DayNight_Order"}_${data.trackingCode}.txt`;
  a.click();
}

export interface TrackingReportData {
  trackingCode: string;
  status: string;
  senderName?: string;
  receiverName?: string;
  senderCity?: string;
  receiverCity?: string;
  timeline?: Array<{ status: string; timestamp: string; note?: string }>;
}

export function exportTrackingReportPDF(data: TrackingReportData, language: ExportLanguage = getExportLanguage()) {
  const doc = new jsPDF();
  const isArabic = language === "ar";
  addHeader(doc, isArabic ? "تقرير تتبع الشحنة" : "Shipment Tracking Report", language);

  let y = 54;
  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(14, y, 182, 14, "F");
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(processPdfText(doc, isArabic ? "رقم التتبع:" : "TRACKING CODE:", language), isArabic ? 192 : 18, y + 9.5, { align: isArabic ? "right" : "left" });
  doc.text(data.trackingCode, isArabic ? 18 : 192, y + 9.5, { align: isArabic ? "left" : "right" });
  y += 20;

  y = addSection(doc, isArabic ? "معلومات الشحنة" : "SHIPMENT INFORMATION", y, language);
  const infoRows: PdfRow[] = isArabic ? [
    ["الحالة الحالية", data.status],
    ["تاريخ التقرير", now(language)],
    ...(data.senderName ? [["الراسل", data.senderName] as PdfRow] : []),
    ...(data.receiverName ? [["المستلم", data.receiverName] as PdfRow] : []),
    ...(data.senderCity && data.receiverCity ? [["المسار", `${data.senderCity} → ${data.receiverCity}`] as PdfRow] : []),
  ] : [
    ["Current Status", data.status],
    ["Report Date", now(language)],
    ...(data.senderName ? [["Sender", data.senderName] as PdfRow] : []),
    ...(data.receiverName ? [["Receiver", data.receiverName] as PdfRow] : []),
    ...(data.senderCity && data.receiverCity ? [["Route", `${data.senderCity} → ${data.receiverCity}`] as PdfRow] : []),
  ];
  infoRows.forEach((r, i) => { row(doc, r[0], r[1], y, i % 2 === 0, language); y += 9; });

  if (data.timeline && data.timeline.length > 0) {
    y += 4;
    y = addSection(doc, isArabic ? "سجل التتبع" : "TRACKING TIMELINE", y, language);
    data.timeline.forEach((event, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(LGREY[0], LGREY[1], LGREY[2]);
        doc.rect(14, y - 4, 182, 8, "F");
      }
      doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(processPdfText(doc, event.status, language), isArabic ? 192 : 18, y, { align: isArabic ? "right" : "left" });
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.setFont("helvetica", "normal");
      doc.text(event.timestamp, isArabic ? 18 : 192, y, { align: isArabic ? "left" : "right" });
      y += 9;
    });
  }

  addFooter(doc, language);
  savePdf(doc, `${isArabic ? "DayNight_تتبع" : "DayNight_Tracking"}_${data.trackingCode}.pdf`);
}

export function exportQuoteTXT(type: "domestic" | "international", data: Record<string, string | number>, language: ExportLanguage = getExportLanguage()) {
  const isArabic = language === "ar";
  const header = isArabic ? [
    "====================================================",
    "  DAY NIGHT DELIVERY SERVICES",
    "  daynightae.com  |  +971 56 875 7331",
    "====================================================",
    "",
    `عرض سعر — ${type === "domestic" ? "توصيل محلي داخل الإمارات" : "شحن دولي"}`,
    `التاريخ: ${now(language)}`,
    "",
  ] : [
    "====================================================",
    "  DAY NIGHT DELIVERY SERVICES",
    "  daynightae.com  |  +971 56 875 7331",
    "====================================================",
    "",
    `DELIVERY QUOTE — ${type === "domestic" ? "UAE LOCAL" : "INTERNATIONAL"}`,
    `Date: ${now(language)}`,
    "",
  ];
  const body = Object.entries(data).map(([k, v]) => `${k.padEnd(26)}: ${v}`);
  const footer = isArabic ? [
    "",
    "====================================================",
    "* الأسعار نهائية. مبلغ COD منفصل ويتم تحصيله من المستلم.",
    "Creating by Eng Sadek Elgazar",
    "====================================================",
  ] : [
    "",
    "====================================================",
    "* Prices are final. COD collected separately.",
    "Creating by Eng Sadek Elgazar",
    "====================================================",
  ];
  const blob = new Blob([[...header, ...body, ...footer].join("\n")], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `DayNight_${type}_Quote.txt`;
  a.click();
}
