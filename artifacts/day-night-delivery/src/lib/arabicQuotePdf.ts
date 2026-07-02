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

const W = 794;
const H = 1123;
const FONT = "Tajawal, Cairo, Arial, Tahoma, sans-serif";

function arDate() {
  return new Date().toLocaleDateString("ar-AE", { dateStyle: "long" });
}

function write(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, align: CanvasTextAlign, dir: CanvasDirection, color: string, font: string) {
  ctx.save();
  ctx.direction = dir;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.fillText(text || "-", x, y);
  ctx.restore();
}

function drawRow(ctx: CanvasRenderingContext2D, label: string, value: string, y: number, shade: boolean) {
  if (shade) {
    ctx.fillStyle = "#f4f7fb";
    ctx.fillRect(58, y - 26, 678, 40);
  }
  write(ctx, label, 716, y, "right", "rtl", "#64748b", `800 16px ${FONT}`);
  write(ctx, value, 86, y, "left", "rtl", "#071a33", `900 16px ${FONT}`);
}

export async function exportArabicQuotePdfImage(input: ArabicQuotePdfInput) {
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#071a33";
  ctx.fillRect(0, 0, W, 176);
  ctx.fillStyle = "#d4af37";
  ctx.fillRect(0, 176, W, 8);
  write(ctx, "DAY NIGHT DELIVERY SERVICES", W / 2, 60, "center", "ltr", "#d4af37", `900 26px ${FONT}`);
  write(ctx, "داي نايت لخدمات التوصيل والشحن", W / 2, 102, "center", "rtl", "#ffffff", `900 22px ${FONT}`);
  write(ctx, input.title, W / 2, 142, "center", "rtl", "#f5b700", `900 24px ${FONT}`);
  let y = 242;
  input.sections.forEach((section) => {
    ctx.fillStyle = "#071a33";
    ctx.fillRect(58, y, 678, 38);
    write(ctx, section.title, 714, y + 26, "right", "rtl", "#d4af37", `900 17px ${FONT}`);
    y += 58;
    section.rows.forEach(([label, value], index) => {
      drawRow(ctx, label, value, y, index % 2 === 0);
      y += 43;
    });
    y += 28;
  });
  ctx.fillStyle = "#d4af37";
  ctx.fillRect(58, y, 678, 3);
  y += 25;
  ctx.fillStyle = "#071a33";
  ctx.fillRect(58, y, 678, 62);
  write(ctx, input.totalLabel, 714, y + 40, "right", "rtl", "#ffffff", `900 18px ${FONT}`);
  write(ctx, input.totalValue, 86, y + 42, "left", "ltr", "#f5b700", `900 27px ${FONT}`);
  y += 95;
  if (input.note) write(ctx, input.note, 714, y, "right", "rtl", "#64748b", `800 14px ${FONT}`);
  ctx.fillStyle = "#071a33";
  ctx.fillRect(0, H - 82, W, 82);
  write(ctx, `${companyMeta.displayWebsite} - ${companyMeta.email} - ${companyMeta.phone}`, W / 2, H - 45, "center", "ltr", "#d4af37", `800 14px ${FONT}`);
  write(ctx, "Creating by Eng Sadek Elgazar", W / 2, H - 22, "center", "ltr", "#ffffff", `700 12px ${FONT}`);
  const image = canvas.toDataURL("image/png");
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  doc.addImage(image, "PNG", 0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), undefined, "FAST");
  doc.save(input.fileName.split("/").join("_"));
}

export function exportArabicDomesticQuotePdf(data: ArabicDomesticQuoteData) {
  return exportArabicQuotePdfImage({
    fileName: `DayNight_عرض_محلي_${data.pickupCity}_to_${data.deliveryCity}.pdf`,
    title: "عرض سعر التوصيل المحلي",
    sections: [
      { title: "بيانات الشحنة", rows: [["مدينة الاستلام", data.pickupCity], ["مدينة التسليم", data.deliveryCity], ["نوع الخدمة", data.service === "express" ? "سريع" : "قياسي"], ["الوزن", `${data.weight} kg`], ["عدد القطع", String(data.pieces)], ["تاريخ العرض", arDate()]] },
      { title: "تفاصيل السعر", rows: [["رسوم التوصيل الأساسية", `${data.basePrice.toFixed(2)} AED`], ["رسوم الخدمة السريعة", data.expressCharge > 0 ? `+${data.expressCharge.toFixed(2)} AED` : "مشمول"], ["رسوم القطع الإضافية", data.extraPiecesCharge > 0 ? `+${data.extraPiecesCharge.toFixed(2)} AED` : "مشمول"]] },
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
