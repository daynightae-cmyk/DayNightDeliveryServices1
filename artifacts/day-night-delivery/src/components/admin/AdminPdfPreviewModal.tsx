import { useMemo, useState } from "react";
import type { AdminPdfLanguage, AdminPdfPayload } from "../../lib/adminPdfExport";

type Props = { open: boolean; payload: AdminPdfPayload; onClose: () => void; onExport: (payload: AdminPdfPayload) => void };

export default function AdminPdfPreviewModal({ open, payload, onClose, onExport }: Props) {
  const [language, setLanguage] = useState<AdminPdfLanguage>(payload.language);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(payload.orientation || (payload.columns.length > 5 ? "landscape" : "portrait"));
  const [includeSummary, setIncludeSummary] = useState(payload.includeSummary !== false);
  const [includeFilters, setIncludeFilters] = useState(payload.includeFilters !== false);
  const previewPayload = useMemo<AdminPdfPayload>(() => ({ ...payload, language, orientation, includeSummary, includeFilters }), [payload, language, orientation, includeSummary, includeFilters]);
  if (!open) return null;
  const isArabic = language === "ar";
  return <div className="dn-admin-pdf-backdrop" role="dialog" aria-modal="true" dir={isArabic ? "rtl" : "ltr"}>
    <div className="dn-admin-pdf-modal">
      <header><strong>DAY NIGHT</strong><button type="button" onClick={onClose}>{isArabic ? "إغلاق" : "Close"}</button></header>
      <h2>{payload.sectionTitle}</h2>
      <p>{payload.filters || (isArabic ? "بدون فلاتر" : "No filters")}</p>
      <div className="dn-admin-pdf-options">
        <label>{isArabic ? "اللغة" : "Language"}<select value={language} onChange={(event) => setLanguage(event.target.value as AdminPdfLanguage)}><option value="ar">العربية</option><option value="en">English</option></select></label>
        <label>{isArabic ? "الاتجاه" : "Orientation"}<select value={orientation} onChange={(event) => setOrientation(event.target.value as "portrait" | "landscape")}><option value="portrait">{isArabic ? "عمودي" : "Portrait"}</option><option value="landscape">{isArabic ? "أفقي" : "Landscape"}</option></select></label>
        <label className="dn-admin-pdf-check"><input type="checkbox" checked={includeSummary} onChange={(event) => setIncludeSummary(event.target.checked)} />{isArabic ? "إظهار الملخص" : "Include summary"}</label>
        <label className="dn-admin-pdf-check"><input type="checkbox" checked={includeFilters} onChange={(event) => setIncludeFilters(event.target.checked)} />{isArabic ? "إظهار الفلاتر" : "Include filters"}</label>
      </div>
      <div className="dn-admin-pdf-totals">{Object.entries(payload.totals || {}).map(([key, value]) => <span key={key}><b>{key}</b>{String(value)}</span>)}</div>
      <div className="dn-admin-pdf-scroll"><table><thead><tr>{payload.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{payload.rows.length ? payload.rows.slice(0, 12).map((row, index) => <tr key={index}>{payload.columns.map((c) => <td key={c.key}>{String(row[c.key] ?? "—")}</td>)}</tr>) : <tr><td colSpan={payload.columns.length || 1}>{isArabic ? "لا توجد بيانات للمعاينة" : "No rows to preview"}</td></tr>}</tbody></table></div>
      <button type="button" className="dn-admin-pdf-primary" onClick={() => onExport(previewPayload)}>{isArabic ? "طباعة / حفظ PDF" : "Print / Save PDF"}</button>
    </div>
  </div>;
}
