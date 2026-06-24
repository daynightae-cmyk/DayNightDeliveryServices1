import jsPDF from "jspdf";
import companyMeta from "../data/companyMeta";

const NAVY   = [7, 26, 51]    as const;
const GOLD   = [212, 175, 55] as const;
const WHITE  = [255, 255, 255] as const;
const LGREY  = [245, 247, 252] as const;
const DTEXT  = [30, 40, 60]   as const;
const MUTED  = [100, 115, 140] as const;

/* ── helpers ── */
function hex(r: number, g: number, b: number) { return `rgb(${r},${g},${b})`; }

function row(doc: jsPDF, label: string, value: string, y: number, shade: boolean) {
  if (shade) {
    doc.setFillColor(LGREY[0], LGREY[1], LGREY[2]);
    doc.rect(14, y - 4, 182, 8, "F");
  }
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(label, 18, y);
  doc.setTextColor(DTEXT[0], DTEXT[1], DTEXT[2]);
  doc.setFont("helvetica", "bold");
  doc.text(value, 120, y, { align: "right" });
}

function divider(doc: jsPDF, y: number) {
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.3);
  doc.line(14, y, 196, y);
}

function addHeader(doc: jsPDF, docTitle: string) {
  /* Navy bar */
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 0, 210, 42, "F");
  /* Gold accent line */
  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(0, 42, 210, 1.5, "F");

  /* Company name */
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("DAY NIGHT DELIVERY SERVICES", 105, 13, { align: "center" });

  /* Arabic tagline (transliterated, since default font is latin-only) */
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Dai Nayt lKhadamat al-Tawseel wal-Shahn", 105, 20, { align: "center" });
  doc.text("Fast  \u2022  Reliable  \u2022  Every Time", 105, 26, { align: "center" });

  /* Document title in gold */
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(docTitle.toUpperCase(), 105, 35, { align: "center" });
}

