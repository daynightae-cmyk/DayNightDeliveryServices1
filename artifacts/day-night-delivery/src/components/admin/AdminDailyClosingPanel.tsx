import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Database,
  FileMinus,
  Landmark,
  Loader2,
  LockKeyhole,
  PiggyBank,
  Printer,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Store,
  Truck,
} from "lucide-react";
import type { Order } from "../../types";
import {
  fetchDailyClosing,
  saveDailyClosing,
  type DailyClosingSnapshot,
  type DailyClosingStatus,
} from "../../lib/adminDailyClosingRuntime";
import type { FinanceSummary, FinanceSummarySource } from "../../lib/adminData";
import AdminPdfExportButton from "./AdminPdfExportButton";
import { AdminIconBadge, AdminStateChip, type AdminIconName } from "./adminIconSystem";
import { addAdminNotification, playAdminAudioEvent } from "../../lib/adminAudio";
import "../../styles/dn-daily-closing.css";

type Props = {
  isArabic: boolean;
  orders: Order[];
  financeSummary: FinanceSummary | null;
  financeSummarySource: FinanceSummarySource;
  onNavigate?: (id: string) => void;
};

const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

function dubaiTodayKey() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function money(value: unknown, isArabic: boolean) {
  const formatted = num(value).toLocaleString(isArabic ? "ar-AE" : "en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isArabic ? `${formatted} درهم` : `AED ${formatted}`;
}

function statusText(status: DailyClosingStatus | "blocked", isArabic: boolean) {
  const labels: Record<string, [string, string]> = {
    blocked: ["غير متصل بالدفتر المالي", "Finance ledger unavailable"],
    draft: ["مفتوح للحساب", "Open for calculation"],
    needs_review: ["يحتاج مراجعة", "Needs review"],
    closed: ["مغلق ومثبت", "Closed & locked"],
    reopened: ["أعيد فتحه", "Reopened"],
  };
  return labels[status][isArabic ? 0 : 1];
}

function sourceText(snapshot: DailyClosingSnapshot | null, isArabic: boolean) {
  if (!snapshot || snapshot.source === "unavailable") return isArabic ? "غير متصل" : "Unavailable";
  if (snapshot.source === "persisted") return isArabic ? "لقطة إغلاق محفوظة" : "Persisted closing snapshot";
  if (snapshot.source === "tables") return isArabic ? "جداول الإنتاج المباشرة" : "Direct production tables";
  return isArabic ? "RPC مالي مباشر" : "Authoritative finance RPC";
}

function generatedText(value: string | undefined, isArabic: boolean) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(isArabic ? "ar-AE" : "en-AE", {
    timeZone: "Asia/Dubai",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminDailyClosingPanel({
  isArabic,
  orders: _orders,
  financeSummary: _legacyFinanceSummary,
  financeSummarySource: _legacyFinanceSource,
  onNavigate,
}: Props) {
  const [selectedDate, setSelectedDate] = useState(dubaiTodayKey);
  const [record, setRecord] = useState<DailyClosingSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [lastError, setLastError] = useState("");

  const ledgerReady = Boolean(record?.authoritative && record.source !== "unavailable");
  const isClosed = record?.status === "closed";

  async function load() {
    setBusy(true);
    setMessage("");
    setLastError("");
    try {
      const next = await fetchDailyClosing(selectedDate);
      setRecord(next);
      if (next.source === "tables") {
        setMessage(
          isArabic
            ? "الـRPC غير متاح مؤقتًا، لكن الأرقام الحالية محسوبة مباشرة من جداول الإنتاج الفعلية وليست معاينة محلية."
            : "The RPC is temporarily unavailable, but these values are calculated directly from production finance tables—not a local preview.",
        );
      } else if (next.source === "persisted") {
        setMessage(
          isArabic
            ? "هذه لقطة الإغلاق المحفوظة في قاعدة البيانات. الأرقام مثبتة كما كانت وقت الإغلاق."
            : "This is the database-persisted closing snapshot. Values are locked to the moment the day was closed.",
        );
      } else if (next.source === "unavailable") {
        setLastError(next.reason || "finance_unavailable");
        setMessage(
          isArabic
            ? "تعذر الوصول إلى دفتر مالي موثوق. لن نعرض أصفارًا محلية على أنها أرقام فعلية."
            : "An authoritative finance source is unavailable. Local zero values will not be presented as real finance data.",
        );
      }
    } catch (error) {
      console.warn("Authoritative daily closing unavailable:", error);
      setRecord(null);
      setLastError(error instanceof Error ? error.message : String(error));
      setMessage(
        isArabic
          ? "تعذر تحميل الإغلاق المالي من قاعدة البيانات. لم يتم استخدام أي حفظ محلي أو إجمالي قديم."
          : "The financial closing could not be loaded from the database. No local persistence or legacy total was used.",
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [selectedDate]);

  useEffect(() => {
    if (!record?.authoritative || record.source === "unavailable") return;
    const hasRisk = record.net_total < 0 || record.unreconciled_cod > 0 || record.unposted_delivered_orders > 0;
    const needsReview = record.cod_pending > 0 || record.unassigned_orders > 0 || record.pending_review_orders > 0;
    if (hasRisk) {
      addAdminNotification({
        type: "warning",
        sectionId: "daily_closing",
        priority: "high",
        dedupeKey: `closing:${selectedDate}:risk:${record.unposted_delivered_orders}:${record.unreconciled_cod}`,
        audioEvent: "warning",
        titleAr: "الإغلاق اليومي يحتاج انتباه",
        titleEn: "Daily closing requires attention",
        bodyAr: `طلبات مسلّمة غير مُرحّلة ${record.unposted_delivered_orders}، وتحصيل غير مسوى ${money(record.unreconciled_cod, true)}.`,
        bodyEn: `${record.unposted_delivered_orders} delivered orders are unposted and ${money(record.unreconciled_cod, false)} is unreconciled.`,
      });
    } else if (needsReview) {
      addAdminNotification({
        type: "daily_closing",
        sectionId: "daily_closing",
        priority: "high",
        dedupeKey: `closing:${selectedDate}:review:${record.cod_pending}:${record.unassigned_orders}`,
        audioEvent: "daily_closing_warning",
        titleAr: "الإغلاق يحتاج مراجعة",
        titleEn: "Closing needs review",
        bodyAr: `تحصيل معلق ${money(record.cod_pending, true)}، وطلبات بدون مندوب ${record.unassigned_orders}.`,
        bodyEn: `Pending collection ${money(record.cod_pending, false)} and ${record.unassigned_orders} unassigned orders.`,
      });
    }
  }, [record, selectedDate]);

  async function save(status: DailyClosingStatus) {
    if (!record || !ledgerReady) return;
    if (status === "closed") {
      if (record.unposted_delivered_orders > 0) {
        setMessage(
          isArabic
            ? `لا يمكن تثبيت الإغلاق: يوجد ${record.unposted_delivered_orders} طلب مسلّم لم يُرحّل ماليًا بعد.`
            : `Closing cannot be locked: ${record.unposted_delivered_orders} delivered orders are not financially posted yet.`,
        );
        playAdminAudioEvent("warning");
        return;
      }
      const confirmed = window.confirm(
        isArabic
          ? `سيتم تثبيت إغلاق ${selectedDate} في قاعدة البيانات.\n\nصافي التشغيل: ${money(record.net_total, true)}\nالمحصل: ${money(record.cod_collected, true)}\nمستحق التجار: ${money(record.merchant_due, true)}\n\nهل تريد المتابعة؟`
          : `The ${selectedDate} closing will be locked in the database.\n\nOperating net: ${money(record.net_total, false)}\nCollected: ${money(record.cod_collected, false)}\nMerchant due: ${money(record.merchant_due, false)}\n\nContinue?`,
      );
      if (!confirmed) return;
    }

    setBusy(true);
    setMessage("");
    try {
      const notes =
        status === "closed"
          ? "Closing reviewed and locked by admin"
          : status === "reopened"
            ? "Closing reopened by admin"
            : "Authoritative daily finance snapshot";
      const next = await saveDailyClosing(record, status, notes);
      setRecord(next);
      playAdminAudioEvent("success");
      setMessage(
        status === "closed"
          ? isArabic
            ? "تم إغلاق اليوم وتثبيت اللقطة المالية في قاعدة البيانات."
            : "The day was closed and the finance snapshot was persisted in the database."
          : status === "reopened"
            ? isArabic
              ? "تمت إعادة فتح اليوم مع تسجيل العملية في التدقيق المالي."
              : "The day was reopened and the finance action was audited."
            : isArabic
              ? "تم حفظ لقطة مالية فعلية في قاعدة البيانات."
              : "An authoritative finance snapshot was saved to the database.",
      );
    } catch (error) {
      console.warn("Daily closing save failed:", error);
      const text = error instanceof Error ? error.message : String(error);
      setLastError(text);
      setMessage(
        text.includes("unposted")
          ? isArabic
            ? "لا يمكن الإغلاق قبل ترحيل كل الطلبات المسلّمة الخاصة بهذا اليوم."
            : "The day cannot be closed until its delivered orders are financially posted."
          : isArabic
            ? "تعذر حفظ الإغلاق في قاعدة البيانات. تم إيقاف العملية دون إنشاء أرقام محلية أو مزيفة."
            : "The closing could not be persisted. The operation stopped without creating local or fabricated finance data.",
      );
      playAdminAudioEvent("warning");
    } finally {
      setBusy(false);
    }
  }

  const cards = useMemo<Array<{ ar: string; en: string; key: keyof DailyClosingSnapshot; icon: AdminIconName; kind?: "money"; risk?: boolean }>>(
    () => [
      { ar: "طلبات اليوم", en: "Today's orders", key: "total_orders", icon: "orders" },
      { ar: "طلبات مسلّمة ومُرحّلة", en: "Delivered & posted", key: "delivered_orders", icon: "delivered-orders" },
      { ar: "قيمة البضاعة", en: "Goods value", key: "goods_value", icon: "package", kind: "money" },
      { ar: "دخل التوصيل", en: "Delivery revenue", key: "delivery_income", icon: "income", kind: "money" },
      { ar: "الخصومات", en: "Discounts", key: "discounts_total", icon: "adjustments", kind: "money" },
      { ar: "إجمالي العملاء", en: "Customer total", key: "customer_total", icon: "cod", kind: "money" },
      { ar: "مستحق التجار", en: "Merchant due", key: "merchant_due", icon: "merchant", kind: "money" },
      { ar: "المحصل", en: "Collected", key: "cod_collected", icon: "cash-collection", kind: "money" },
      { ar: "تحصيل معلق", en: "Pending collection", key: "cod_pending", icon: "warning", kind: "money", risk: num(record?.cod_pending) > 0 },
      { ar: "مصروفات معتمدة", en: "Approved expenses", key: "expenses_total", icon: "expenses", kind: "money" },
      { ar: "التسويات", en: "Adjustments", key: "adjustments_net", icon: "adjustments", kind: "money" },
      { ar: "صافي التشغيل", en: "Operating net", key: "net_total", icon: "income", kind: "money", risk: num(record?.net_total) < 0 },
      { ar: "الميزانية", en: "Budget allocated", key: "budget_allocated", icon: "finance", kind: "money" },
      { ar: "متبقي الميزانية", en: "Budget remaining", key: "budget_remaining", icon: "finance", kind: "money", risk: num(record?.budget_remaining) < 0 },
      { ar: "مُسلّم غير مُرحّل", en: "Delivered, unposted", key: "unposted_delivered_orders", icon: "warning", risk: num(record?.unposted_delivered_orders) > 0 },
      { ar: "طلبات بدون مندوب", en: "Unassigned orders", key: "unassigned_orders", icon: "unassigned-orders", risk: num(record?.unassigned_orders) > 0 },
    ],
    [record],
  );

  const valueFor = (card: (typeof cards)[number]) => {
    if (!record || record.source === "unavailable") return "—";
    const value = record[card.key];
    return card.kind === "money" ? money(value, isArabic) : num(value).toLocaleString(isArabic ? "ar-AE" : "en-AE");
  };

  const summaryText = record
    ? isArabic
      ? `إغلاق ${selectedDate}: صافي ${money(record.net_total, true)}، دخل ${money(record.delivery_income, true)}، مصروفات ${money(record.expenses_total, true)}، مستحق تجار ${money(record.merchant_due, true)}، غير مُرحّل ${record.unposted_delivered_orders}.`
      : `Closing ${selectedDate}: net ${money(record.net_total, false)}, income ${money(record.delivery_income, false)}, expenses ${money(record.expenses_total, false)}, merchant due ${money(record.merchant_due, false)}, unposted ${record.unposted_delivered_orders}.`
    : "";

  const pdfPayload = {
    language: isArabic ? ("ar" as const) : ("en" as const),
    sectionTitle: isArabic ? "الإغلاق المالي اليومي" : "Daily financial closing",
    filters: `${selectedDate} · ${sourceText(record, isArabic)}`,
    totals: Object.fromEntries(cards.map((card) => [isArabic ? card.ar : card.en, valueFor(card)])),
    columns: [
      { key: "metric", label: isArabic ? "البند" : "Metric" },
      { key: "value", label: isArabic ? "القيمة" : "Value" },
    ],
    rows: cards.map((card) => ({ metric: isArabic ? card.ar : card.en, value: valueFor(card) })),
  };

  return (
    <section className={`dn-daily-closing ${record?.status || "loading"}`} dir={isArabic ? "rtl" : "ltr"}>
      <div className="dn-closing-ambient dn-closing-ambient-a" aria-hidden="true" />
      <div className="dn-closing-ambient dn-closing-ambient-b" aria-hidden="true" />

      <header>
        <div className="dn-closing-title">
          <AdminIconBadge name="daily-closing" label={isArabic ? "إغلاق يومي" : "Daily closing"} />
          <div>
            <div className="dn-closing-chip-row">
              <AdminStateChip name={ledgerReady ? "database-health" : "warning"} tone={ledgerReady ? "success" : "danger"}>
                {ledgerReady ? (isArabic ? "بيانات مالية فعلية" : "Authoritative finance data") : isArabic ? "لا توجد أرقام موثوقة" : "No authoritative values"}
              </AdminStateChip>
              {isClosed && (
                <AdminStateChip name="daily-closing" tone="success">
                  {isArabic ? "مثبت في قاعدة البيانات" : "Locked in database"}
                </AdminStateChip>
              )}
            </div>
            <h2>{isArabic ? "الإغلاق المالي اليومي" : "Daily Financial Closing"}</h2>
            <p>
              {isArabic
                ? "مصدر الحقيقة هو ترحيلات الطلبات والمصروفات المعتمدة والتسويات والميزانية في قاعدة البيانات. لا إجماليات قديمة، لا localStorage، ولا أرقام معاينة مزيفة."
                : "The source of truth is database-posted orders, approved expenses, adjustments, and budgets. No legacy totals, localStorage, or fabricated preview values."}
            </p>
          </div>
        </div>
        <AdminStateChip name={ledgerReady ? "daily-closing" : "warning"} tone={ledgerReady && record?.status === "closed" ? "success" : ledgerReady ? "warning" : "danger"}>
          {statusText(ledgerReady && record ? record.status : "blocked", isArabic)}
        </AdminStateChip>
      </header>

      <div className="dn-closing-controlbar">
        <label>
          <span>{isArabic ? "تاريخ الإغلاق" : "Closing date"}</span>
          <input
            type="date"
            value={selectedDate}
            max={dubaiTodayKey()}
            onChange={(event) => setSelectedDate(event.target.value || dubaiTodayKey())}
            disabled={busy}
          />
        </label>
        <div className="dn-closing-source-card">
          <Database aria-hidden="true" />
          <div>
            <span>{isArabic ? "مصدر البيانات" : "Data source"}</span>
            <b>{sourceText(record, isArabic)}</b>
          </div>
        </div>
        <div className="dn-closing-source-card">
          <RefreshCw aria-hidden="true" />
          <div>
            <span>{isArabic ? "آخر حساب" : "Last calculated"}</span>
            <b>{generatedText(record?.generated_at, isArabic)}</b>
          </div>
        </div>
        <div className="dn-closing-source-card">
          <LockKeyhole aria-hidden="true" />
          <div>
            <span>{isArabic ? "الحفظ" : "Persistence"}</span>
            <b>{isArabic ? "قاعدة البيانات فقط" : "Database only"}</b>
          </div>
        </div>
      </div>

      {message && <p className={`dn-local-review ${ledgerReady ? "" : "is-error"}`}>{message}</p>}
      {lastError && !ledgerReady && <code className="dn-closing-error-code">{lastError}</code>}

      <div className="dn-closing-grid" aria-busy={busy}>
        {cards.map((card) => (
          <article key={card.en} className={`${card.risk ? "is-risk" : ""} ${!record || record.source === "unavailable" ? "is-unavailable" : ""}`}>
            <AdminIconBadge name={card.icon} label={isArabic ? card.ar : card.en} />
            <span>{isArabic ? card.ar : card.en}</span>
            <b>{busy && !record ? <Loader2 aria-hidden="true" className="animate-spin" /> : valueFor(card)}</b>
          </article>
        ))}
      </div>

      {record && ledgerReady && (
        <div className="dn-closing-integrity-strip">
          <span><b>{isArabic ? "ملغية" : "Cancelled"}</b>{record.cancelled_orders}</span>
          <span><b>{isArabic ? "مرتجعة" : "Returned"}</b>{record.returned_orders}</span>
          <span><b>{isArabic ? "قيد المراجعة" : "Pending review"}</b>{record.pending_review_orders}</span>
          <span className={record.unreconciled_cod > 0 ? "is-risk" : ""}><b>{isArabic ? "تحصيل غير مسوّى" : "Unreconciled COD"}</b>{money(record.unreconciled_cod, isArabic)}</span>
          <span><b>{isArabic ? "نسخة البيانات" : "Data version"}</b>{record.data_version || "daily-closing-v3"}</span>
        </div>
      )}

      {!ledgerReady && (
        <div className="dn-closing-blocker">
          <AlertTriangle aria-hidden="true" />
          <div>
            <b>{isArabic ? "الحفظ والإغلاق متوقفان لأن مصدر الحقيقة غير متاح" : "Save and close are blocked because the source of truth is unavailable"}</b>
            <span>
              {isArabic
                ? "بعد تطبيق Migration الإغلاق المالي سيقرأ قاعدة الإنتاج مباشرة. وحتى ذلك الوقت لا تُعرض أصفار Preview على أنها نتائج حقيقية."
                : "Once the finance migration is installed, this panel reads production directly. Until then, preview zeroes are not presented as real results."}
            </span>
          </div>
        </div>
      )}

      {isClosed && record?.reviewed_at && (
        <div className="dn-closing-locked-note">
          <LockKeyhole aria-hidden="true" />
          <span>
            {isArabic ? "تم تثبيت هذا الإغلاق" : "This closing was locked"} · {generatedText(record.reviewed_at, isArabic)}
          </span>
        </div>
      )}

      <div className="dn-closing-actions">
        <button type="button" disabled={busy || !ledgerReady || isClosed} onClick={() => void save("draft")}>
          {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <CheckCircle2 aria-hidden="true" />}
          {isArabic ? "حفظ لقطة فعلية" : "Save authoritative snapshot"}
        </button>
        <button
          type="button"
          className="is-primary"
          disabled={busy || !ledgerReady || isClosed || num(record?.unposted_delivered_orders) > 0}
          onClick={() => void save("closed")}
        >
          <ShieldAlert aria-hidden="true" />
          {isArabic ? "مراجعة وتثبيت الإغلاق" : "Review & lock closing"}
        </button>
        <button type="button" disabled={busy || !ledgerReady || !isClosed} onClick={() => void save("reopened")}>
          <RotateCcw aria-hidden="true" />
          {isArabic ? "إعادة فتح اليوم" : "Reopen day"}
        </button>
        <button type="button" disabled={busy} onClick={() => void load()}>
          <RefreshCw aria-hidden="true" className={busy ? "animate-spin" : ""} />
          {isArabic ? "تحديث من القاعدة" : "Refresh from database"}
        </button>
        <button type="button" disabled={!summaryText} onClick={() => void navigator.clipboard?.writeText(summaryText)}>
          <Clipboard aria-hidden="true" />
          {isArabic ? "نسخ الملخص" : "Copy summary"}
        </button>
        <AdminPdfExportButton label={isArabic ? "تصدير PDF" : "Export PDF"} payload={pdfPayload} />
        <button type="button" onClick={() => onNavigate?.("finance_dashboard")}><Landmark aria-hidden="true" />{isArabic ? "المالية" : "Finance"}</button>
        <button type="button" onClick={() => onNavigate?.("expenses")}><FileMinus aria-hidden="true" />{isArabic ? "المصروفات" : "Expenses"}</button>
        <button type="button" onClick={() => onNavigate?.("finance_dashboard")}><PiggyBank aria-hidden="true" />{isArabic ? "الميزانية" : "Budget"}</button>
        <button type="button" onClick={() => onNavigate?.("driver_statements")}><Truck aria-hidden="true" />{isArabic ? "المناديب" : "Drivers"}</button>
        <button type="button" onClick={() => onNavigate?.("merchant_statements")}><Store aria-hidden="true" />{isArabic ? "التجار" : "Merchants"}</button>
        <button type="button" onClick={() => onNavigate?.("print")}><Printer aria-hidden="true" />{isArabic ? "الطباعة" : "Print"}</button>
      </div>
    </section>
  );
}
