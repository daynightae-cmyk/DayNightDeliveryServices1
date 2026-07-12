import { jsPDF } from "jspdf";

export type AdminPdfLanguage = "ar" | "en";
export type AdminPdfColumn = { key: string; label: string };
export type AdminPdfPayload = {
  language: AdminPdfLanguage;
  sectionTitle: string;
  filters?: string;
  totals?: Record<string, string | number>;
  columns: AdminPdfColumn[];
  rows: Record<string, unknown>[];
  orientation?: "portrait" | "landscape";
  includeSummary?: boolean;
  includeFilters?: boolean;
};

const secretPattern = /(key|token|secret|password|authorization|supabase|anon|service_role)/i;
const ltrPattern = /(id|tracking|phone|email|url|amount|cod|aed|number|code|date|invoice|reference)/i;
const pageFont = "Tahoma, Arial, 'Noto Sans Arabic', 'Segoe UI', sans-serif";

function clean(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const text = String(value);
  return secretPattern.test(text) ? "[redacted]" : text.slice(0, 180);
}

function html(value: unknown) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function visibleColumns(payload: AdminPdfPayload) {
  return payload.columns.filter((column) => !secretPattern.test(column.key));
}

function safeRows(payload: AdminPdfPayload) {
  return payload.rows.slice(0, 500);
}

function reportOrientation(payload: AdminPdfPayload) {
  return payload.orientation || (visibleColumns(payload).length > 5 ? "landscape" : "portrait");
}

