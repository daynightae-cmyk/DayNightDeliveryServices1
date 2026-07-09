import { useState } from "react";
import { FileDown } from "lucide-react";
import { printAdminPdf, type AdminPdfOptions, type AdminPdfPayload } from "../../lib/adminPdfExport";
import AdminPdfPreviewModal from "./AdminPdfPreviewModal";

type Props = { payload: AdminPdfPayload; label?: string; disabledReason?: string };
export default function AdminPdfExportButton({ payload, label, disabledReason }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [options, setOptions] = useState<AdminPdfOptions>({ language: payload.language, orientation: "landscape", includeSummary: true, includeFilters: true });
  const isArabic = options.language === "ar";
  const disabled = Boolean(disabledReason) || payload.columns.length === 0;
  const exportNow = () => {
    setError("");
    try { printAdminPdf({ ...payload, language: options.language }, options); } catch (err) { setError(String((err as Error).message || err)); }
  };
  return <>
    <button type="button" className="dn-admin-pdf-button" onClick={() => !disabled && setOpen(true)} disabled={disabled} title={disabledReason || undefined}><FileDown className="h-4 w-4" />{disabled ? (disabledReason || (isArabic ? "التصدير غير متاح" : "Export unavailable")) : (label || (isArabic ? "تصدير PDF" : "Export PDF"))}</button>
    <AdminPdfPreviewModal open={open} payload={{ ...payload, language: options.language }} options={options} onOptionsChange={setOptions} onClose={() => setOpen(false)} onExport={exportNow} error={error} />
  </>;
}
