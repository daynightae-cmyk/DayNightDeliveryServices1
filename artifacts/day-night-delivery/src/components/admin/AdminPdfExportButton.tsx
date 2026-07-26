import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { buildAdminCsv, buildAdminDoc, buildAdminPdf, type AdminPdfPayload } from "../../lib/adminPdfExport";
import { requireAdminStepUp } from "../../lib/adminStepUp";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isArabic = payload.language === "ar";

  async function authorize<T>(operation: (value: AdminPdfPayload) => T | Promise<T>) {
    setBusy(true);
    setError("");
    try {
      await requireAdminStepUp("export_sensitive_data");
      return await operation(payload);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "admin_step_up_failed";
      if (!/cancelled/i.test(reason)) {
        setError(isArabic ? "يجب إكمال التحقق الأمني قبل تصدير البيانات." : "Complete security verification before exporting data.");
      }
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function openPreview() {
    setBusy(true);
    setError("");
    try {
      await requireAdminStepUp("export_sensitive_data");
      setOpen(true);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "admin_step_up_failed";
      if (!/cancelled/i.test(reason)) {
        setError(isArabic ? "يجب إكمال التحقق الأمني قبل فتح التقرير." : "Complete security verification before opening the report.");
      }
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" className="dn-admin-pdf-button" onClick={() => void openPreview()} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      {cleanButtonLabel(label, isArabic)}
    </button>
    {error && <span className="mt-2 block text-[10px] font-bold text-rose-200" role="alert">{error}</span>}
    <AdminPdfPreviewModal
      open={open}
      payload={payload}
      onClose={() => setOpen(false)}
      onExportPdf={() => authorize(buildAdminPdf)}
      onExportCsv={() => authorize(buildAdminCsv)}
      onExportDoc={() => authorize(buildAdminDoc)}
    />
  </>;
}
