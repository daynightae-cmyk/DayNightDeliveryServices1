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
const ltrPattern = /(id|tracking|phone|email|url|amount|cod|aed|number|code|date)/i;

function clean(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const text = String(value);
  return secretPattern.test(text) ? "[redacted]" : text.slice(0, 160);
}

function html(value: unknown) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cellDir(key: string) {
  return ltrPattern.test(key) ? "ltr" : "auto";
}

function buildReportHtml(payload: AdminPdfPayload) {
  const isArabic = payload.language === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const lang = isArabic ? "ar" : "en";
  const title = html(payload.sectionTitle);
  const columns = payload.columns.filter((column) => !secretPattern.test(column.key));
  const rows = payload.rows.slice(0, 500);
  const totals = Object.entries(payload.totals || {});
  const orientation = payload.orientation || (columns.length > 5 ? "landscape" : "portrait");
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
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.focus(); window.print(); }, 250);
    });
  </script>
</body>
</html>`;
}

export function buildAdminPdf(payload: AdminPdfPayload) {
  const reportHtml = buildReportHtml(payload);
  const reportWindow = window.open("", "_blank", "noopener,noreferrer,width=1200,height=800");
  if (!reportWindow) {
    const blob = new Blob([reportHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `DAY_NIGHT_${payload.sectionTitle.replace(/\s+/g, "_")}_${Date.now()}.html`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    return;
  }
  reportWindow.document.open();
  reportWindow.document.write(reportHtml);
  reportWindow.document.close();
}