function safeFileStem(payload: AdminPdfPayload) {
  const title = clean(payload.sectionTitle)
    .replace(/[\\/:*?\"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 70) || "admin_report";
  return `DAY_NIGHT_${title}_${new Date().toISOString().slice(0, 10)}_${Date.now()}`;
}

function downloadBlob(blob: Blob, filename: string) {
  if (typeof document === "undefined" || typeof URL === "undefined") return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function buildReportHtml(payload: AdminPdfPayload) {
  const isArabic = payload.language === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const lang = isArabic ? "ar" : "en";
  const title = html(payload.sectionTitle);
  const columns = visibleColumns(payload);
  const rows = safeRows(payload);
  const totals = Object.entries(payload.totals || {});
  const orientation = reportOrientation(payload);
  const generatedAt = new Date().toLocaleString(isArabic ? "ar-AE" : "en-AE");
  const showSummary = payload.includeSummary !== false;
  const showFilters = payload.includeFilters !== false;

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DAY NIGHT - ${title}</title>
  <style>
    @page { size: A4 ${orientation}; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #0b172a; font-family: Tahoma, Arial, "Noto Sans Arabic", "Segoe UI", sans-serif; direction: ${dir}; unicode-bidi: plaintext; }
    .dn-report { width: 100%; }
    .dn-report-header { background: #03101f; color: #fff; border-radius: 18px; padding: 18px 22px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 5px solid #d4af37; }
    .brand strong { display: block; color: #d4af37; font-size: 24px; letter-spacing: .05em; }
    .brand span { display: block; font-size: 12px; opacity: .86; margin-top: 4px; }
    .meta { text-align: ${isArabic ? "left" : "right"}; font-size: 11px; line-height: 1.8; opacity: .9; }
    h1 { margin: 22px 0 8px; font-size: 22px; color: #03101f; }
    .subtitle { margin: 0 0 16px; color: #475569; font-size: 12px; }
    .filters, .totals { border: 1px solid #d8dee8; border-radius: 14px; padding: 12px; margin: 12px 0; background: #f8fafc; font-size: 12px; }
    .totals { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
    .total-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; }
    .total-card b { display: block; color: #926f00; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; table-layout: fixed; }
    th { background: #d4af37; color: #03101f; font-size: 11px; padding: 9px 7px; text-align: start; border: 1px solid #c49f25; }
    td { font-size: 10px; padding: 8px 7px; border: 1px solid #e2e8f0; vertical-align: top; word-break: break-word; }
    tr:nth-child(even) td { background: #f8fafc; }
    .empty { padding: 28px; text-align: center; border: 1px dashed #cbd5e1; border-radius: 14px; color: #64748b; }
    footer { margin-top: 18px; padding-top: 10px; border-top: 2px solid #d4af37; color: #475569; font-size: 10px; display: flex; justify-content: space-between; gap: 12px; }
  </style>
</head>
<body>
  <main class="dn-report">
    <section class="dn-report-header"><div class="brand"><strong>DAY NIGHT</strong><span>${isArabic ? "داي نايت لخدمات التوصيل والشحن" : "DAY NIGHT DELIVERY SERVICES"}</span></div><div class="meta"><div>${isArabic ? "تاريخ الملف" : "File date"}: ${html(generatedAt)}</div><div>${isArabic ? "اللغة" : "Language"}: ${isArabic ? "العربية" : "English"}</div></div></section>
    <h1>${title}</h1>
    <p class="subtitle">${isArabic ? "ملف إداري صادر من لوحة تحكم DAY NIGHT" : "Administrative file from DAY NIGHT Admin Dashboard"}</p>
    ${showFilters ? `<section class="filters"><b>${isArabic ? "الفلاتر / البحث" : "Filters / Search"}</b><br />${html(payload.filters || (isArabic ? "بدون فلاتر" : "No filters"))}</section>` : ""}
    ${showSummary && totals.length ? `<section class="totals">${totals.map(([key, value]) => `<article class="total-card"><b>${html(key)}</b><span>${html(value)}</span></article>`).join("")}</section>` : ""}
    ${rows.length ? `<table><thead><tr>${columns.map((column) => `<th>${html(column.label)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((column) => `<td>${html(row[column.key])}</td>`).join("")}</tr>`).join("")}</tbody></table>` : `<div class="empty">${isArabic ? "لا توجد بيانات في هذا التقرير." : "No data in this report."}</div>`}
    <footer><span>${isArabic ? "تم إنشاء الملف تلقائياً من نظام DAY NIGHT التشغيلي." : "Generated automatically from the DAY NIGHT operations system."}</span><span>DAY NIGHT</span></footer>
  </main>
</body>
</html>`;
}

function csvValue(value: unknown) {
  const text = clean(value).replace(/\r?\n/g, " ");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildAdminCsv(payload: AdminPdfPayload) {
  const columns = visibleColumns(payload);
  const header = columns.map((column) => csvValue(column.label)).join(",");
  const rows = safeRows(payload).map((row) => columns.map((column) => csvValue(row[column.key])).join(","));
  const csv = `\uFEFF${[header, ...rows].join("\r\n")}`;
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${safeFileStem(payload)}.csv`);
}

export function buildAdminDoc(payload: AdminPdfPayload) {
  const docHtml = buildReportHtml(payload).replace("<!doctype html>", "").replace("<html", "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'");
  downloadBlob(new Blob(["\uFEFF", docHtml], { type: "application/msword;charset=utf-8" }), `${safeFileStem(payload)}.doc`);
}

function rowsPerPage(payload: AdminPdfPayload, firstPage: boolean, pageHeight: number) {
  const columns = visibleColumns(payload).length || 1;
  const rowHeight = columns > 7 ? 34 : columns > 5 ? 32 : 30;
  const startY = firstPage ? 292 : 180;
  return Math.max(4, Math.floor((pageHeight - startY - 62) / rowHeight));
}

function paginateRows(payload: AdminPdfPayload, pageHeight: number) {
  const rows = safeRows(payload);
  if (!rows.length) return [[]] as Record<string, unknown>[][];
  const pages: Record<string, unknown>[][] = [];
  const firstCount = rowsPerPage(payload, true, pageHeight);
  pages.push(rows.slice(0, firstCount));
  const restCount = rowsPerPage(payload, false, pageHeight);
  for (let index = firstCount; index < rows.length; index += restCount) pages.push(rows.slice(index, index + restCount));
  return pages;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, value: unknown, maxWidth: number) {
  let text = clean(value).replace(/\s+/g, " ");
  if (ctx.measureText(text).width <= maxWidth) return text;
  while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);
  return `${text}…`;
}

function drawText(ctx: CanvasRenderingContext2D, value: unknown, x: number, y: number, maxWidth: number, align: CanvasTextAlign, size = 10, weight = "400", color = "#0b172a") {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${pageFont}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(fitText(ctx, value, maxWidth), x, y);
  ctx.restore();
}

function drawPdfPage(payload: AdminPdfPayload, rows: Record<string, unknown>[], page: number, totalPages: number, width: number, height: number) {
  if (typeof document === "undefined") throw new Error("Browser document is not available.");
  const isArabic = payload.language === "ar";
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.scale(scale, scale);
  ctx.direction = isArabic ? "rtl" : "ltr";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const margin = 28;
  roundedRect(ctx, margin, 28, width - margin * 2, 82, 16);
  ctx.fillStyle = "#03101f";
  ctx.fill();
  ctx.fillStyle = "#d4af37";
  ctx.fillRect(margin, 104, width - margin * 2, 5);
  drawText(ctx, "DAY NIGHT", isArabic ? width - 54 : 54, 58, 210, isArabic ? "right" : "left", 24, "800", "#d4af37");
  drawText(ctx, isArabic ? "داي نايت لخدمات التوصيل والشحن" : "DAY NIGHT DELIVERY SERVICES", isArabic ? width - 54 : 54, 85, 260, isArabic ? "right" : "left", 10, "500", "#ffffff");
  const generatedAt = new Date().toLocaleString(isArabic ? "ar-AE" : "en-AE");
  drawText(ctx, `${isArabic ? "تاريخ الملف" : "File date"}: ${generatedAt}`, isArabic ? 54 : width - 54, 59, 260, isArabic ? "left" : "right", 10, "500", "#ffffff");
  drawText(ctx, `${isArabic ? "صفحة" : "Page"} ${page} / ${totalPages}`, isArabic ? 54 : width - 54, 83, 180, isArabic ? "left" : "right", 10, "700", "#d4af37");

  drawText(ctx, payload.sectionTitle, isArabic ? width - margin : margin, 137, width - margin * 2, isArabic ? "right" : "left", 20, "800", "#03101f");
  drawText(ctx, isArabic ? "ملف إداري صادر من لوحة تحكم DAY NIGHT" : "Administrative file from DAY NIGHT Admin Dashboard", isArabic ? width - margin : margin, 163, width - margin * 2, isArabic ? "right" : "left", 10, "500", "#475569");

  let y = 188;
  if (page === 1 && payload.includeFilters !== false) {
    roundedRect(ctx, margin, y, width - margin * 2, 42, 10);
    ctx.fillStyle = "#f8fafc";
    ctx.fill();
    ctx.strokeStyle = "#d8dee8";
    ctx.stroke();
    drawText(ctx, isArabic ? "الفلاتر / البحث" : "Filters / Search", isArabic ? width - 44 : 44, y + 13, 160, isArabic ? "right" : "left", 10, "800", "#926f00");
    drawText(ctx, payload.filters || (isArabic ? "بدون فلاتر" : "No filters"), isArabic ? width - 44 : 44, y + 30, width - 88, isArabic ? "right" : "left", 9, "500", "#334155");
    y += 54;
  }

  const totals = Object.entries(payload.totals || {});
  if (page === 1 && payload.includeSummary !== false && totals.length) {
    const cardGap = 8;
    const cardsPerRow = Math.min(4, Math.max(1, totals.length));
    const cardWidth = (width - margin * 2 - cardGap * (cardsPerRow - 1)) / cardsPerRow;
    const cardHeight = 42;
    totals.slice(0, 8).forEach(([key, value], index) => {
      const row = Math.floor(index / cardsPerRow);
      const column = index % cardsPerRow;
      const x = margin + column * (cardWidth + cardGap);
      const cardY = y + row * (cardHeight + cardGap);
      roundedRect(ctx, x, cardY, cardWidth, cardHeight, 10);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#e2e8f0";
      ctx.stroke();
      drawText(ctx, key, x + cardWidth / 2, cardY + 14, cardWidth - 12, "center", 8, "800", "#926f00");
      drawText(ctx, value, x + cardWidth / 2, cardY + 30, cardWidth - 12, "center", 10, "700", "#0b172a");
    });
    y += Math.ceil(totals.slice(0, 8).length / cardsPerRow) * (cardHeight + cardGap) + 8;
  }

  const columns = visibleColumns(payload);
  const tableWidth = width - margin * 2;
  const columnWidth = tableWidth / Math.max(1, columns.length);
  const rowHeight = columns.length > 7 ? 34 : columns.length > 5 ? 32 : 30;
  ctx.fillStyle = "#d4af37";
  ctx.fillRect(margin, y, tableWidth, 30);
  columns.forEach((column, index) => {
    const x = margin + index * columnWidth;
    ctx.strokeStyle = "#c49f25";
    ctx.strokeRect(x, y, columnWidth, 30);
    drawText(ctx, column.label, x + columnWidth / 2, y + 15, columnWidth - 10, "center", 9, "800", "#03101f");
  });
  y += 30;

  if (!rows.length) {
    roundedRect(ctx, margin, y + 10, tableWidth, 52, 12);
    ctx.strokeStyle = "#cbd5e1";
    ctx.stroke();
    drawText(ctx, isArabic ? "لا توجد بيانات في هذا الملف." : "No data in this file.", width / 2, y + 36, tableWidth - 20, "center", 11, "600", "#64748b");
  } else {
    rows.forEach((row, rowIndex) => {
      ctx.fillStyle = rowIndex % 2 === 0 ? "#ffffff" : "#f8fafc";
      ctx.fillRect(margin, y, tableWidth, rowHeight);
      columns.forEach((column, index) => {
        const x = margin + index * columnWidth;
        ctx.strokeStyle = "#e2e8f0";
        ctx.strokeRect(x, y, columnWidth, rowHeight);
        const value = row[column.key];
        const isLtr = ltrPattern.test(column.key);
        const align: CanvasTextAlign = isLtr ? "left" : "center";
        const textX = isLtr ? x + 7 : x + columnWidth / 2;
        drawText(ctx, value, textX, y + rowHeight / 2, columnWidth - 12, align, 8.5, "500", "#0b172a");
      });
      y += rowHeight;
    });
  }

  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(margin, height - 42);
  ctx.lineTo(width - margin, height - 42);
  ctx.stroke();
  drawText(ctx, isArabic ? "تم إنشاء الملف تلقائياً من نظام DAY NIGHT التشغيلي." : "Generated automatically from the DAY NIGHT operations system.", isArabic ? width - margin : margin, height - 25, width - margin * 2 - 120, isArabic ? "right" : "left", 8.5, "500", "#475569");
  drawText(ctx, "DAY NIGHT", isArabic ? margin : width - margin, height - 25, 90, isArabic ? "left" : "right", 9, "800", "#03101f");
  return canvas;
}

export async function buildAdminPdf(payload: AdminPdfPayload) {
  if (typeof window === "undefined") return;
  const orientation = reportOrientation(payload);
  const doc = new jsPDF({ orientation, unit: "pt", format: "a4", compress: true });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const pages = paginateRows(payload, height);

  try {
    pages.forEach((pageRows, index) => {
      if (index > 0) doc.addPage("a4", orientation);
      const canvas = drawPdfPage(payload, pageRows, index + 1, pages.length, width, height);
      doc.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, width, height, undefined, "FAST");
    });
    doc.save(`${safeFileStem(payload)}.pdf`);
  } catch (error) {
    console.error("PDF export failed.", error);
    window.alert(payload.language === "ar" ? "تعذر إنشاء ملف PDF. لم يتم تنزيل ملف Word بديل حتى لا يحدث خلط. جرّب تقليل عدد الصفوف أو أعد المحاولة." : "PDF creation failed. No Word fallback was downloaded to avoid confusion. Reduce rows or try again.");
  }
}
