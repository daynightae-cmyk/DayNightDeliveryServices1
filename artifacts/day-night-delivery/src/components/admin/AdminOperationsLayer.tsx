import { useEffect, useMemo, useState } from "react";
import { Database, FileText, Printer, RefreshCw } from "lucide-react";
import type { Merchant, Order } from "../../types";
import type { FinanceRow } from "../../lib/adminData";
import {
  fetchProductionRows,
  productionTableForSection,
  rowBalance,
  rowCredit,
  rowDate,
  rowDebit,
  rowNotes,
  rowReference,
  rowType,
  summarizeRows,
  type AdminProductionSource,
} from "../../lib/adminProductionData";
import { fieldLabel, financeTypeLabel } from "../../data/adminTranslations";
import AdminPdfExportButton from "./AdminPdfExportButton";
import AdminFinanceOperationsCenter from "./AdminFinanceOperationsCenter";
import "../../styles/dn-admin-ops-layer.css";

type FinanceArea =
  | "finance_dashboard"
  | "driver_statements"
  | "merchant_statements"
  | "income"
  | "cod"
  | "expenses"
  | "accounts"
  | "adjustments"
  | "audit_log";

type Props = {
  id: string;
  title: string;
  isArabic: boolean;
  orders: Order[];
  merchants: Merchant[];
  onRefresh: () => Promise<void>;
};

const financeSections: FinanceArea[] = [
  "finance_dashboard",
  "driver_statements",
  "merchant_statements",
  "income",
  "cod",
  "expenses",
  "accounts",
  "adjustments",
  "audit_log",
];

function isFinanceSection(id: string): id is FinanceArea {
  return financeSections.includes(id as FinanceArea);
}

function money(value: unknown) {
  return `${Number(value || 0).toFixed(2)} AED`;
}

function sourceText(source: AdminProductionSource, isArabic: boolean, table: string) {
  if (source === "db") return isArabic ? `مصدر فعلي: ${table}` : `Real source: ${table}`;
  return isArabic ? `جاهز للتفعيل: ${table}` : `Ready to activate: ${table}`;
}

function tablePdf(isArabic: boolean, title: string, source: string, rows: FinanceRow[]) {
  return {
    language: isArabic ? ("ar" as const) : ("en" as const),
    sectionTitle: title,
    filters: `${isArabic ? "مصدر البيانات" : "Data source"}: ${source}`,
    totals: {
      rows: rows.length,
      debit: money(rows.reduce((sum, row) => sum + rowDebit(row), 0)),
      credit: money(rows.reduce((sum, row) => sum + rowCredit(row), 0)),
      balance: money(rows.reduce((sum, row) => sum + rowBalance(row), 0)),
    },
    columns: ["date", "tracking", "type", "debit", "credit", "balance", "notes"].map((key) => ({ key, label: fieldLabel(key, isArabic) })),
    rows: rows.map((row) => ({
      date: rowDate(row),
      tracking: rowReference(row),
      type: financeTypeLabel(rowType(row), isArabic),
      debit: money(rowDebit(row)),
      credit: money(rowCredit(row)),
      balance: money(rowBalance(row)),
      notes: rowNotes(row),
    })),
  };
}

