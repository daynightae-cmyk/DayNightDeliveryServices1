import jsPDF from "jspdf";
import companyMeta from "../data/companyMeta";
import { orderInvoiceNumber, printOrderDocument } from "./printableDocuments";

export type ExportLanguage = "ar" | "en";

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

export interface IntlQuoteData {
  destination: string;
  weight: number;
  firstKgPrice: number;
  additionalKgPrice: number;
  total: number;
  zone: string;
}

export interface OrderPDFData {
  trackingCode: string;
  invoiceNumber?: string;
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
  status?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
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

function getExportLanguage(language?: ExportLanguage): ExportLanguage {
  if (language === "ar" || language === "en") return language;
  if (typeof document !== "undefined" && document.documentElement.lang === "ar") return "ar";
  return "en";
}

function today(language: ExportLanguage = getExportLanguage()) {
  return new Date().toLocaleDateString(language === "ar" ? "ar-AE" : "en-AE", { dateStyle: "long" });
}

function savePdf(doc: jsPDF, fileName: string) {
  doc.save(fileName.replace(/[\\/:*?"<>|]/g, "_"));
}

function basicHeader(doc: jsPDF, title: string) {
  doc.setFillColor(7, 26, 51);
  doc.rect(0, 0, 210, 36, "F");
  doc.setTextColor(212, 175, 55);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("DAY NIGHT DELIVERY SERVICES", 105, 13, { align: "center" });
  doc.setFontSize(10);
  doc.text(title, 105, 25, { align: "center" });
}

function footer(doc: jsPDF) {
  doc.setFillColor(7, 26, 51);
  doc.rect(0, 282, 210, 15, "F");
  doc.setTextColor(212, 175, 55);
  doc.setFontSize(7);
  doc.text(`${companyMeta.displayWebsite} | ${companyMeta.email} | ${companyMeta.phone}`, 105, 290, { align: "center" });
}

function line(doc: jsPDF, label: string, value: unknown, y: number) {
  doc.setTextColor(80, 90, 110);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(label, 16, y);
  doc.setTextColor(7, 26, 51);
  doc.setFont("helvetica", "bold");
  doc.text(String(value ?? "—"), 194, y, { align: "right" });
}

export function exportDomesticQuotePDF(data: DomesticQuoteData, language: ExportLanguage = getExportLanguage()) {
  const doc = new jsPDF();
  const title = language === "ar" ? "Local UAE Delivery Quote" : "Local UAE Delivery Quote";
  basicHeader(doc, title);
  let y = 52;
  line(doc, "Pickup City", data.pickupCity, y); y += 9;
  line(doc, "Delivery City", data.deliveryCity, y); y += 9;
  line(doc, "Service", data.service, y); y += 9;
  line(doc, "Quote Date", today(language), y); y += 14;
  doc.setFillColor(7, 26, 51);
  doc.rect(14, y - 6, 182, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text("TOTAL DELIVERY FEE", 18, y + 3);
  doc.setTextColor(212, 175, 55);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(`${data.total.toFixed(2)} AED`, 192, y + 4, { align: "right" });
  footer(doc);
  savePdf(doc, `DayNight_UAE_Quote_${data.pickupCity}_to_${data.deliveryCity}.pdf`);
}

export function exportIntlQuotePDF(data: IntlQuoteData, language: ExportLanguage = getExportLanguage()) {
  const doc = new jsPDF();
  basicHeader(doc, "International Shipping Quote");
  let y = 52;
  const additionalKg = Math.max(0, data.weight - 1);
  line(doc, "Destination", data.destination, y); y += 9;
  line(doc, "Zone", data.zone, y); y += 9;
  line(doc, "Weight", `${data.weight} kg`, y); y += 9;
  line(doc, "First Kg", `${data.firstKgPrice.toFixed(2)} AED`, y); y += 9;
  line(doc, "Additional Kg", `${data.additionalKgPrice.toFixed(2)} AED x ${additionalKg}`, y); y += 14;
  doc.setFillColor(7, 26, 51);
  doc.rect(14, y - 6, 182, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text("TOTAL SHIPPING COST", 18, y + 3);
  doc.setTextColor(212, 175, 55);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(`${data.total.toFixed(2)} AED`, 192, y + 4, { align: "right" });
  footer(doc);
  savePdf(doc, `DayNight_Intl_Quote_${data.destination.replace(/\s+/g, "_")}.pdf`);
}

export function exportOrderPDF(data: OrderPDFData, type: "invoice" | "summary" | "label" = "invoice", language: ExportLanguage = getExportLanguage()) {
  if (language === "ar") {
    printOrderDocument(data, type, language);
    return;
  }

  const title = type === "invoice" ? "Delivery Invoice" : type === "label" ? "Shipping Label" : "Order Summary";
  const invoiceNo = orderInvoiceNumber(data);
  const doc = new jsPDF();
  basicHeader(doc, title);
  let y = 50;
  line(doc, "Invoice Number", invoiceNo, y); y += 9;
  line(doc, "Tracking Number", data.trackingCode, y); y += 9;
  line(doc, "Date", data.createdAt || today(language), y); y += 12;
  line(doc, "Sender", `${data.senderName} | ${data.senderPhone}`, y); y += 9;
  line(doc, "Sender Address", `${data.senderCity} - ${data.senderAddress}`, y); y += 9;
  line(doc, "Receiver", `${data.receiverName} | ${data.receiverPhone}`, y); y += 9;
  line(doc, "Receiver Address", `${data.receiverCity} - ${data.receiverAddress}`, y); y += 9;
  line(doc, "Package", data.packageType, y); y += 9;
  line(doc, "Service", data.serviceType, y); y += 9;
  line(doc, "Payment", data.paymentMethod.replace(/_/g, " "), y); y += 9;
  if (data.codAmount) { line(doc, "COD Amount", `${data.codAmount} AED`, y); y += 9; }
  line(doc, "Notes", data.notes || "—", y); y += 13;
  doc.setFillColor(7, 26, 51);
  doc.rect(14, y - 6, 182, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text("DELIVERY FEE TOTAL", 18, y + 3);
  doc.setTextColor(212, 175, 55);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(`${Number(data.deliveryFee || 0).toFixed(2)} AED`, 192, y + 4, { align: "right" });
  footer(doc);
  savePdf(doc, `DayNight_${title.replace(/\s/g, "_")}_${invoiceNo}.pdf`);
}

export function exportOrderTXT(data: OrderPDFData, language: ExportLanguage = getExportLanguage()) {
  const invoiceNo = orderInvoiceNumber(data);
  const isArabic = language === "ar";
  const lines = isArabic ? [
    "DAY NIGHT DELIVERY SERVICES",
    "داي نايت لخدمات التوصيل والشحن",
    `رقم الفاتورة: ${invoiceNo}`,
    `رقم التتبع: ${data.trackingCode}`,
    `التاريخ: ${data.createdAt || today(language)}`,
    `المرسل: ${data.senderName} | ${data.senderPhone}`,
    `عنوان المرسل: ${data.senderCity} - ${data.senderAddress}`,
    `المستلم: ${data.receiverName} | ${data.receiverPhone}`,
    `عنوان المستلم: ${data.receiverCity} - ${data.receiverAddress}`,
    `الشحنة: ${data.packageType}`,
    `الدفع: ${data.paymentMethod}`,
    `رسوم التوصيل: ${Number(data.deliveryFee || 0).toFixed(2)} AED`,
    data.codAmount ? `مبلغ COD: ${data.codAmount} AED` : "",
    `ملاحظات: ${data.notes || "—"}`,
    `${companyMeta.displayWebsite} | ${companyMeta.email} | ${companyMeta.phone}`,
  ] : [
    "DAY NIGHT DELIVERY SERVICES",
    `Invoice Number: ${invoiceNo}`,
    `Tracking Number: ${data.trackingCode}`,
    `Date: ${data.createdAt || today(language)}`,
    `Sender: ${data.senderName} | ${data.senderPhone}`,
    `Sender Address: ${data.senderCity} - ${data.senderAddress}`,
    `Receiver: ${data.receiverName} | ${data.receiverPhone}`,
    `Receiver Address: ${data.receiverCity} - ${data.receiverAddress}`,
    `Package: ${data.packageType}`,
    `Payment: ${data.paymentMethod}`,
    `Delivery Fee: ${Number(data.deliveryFee || 0).toFixed(2)} AED`,
    data.codAmount ? `COD Amount: ${data.codAmount} AED` : "",
    `Notes: ${data.notes || "—"}`,
    `${companyMeta.displayWebsite} | ${companyMeta.email} | ${companyMeta.phone}`,
  ];
  const blob = new Blob([lines.filter(Boolean).join("\n")], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${isArabic ? "DayNight_فاتورة" : "DayNight_Invoice"}_${invoiceNo}.txt`;
  a.click();
}

export function exportTrackingReportPDF(data: TrackingReportData, language: ExportLanguage = getExportLanguage()) {
  const doc = new jsPDF();
  basicHeader(doc, "Shipment Tracking Report");
  let y = 52;
  line(doc, "Tracking Code", data.trackingCode, y); y += 9;
  line(doc, "Current Status", data.status, y); y += 9;
  if (data.senderName) { line(doc, "Sender", data.senderName, y); y += 9; }
  if (data.receiverName) { line(doc, "Receiver", data.receiverName, y); y += 9; }
  if (data.senderCity && data.receiverCity) { line(doc, "Route", `${data.senderCity} -> ${data.receiverCity}`, y); y += 9; }
  footer(doc);
  savePdf(doc, `DayNight_Tracking_${data.trackingCode}.pdf`);
}

export function exportQuoteTXT(type: "domestic" | "international", data: Record<string, string | number>, language: ExportLanguage = getExportLanguage()) {
  const isArabic = language === "ar";
  const header = isArabic ? `عرض سعر — ${type === "domestic" ? "توصيل محلي داخل الإمارات" : "شحن دولي"}` : `DELIVERY QUOTE — ${type === "domestic" ? "UAE LOCAL" : "INTERNATIONAL"}`;
  const body = Object.entries(data).map(([key, value]) => `${key}: ${value}`);
  const blob = new Blob([["DAY NIGHT DELIVERY SERVICES", header, `Date: ${today(language)}`, "", ...body, "", companyMeta.displayWebsite, companyMeta.email, companyMeta.phone].join("\n")], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `DayNight_${type}_Quote.txt`;
  a.click();
}
