import jsPDF from "jspdf";

export type AdminPdfLanguage = "ar" | "en";
export type AdminPdfColumn = { key: string; label: string };
export type AdminPdfPayload = {
  language: AdminPdfLanguage;
  sectionTitle: string;
  filters?: string;
  totals?: Record<string, string | number>;
  columns: AdminPdfColumn[];
  rows: Record<string, unknown>[];
};

const secretPattern = /(key|token|secret|password|authorization|supabase|anon|service_role)/i;

function clean(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const text = String(value);
  return secretPattern.test(text) ? "[redacted]" : text.slice(0, 120);
}

export function buildAdminPdf(payload: AdminPdfPayload) {
  const isArabic = payload.language === "ar";
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const margin = 34;
  doc.setProperties({ title: `DAY NIGHT - ${payload.sectionTitle}`, subject: "Admin export" });
  doc.setFillColor(3, 12, 27);
  doc.rect(0, 0, width, 88, "F");
  doc.setTextColor(212, 175, 55);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("DAY NIGHT", isArabic ? width - margin : margin, 34, { align: isArabic ? "right" : "left" });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text(payload.sectionTitle, isArabic ? width - margin : margin, 58, { align: isArabic ? "right" : "left" });
  doc.setFontSize(9);
  doc.text(new Date().toLocaleString(isArabic ? "ar-AE" : "en-AE"), isArabic ? margin : width - margin, 34, { align: isArabic ? "left" : "right" });
  doc.text(payload.filters || (isArabic ? "بدون فلاتر" : "No filters"), isArabic ? margin : width - margin, 56, { align: isArabic ? "left" : "right" });

  let y = 112;
  doc.setTextColor(3, 12, 27);
  doc.setFontSize(10);
  const totals = Object.entries(payload.totals || {});
  if (totals.length) {
    const text = totals.map(([k, v]) => `${k}: ${clean(v)}`).join("   |   ");
    doc.text(text, isArabic ? width - margin : margin, y, { align: isArabic ? "right" : "left" });
    y += 24;
  }

  const columns = payload.columns.filter((column) => !secretPattern.test(column.key));
  const colWidth = (width - margin * 2) / Math.max(columns.length, 1);
  doc.setFillColor(212, 175, 55);
  doc.rect(margin, y, width - margin * 2, 24, "F");
  doc.setTextColor(3, 12, 27);
  doc.setFont("helvetica", "bold");
  columns.forEach((column, i) => doc.text(column.label, margin + i * colWidth + 6, y + 16, { maxWidth: colWidth - 8 }));
  y += 28;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  payload.rows.slice(0, 120).forEach((row, rowIndex) => {
    if (y > 550) { doc.addPage(); y = 44; }
    if (rowIndex % 2 === 0) { doc.setFillColor(245, 247, 250); doc.rect(margin, y - 12, width - margin * 2, 22, "F"); }
    columns.forEach((column, i) => doc.text(clean(row[column.key]), margin + i * colWidth + 6, y + 2, { maxWidth: colWidth - 8 }));
    y += 22;
  });
  doc.save(`DAY_NIGHT_${payload.sectionTitle.replace(/\s+/g, "_")}_${Date.now()}.pdf`);
}
