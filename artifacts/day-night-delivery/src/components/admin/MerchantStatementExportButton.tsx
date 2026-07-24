import { useState } from "react";
import { FileArchive, FileSpreadsheet, Loader2 } from "lucide-react";
import {
  buildMerchantStatementCsv,
  buildMerchantStatementPdf,
  type MerchantStatementPayload,
} from "../../lib/merchantStatementExport";

type Props = {
  payload: MerchantStatementPayload;
  isArabic: boolean;
  disabled?: boolean;
};

export default function MerchantStatementExportButton({ payload, isArabic, disabled = false }: Props) {
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);

  async function exportPdf() {
    if (disabled || busy) return;
    setBusy("pdf");
    try {
      await buildMerchantStatementPdf(payload);
    } catch (error) {
      console.error("Merchant statement PDF export failed.", error);
      window.alert(
        isArabic
          ? "تعذر إنشاء كشف التاجر الآن. تحقق من الاتصال ثم أعد المحاولة."
          : "The merchant statement could not be created. Check the connection and try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  function exportCsv() {
    if (disabled || busy) return;
    setBusy("csv");
    try {
      buildMerchantStatementCsv(payload);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={disabled || busy !== null}
        onClick={() => void exportPdf()}
        className="dn-admin-pdf-button disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
        {busy === "pdf" ? (isArabic ? "جاري إنشاء الكشف..." : "Creating statement...") : (isArabic ? "كشف التاجر PDF" : "Merchant PDF")}
      </button>
      <button
        type="button"
        disabled={disabled || busy !== null}
        onClick={exportCsv}
        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
        CSV
      </button>
    </div>
  );
}