function addFooter(doc: jsPDF) {
  const h = doc.internal.pageSize.height;
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, h - 18, 210, 18, "F");
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${companyMeta.displayWebsite}  \u2022  ${companyMeta.email}  \u2022  ${companyMeta.phone}`,
    105, h - 6, { align: "center" }
  );
}

function addSection(doc: jsPDF, title: string, y: number): number {
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(14, y, 182, 9, "F");
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(title, 18, y + 6.5);
  return y + 14;
}

const now = () => new Date().toLocaleDateString("en-AE", { dateStyle: "long" });

/* ═══════════════════════════════════════════════
   1. DOMESTIC PRICE QUOTE PDF
   ═══════════════════════════════════════════════ */
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

export function exportDomesticQuotePDF(data: DomesticQuoteData) {
  const doc = new jsPDF();
  addHeader(doc, "Local UAE Delivery Quote");

  let y = 54;

  y = addSection(doc, "SHIPMENT DETAILS", y);
  const rows1 = [
    ["Pickup City", data.pickupCity],
    ["Delivery City", data.deliveryCity],
    ["Service Type", data.service.charAt(0).toUpperCase() + data.service.slice(1)],
    ["Weight (kg)", data.weight.toString() + " kg"],
    ["Number of Pieces", data.pieces.toString()],
    ["Quote Date", now()],
  ];
  rows1.forEach((r, i) => { row(doc, r[0], r[1], y, i % 2 === 0); y += 9; });

  y += 4;
  y = addSection(doc, "PRICE BREAKDOWN", y);

  const rows2 = [
    ["Base Delivery Fee", `${data.basePrice.toFixed(2)} AED`],
    ["Express Surcharge", data.expressCharge > 0 ? `+${data.expressCharge.toFixed(2)} AED` : "Included"],
    ["Extra Pieces", data.extraPiecesCharge > 0 ? `+${data.extraPiecesCharge.toFixed(2)} AED` : "Included"],
  ];
  rows2.forEach((r, i) => { row(doc, r[0], r[1], y, i % 2 === 0); y += 9; });

  y += 6;
  divider(doc, y); y += 8;
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(14, y - 4, 182, 12, "F");
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("TOTAL DELIVERY FEE", 18, y + 4);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`${data.total.toFixed(2)} AED`, 192, y + 5, { align: "right" });
  y += 20;

  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.text("* COD amount is separate from delivery fee. Prices are final and include no hidden charges.", 18, y);

  addFooter(doc);
  doc.save(`DayNight_UAE_Quote_${data.pickupCity}_to_${data.deliveryCity}.pdf`);
}

/* ═══════════════════════════════════════════════
   2. INTERNATIONAL PRICE QUOTE PDF
   ═══════════════════════════════════════════════ */
export interface IntlQuoteData {
  destination: string;
  weight: number;
  firstKgPrice: number;
  additionalKgPrice: number;
  total: number;
  zone: string;
}

export function exportIntlQuotePDF(data: IntlQuoteData) {
  const doc = new jsPDF();
  addHeader(doc, "International Shipping Quote");

  let y = 54;

  y = addSection(doc, "SHIPMENT DETAILS", y);
  const rows1 = [
    ["Origin", "UAE - Abu Dhabi / Dubai"],
    ["Destination", data.destination],
    ["Zone", data.zone],
    ["Weight (kg)", data.weight.toString() + " kg"],
    ["Quote Date", now()],
  ];
  rows1.forEach((r, i) => { row(doc, r[0], r[1], y, i % 2 === 0); y += 9; });

  y += 4;
  y = addSection(doc, "PRICE BREAKDOWN", y);
  const addKg = Math.max(0, data.weight - 1);
  const rows2 = [
    ["First Kg Rate", `${data.firstKgPrice.toFixed(2)} AED`],
    ["Additional Kg Rate", `${data.additionalKgPrice.toFixed(2)} AED/kg`],
    ["Additional Weight", `${addKg.toFixed(1)} kg × ${data.additionalKgPrice} = ${(addKg * data.additionalKgPrice).toFixed(2)} AED`],
  ];
  rows2.forEach((r, i) => { row(doc, r[0], r[1], y, i % 2 === 0); y += 9; });

  y += 6;
  divider(doc, y); y += 8;
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(14, y - 4, 182, 12, "F");
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("TOTAL SHIPPING COST", 18, y + 4);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`${data.total.toFixed(2)} AED`, 192, y + 5, { align: "right" });
  y += 20;

  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.text("* Transit time: GCC 2-5 business days, Worldwide 5-15 business days. Rates exclude customs duties.", 18, y);

  addFooter(doc);
  doc.save(`DayNight_Intl_Quote_${data.destination.replace(/\s+/g, "_")}.pdf`);
}

/* ═══════════════════════════════════════════════
   3. ORDER SUMMARY / INVOICE PDF
   ═══════════════════════════════════════════════ */
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

export function exportOrderPDF(data: OrderPDFData, type: "invoice" | "summary" | "label" = "invoice") {
  const doc = new jsPDF();
  const title = type === "invoice" ? "Delivery Invoice" : type === "label" ? "Shipping Label" : "Order Summary";
  addHeader(doc, title);

  let y = 54;

  /* Tracking number — prominent */
  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(14, y, 182, 14, "F");
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TRACKING NUMBER:", 18, y + 9.5);
  doc.setFontSize(14);
  doc.text(data.trackingCode, 192, y + 9.5, { align: "right" });
  y += 20;

  /* Date */
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Date: ${data.createdAt || now()}`, 14, y);
  y += 10;

  y = addSection(doc, "SENDER DETAILS", y);
  [
    ["Name / Store", data.senderName],
    ["Phone", data.senderPhone],
    ["City", data.senderCity],
    ["Address", data.senderAddress],
  ].forEach((r, i) => { row(doc, r[0], r[1], y, i % 2 === 0); y += 9; });

  y += 4;
  y = addSection(doc, "RECEIVER DETAILS", y);
  [
    ["Name", data.receiverName],
    ["Phone", data.receiverPhone],
    ["City", data.receiverCity],
    ["Address", data.receiverAddress],
  ].forEach((r, i) => { row(doc, r[0], r[1], y, i % 2 === 0); y += 9; });

  y += 4;
  y = addSection(doc, "PACKAGE & SERVICE", y);
  [
    ["Package Type", data.packageType],
    ["Number of Pieces", data.pieces.toString()],
    ["Weight", data.weight.toString() + " kg"],
    ["Service", data.serviceType.charAt(0).toUpperCase() + data.serviceType.slice(1)],
    ["Payment Method", data.paymentMethod.replace(/_/g, " ").toUpperCase()],
    ...(data.codAmount ? [["COD Amount (collect)", `${data.codAmount} AED`]] : []),
    ...(data.notes ? [["Driver Notes", data.notes]] : []),
  ].forEach((r, i) => { row(doc, r[0], r[1], y, i % 2 === 0); y += 9; });

  y += 6;
  divider(doc, y); y += 8;
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(14, y - 4, 182, 12, "F");
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("DELIVERY FEE TOTAL", 18, y + 4);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`${data.deliveryFee.toFixed(2)} AED`, 192, y + 5, { align: "right" });

  addFooter(doc);
  doc.save(`DayNight_${title.replace(/\s/g, "_")}_${data.trackingCode}.pdf`);
}

