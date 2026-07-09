import type { AdminPdfOptions, AdminPdfPayload } from "../../lib/adminPdfExport";

type Props = { open: boolean; payload: AdminPdfPayload; options: AdminPdfOptions; onOptionsChange: (options: AdminPdfOptions) => void; onClose: () => void; onExport: () => void; error?: string };

export default function AdminPdfPreviewModal({ open, payload, options, onOptionsChange, onClose, onExport, error }: Props) {
  if (!open) return null;
  const isArabic = options.language === "ar";
  const setOption = <K extends keyof AdminPdfOptions>(key: K, value: AdminPdfOptions[K]) => onOptionsChange({ ...options, [key]: value });
  return <div className="dn-admin-pdf-backdrop" role="dialog" aria-modal="true" dir={isArabic ? "rtl" : "ltr"}>
    <div className="dn-admin-pdf-modal">
      <header><strong>DAY NIGHT</strong><button type="button" onClick={onClose}>{isArabic ? "إغلاق" : "Close"}</button></header>
      <h2>{payload.sectionTitle}</h2>
      <p>{isArabic ? "معاينة تقرير HTML قابل للطباعة بدون خطوط PDF معطوبة." : "Printable HTML report preview with safe Arabic rendering."}</p>
      {error && <div className="dn-admin-pdf-error">{error}</div>}
      <div className="dn-admin-pdf-options">
        <label>{isArabic ? "اللغة" : "Language"}<select value={options.language} onChange={(e) => setOption("language", e.target.value as AdminPdfOptions["language"])}><option value="ar">العربية</option><option value="en">English</option></select></label>
        <label>{isArabic ? "الاتجاه" : "Orientation"}<select value={options.orientation} onChange={(e) => setOption("orientation", e.target.value as AdminPdfOptions["orientation"])}><option value="portrait">{isArabic ? "طولي" : "Portrait"}</option><option value="landscape">{isArabic ? "عرضي" : "Landscape"}</option></select></label>
        <label className="dn-admin-pdf-check"><input type="checkbox" checked={options.includeSummary} onChange={(e) => setOption("includeSummary", e.target.checked)} />{isArabic ? "إظهار الملخص" : "Include summary"}</label>
        <label className="dn-admin-pdf-check"><input type="checkbox" checked={options.includeFilters} onChange={(e) => setOption("includeFilters", e.target.checked)} />{isArabic ? "إظهار الفلاتر" : "Include filters"}</label>
      </div>
      <div className="dn-admin-pdf-totals">{Object.entries(payload.totals || {}).map(([key, value]) => <span key={key}><b>{key}</b>{String(value)}</span>)}</div>
      <div className="dn-admin-pdf-scroll"><table><thead><tr>{payload.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{payload.rows.slice(0, 12).map((row, index) => <tr key={index}>{payload.columns.map((c) => <td key={c.key} dir={c.ltr ? "ltr" : undefined}>{String(row[c.key] ?? "—")}</td>)}</tr>)}{payload.rows.length === 0 && <tr><td colSpan={payload.columns.length || 1}>{isArabic ? "لا توجد بيانات للتصدير" : "No rows to export"}</td></tr>}</tbody></table></div>
      <button type="button" className="dn-admin-pdf-primary" onClick={onExport} disabled={payload.columns.length === 0}>{isArabic ? "طباعة / حفظ PDF" : "Print / Save PDF"}</button>
    </div>
  </div>;
}
