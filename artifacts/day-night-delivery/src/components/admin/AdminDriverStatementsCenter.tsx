import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpCircle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  FileDown,
  History,
  Info,
  MapPin,
  MessageCircle,
  Phone,
  ReceiptText,
  Save,
  Search,
  ShieldCheck,
  Truck,
  UserRound,
  WalletCards,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Order } from "../../types";
import { useAdminDrivers } from "../../hooks/useAdminDrivers";
import { updateOrderStatus } from "../../lib/adminData";
import {
  createDriverPayrollEntry,
  fetchDriverPayrollSnapshot,
  payrollErrorMessage,
  setDriverPayrollEntryStatus,
  setDriverSalary,
  type DriverPayrollEntry,
  type DriverPayrollEntryType,
  type DriverPayrollSnapshot,
} from "../../lib/adminDriverPayroll";
import type { AdminPdfPayload } from "../../lib/adminPdfExport";
import AdminPdfExportButton from "./AdminPdfExportButton";

 type Props = {
  isArabic: boolean;
  dateFrom: string;
  dateTo: string;
  query: string;
  onNavigate: (id: string) => void;
};

type EntryOption = {
  value: DriverPayrollEntryType;
  ar: string;
  en: string;
  effectAr: string;
  effectEn: string;
  effect: "credit" | "debit" | "payment";
};

const today = () => new Date().toISOString().slice(0, 10);
const clean = (value: unknown) => String(value ?? "").trim();
const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const money = (value: unknown, isArabic: boolean) =>
  isArabic ? `${num(value).toFixed(2)} درهم` : `${num(value).toFixed(2)} AED`;
const normalize = (value: unknown) => clean(value).toLowerCase().replace(/[\s_-]+/g, "");
const reference = (order: Order) =>
  clean(order.tracking_number || order.tracking_code || order.invoice_number || order.id || "—");
const phoneForWhatsApp = (value: unknown) => {
  let digits = clean(value).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `971${digits.slice(1)}`;
  return digits;
};

const entryOptions: EntryOption[] = [
  {
    value: "deduction",
    ar: "خصم من راتب المندوب",
    en: "Salary deduction",
    effectAr: "يُخصم من صافي الراتب ومن المبلغ المتبقي للمندوب.",
    effectEn: "Reduces net salary and the amount outstanding to the driver.",
    effect: "debit",
  },
  {
    value: "advance",
    ar: "سلفة صُرفت للمندوب",
    en: "Driver advance",
    effectAr: "تُعتبر مبلغاً استلمه المندوب مقدماً وتُخصم من استحقاق الفترة.",
    effectEn: "Records money already advanced and reduces the period entitlement.",
    effect: "debit",
  },
  {
    value: "payment",
    ar: "دفعة راتب تم سدادها",
    en: "Salary payment",
    effectAr: "لا تغيّر صافي الاستحقاق؛ تقلل المتبقي الواجب دفعه فقط.",
    effectEn: "Does not change entitlement; it only reduces the outstanding balance.",
    effect: "payment",
  },
  {
    value: "bonus",
    ar: "مكافأة للمندوب",
    en: "Driver bonus",
    effectAr: "تُضاف إلى صافي الراتب وإلى المبلغ المستحق للمندوب.",
    effectEn: "Increases net salary and the amount due to the driver.",
    effect: "credit",
  },
  {
    value: "reimbursement",
    ar: "تعويض مصروف للمندوب",
    en: "Expense reimbursement",
    effectAr: "تُعاد للمندوب كمبلغ مستحق وتُضاف إلى صافي راتبه.",
    effectEn: "Reimburses the driver and increases net salary.",
    effect: "credit",
  },
  {
    value: "expense",
    ar: "مصروف محمّل على المندوب",
    en: "Driver-charged expense",
    effectAr: "يُحمّل على حساب المندوب ويُخصم من صافي الراتب.",
    effectEn: "Charges an expense to the driver and reduces net salary.",
    effect: "debit",
  },
  {
    value: "adjustment",
    ar: "تسوية إضافة",
    en: "Credit adjustment",
    effectAr: "تسوية موجبة تُضاف إلى استحقاق المندوب.",
    effectEn: "A positive adjustment added to driver entitlement.",
    effect: "credit",
  },
  {
    value: "debit_adjustment",
    ar: "تسوية خصم",
    en: "Debit adjustment",
    effectAr: "تسوية سالبة تُخصم من استحقاق المندوب.",
    effectEn: "A negative adjustment deducted from driver entitlement.",
    effect: "debit",
  },
];

function entryOption(type: unknown) {
  return entryOptions.find((item) => item.value === clean(type)) || null;
}

function entryTypeLabel(type: unknown, isArabic: boolean) {
  const option = entryOption(type);
  return option ? (isArabic ? option.ar : option.en) : clean(type).replace(/_/g, " ") || "—";
}

