import { useMemo, useState } from "react";
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
  pdfLabel?: string;
  onPdfCreated?: () => void | Promise<void>;
};

const EPSILON = 0.005;
const CUSTOMER_PAID_ZERO_GOODS_SENTINEL = 0.01;

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Preserve the exact settlement owner recorded in the database. A zero-goods
 * order may still be customer-paid when customer_total equals delivery_fee.
 */
function preservePreciseSettlement(payload: MerchantStatementPayload): MerchantStatementPayload {
  return {
    ...payload,
    rows: payload.rows.map((row) => {
      const goodsAreZero = Math.abs(numeric(row.goodsValue)) <= EPSILON;
      const deliveryFee = numeric(row.deliveryFee);
      const customerTotal = numeric(row.customerTotal);
      const merchantDue = numeric(row.merchantDue);
      const customerPaysDelivery =
        goodsAreZero &&
        deliveryFee > EPSILON &&
        Math.abs(customerTotal - deliveryFee) <= EPSILON &&
        Math.abs(merchantDue) <= EPSILON;

      return customerPaysDelivery
        ? { ...row, goodsValue: CUSTOMER_PAID_ZERO_GOODS_SENTINEL }
        : row;
    }),
  };
}

export default function MerchantStatementExportButton({
  payload,
  isArabic,
  disabled = false,
  pdfLabel,
  onPdfCreated,
}: Props) {
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);
  const protectedPayload = useMemo(() => preservePreciseSettlement(payload), [payload]);

  async function exportPdf() {
    if (disabled || busy) return;
    setBusy("pdf");
    let pdfCreated = false;
    try {
      await buildMerchantStatementPdf(protectedPayload);
      pdfCreated = true;
      await onPdfCreated?.();
    } catch (error) {
      console.error("Merchant statement PDF export failed.", error);
      window.alert(
        pdfCreated
          ? isArabic
            ? "تم إنشاء ملف PDF، لكن تعذر تسجيله في سجل كشوف التاجر. لا تعِد تصديره قبل تحديث الصفحة والتحقق من العلامة."
            : "The PDF was created, but its merchant-statement record could not be saved. Refresh and verify the badge before exporting again."
          : isArabic
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
      buildMerchantStatementCsv(protectedPayload);
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
        {busy === "pdf"
          ? isArabic
            ? "جاري إنشاء الكشف..."
            : "Creating statement..."
          : pdfLabel || (isArabic ? "كشف التاجر PDF" : "Merchant PDF")}
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
