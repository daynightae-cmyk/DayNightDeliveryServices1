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

export async function exportArabicQuotePdfImage(input: ArabicQuotePdfInput) {
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 100;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.fillText(input.title + companyMeta.displayWebsite, 10, 40);
  const image = canvas.toDataURL("image/png");
  const doc = new jsPDF();
  doc.addImage(image, "PNG", 10, 10, 80, 80);
  doc.save(input.fileName);
}
