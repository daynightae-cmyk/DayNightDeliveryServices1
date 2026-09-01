import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { buildAdminCsv, buildAdminDoc, buildAdminPdf, type AdminPdfPayload } from "../../lib/adminPdfExport";
import { requireAdminStepUp } from "../../lib/adminStepUp";
import AdminPdfPreviewModal from "./AdminPdfPreviewModal";

type Props = { payload: AdminPdfPayload; label?: string };

function cleanButtonLabel(label: string | undefined, isArabic: boolean) {
  const fallback = isArabic ? "تصدير الملفات" : "Export files";
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
        setError(isArabic ? "يجب إكمال التحقق الأمني قبل تنزيل الملف." : "Complete security verification before downloading the file.");
      }
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  function openPreview() {
    // The preview contains only the same rows already visible to the authenticated
    // admin on screen. Step-up remains mandatory for the actual PDF/CSV/Word
    // download, so a browser/passkey prompt can never make the report button look dead.
    setError("");
    setOpen(true);
  }

  return <>
    <button type="button" className="dn-admin-pdf-button" onClick={openPreview} disabled={busy}>
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
