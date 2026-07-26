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
};

const EPSILON = 0.005;
const CUSTOMER_PAID_ZERO_GOODS_SENTINEL = 0.01;

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * The legacy PDF renderer used goods_value=0 as a heuristic for charging every
 * delivery fee to the merchant. The current rule is more precise: a zero-goods
 * row may still be customer-paid when customer_total equals the delivery fee.
 *
 * The PDF does not render row.goodsValue and its totals use payload.totals, so a
 * tiny export-only sentinel safely prevents the old heuristic from rewriting a
 * correctly persisted customer-paid row. Merchant-liability rows remain signed.
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

export default function MerchantStatementExportButton({ payload, isArabic, disabled = false }: Props) {
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);
  const protectedPayload = useMemo(() => preservePreciseSettlement(payload), [payload]);

  async function exportPdf() {
    if (disabled || busy) return;
    setBusy("pdf");
    try {
      await buildMerchantStatementPdf(protectedPayload);
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