function entryEffectLabel(type: unknown, isArabic: boolean) {
  const option = entryOption(type);
  if (!option) return isArabic ? "حركة مالية" : "Payroll movement";
  if (option.effect === "credit") return isArabic ? "إضافة للاستحقاق" : "Adds to entitlement";
  if (option.effect === "payment") return isArabic ? "سداد من المتبقي" : "Pays down outstanding";
  return isArabic ? "خصم من الاستحقاق" : "Deducts from entitlement";
}

function statusLabel(value: unknown, isArabic: boolean) {
  const status = clean(value).toLowerCase();
  const map: Record<string, [string, string]> = {
    pending: ["جديد", "Pending"],
    review: ["مراجعة", "Review"],
    confirmed: ["بدأ المهمة", "Started"],
    assigned: ["مسند", "Assigned"],
    picked_up: ["تم الاستلام", "Picked up"],
    in_transit: ["في الطريق", "In transit"],
    delivered: ["تم التسليم", "Delivered"],
    cancelled: ["ملغي", "Cancelled"],
    returned: ["راجع", "Returned"],
    postponed: ["مؤجل", "Postponed"],
    approved: ["معتمد", "Approved"],
    draft: ["مسودة", "Draft"],
    void: ["ملغي مع حفظ الأثر", "Void"],
  };
  return map[status]?.[isArabic ? 0 : 1] || status || "—";
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "normal",
}: {
  label: string;
  value: unknown;
  icon: LucideIcon;
  tone?: "normal" | "credit" | "debit" | "gold";
}) {
  const toneClass =
    tone === "credit"
      ? "border-emerald-400/25 bg-emerald-400/[.07] text-emerald-200"
      : tone === "debit"
        ? "border-rose-400/25 bg-rose-400/[.07] text-rose-200"
        : tone === "gold"
          ? "border-brand-gold/35 bg-brand-gold/[.09] text-brand-gold"
          : "border-white/10 bg-[#031226] text-white";
  return (
    <article className={`rounded-[1.3rem] border p-4 ${toneClass}`}>
      <Icon className="h-4 w-4" />
      <small className="mt-2 block text-[10px] font-black opacity-65">{label}</small>
      <strong className="mt-1 block text-lg font-black text-white" dir="ltr">
        {value}
      </strong>
    </article>
  );
}

function salaryCycleLabel(value: unknown, isArabic: boolean) {
  const cycle = clean(value).toLowerCase();
  if (cycle === "daily") return isArabic ? "يومي" : "Daily";
  if (cycle === "weekly") return isArabic ? "أسبوعي" : "Weekly";
  return isArabic ? "شهري" : "Monthly";
}

