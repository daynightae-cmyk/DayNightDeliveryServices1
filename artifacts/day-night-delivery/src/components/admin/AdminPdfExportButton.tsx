import { useState } from "react";
import { FileDown } from "lucide-react";
import { buildAdminCsv, buildAdminDoc, buildAdminPdf, type AdminPdfPayload } from "../../lib/adminPdfExport";
import AdminPdfPreviewModal from "./AdminPdfPreviewModal";

type Props = { payload: AdminPdfPayload; label?: string };

function cleanButtonLabel(label: string | undefined, isArabic: boolean) {
  const fallback = isArabic ? "ملف التقرير" : "Report file";
  if (!label) return fallback;
  const cleaned = label
    .replace(/تصدير\s*/g, "")
    .replace(/تحميل\s*/g, "")
    .replace(/Export\s*/gi, "")
    .replace(/Download\s*/gi, "")
    .trim();
  return cleaned || fallback;
}

export default function AdminPdfExportButton({ payload, label }: Props) {
  const [open, setOpen] = useState(false);
  const isArabic = payload.language === "ar";
  return <>
    <button type="button" className="dn-admin-pdf-button" onClick={() => setOpen(true)}><FileDown className="h-4 w-4" />{cleanButtonLabel(label, isArabic)}</button>
    <AdminPdfPreviewModal
      open={open}
      payload={payload}
      onClose={() => setOpen(false)}
      onExportPdf={buildAdminPdf}
      onExportCsv={buildAdminCsv}
      onExportDoc={buildAdminDoc}
    />
  </>;
}
