export type AdminPdfLanguage = "ar" | "en";
export type AdminPdfOrientation = "portrait" | "landscape";
export type AdminPdfColumn = { key: string; label: string; ltr?: boolean };
export type AdminPdfPayload = {
  language: AdminPdfLanguage;
  sectionTitle: string;
  filters?: string;
  totals?: Record<string, string | number>;
  columns: AdminPdfColumn[];
  rows: Record<string, unknown>[];
};
export type AdminPdfOptions = { language: AdminPdfLanguage; orientation: AdminPdfOrientation; includeSummary: boolean; includeFilters: boolean };

const secretPattern = /(key|token|secret|password|authorization|supabase|anon|service_role|url)/i;
const ltrPattern = /(id|tracking|phone|email|url|code|number|amount|date|cod|aed)/i;

function escapeHtml(value: unknown) {
  return String(value ?? "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
}

function clean(key: string, value: unknown) {
  if (secretPattern.test(key)) return "[redacted]";
  const text = String(value ?? "—");
  return secretPattern.test(text) ? "[redacted]" : text.slice(0, 180);
}

export function buildAdminPrintHtml(payload: AdminPdfPayload, options: AdminPdfOptions) {
  const isArabic = options.language === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const columns = payload.columns.filter((column) => !secretPattern.test(column.key));
  const rows = payload.rows.slice(0, 250);
  const generatedAt = new Date().toLocaleString(isArabic ? "ar-AE" : "en-AE");
  const totals = Object.entries(payload.totals || {}).filter(([key]) => !secretPattern.test(key));
  const companyName = isArabic ? "داي نايت لخدمات التوصيل والشحن" : "DAY NIGHT Delivery Services";
  const empty = isArabic ? "لا توجد بيانات متاحة للتصدير في هذا القسم." : "No data is available to export for this section.";
  return `<!doctype html><html lang="${isArabic ? "ar" : "en"}" dir="${dir}"><head><meta charset="utf-8"/><title>DAY NIGHT - ${escapeHtml(payload.sectionTitle)}</title><style>
    @page{size:A4 ${options.orientation};margin:12mm}*{box-sizing:border-box}body{margin:0;color:#0f172a;background:#fff;font-family:${isArabic ? '"Tahoma","Arial","Noto Sans Arabic",sans-serif' : '"Inter","Arial",sans-serif'};direction:${dir};unicode-bidi:plaintext}.dn-report{min-height:100vh}.dn-head{border-radius:18px;background:#03101f;color:white;padding:22px 26px;display:flex;align-items:center;justify-content:space-between;gap:18px}.brand b{display:block;color:#d4af37;font-size:26px;letter-spacing:.08em}.brand span{font-size:14px}.meta{text-align:${isArabic ? "left" : "right"};font-size:12px;line-height:1.8}.section{margin:18px 0}.section h1{margin:0 0 8px;font-size:24px}.chips{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.chip{border:1px solid #d8dee9;border-radius:14px;padding:10px 12px;background:#f8fafc}.chip b{display:block;color:#96731a;font-size:12px}.filters{border:1px dashed #cbd5e1;border-radius:14px;padding:12px;background:#fffdf2}.table-wrap{overflow:visible}.report-table{width:100%;border-collapse:collapse;font-size:11px}.report-table th{background:#d4af37;color:#03101f;text-align:${isArabic ? "right" : "left"};padding:9px;border:1px solid #c49b23}.report-table td{padding:8px;border:1px solid #e2e8f0;vertical-align:top}.report-table tr:nth-child(even) td{background:#f8fafc}.ltr{direction:ltr;unicode-bidi:isolate;text-align:left}.footer{margin-top:18px;border-top:1px solid #e2e8f0;padding-top:10px;color:#64748b;font-size:11px;display:flex;justify-content:space-between;gap:12px}@media print{button{display:none}.dn-head{break-inside:avoid}.report-table{page-break-inside:auto}tr{page-break-inside:avoid;page-break-after:auto}}</style></head><body><main class="dn-report"><header class="dn-head"><div class="brand"><b>DAY NIGHT</b><span>${companyName}</span></div><div class="meta"><div>${isArabic ? "تاريخ التصدير" : "Export date"}: <span class="ltr">${escapeHtml(generatedAt)}</span></div><div>${isArabic ? "الاتجاه" : "Orientation"}: ${options.orientation}</div></div></header><section class="section"><h1>${escapeHtml(payload.sectionTitle)}</h1>${options.includeFilters ? `<div class="filters"><strong>${isArabic ? "الفلاتر / البحث" : "Filters / search"}</strong><br/>${escapeHtml(payload.filters || (isArabic ? "بدون فلاتر" : "No filters"))}</div>` : ""}</section>${options.includeSummary ? `<section class="section chips">${totals.map(([key, value]) => `<article class="chip"><b>${escapeHtml(key)}</b><span class="${ltrPattern.test(key) ? "ltr" : ""}">${escapeHtml(clean(key, value))}</span></article>`).join("")}</section>` : ""}<section class="section table-wrap">${rows.length ? `<table class="report-table"><thead><tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((column) => `<td class="${column.ltr || ltrPattern.test(column.key) ? "ltr" : ""}">${escapeHtml(clean(column.key, row[column.key]))}</td>`).join("")}</tr>`).join("")}</tbody></table>` : `<div class="filters">${empty}</div>`}</section><footer class="footer"><span>DAY NIGHT</span><span>${isArabic ? "تقرير إداري آمن - لا يحتوي على أسرار" : "Safe admin report - no secrets included"}</span></footer></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));</script></body></html>`;
}

export function printAdminPdf(payload: AdminPdfPayload, options: AdminPdfOptions) {
  const html = buildAdminPrintHtml(payload, options);
  const printWindow = window.open("", "day-night-admin-report", "noopener,noreferrer,width=1100,height=800");
  if (!printWindow) throw new Error(options.language === "ar" ? "تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة." : "Could not open the print window. Please allow pop-ups.");
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