export default function AdminDriverStatementsCenter({
  isArabic,
  dateFrom,
  dateTo,
  query,
  onNavigate: _onNavigate,
}: Props) {
  const { drivers, loading, error, refresh } = useAdminDrivers();
  const [driverId, setDriverId] = useState("");
  const [driverQuery, setDriverQuery] = useState("");
  const [orderQuery, setOrderQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [payroll, setPayroll] = useState<DriverPayrollSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [salary, setSalary] = useState("");
  const [cycle, setCycle] = useState("monthly");
  const [salaryEffectiveFrom, setSalaryEffectiveFrom] = useState(today());
  const [entryType, setEntryType] = useState<DriverPayrollEntryType>("deduction");
  const [entryDate, setEntryDate] = useState(today());
  const [entryAmount, setEntryAmount] = useState("");
  const [entryNote, setEntryNote] = useState("");
  const [entryReference, setEntryReference] = useState("");

  const driver = drivers.find((item) => item.id === driverId) || null;
  const selectedEntryOption = entryOption(entryType) || entryOptions[0];
  const amount = num(entryAmount);

  const visibleDrivers = useMemo(() => {
    const needle = normalize(`${query} ${driverQuery}`);
    return drivers.filter(
      (item) =>
        !needle ||
        normalize(
          [item.full_name, item.name, item.phone, item.vehicle_plate, item.vehicle_type, item.emirate].join(" "),
        ).includes(needle),
    );
  }, [driverQuery, drivers, query]);

  const visibleOrders = useMemo(() => {
    if (!driver) return [];
    const needle = normalize(orderQuery);
    return driver.orders
      .filter((order) => {
        const date = clean(order.created_at).slice(0, 10);
        return (
          (!dateFrom || date >= dateFrom) &&
          (!dateTo || date <= dateTo) &&
          (!needle ||
            normalize(
              [reference(order), order.receiver_name, order.receiver_phone, order.receiver_city, order.status].join(" "),
            ).includes(needle))
        );
      })
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [dateFrom, dateTo, driver, orderQuery]);

  const selectedOrders = visibleOrders.filter((order) => selected.includes(order.id));

  async function loadPayroll(id = driverId) {
    if (!id) return;
    setBusy(true);
    setMessage("");
    try {
      const next = await fetchDriverPayrollSnapshot(id, dateFrom, dateTo);
      setPayroll(next);
      setSalary(String(next.driver.base_salary ?? 0));
      setCycle(next.driver.salary_cycle || "monthly");
      setSalaryEffectiveFrom(next.driver.salary_effective_from || today());
    } catch (cause) {
      setPayroll(null);
      setMessage(payrollErrorMessage(cause, isArabic));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setSelected([]);
    setOrderQuery("");
    setEntryDate(dateTo || today());
    if (driverId) void loadPayroll(driverId);
    else setPayroll(null);
  }, [driverId, dateFrom, dateTo]);

  async function saveSalary() {
    if (!driver || num(salary) < 0 || !salaryEffectiveFrom) return;
    setBusy(true);
    setMessage("");
    try {
      await setDriverSalary(
        driver.id,
        num(salary),
        cycle,
        salaryEffectiveFrom,
        isArabic
          ? "تحديث راتب المندوب من مركز الرواتب المتخصص"
          : "Salary updated from the specialized driver payroll center",
      );
      await Promise.all([loadPayroll(driver.id), refresh()]);
      setMessage(
        isArabic
          ? `تم حفظ الراتب ${money(salary, true)} بنظام ${salaryCycleLabel(cycle, true)} من تاريخ ${salaryEffectiveFrom}. حُفظ في ملف المندوب وسجل تاريخ الرواتب.`
          : `Salary ${money(salary, false)} was saved as ${salaryCycleLabel(cycle, false)} from ${salaryEffectiveFrom}. It is stored in the driver profile and salary history.`,
      );
    } catch (cause) {
      setMessage(payrollErrorMessage(cause, isArabic));
    } finally {
      setBusy(false);
    }
  }

  async function addEntry() {
    if (!driver || amount <= 0 || !entryNote.trim() || !entryDate) return;
    setBusy(true);
    setMessage("");
    try {
      await createDriverPayrollEntry({
        driverId: driver.id,
        entryDate,
        entryType,
        amount,
        reference: entryReference,
        notes: entryNote,
        status: "approved",
      });
      setEntryAmount("");
      setEntryNote("");
      setEntryReference("");
      await loadPayroll(driver.id);
      setMessage(
        isArabic
          ? `تم ترحيل ${entryTypeLabel(entryType, true)} بقيمة ${money(amount, true)} إلى سجل راتب المندوب بتاريخ ${entryDate}. ${selectedEntryOption.effectAr}`
          : `${entryTypeLabel(entryType, false)} of ${money(amount, false)} was posted to the driver payroll ledger on ${entryDate}. ${selectedEntryOption.effectEn}`,
      );
    } catch (cause) {
      setMessage(payrollErrorMessage(cause, isArabic));
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(order: Order, status: string) {
    setBusy(true);
    setMessage("");
    try {
      await updateOrderStatus(
        order.id,
        status,
        isArabic ? "تحديث من كشف المندوب" : "Updated from driver statement",
      );
      await refresh();
      setMessage(
        isArabic
          ? "تم تحديث حالة الطلبية وظهرت في جميع اللوحات."
          : "Order status updated across all dashboards.",
      );
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  const payrollPdf: AdminPdfPayload = {
    language: isArabic ? "ar" : "en",
    sectionTitle: `${isArabic ? "كشف راتب المندوب" : "Driver payroll statement"} · ${driver?.full_name || driver?.name || "DAY NIGHT"}`,
    filters: `${dateFrom} → ${dateTo}`,
    totals: {
      [isArabic ? "الراتب المحتسب للفترة" : "Period gross salary"]: money(payroll?.gross_salary, isArabic),
      [isArabic ? "الإضافات" : "Credits"]: money(payroll?.credits, isArabic),
      [isArabic ? "إجمالي الخصومات" : "Total deductions"]: money(
        num(payroll?.expenses) +
          num(payroll?.deductions) +
          num(payroll?.advances) +
          num(payroll?.debit_adjustments),
        isArabic,
      ),
      [isArabic ? "صافي الاستحقاق" : "Net entitlement"]: money(payroll?.net_salary, isArabic),
      [isArabic ? "المدفوع" : "Paid"]: money(payroll?.payments, isArabic),
      [isArabic ? "المتبقي" : "Outstanding"]: money(payroll?.outstanding, isArabic),
    },
    columns: [
      { key: "date", label: isArabic ? "التاريخ" : "Date" },
      { key: "type", label: isArabic ? "نوع الحركة" : "Entry type" },
      { key: "effect", label: isArabic ? "الأثر" : "Effect" },
      { key: "amount", label: isArabic ? "المبلغ" : "Amount" },
      { key: "status", label: isArabic ? "الحالة" : "Status" },
      { key: "reference", label: isArabic ? "المرجع" : "Reference" },
      { key: "notes", label: isArabic ? "السبب" : "Reason" },
    ],
    rows: (payroll?.entries || []).map((entry) => ({
      date: entry.entry_date,
      type: entryTypeLabel(entry.entry_type, isArabic),
      effect: entryEffectLabel(entry.entry_type, isArabic),
      amount: money(entry.amount, isArabic),
      status: statusLabel(entry.status, isArabic),
      reference: entry.reference_number || "—",
      notes: entry.notes,
    })),
    orientation: "landscape",
  };

  const ordersPdf: AdminPdfPayload = {
    language: isArabic ? "ar" : "en",
    sectionTitle: `${isArabic ? "طلبيات المندوب" : "Driver orders"} · ${driver?.full_name || driver?.name || "DAY NIGHT"}`,
    filters: `${dateFrom} → ${dateTo} · ${isArabic ? "المحدد" : "Selected"}: ${selectedOrders.length}`,
    totals: {
      [isArabic ? "الطلبات" : "Orders"]: selectedOrders.length,
      [isArabic ? "صافي الراتب" : "Net salary"]: money(payroll?.net_salary, isArabic),
      [isArabic ? "المتبقي" : "Outstanding"]: money(payroll?.outstanding, isArabic),
    },
    columns: [
      { key: "reference", label: isArabic ? "الطلب" : "Order" },
      { key: "date", label: isArabic ? "التاريخ" : "Date" },
      { key: "recipient", label: isArabic ? "المستلم" : "Recipient" },
      { key: "phone", label: isArabic ? "الهاتف" : "Phone" },
      { key: "route", label: isArabic ? "المسار" : "Route" },
      { key: "cod", label: "COD" },
      { key: "status", label: isArabic ? "الحالة" : "Status" },
    ],
    rows: selectedOrders.map((order) => ({
      reference: reference(order),
      date: clean(order.created_at).slice(0, 16).replace("T", " "),
      recipient: order.receiver_name || order.customer_name || "—",
      phone: order.receiver_phone || order.customer_phone || "—",
      route: `${order.sender_city || "—"} → ${order.receiver_city || "—"}`,
      cod: money(order.cod_amount, isArabic),
      status: statusLabel(order.status, isArabic),
    })),
    orientation: "landscape",
  };

  const whatsapp = useMemo(() => {
    if (!driver || !payroll) return "";
    const lines = [
      `السلام عليكم ${driver.full_name || driver.name || "مندوبنا الكريم"}،`,
      `كشف راتب DAY NIGHT للفترة ${dateFrom} إلى ${dateTo}:`,
      `الراتب المحتسب: ${money(payroll.gross_salary, true)}`,
      `الإضافات: ${money(payroll.credits, true)}`,
      `الخصومات والمصاريف والسلف: ${money(num(payroll.expenses) + num(payroll.deductions) + num(payroll.advances) + num(payroll.debit_adjustments), true)}`,
      `صافي الاستحقاق: ${money(payroll.net_salary, true)}`,
      `المدفوع: ${money(payroll.payments, true)}`,
      `المتبقي: ${money(payroll.outstanding, true)}`,
    ];
    if (selectedOrders.length) {
      lines.push("", `الطلبيات المحددة: ${selectedOrders.length}`);
      selectedOrders
        .slice(0, 20)
        .forEach((order, index) => lines.push(`${index + 1}) ${reference(order)} · ${statusLabel(order.status, true)}`));
    }
    lines.push("", "يرجى مراجعة الكشف والتواصل مع مركز العمليات عند وجود أي ملاحظة.");
    return lines.join("\n");
  }, [dateFrom, dateTo, driver, payroll, selectedOrders]);

  if (!driver) {
    return (
      <section className="space-y-4 rounded-[1.8rem] border border-white/10 bg-[#031226] p-4 sm:p-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-black text-brand-gold">
              <Truck className="h-4 w-4" />
              {isArabic ? "رواتب المناديب المتخصصة" : "Specialized driver payroll"}
            </span>
            <h2 className="mt-2 text-2xl font-black text-white">
              {isArabic ? "اختر المندوب لفتح راتبه وسجل حركاته" : "Choose a driver to open payroll and ledger"}
            </h2>
            <p className="mt-2 text-xs font-bold text-white/45">
              {isArabic
                ? "هذا القسم خاص بالمناديب المرتبطين بملفات driver_profiles، ولا يخلط رواتبهم بمصروفات الشركة العامة."
                : "This section is dedicated to drivers linked to driver_profiles and does not mix payroll with general company expenses."}
            </p>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#071a33] px-4 py-3">
            <Search className="h-4 w-4 text-white/35" />
            <input
              value={driverQuery}
              onChange={(event) => setDriverQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none"
              placeholder={isArabic ? "الاسم، الهاتف، المركبة..." : "Name, phone, vehicle..."}
            />
          </label>
        </header>
        {error ? <p className="rounded-xl bg-rose-500/10 p-3 text-xs text-rose-200">{error}</p> : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleDrivers.map((item) => (
            <article key={item.id} className="rounded-[1.4rem] border border-white/10 bg-[#071a33] p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-white/5 text-brand-gold">
                  {item.avatar_url ? (
                    <img src={item.avatar_url} className="h-full w-full object-cover" alt="" />
                  ) : (
                    <UserRound className="h-5 w-5" />
                  )}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-black ${
                    item.presence === "online" ? "bg-emerald-400/10 text-emerald-200" : "bg-white/5 text-white/45"
                  }`}
                >
                  {item.presence}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-black text-white">{item.full_name || item.name || "—"}</h3>
              <p className="mt-1 text-[11px] text-white/45" dir="ltr">
                {item.phone || "—"} · {item.vehicle_plate || "—"}
              </p>
              <div className="mt-4 grid grid-cols-3 border-t border-white/8 pt-3 text-center">
                <span>
                  <b className="block text-white">{item.orders.length}</b>
                  <small className="text-white/38">{isArabic ? "طلب" : "orders"}</small>
                </span>
                <span>
                  <b className="block text-emerald-200">{item.delivered_today}</b>
                  <small className="text-white/38">{isArabic ? "اليوم" : "today"}</small>
                </span>
                <span>
                  <b className="block text-brand-gold">{money(item.base_salary, isArabic)}</b>
                  <small className="text-white/38">{salaryCycleLabel(item.salary_cycle, isArabic)}</small>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDriverId(item.id)}
                className="mt-4 w-full rounded-xl border border-brand-gold/35 bg-brand-gold/10 px-4 py-2.5 text-xs font-black text-brand-gold"
              >
                {isArabic ? "فتح ملف الراتب" : "Open payroll profile"}
              </button>
            </article>
          ))}
        </div>
        {!loading && !visibleDrivers.length ? (
          <div className="grid min-h-40 place-items-center text-sm font-bold text-white/45">
            {isArabic ? "لا توجد ملفات مناديب مطابقة." : "No matching driver profiles."}
          </div>
        ) : null}
      </section>
    );
  }

  const BackIcon = isArabic ? ArrowRight : ArrowLeft;
  const waPhone = phoneForWhatsApp(driver.phone);
  const allSelected = visibleOrders.length > 0 && visibleOrders.every((order) => selected.includes(order.id));
  const payrollDeductions =
    num(payroll?.expenses) +
    num(payroll?.deductions) +
    num(payroll?.advances) +
    num(payroll?.debit_adjustments);
  const paymentTooHigh = entryType === "payment" && payroll && amount > num(payroll.outstanding);

  return (
    <section className="space-y-4">
      <header className="rounded-[1.8rem] border border-brand-gold/25 bg-[#031226] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setDriverId("")}
              className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-white"
            >
              <BackIcon className="h-5 w-5" />
            </button>
            <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-white/5 text-brand-gold">
              {driver.avatar_url ? (
                <img src={driver.avatar_url} className="h-full w-full object-cover" alt="" />
              ) : (
                <UserRound />
              )}
            </span>
            <div>
              <span className="text-[10px] font-black text-brand-gold">
                {isArabic ? "ملف راتب مندوب متخصص" : "SPECIALIZED DRIVER PAYROLL"}
              </span>
              <h2 className="mt-1 text-2xl font-black text-white">{driver.full_name || driver.name}</h2>
              <p className="mt-1 text-[11px] text-white/48">
                <Phone className="inline h-3.5 w-3.5" /> {driver.phone || "—"} ·{" "}
                <MapPin className="inline h-3.5 w-3.5" /> {driver.emirate || driver.work_area || "—"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-[10px] font-black text-emerald-200">
              <ShieldCheck className="h-4 w-4" />
              {isArabic ? "الحفظ في قاعدة البيانات + سجل تدقيق" : "Database saved + audited"}
            </span>
            <AdminPdfExportButton
              payload={payrollPdf}
              label={isArabic ? "كشف الراتب PDF / CSV" : "Payroll PDF / CSV"}
            />
          </div>
        </div>
      </header>

      {message ? (
        <p className="rounded-2xl border border-brand-gold/25 bg-brand-gold/10 px-4 py-3 text-xs font-bold leading-6 text-brand-gold">
          {message}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={isArabic ? "الراتب المحتسب للفترة" : "Period gross salary"}
          value={money(payroll?.gross_salary, isArabic)}
          icon={Banknote}
          tone="gold"
        />
        <MetricCard
          label={isArabic ? "الإضافات والمكافآت" : "Credits and bonuses"}
          value={money(payroll?.credits, isArabic)}
          icon={ArrowUpCircle}
          tone="credit"
        />
        <MetricCard
          label={isArabic ? "الخصومات والمصاريف والسلف" : "Deductions, expenses and advances"}
          value={money(payrollDeductions, isArabic)}
          icon={ArrowDownCircle}
          tone="debit"
        />
        <MetricCard
          label={isArabic ? "صافي الاستحقاق" : "Net entitlement"}
          value={money(payroll?.net_salary, isArabic)}
          icon={CheckCircle2}
          tone="credit"
        />
        <MetricCard
          label={isArabic ? "المدفوع للمندوب" : "Paid to driver"}
          value={money(payroll?.payments, isArabic)}
          icon={ReceiptText}
        />
        <MetricCard
          label={isArabic ? "المتبقي الواجب دفعه" : "Outstanding to pay"}
          value={money(payroll?.outstanding, isArabic)}
          icon={CalendarDays}
          tone="gold"
        />
        <MetricCard
          label={isArabic ? "السلف" : "Advances"}
          value={money(payroll?.advances, isArabic)}
          icon={WalletCards}
          tone="debit"
        />
        <MetricCard
          label={isArabic ? "زيادة مدفوعة" : "Overpaid"}
          value={money(payroll?.overpaid, isArabic)}
          icon={XCircle}
          tone={num(payroll?.overpaid) > 0 ? "debit" : "normal"}
        />
      </div>

      <section className="rounded-[1.5rem] border border-brand-sky/20 bg-brand-sky/[.06] p-4 text-xs font-bold leading-6 text-white/70">
        <div className="flex items-start gap-3">
          <Info className="mt-1 h-5 w-5 shrink-0 text-brand-sky" />
          <div>
            <strong className="text-white">{isArabic ? "طريقة الحساب الواضحة" : "Explicit calculation"}</strong>
            <p className="mt-1">
              {isArabic
                ? "صافي الاستحقاق = راتب الفترة + المكافآت والتعويضات والتسويات الموجبة − الخصومات والسلف والمصروفات المحملة والتسويات السالبة. دفعات الراتب لا تخصم من صافي الاستحقاق؛ تخصم من المتبقي فقط."
                : "Net entitlement = period salary + bonuses, reimbursements and credit adjustments − deductions, advances, driver-charged expenses and debit adjustments. Salary payments reduce outstanding only, not entitlement."}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-[1.8rem] border border-white/10 bg-[#031226] p-5 xl:grid-cols-2">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-black text-white">
            <Banknote className="h-5 w-5 text-brand-gold" />
            {isArabic ? "تعريف الراتب وحفظ تاريخه" : "Salary setup and history"}
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-[10px] font-black text-white/45">
                {isArabic ? "قيمة الراتب" : "Salary amount"}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={salary}
                onChange={(event) => setSalary(event.target.value)}
                placeholder={isArabic ? "الراتب" : "Salary"}
                className="w-full rounded-xl border border-white/10 bg-[#071a33] px-4 py-3 text-sm text-white"
              />
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-black text-white/45">
                {isArabic ? "دورة الراتب" : "Salary cycle"}
              </span>
              <select
                value={cycle}
                onChange={(event) => setCycle(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#071a33] px-4 py-3 text-sm text-white"
              >
                <option value="monthly">{isArabic ? "شهري" : "Monthly"}</option>
                <option value="weekly">{isArabic ? "أسبوعي" : "Weekly"}</option>
                <option value="daily">{isArabic ? "يومي" : "Daily"}</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-black text-white/45">
                {isArabic ? "ساري من تاريخ" : "Effective from"}
              </span>
              <input
                type="date"
                max={today()}
                value={salaryEffectiveFrom}
                onChange={(event) => setSalaryEffectiveFrom(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#071a33] px-4 py-3 text-sm text-white"
              />
            </label>
            <button
              type="button"
              disabled={busy || num(salary) < 0 || !salaryEffectiveFrom}
              onClick={() => void saveSalary()}
              className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-3 text-xs font-black text-[#071a33] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isArabic ? "حفظ الراتب في الملف والسجل" : "Save salary and history"}
            </button>
          </div>
          <p className="mt-3 text-[10px] font-bold leading-5 text-white/42">
            {isArabic
              ? "الحفظ يحدّث الراتب الحالي داخل ملف المندوب، ويضيف نسخة مؤرخة داخل سجل الرواتب حتى لا تضيع الرواتب السابقة. الفترة المعروضة تُحسب يومياً حسب شهري/أسبوعي/يومي."
              : "Saving updates the current driver profile and creates a dated salary-history row. The selected period is prorated daily according to monthly, weekly, or daily cycle."}
          </p>
        </div>

        <div>
          <h3 className="flex items-center gap-2 text-lg font-black text-white">
            <ReceiptText className="h-5 w-5 text-brand-gold" />
            {isArabic ? "إضافة حركة راتب بمكانها الصحيح" : "Post a classified payroll entry"}
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1 block text-[10px] font-black text-white/45">
                {isArabic ? "نوع الحركة" : "Entry type"}
              </span>
              <select
                value={entryType}
                onChange={(event) => setEntryType(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#071a33] px-4 py-3 text-sm text-white"
              >
                {entryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {isArabic ? option.ar : option.en}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-black text-white/45">
                {isArabic ? "تاريخ الحركة" : "Entry date"}
              </span>
              <input
                type="date"
                value={entryDate}
                onChange={(event) => setEntryDate(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#071a33] px-4 py-3 text-sm text-white"
              />
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-black text-white/45">
                {isArabic ? "المبلغ" : "Amount"}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={entryAmount}
                onChange={(event) => setEntryAmount(event.target.value)}
                placeholder={isArabic ? "المبلغ" : "Amount"}
                className="w-full rounded-xl border border-white/10 bg-[#071a33] px-4 py-3 text-sm text-white"
              />
            </label>
            <input
              value={entryReference}
              onChange={(event) => setEntryReference(event.target.value)}
              placeholder={isArabic ? "مرجع / فاتورة / مخالفة" : "Reference / invoice / violation"}
              className="rounded-xl border border-white/10 bg-[#071a33] px-4 py-3 text-sm text-white"
            />
            <input
              value={entryNote}
              onChange={(event) => setEntryNote(event.target.value)}
              placeholder={isArabic ? "السبب الإلزامي بالتفصيل" : "Required detailed reason"}
              className="rounded-xl border border-white/10 bg-[#071a33] px-4 py-3 text-sm text-white"
            />
          </div>
          <div
            className={`mt-3 rounded-xl border p-3 text-[11px] font-bold leading-5 ${
              selectedEntryOption.effect === "credit"
                ? "border-emerald-400/20 bg-emerald-400/[.06] text-emerald-100"
                : selectedEntryOption.effect === "payment"
                  ? "border-brand-sky/20 bg-brand-sky/[.06] text-brand-sky"
                  : "border-rose-400/20 bg-rose-400/[.06] text-rose-100"
            }`}
          >
            <strong>{isArabic ? "أثر الحركة قبل الحفظ: " : "Impact before posting: "}</strong>
            {isArabic ? selectedEntryOption.effectAr : selectedEntryOption.effectEn}
            {amount > 0 ? ` ${money(amount, isArabic)}` : ""}
          </div>
          {paymentTooHigh ? (
            <p className="mt-2 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-[11px] font-bold text-rose-100">
              {isArabic
                ? `قيمة الدفعة أكبر من المتبقي الحالي ${money(payroll?.outstanding, true)}. راجع المبلغ قبل الحفظ.`
                : `The payment exceeds the current outstanding balance of ${money(payroll?.outstanding, false)}.`}
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy || amount <= 0 || !entryNote.trim() || !entryDate || paymentTooHigh}
            onClick={() => void addEntry()}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-3 text-xs font-black text-[#071a33] disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isArabic ? "ترحيل الحركة إلى سجل راتب المندوب" : "Post to driver payroll ledger"}
          </button>
        </div>
      </section>

      {payroll?.salary_history?.length ? (
        <section className="rounded-[1.8rem] border border-white/10 bg-[#031226] p-5">
          <h3 className="flex items-center gap-2 text-xl font-black text-white">
            <History className="h-5 w-5 text-brand-gold" />
            {isArabic ? "تاريخ الرواتب المحفوظ" : "Saved salary history"}
          </h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {payroll.salary_history.map((history) => (
              <article key={history.id} className="rounded-xl border border-white/10 bg-white/[.035] p-4">
                <strong className="text-white">{money(history.base_salary, isArabic)}</strong>
                <p className="mt-1 text-[11px] font-bold text-brand-gold">
                  {salaryCycleLabel(history.salary_cycle, isArabic)} · {history.effective_from} →{" "}
                  {history.effective_to || (isArabic ? "مستمر" : "Current")}
                </p>
                <small className="mt-2 block text-white/40">{history.note || "—"}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[1.8rem] border border-white/10 bg-[#031226]">
        <header className="flex flex-col gap-3 border-b border-white/10 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl font-black text-white">
              {visibleOrders.length} {isArabic ? "طلبية للمندوب" : "driver orders"}
            </h3>
            <p className="text-xs text-white/45">
              {dateFrom} → {dateTo}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#071a33] px-4 py-2">
              <Search className="h-4 w-4 text-white/35" />
              <input
                value={orderQuery}
                onChange={(event) => setOrderQuery(event.target.value)}
                className="bg-transparent text-xs text-white outline-none"
                placeholder={isArabic ? "بحث بالطلب أو العميل" : "Search order or customer"}
              />
            </label>
            <button
              type="button"
              onClick={() => setSelected(allSelected ? [] : visibleOrders.map((order) => order.id))}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-white"
            >
              {allSelected ? (isArabic ? "إلغاء الكل" : "Clear all") : isArabic ? "تحديد الكل" : "Select all"}
            </button>
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-start text-xs">
            <thead className="bg-white/[.04] text-white/55">
              <tr>
                <th className="px-4 py-3">{isArabic ? "تحديد" : "Select"}</th>
                <th className="px-4 py-3">{isArabic ? "الطلب" : "Order"}</th>
                <th className="px-4 py-3">{isArabic ? "المستلم" : "Recipient"}</th>
                <th className="px-4 py-3">{isArabic ? "المسار" : "Route"}</th>
                <th className="px-4 py-3">COD</th>
                <th className="px-4 py-3">{isArabic ? "الحالة والتحكم" : "Status & control"}</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => (
                <tr
                  key={order.id}
                  className={
                    selected.includes(order.id)
                      ? "border-t border-white/7 bg-brand-gold/[.08] text-white/75"
                      : "border-t border-white/7 text-white/75"
                  }
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(order.id)}
                      onChange={() =>
                        setSelected((current) =>
                          current.includes(order.id)
                            ? current.filter((id) => id !== order.id)
                            : [...current, order.id],
                        )
                      }
                    />
                  </td>
                  <td className="px-4 py-3 font-black text-white" dir="ltr">
                    {reference(order)}
                  </td>
                  <td className="px-4 py-3">
                    {order.receiver_name || "—"}
                    <small className="block text-white/40" dir="ltr">
                      {order.receiver_phone || "—"}
                    </small>
                  </td>
                  <td className="px-4 py-3">
                    {order.sender_city || "—"} → {order.receiver_city || "—"}
                  </td>
                  <td className="px-4 py-3" dir="ltr">
                    {money(order.cod_amount, isArabic)}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={clean(order.status).toLowerCase()}
                      onChange={(event) => void changeStatus(order, event.target.value)}
                      disabled={busy}
                      className="rounded-lg border border-white/10 bg-[#071a33] px-3 py-2 text-xs text-white"
                    >
                      <option value="pending">{isArabic ? "جديد" : "Pending"}</option>
                      <option value="review">{isArabic ? "مراجعة" : "Review"}</option>
                      <option value="confirmed">{isArabic ? "بدأ المهمة" : "Started"}</option>
                      <option value="assigned">{isArabic ? "مسند" : "Assigned"}</option>
                      <option value="picked_up">{isArabic ? "تم الاستلام" : "Picked up"}</option>
                      <option value="in_transit">{isArabic ? "في الطريق" : "In transit"}</option>
                      <option value="delivered">{isArabic ? "تم التسليم" : "Delivered"}</option>
                      <option value="postponed">{isArabic ? "مؤجل" : "Postponed"}</option>
                      <option value="returned">{isArabic ? "راجع" : "Returned"}</option>
                      <option value="cancelled">{isArabic ? "ملغي" : "Cancelled"}</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleOrders.length ? (
            <div className="grid min-h-40 place-items-center text-sm font-bold text-white/45">
              {isArabic ? "لا توجد طلبيات في الفترة المحددة." : "No orders in the selected period."}
            </div>
          ) : null}
        </div>
      </section>

      {payroll?.entries?.length ? (
        <section className="rounded-[1.8rem] border border-white/10 bg-[#031226] p-5">
          <h3 className="text-xl font-black text-white">
            {isArabic ? "حركات الراتب المحفوظة" : "Saved payroll entries"}
          </h3>
          <p className="mt-1 text-[10px] font-bold text-white/42">
            {isArabic
              ? "كل حركة تُحفظ بنوعها وتاريخها وسببها ومرجعها. الإلغاء لا يحذف السجل، بل يجعله ملغياً ويحفظ أثر التدقيق."
              : "Every entry keeps its type, date, reason, and reference. Voiding preserves the audit trail instead of deleting the row."}
          </p>
          <div className="mt-4 space-y-2">
            {payroll.entries.map((entry: DriverPayrollEntry) => {
              const option = entryOption(entry.entry_type);
              const credit = option?.effect === "credit";
              const payment = option?.effect === "payment";
              return (
                <article
                  key={entry.id}
                  className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[.035] p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <strong
                      className={credit ? "text-emerald-200" : payment ? "text-brand-sky" : "text-rose-200"}
                    >
                      {entryTypeLabel(entry.entry_type, isArabic)} · {money(entry.amount, isArabic)}
                    </strong>
                    <p className="mt-1 text-[10px] font-bold text-white/55">
                      {entryEffectLabel(entry.entry_type, isArabic)}
                    </p>
                    <p className="mt-1 text-[10px] text-white/40">
                      {entry.entry_date} · {entry.reference_number || "—"} · {entry.notes}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] text-white/55">
                      {statusLabel(entry.status, isArabic)}
                    </span>
                    {entry.status !== "void" ? (
                      <button
                        type="button"
                        onClick={async () => {
                          await setDriverPayrollEntryStatus(
                            entry.id,
                            "void",
                            isArabic ? "إلغاء من مركز رواتب المناديب" : "Voided from driver payroll center",
                          );
                          await loadPayroll(driver.id);
                        }}
                        className="rounded-lg bg-rose-500/10 px-3 py-1 text-[10px] font-black text-rose-200"
                      >
                        {isArabic ? "إلغاء الحركة" : "Void"}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <aside className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-[1.5rem] border border-brand-gold/25 bg-[#06172c]/95 p-4 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
        <strong className="text-white">
          {selectedOrders.length} {isArabic ? "طلبية محددة" : "selected orders"}
        </strong>
        <div className="flex flex-wrap gap-2">
          {selectedOrders.length ? (
            <AdminPdfExportButton
              payload={ordersPdf}
              label={isArabic ? "كشف الطلبيات PDF / CSV" : "Orders PDF / CSV"}
            />
          ) : (
            <button type="button" disabled className="dn-admin-pdf-button opacity-40">
              <FileDown className="h-4 w-4" />
              {isArabic ? "حدد طلبيات لطباعة كشف المهام" : "Select orders to export"}
            </button>
          )}
          <a
            href={waPhone && payroll ? `https://wa.me/${waPhone}?text=${encodeURIComponent(whatsapp)}` : undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!waPhone || !payroll}
            className="inline-flex items-center gap-2 rounded-xl bg-[#25d366] px-4 py-3 text-xs font-black text-[#031226] aria-disabled:pointer-events-none aria-disabled:opacity-35"
          >
            <MessageCircle className="h-4 w-4" />
            {isArabic ? "إرسال كشف الراتب للمندوب" : "Send payroll to driver"}
          </a>
        </div>
      </aside>
    </section>
  );
}
