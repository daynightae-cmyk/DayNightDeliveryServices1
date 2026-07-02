import jsPDF from "jspdf";

export type ArabicQuotePdfRow = [string, string];

export async function exportArabicQuotePdfImage(fileName: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 100;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.fillText("اختبار عربي", 10, 40);
  const doc = new jsPDF();
  doc.text(fileName, 20, 20);
  doc.save(fileName);
}
