import jsPDF from "jspdf";

export type ArabicQuotePdfRow = [string, string];

export async function exportArabicQuotePdfImage(fileName: string) {
  const doc = new jsPDF();
  doc.text(fileName, 20, 20);
  doc.save(fileName);
}