/* ═══════════════════════════════════════════════
   4. ORDER SUMMARY TXT
   ═══════════════════════════════════════════════ */
export function exportOrderTXT(data: OrderPDFData) {
  const lines = [
    "====================================================",
    "  DAY NIGHT DELIVERY SERVICES",
    "  داي نايت لخدمات التوصيل والشحن",
    "  Fast • Reliable • Every Time",
    "====================================================",
    "",
    `TRACKING NUMBER: ${data.trackingCode}`,
    `Date: ${data.createdAt || now()}`,
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
    "====================================================",
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `DayNight_Order_${data.trackingCode}.txt`;
  a.click();
}

/* ═══════════════════════════════════════════════
   5. TRACKING REPORT PDF
   ═══════════════════════════════════════════════ */
export interface TrackingReportData {
  trackingCode: string;
  status: string;
  senderName?: string;
  receiverName?: string;
  senderCity?: string;
  receiverCity?: string;
  timeline?: Array<{ status: string; timestamp: string; note?: string }>;
}

export function exportTrackingReportPDF(data: TrackingReportData) {
  const doc = new jsPDF();
  addHeader(doc, "Shipment Tracking Report");

  let y = 54;

  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(14, y, 182, 14, "F");
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TRACKING CODE:", 18, y + 9.5);
  doc.text(data.trackingCode, 192, y + 9.5, { align: "right" });
  y += 20;

  y = addSection(doc, "SHIPMENT INFORMATION", y);
  [
    ["Current Status", data.status],
    ["Report Date", now()],
    ...(data.senderName ? [["Sender", data.senderName]] : []),
    ...(data.receiverName ? [["Receiver", data.receiverName]] : []),
    ...(data.senderCity && data.receiverCity ? [["Route", `${data.senderCity} → ${data.receiverCity}`]] : []),
  ].forEach((r, i) => { row(doc, r[0], r[1], y, i % 2 === 0); y += 9; });

  if (data.timeline && data.timeline.length > 0) {
    y += 4;
    y = addSection(doc, "TRACKING TIMELINE", y);
    data.timeline.forEach((event, i) => {
      const shade = i % 2 === 0;
      if (shade) {
        doc.setFillColor(LGREY[0], LGREY[1], LGREY[2]);
        doc.rect(14, y - 4, 182, 8, "F");
      }
      doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(event.status, 18, y);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.setFont("helvetica", "normal");
      doc.text(event.timestamp, 192, y, { align: "right" });
      y += 9;
    });
  }

  y += 10;
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.text("For support: contact WhatsApp with your tracking code.", 18, y);
  doc.text(companyMeta.phone, 18, y + 5);

  addFooter(doc);
  doc.save(`DayNight_Tracking_${data.trackingCode}.pdf`);
}

/* ═══════════════════════════════════════════════
   6. QUOTE TXT (Pricing page)
   ═══════════════════════════════════════════════ */
export function exportQuoteTXT(type: "domestic" | "international", data: Record<string, string | number>) {
  const header = [
    "====================================================",
    "  DAY NIGHT DELIVERY SERVICES",
    "  daynightae.com  |  +971 56 875 7331",
    "====================================================",
    "",
    `DELIVERY QUOTE — ${type === "domestic" ? "UAE LOCAL" : "INTERNATIONAL"}`,
    `Date: ${now()}`,
    "",
  ];
  const body = Object.entries(data).map(([k, v]) => `${k.padEnd(26)}: ${v}`);
  const footer = [
    "",
    "====================================================",
    "* Prices are final. COD collected separately.",
    "====================================================",
  ];
  const blob = new Blob([[...header, ...body, ...footer].join("\n")], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `DayNight_${type}_Quote.txt`;
  a.click();
}
