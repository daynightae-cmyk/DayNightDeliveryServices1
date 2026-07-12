import { useMemo, useState } from "react";
import { FileArchive, FileSpreadsheet, FileText } from "lucide-react";
import type { AdminPdfLanguage, AdminPdfPayload } from "../../lib/adminPdfExport";

type Props = {
  open: boolean;
  payload: AdminPdfPayload;
  onClose: () => void;
  onExportPdf: (payload: AdminPdfPayload) => void | Promise<void>;
  onExportCsv: (payload: AdminPdfPayload) => void;
  onExportDoc: (payload: AdminPdfPayload) => void;
};

export default function AdminPdfPreviewModal({ open, payload, onClose, onExportPdf, onExportCsv, onExportDoc }: Props) {
  const [language, setLanguage] = useState<AdminPdfLanguage>(payload.language);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(payload.orientation || (payload.columns.length > 5 ? "landscape" : "portrait"));
  const [includeSummary, setIncludeSummary] = useState(payload.includeSummary !== false);
  const [includeFilters, setIncludeFilters] = useState(payload.includeFilters !== false);
  const [busyFormat, setBusyFormat] = useState<"pdf" | "csv" | "doc" | null>(null);
  const previewPayload = useMemo<AdminPdfPayload>(() => ({ ...payload, language, orientation, includeSummary, includeFilters }), [payload, language, orientation, includeSummary, includeFilters]);
  if (!open) return null;
  const isArabic = language === "ar";
  async function run(format: "pdf" | "csv" | "doc") {
    setBusyFormat(format);
    try {
      if (format === "pdf") await onExportPdf(previewPayload);
      if (format === "csv") onExportCsv(previewPayload);
      if (format === "doc") onExportDoc(previewPayload);
    } finally {
      setBusyFormat(null);
    }
  }
  return <div className="dn-admin-pdf-backdrop" role="dialog" aria-modal="true" dir={isArabic ? "rtl" : "ltr"}>
    <div className="dn-admin-pdf-modal">
      <header><strong>{isArabic ? "ملف التقرير" : "Report file"}</strong><button type="button" onClick={onClose}>{isArabic ? "إغلاق" : "Close"}</button></header>
      <h2>{payload.sectionTitle}</h2>
      <p>{payload.filters || (isArabic ? "بدون فلاتر" : "No filters")}</p>
      <div className="dn-admin-pdf-options">
        <label>{isArabic ? "اللغة" : "Language"}<select value={language} onChange={(event) => setLanguage(event.target.value as AdminPdfLanguage)}><option value="ar">العربية</option><option value="en">English</option></select></label>
        <label>{isArabic ? "الاتجاه" : "Orientation"}<select value={orientation} onChange={(event) => setOrientation(event.target.value as "portrait" | "landscape")}><option value="portrait">{isArabic ? "عمودي" : "Portrait"}</option><option value="landscape">{isArabic ? "أفقي" : "Landscape"}</option></select></label>
        <label className="dn-admin-pdf-check"><input type="checkbox" checked={includeSummary} onChange={(event) => setIncludeSummary(event.target.checked)} />{isArabic ? "الملخص" : "Summary"}</label>
        <label className="dn-admin-pdf-check"><input type="checkbox" checked={includeFilters} onChange={(event) => setIncludeFilters(event.target.checked)} />{isArabic ? "الفلاتر" : "Filters"}</label>
      </div>
      <div className="dn-admin-pdf-totals">{Object.entries(payload.totals || {}).map(([key, value]) => <span key={key}><b>{key}</b>{String(value)}</span>)}</div>
      <div className="dn-admin-pdf-scroll"><table><thead><tr>{payload.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{payload.rows.length ? payload.rows.slice(0, 12).map((row, index) => <tr key={index}>{payload.columns.map((c) => <td key={c.key}>{String(row[c.key] ?? "—")}</td>)}</tr>) : <tr><td colSpan={payload.columns.length || 1}>{isArabic ? "لا توجد بيانات للمعاينة" : "No rows to preview"}</td></tr>}</tbody></table></div>
      <div className="dn-admin-pdf-actions" aria-label={isArabic ? "صيغ الملف" : "File formats"}>
        <button type="button" className="dn-admin-pdf-primary" onClick={() => void run("pdf")} disabled={busyFormat !== null}><FileArchive className="h-4 w-4" />{busyFormat === "pdf" ? (isArabic ? "جاري PDF..." : "PDF...") : "PDF"}</button>
        <button type="button" onClick={() => void run("csv")} disabled={busyFormat !== null}><FileSpreadsheet className="h-4 w-4" />CSV</button>
        <button type="button" onClick={() => void run("doc")} disabled={busyFormat !== null}><FileText className="h-4 w-4" />Word</button>
      </div>
      <small className="dn-admin-pdf-hint">{isArabic ? "اختر صيغة واحدة فقط. زر PDF ينشئ ملف PDF حقيقي ولا ينزل Word بديل." : "Choose one format. PDF creates a real PDF and never downloads a Word fallback."}</small>
    </div>
  </div>;
}
