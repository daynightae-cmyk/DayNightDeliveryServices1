import jsPDF from "jspdf";
import companyMeta from "../data/companyMeta";

export type ArabicQuotePdfRow = [string, string];
export type ArabicQuotePdfSection = { title: string; rows: ArabicQuotePdfRow[] };
export type ArabicQuotePdfInput = {
  fileName: string;
  title: string;
  sections: ArabicQuotePdfSection[];
  totalLabel: string;
  totalValue: string;
  note?: string;
};

export type ArabicDomesticQuoteData = {
  pickupCity: string;
  deliveryCity: string;
  service: string;
  weight: number;
  pieces: number;
  basePrice: number;
  expressCharge: number;
  extraPiecesCharge: number;
  total: number;
};

export type ArabicInternationalQuoteData = {
  destination: string;
  zone: string;
  weight: number;
  firstKgPrice: number;
  additionalKgPrice: number;
  total: number;
};

const FONT_NAME = "NotoNaskhArabicDN";
const FONT_FILE = "NotoNaskhArabicDN.ttf";
const FONT_URL = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notonaskharabic/NotoNaskhArabic%5Bwght%5D.ttf";
const NAVY = [7, 26, 51] as const;
const GOLD = [212, 175, 55] as const;
const GOLD2 = [245, 183, 0] as const;
const WHITE = [255, 255, 255] as const;
const LIGHT = [244, 247, 251] as const;
const TEXT = [7, 26, 51] as const;
const MUTED = [100, 116, 139] as const;

let arabicFontBase64Promise: Promise<string> | null = null;

function arDate() {
  return new Date().toLocaleDateString("ar-AE", { dateStyle: "long" });
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_");
}

function hasArabic(value: string) {
  return /[\u0600-\u06ff]/.test(value);
}

function bufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function getArabicFontBase64() {
  if (!arabicFontBase64Promise) {
    arabicFontBase64Promise = fetch(FONT_URL, { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`Arabic font failed: ${response.status}`);
        return response.arrayBuffer();
      })
      .then(bufferToBase64);
  }
  return arabicFontBase64Promise;
}

async function registerArabicFont(doc: jsPDF) {
  const base64 = await getArabicFontBase64();
  const api = doc as jsPDF & {
    addFileToVFS: (filename: string, filecontent: string) => void;
    addFont: (postScriptName: string, id: string, fontStyle: string) => void;
    setLanguage?: (language: string) => void;
  };
  api.addFileToVFS(FONT_FILE, base64);
  api.addFont(FONT_FILE, FONT_NAME, "normal");
  api.setLanguage?.("ar");
  doc.setFont(FONT_NAME, "normal");
}

function shapeArabic(doc: jsPDF, value: string) {
  const api = doc as jsPDF & { processArabic?: (input: string) => string };
  return hasArabic(value) && typeof api.processArabic === "function" ? api.processArabic(value) : value;
}

function write(doc: jsPDF, value: string, x: number, y: number, options: { size?: number; color?: readonly number[]; align?: "left" | "center" | "right"; weight?: "normal" | "bold" } = {}) {
  const color = options.color || TEXT;
  doc.setFont(FONT_NAME, options.weight === "bold" ? "normal" : "normal");
  doc.setFontSize(options.size || 10);
  doc.setTextColor(color[0], color[1], color[2]);
  doc.text(shapeArabic(doc, String(value || "-")), x, y, { align: options.align || "right" });
}

function sectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(42, y, 511, 28, "F");
  write(doc, title, 538, y + 19, { size: 12, color: GOLD, align: "right", weight: "bold" });
  return y + 44;
}

function row(doc: jsPDF, label: string, value: string, y: number, shade: boolean) {
  if (shade) {
    doc.setFillColor(LIGHT[0], LIGHT[1], LIGHT[2]);
    doc.rect(42, y - 17, 511, 28, "F");
  }
  write(doc, label, 538, y, { size: 10, color: MUTED, align: "right" });
  write(doc, value, 58, y, { size: 10, color: TEXT, align: "left", weight: "bold" });
}

