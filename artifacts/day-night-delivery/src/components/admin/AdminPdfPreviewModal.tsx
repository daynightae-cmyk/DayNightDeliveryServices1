import type { AdminPdfPayload } from "../../lib/adminPdfExport";

type Props = { open: boolean; payload: AdminPdfPayload; onClose: () => void; onExport: () => void };

export default function AdminPdfPreviewModal({ open, payload, onClose, onExport }: Props) {
  if (!open) return null;
  const isArabic = payload.language === "ar";
  return <div className="dn-admin-pdf-backdrop" role="dialog" aria-modal="true" dir={isArabic ? "rtl" : "ltr"}>
    <div className="dn-admin-pdf-modal">
      <header><strong>DAY NIGHT</strong><button type="button" onClick={onClose}>{isArabic ? "إغلاق" : "Close"}</button></header>
      <h2>{payload.sectionTitle}</h2>
      <p>{payload.filters || (isArabic ? "بدون فلاتر" : "No filters")}</p>
      <div className="dn-admin-pdf-totals">{Object.entries(payload.totals || {}).map(([key, value]) => <span key={key}><b>{key}</b>{String(value)}</span>)}</div>
      <div className="dn-admin-pdf-scroll"><table><thead><tr>{payload.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{payload.rows.slice(0, 12).map((row, index) => <tr key={index}>{payload.columns.map((c) => <td key={c.key}>{String(row[c.key] ?? "—")}</td>)}</tr>)}</tbody></table></div>
      <button type="button" className="dn-admin-pdf-primary" onClick={onExport}>{isArabic ? "تصدير PDF" : "Export PDF"}</button>
    </div>
  </div>;
}
