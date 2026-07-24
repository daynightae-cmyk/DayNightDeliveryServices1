import { useMemo, useState } from "react";
import { FileArchive, FileSpreadsheet, Loader2 } from "lucide-react";
import {
  buildMerchantStatementCsv,
  buildMerchantStatementPdf,
  type MerchantStatementPayload,
  type MerchantStatementRow,
} from "../../lib/merchantStatementExport";

type Props = {
  payload: MerchantStatementPayload;
  isArabic: boolean;
  disabled?: boolean;
};

const EPSILON = 0.005;
const DEFAULT_ZERO_ORDER_DELIVERY_FEE = 180;

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isUnresolvedZeroOrder(row: MerchantStatementRow) {
  const goods = row.goodsValue;
  const goodsAreZero = goods === undefined || Math.abs(numeric(goods)) <= EPSILON;
  return (
    goodsAreZero &&
    Math.abs(numeric(row.customerTotal)) <= EPSILON &&
    Math.abs(numeric(row.merchantDue)) <= EPSILON
  );
}

function normalizeZeroOrderPayload(payload: MerchantStatementPayload): MerchantStatementPayload {
  const positiveFees = payload.rows
    .map((row) => numeric(row.deliveryFee))
    .filter((value) => value > EPSILON)
    .sort((a, b) => a - b);
  const statementBaseFee = positiveFees[0] || DEFAULT_ZERO_ORDER_DELIVERY_FEE;

  const rows = payload.rows.map((row) => {
    if (!isUnresolvedZeroOrder(row)) return row;
    const effectiveFee = numeric(row.deliveryFee) > EPSILON
      ? numeric(row.deliveryFee)
      : statementBaseFee;
    return {
      ...row,
      goodsValue: 0,
      deliveryFee: effectiveFee,
      customerTotal: 0,
      merchantDue: -effectiveFee,
    };
  });

  return {
    ...payload,
    rows,
    totals: {
      orders: rows.length,
      goodsValue: numeric(payload.totals.goodsValue),
      deliveryFees: rows.reduce((sum, row) => sum + numeric(row.deliveryFee), 0),
      customerTotal: rows.reduce((sum, row) => sum + numeric(row.customerTotal), 0),
      merchantBalance: rows.reduce((sum, row) => sum + numeric(row.merchantDue), 0),
    },
  };
}

export default function MerchantStatementExportButton({ payload, isArabic, disabled = false }: Props) {
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);
  const normalizedPayload = useMemo(() => normalizeZeroOrderPayload(payload), [payload]);

  async function exportPdf() {
    if (disabled || busy) return;
    setBusy("pdf");
    try {
      await buildMerchantStatementPdf(normalizedPayload);
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
      buildMerchantStatementCsv(normalizedPayload);
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
