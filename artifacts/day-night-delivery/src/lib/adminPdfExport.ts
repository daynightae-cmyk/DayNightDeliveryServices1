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

function cellDir(key: string) {
  return ltrPattern.test(key) ? "ltr" : "auto";
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

function buildReportHtml(payload: AdminPdfPayload, rowsOverride?: Record<string, unknown>[], pageMeta?: { page: number; totalPages: number }) {
  const isArabic = payload.language === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const lang = isArabic ? "ar" : "en";
  const title = html(payload.sectionTitle);
  const columns = visibleColumns(payload);
  const rows = rowsOverride || safeRows(payload);
  const totals = Object.entries(payload.totals || {});
  const orientation = reportOrientation(payload);
  const generatedAt = new Date().toLocaleString(isArabic ? "ar-AE" : "en-AE");
  const showSummary = payload.includeSummary !== false && (!pageMeta || pageMeta.page === 1);
  const showFilters = payload.includeFilters !== false && (!pageMeta || pageMeta.page === 1);
  const pageLabel = pageMeta ? `${isArabic ? "صفحة" : "Page"} ${pageMeta.page} / ${pageMeta.totalPages}` : "";

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DAY NIGHT - ${title}</title>
  <style>
    @page { size: A4 ${orientation}; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #fff;
      color: #0b172a;
      font-family: Tahoma, Arial, "Noto Sans Arabic", "Segoe UI", sans-serif;
      direction: ${dir};
      unicode-bidi: plaintext;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .dn-report { width: 100%; }
    .dn-report-header {
      background: #03101f;
      color: #fff;
      border-radius: 18px;
      padding: 18px 22px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 5px solid #d4af37;
    }
    .brand strong { display: block; color: #d4af37; font-size: 24px; letter-spacing: .05em; }
    .brand span { display: block; font-size: 12px; opacity: .86; margin-top: 4px; }
    .meta { text-align: ${isArabic ? "left" : "right"}; font-size: 11px; line-height: 1.8; opacity: .9; }
    h1 { margin: 22px 0 8px; font-size: 22px; color: #03101f; }
    .subtitle { margin: 0 0 16px; color: #475569; font-size: 12px; }
    .filters, .totals {
      border: 1px solid #d8dee8;
      border-radius: 14px;
      padding: 12px;
      margin: 12px 0;
      background: #f8fafc;
      font-size: 12px;
    }
    .totals { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
    .total-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; }
    .total-card b { display: block; color: #926f00; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; table-layout: fixed; }
    thead { display: table-header-group; }
    th { background: #d4af37; color: #03101f; font-size: 11px; padding: 9px 7px; text-align: start; border: 1px solid #c49f25; }
    td { font-size: 10px; padding: 8px 7px; border: 1px solid #e2e8f0; vertical-align: top; word-break: break-word; }
    tr:nth-child(even) td { background: #f8fafc; }
    .ltr { direction: ltr; unicode-bidi: isolate; text-align: left; }
    .empty { padding: 28px; text-align: center; border: 1px dashed #cbd5e1; border-radius: 14px; color: #64748b; }
    footer { margin-top: 18px; padding-top: 10px; border-top: 2px solid #d4af37; color: #475569; font-size: 10px; display: flex; justify-content: space-between; gap: 12px; }
    @media print { .no-print { display: none !important; } body { background: #fff; } }
  </style>
</head>
<body>
  <main class="dn-report">
    <section class="dn-report-header">
      <div class="brand">
        <strong>DAY NIGHT</strong>
        <span>${isArabic ? "داي نايت لخدمات التوصيل والشحن" : "DAY NIGHT DELIVERY SERVICES"}</span>
      </div>
      <div class="meta">
        <div>${isArabic ? "تاريخ التصدير" : "Export date"}: <span class="ltr">${html(generatedAt)}</span></div>
        <div>${isArabic ? "اللغة" : "Language"}: ${isArabic ? "العربية" : "English"}</div>
        ${pageLabel ? `<div>${html(pageLabel)}</div>` : ""}
      </div>
    </section>

    <h1>${title}</h1>
    <p class="subtitle">${isArabic ? "تم التصدير من لوحة تحكم DAY NIGHT" : "Exported from DAY NIGHT Admin Dashboard"}</p>

    ${showFilters ? `<section class="filters"><b>${isArabic ? "الفلاتر / البحث" : "Filters / Search"}</b><br />${html(payload.filters || (isArabic ? "بدون فلاتر" : "No filters"))}</section>` : ""}

    ${showSummary && totals.length ? `<section class="totals">${totals.map(([key, value]) => `<article class="total-card"><b>${html(key)}</b><span class="${ltrPattern.test(key) ? "ltr" : ""}">${html(value)}</span></article>`).join("")}</section>` : ""}

    ${rows.length ? `<table><thead><tr>${columns.map((column) => `<th>${html(column.label)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((column) => `<td dir="${cellDir(column.key)}" class="${cellDir(column.key) === "ltr" ? "ltr" : ""}">${html(row[column.key])}</td>`).join("")}</tr>`).join("")}</tbody></table>` : `<div class="empty">${isArabic ? "لا توجد بيانات في هذا التقرير." : "No data in this report."}</div>`}

    <footer>
      <span>${isArabic ? "هذا التقرير تم إنشاؤه تلقائياً من نظام DAY NIGHT التشغيلي." : "This report was generated automatically from the DAY NIGHT operations system."}</span>
      <span class="ltr">DAY NIGHT</span>
    </footer>
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
  const docHtml = buildReportHtml(payload)
    .replace("<!doctype html>", "")
    .replace("<html", "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'");
  downloadBlob(new Blob(["\uFEFF", docHtml], { type: "application/msword;charset=utf-8" }), `${safeFileStem(payload)}.doc`);
}

function rowsPerPdfPage(payload: AdminPdfPayload) {
  const columns = visibleColumns(payload).length;
  const orientation = reportOrientation(payload);
  if (orientation === "landscape") return columns > 7 ? 10 : 13;
  return columns > 5 ? 11 : 18;
}

function chunkRows(rows: Record<string, unknown>[], size: number) {
  if (!rows.length) return [[]] as Record<string, unknown>[][];
  const chunks: Record<string, unknown>[][] = [];
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
  return chunks;
}

function pageXhtml(payload: AdminPdfPayload, rows: Record<string, unknown>[], page: number, totalPages: number, width: number, height: number) {
  const report = buildReportHtml(payload, rows, { page, totalPages });
  const body = report.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || report;
  const isArabic = payload.language === "ar";
  return `<div xmlns="http://www.w3.org/1999/xhtml" dir="${isArabic ? "rtl" : "ltr"}" style="width:${width}px;height:${height}px;padding:28px;background:#ffffff;overflow:hidden;font-family:Tahoma,Arial,'Noto Sans Arabic','Segoe UI',sans-serif;color:#0b172a;box-sizing:border-box;">${body}</div>`;
}

function renderSvgPageToImage(xhtml: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined" || typeof URL === "undefined") {
      reject(new Error("Browser export is not available."));
      return;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${xhtml}</foreignObject></svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      try {
        const scale = 2;
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is not available.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.scale(scale, scale);
        context.drawImage(image, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("PDF page render failed."));
    };
    image.src = url;
  });
}

export async function buildAdminPdf(payload: AdminPdfPayload) {
  if (typeof window === "undefined") return;
  const orientation = reportOrientation(payload);
  const doc = new jsPDF({ orientation, unit: "pt", format: "a4", compress: true });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const rows = safeRows(payload);
  const pages = chunkRows(rows, rowsPerPdfPage(payload));

  try {
    for (let index = 0; index < pages.length; index += 1) {
      if (index > 0) doc.addPage("a4", orientation);
      const xhtml = pageXhtml(payload, pages[index], index + 1, pages.length, width, height);
      const image = await renderSvgPageToImage(xhtml, width, height);
      doc.addImage(image, "PNG", 0, 0, width, height, undefined, "FAST");
    }
    doc.save(`${safeFileStem(payload)}.pdf`);
  } catch (error) {
    console.warn("Direct PDF export failed; downloading Word-compatible report instead.", error);
    buildAdminDoc(payload);
  }
}