function header(doc: jsPDF, title: string) {
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 0, 595.28, 126, "F");
  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(0, 126, 595.28, 5, "F");
  write(doc, "DAY NIGHT DELIVERY SERVICES", 297.64, 43, { size: 18, color: GOLD, align: "center", weight: "bold" });
  write(doc, "داي نايت لخدمات التوصيل والشحن", 297.64, 72, { size: 15, color: WHITE, align: "center", weight: "bold" });
  write(doc, title, 297.64, 101, { size: 17, color: GOLD2, align: "center", weight: "bold" });
}

function footer(doc: jsPDF) {
  const h = doc.internal.pageSize.getHeight();
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, h - 58, 595.28, 58, "F");
  write(doc, `${companyMeta.displayWebsite} - ${companyMeta.email} - ${companyMeta.phone}`, 297.64, h - 32, { size: 10, color: GOLD, align: "center" });
  write(doc, "DAY NIGHT DELIVERY SERVICES", 297.64, h - 14, { size: 8, color: WHITE, align: "center" });
}

export async function exportArabicQuotePdfImage(input: ArabicQuotePdfInput) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", putOnlyUsedFonts: true, compress: true });
  await registerArabicFont(doc);

  header(doc, input.title);
  let y = 176;
  input.sections.forEach((section) => {
    y = sectionTitle(doc, section.title, y);
    section.rows.forEach(([label, value], index) => {
      row(doc, label, value, y, index % 2 === 0);
      y += 30;
    });
    y += 18;
  });

  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(42, y, 511, 2, "F");
  y += 22;
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(42, y, 511, 44, "F");
  write(doc, input.totalLabel, 538, y + 29, { size: 13, color: WHITE, align: "right", weight: "bold" });
  write(doc, input.totalValue, 58, y + 31, { size: 18, color: GOLD2, align: "left", weight: "bold" });

  if (input.note) {
    write(doc, input.note, 538, y + 74, { size: 10, color: MUTED, align: "right" });
  }

  footer(doc);
  doc.save(safeFileName(input.fileName));
}

export function exportArabicDomesticQuotePdf(data: ArabicDomesticQuoteData) {
  return exportArabicQuotePdfImage({
    fileName: `DayNight_عرض_محلي_${data.pickupCity}_to_${data.deliveryCity}.pdf`,
    title: "عرض سعر التوصيل المحلي",
    sections: [
      { title: "بيانات الطلب المحلي", rows: [["مدينة الاستلام", data.pickupCity], ["مدينة التسليم", data.deliveryCity], ["نوع الخدمة", data.service === "express" ? "سريع" : "قياسي"], ["تاريخ العرض", arDate()]] },
      { title: "تفاصيل السعر", rows: [["رسوم التوصيل", `${data.basePrice.toFixed(2)} AED`], ["رسوم الخدمة السريعة", data.expressCharge > 0 ? `+${data.expressCharge.toFixed(2)} AED` : "غير مضافة"]] },
    ],
    totalLabel: "إجمالي رسوم التوصيل",
    totalValue: `${data.total.toFixed(2)} AED`,
    note: "هذا عرض سعر تقديري تشغيلي من داي نايت لخدمات التوصيل والشحن.",
  });
}

export function exportArabicInternationalQuotePdf(data: ArabicInternationalQuoteData) {
  const addKg = Math.max(0, data.weight - 1);
  return exportArabicQuotePdfImage({
    fileName: `DayNight_عرض_دولي_${data.destination}.pdf`,
    title: "عرض سعر الشحن الدولي",
    sections: [
      { title: "بيانات الشحنة", rows: [["نقطة الانطلاق", "الإمارات - أبوظبي / دبي"], ["الوجهة", data.destination], ["النطاق", data.zone], ["الوزن", `${data.weight} kg`], ["تاريخ العرض", arDate()]] },
      { title: "تفاصيل السعر", rows: [["سعر أول كيلو", `${data.firstKgPrice.toFixed(2)} AED`], ["سعر الكيلو الإضافي", `${data.additionalKgPrice.toFixed(2)} AED/kg`], ["الوزن الإضافي", `${addKg.toFixed(1)} kg × ${data.additionalKgPrice} = ${(addKg * data.additionalKgPrice).toFixed(2)} AED`]] },
    ],
    totalLabel: "إجمالي تكلفة الشحن",
    totalValue: `${data.total.toFixed(2)} AED`,
    note: "السعر تقديري وقد يتغير حسب الأبعاد النهائية ومتطلبات الجمارك.",
  });
}