export default function AdminOperationsLayer({ id, title, isArabic, orders, merchants, onRefresh }: Props) {
  const [financeSection, setFinanceSection] = useState<FinanceArea>(isFinanceSection(id) ? id : "finance_dashboard");
  const [rows, setRows] = useState<FinanceRow[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<AdminProductionSource>("unavailable");
  const [tableName, setTableName] = useState(productionTableForSection(id).table);

  async function load() {
    if (isFinanceSection(id)) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await fetchProductionRows(id);
      const normalized = result.rows.map((row) => ({
        ...row,
        debit: rowDebit(row),
        credit: rowCredit(row),
        balance: rowBalance(row),
      }));
      setRows(normalized);
      setSource(result.source);
      setTableName(result.table);
      setMessage(result.message || (result.source === "db"
        ? (isArabic ? "تم تحميل الصفوف من قاعدة البيانات." : "Rows loaded from database.")
        : (isArabic ? "القسم جاهز؛ طبّق migration إذا كان الجدول بلا صفوف." : "Section is ready; apply the migration if the table has no rows.")));
    } catch (error) {
      console.warn("Admin operation load failed:", error);
      setRows([]);
      setSource("unavailable");
      setMessage(isArabic ? "القسم جاهز للتفعيل ولا يعرض صفوفاً وهمية." : "Section is ready to activate and does not show fake rows.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (isFinanceSection(id)) setFinanceSection(id);
    void load();
  }, [id]);

  const totals = useMemo(() => summarizeRows(rows), [rows]);
  const dataSourceText = sourceText(source, isArabic, tableName);

  if (isFinanceSection(id)) {
    return (
      <AdminFinanceOperationsCenter
        isArabic={isArabic}
        activeSection={financeSection}
        orders={orders}
        merchants={merchants}
        financeSummary={null}
        financeSummarySource="derived"
        onRefresh={onRefresh}
        onNavigate={(target) => {
          if (isFinanceSection(target)) setFinanceSection(target);
        }}
      />
    );
  }

  return (
    <section className="dn-ops-layer" dir={isArabic ? "rtl" : "ltr"}>
      <header>
        <div>
          <span>{isArabic ? "طبقة إنتاج منظمة" : "Organized production layer"}</span>
          <h1>{title}</h1>
          <p>{isArabic ? "هذا القسم يستخدم الجداول الفعلية عند توفرها، ولا يعرض بيانات وهمية." : "This section uses real tables when available and never shows fake data."}</p>
        </div>
        <AdminPdfExportButton payload={tablePdf(isArabic, title, dataSourceText, rows)} />
      </header>

      <div className={`dn-ops-message ${source === "db" ? "is-db" : "is-warning"}`}>
        <Database className="inline h-4 w-4" /> {dataSourceText}{message ? ` · ${message}` : ""}
      </div>

      <div className="dn-ops-filters">
        <button type="button" onClick={() => void load()}><RefreshCw className="inline h-4 w-4" /> {busy ? (isArabic ? "تحميل" : "Loading") : (isArabic ? "تحديث" : "Refresh")}</button>
        <button type="button" onClick={() => window.print()}><Printer className="inline h-4 w-4" /> {isArabic ? "طباعة" : "Print"}</button>
      </div>

      <div className="dn-ops-kpis">
        <article><span>{isArabic ? "الصفوف" : "Rows"}</span><strong>{totals.count}</strong></article>
        <article><span>{isArabic ? "مدين" : "Debit"}</span><strong>{money(totals.debit)}</strong></article>
        <article><span>{isArabic ? "دائن/مبلغ" : "Credit/Amount"}</span><strong>{money(totals.credit)}</strong></article>
        <article><span>{isArabic ? "بانتظار إجراء" : "Pending"}</span><strong>{totals.pending}</strong></article>
      </div>

      <div className="dn-ops-table">
        <table>
          <thead>
            <tr>
              <th>{isArabic ? "التاريخ" : "Date"}</th>
              <th>{isArabic ? "التتبع/الكيان" : "Tracking/entity"}</th>
              <th>{isArabic ? "النوع" : "Type"}</th>
              <th>{isArabic ? "مدين" : "Debit"}</th>
              <th>{isArabic ? "دائن" : "Credit"}</th>
              <th>{isArabic ? "الرصيد" : "Balance"}</th>
              <th>{isArabic ? "ملاحظات" : "Notes"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={String(row.id || index)}>
                <td>{rowDate(row)}</td>
                <td>{rowReference(row)}</td>
                <td>{financeTypeLabel(rowType(row), isArabic)}</td>
                <td>{money(rowDebit(row))}</td>
                <td>{money(rowCredit(row))}</td>
                <td>{money(rowBalance(row))}</td>
                <td>{rowNotes(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!rows.length && (
          <div className="dn-ops-empty">
            <FileText className="inline h-4 w-4" /> {isArabic ? "لا توجد صفوف محفوظة لهذا القسم بعد." : "No saved rows exist for this section yet."}
          </div>
        )}
      </div>
    </section>
  );
}
