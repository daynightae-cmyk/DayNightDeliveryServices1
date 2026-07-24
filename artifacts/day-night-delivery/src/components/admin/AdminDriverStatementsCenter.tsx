import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
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
  value: string;
  ar: string;
  en: string;
  effect: "credit" | "debit" | "payment";
  effectAr: string;
  effectEn: string;
};

const entryOptions: EntryOption[] = [
  { value: "deduction", ar: "خصم من راتب المندوب", en: "Salary deduction", effect: "debit", effectAr: "يخصم من صافي الاستحقاق والمتبقي.", effectEn: "Reduces net entitlement and outstanding." },
  { value: "advance", ar: "سلفة صُرفت للمندوب", en: "Driver advance", effect: "debit", effectAr: "مبلغ استلمه المندوب مقدماً ويخصم من استحقاقه.", effectEn: "Records money advanced and reduces entitlement." },
  { value: "payment", ar: "دفعة راتب تم سدادها", en: "Salary payment", effect: "payment", effectAr: "تقلل المتبقي فقط ولا تغيّر صافي الاستحقاق.", effectEn: "Reduces outstanding only, not net entitlement." },
  { value: "bonus", ar: "مكافأة للمندوب", en: "Driver bonus", effect: "credit", effectAr: "تضاف إلى صافي الاستحقاق والمتبقي.", effectEn: "Increases net entitlement and outstanding." },
  { value: "reimbursement", ar: "تعويض مصروف للمندوب", en: "Expense reimbursement", effect: "credit", effectAr: "مبلغ مستحق يُعاد للمندوب ويضاف إلى راتبه.", effectEn: "Reimburses the driver and increases entitlement." },
  { value: "expense", ar: "مصروف محمّل على المندوب", en: "Driver-charged expense", effect: "debit", effectAr: "يحمّل على المندوب ويخصم من استحقاقه.", effectEn: "Charges the expense to the driver and reduces entitlement." },
  { value: "adjustment", ar: "تسوية إضافة", en: "Credit adjustment", effect: "credit", effectAr: "تسوية موجبة تضاف إلى الاستحقاق.", effectEn: "Positive adjustment added to entitlement." },
  { value: "debit_adjustment", ar: "تسوية خصم", en: "Debit adjustment", effect: "debit", effectAr: "تسوية سالبة تخصم من الاستحقاق.", effectEn: "Negative adjustment deducted from entitlement." },
];

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

function phoneForWhatsApp(value: unknown) {
  let digits = clean(value).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `971${digits.slice(1)}`;
  return digits;
}

function entryOption(value: unknown) {
  return entryOptions.find((option) => option.value === clean(value)) || entryOptions[0];
}

function entryLabel(value: unknown, isArabic: boolean) {
  const option = entryOption(value);
  return isArabic ? option.ar : option.en;
}

function entryEffect(value: unknown, isArabic: boolean) {
  const option = entryOption(value);
  if (option.effect === "credit") return isArabic ? "إضافة للاستحقاق" : "Adds to entitlement";
  if (option.effect === "payment") return isArabic ? "سداد من المتبقي" : "Pays down outstanding";
  return isArabic ? "خصم من الاستحقاق" : "Deducts from entitlement";
}

function cycleLabel(value: unknown, isArabic: boolean) {
  const cycle = clean(value).toLowerCase();
  if (cycle === "daily") return isArabic ? "يومي" : "Daily";
  if (cycle === "weekly") return isArabic ? "أسبوعي" : "Weekly";
  return isArabic ? "شهري" : "Monthly";
}

function statusLabel(value: unknown, isArabic: boolean) {
  const status = clean(value).toLowerCase();
  const labels: Record<string, [string, string]> = {
    pending: ["جديد", "Pending"],
    review: ["مراجعة", "Review"],
    confirmed: ["بدأ المهمة", "Started"],
    assigned: ["مسند", "Assigned"],
    picked_up: ["تم الاستلام", "Picked up"],
    in_transit: ["في الطريق", "In transit"],
    delivered: ["تم التسليم", "Delivered"],
    postponed: ["مؤجل", "Postponed"],
    returned: ["راجع", "Returned"],
    cancelled: ["ملغي", "Cancelled"],
    approved: ["معتمد", "Approved"],
    draft: ["مسودة", "Draft"],
    void: ["ملغي مع حفظ الأثر", "Void"],
  };
  return labels[status]?.[isArabic ? 0 : 1] || status || "—";
}

function Metric({
  label,
  value,
  icon: Icon,
  tone = "normal",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "normal" | "credit" | "debit" | "gold";
}) {
  const className =
    tone === "credit"
      ? "border-emerald-400/25 bg-emerald-400/[.07] text-emerald-200"
      : tone === "debit"
        ? "border-rose-400/25 bg-rose-400/[.07] text-rose-200"
        : tone === "gold"
          ? "border-brand-gold/35 bg-brand-gold/[.09] text-brand-gold"
          : "border-white/10 bg-[#031226] text-white";
  return (
    <article className={`rounded-[1.3rem] border p-4 ${className}`}>
      <Icon className="h-4 w-4" />
      <small className="mt-2 block text-[10px] font-black opacity-65">{label}</small>
      <strong className="mt-1 block text-lg font-black text-white" dir="ltr">{value}</strong>
    </article>
  );
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
  const [entryType, setEntryType] = useState("deduction");
  const [entryDate, setEntryDate] = useState(today());
  const [entryAmount, setEntryAmount] = useState("");
  const [entryReference, setEntryReference] = useState("");
  const [entryNote, setEntryNote] = useState("");

  const driver = drivers.find((item) => item.id === driverId) || null;
  const selectedEntry = entryOption(entryType);
  const amount = num(entryAmount);

  const visibleDrivers = useMemo(() => {
    const needle = normalize(`${query} ${driverQuery}`);
    return drivers.filter((item) =>
      !needle || normalize([item.full_name, item.name, item.phone, item.vehicle_plate, item.emirate].join(" ")).includes(needle),
    );
  }, [driverQuery, drivers, query]);

  const visibleOrders = useMemo(() => {
    if (!driver) return [];
    const needle = normalize(orderQuery);
    return driver.orders
      .filter((order) => {
        const date = clean(order.created_at).slice(0, 10);
        return (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo) &&
          (!needle || normalize([reference(order), order.receiver_name, order.receiver_phone, order.receiver_city, order.status].join(" ")).includes(needle));
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
      await setDriverSalary(driver.id, num(salary), cycle, salaryEffectiveFrom,
        isArabic ? "تحديث من مركز رواتب المناديب المتخصص" : "Updated from specialized driver payroll");
      await Promise.all([loadPayroll(driver.id), refresh()]);
      setMessage(isArabic
        ? `تم حفظ الراتب ${money(salary, true)} بنظام ${cycleLabel(cycle, true)} من تاريخ ${salaryEffectiveFrom} داخل ملف المندوب وسجل تاريخ الرواتب.`
        : `Salary ${money(salary, false)} was saved as ${cycleLabel(cycle, false)} from ${salaryEffectiveFrom} in the driver profile and salary history.`);
    } catch (cause) {
      setMessage(payrollErrorMessage(cause, isArabic));
    } finally {
      setBusy(false);
    }
  }

  async function addEntry() {
    if (!driver || amount <= 0 || !entryDate || !entryNote.trim()) return;
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
      setEntryReference("");
      setEntryNote("");
      await loadPayroll(driver.id);
      setMessage(isArabic
        ? `تم ترحيل ${entryLabel(entryType, true)} بقيمة ${money(amount, true)} إلى سجل الراتب بتاريخ ${entryDate}. ${selectedEntry.effectAr}`
        : `${entryLabel(entryType, false)} of ${money(amount, false)} was posted on ${entryDate}. ${selectedEntry.effectEn}`);
    } catch (cause) {
      setMessage(payrollErrorMessage(cause, isArabic));
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(order: Order, status: string) {
    setBusy(true);
    try {
      await updateOrderStatus(order.id, status, isArabic ? "تحديث من كشف المندوب" : "Updated from driver statement");
      await refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  const deductionsTotal = num(payroll?.expenses) + num(payroll?.deductions) + num(payroll?.advances) + num(payroll?.debit_adjustments);
  const paymentTooHigh = entryType === "payment" && amount > num(payroll?.outstanding);
  const allSelected = visibleOrders.length > 0 && visibleOrders.every((order) => selected.includes(order.id));

  const payrollPdf: AdminPdfPayload = {
    language: isArabic ? "ar" : "en",
    sectionTitle: `${isArabic ? "كشف راتب المندوب" : "Driver payroll statement"} · ${driver?.full_name || driver?.name || "DAY NIGHT"}`,
    filters: `${dateFrom} → ${dateTo}`,
    totals: {
      [isArabic ? "راتب الفترة" : "Period salary"]: money(payroll?.gross_salary, isArabic),
      [isArabic ? "الإضافات" : "Credits"]: money(payroll?.credits, isArabic),
      [isArabic ? "الخصومات" : "Deductions"]: money(deductionsTotal, isArabic),
      [isArabic ? "صافي الاستحقاق" : "Net entitlement"]: money(payroll?.net_salary, isArabic),
      [isArabic ? "المدفوع" : "Paid"]: money(payroll?.payments, isArabic),
      [isArabic ? "المتبقي" : "Outstanding"]: money(payroll?.outstanding, isArabic),
    },
    columns: [
      { key: "date", label: isArabic ? "التاريخ" : "Date" },
      { key: "type", label: isArabic ? "النوع" : "Type" },
      { key: "effect", label: isArabic ? "الأثر" : "Effect" },
      { key: "amount", label: isArabic ? "المبلغ" : "Amount" },
      { key: "status", label: isArabic ? "الحالة" : "Status" },
      { key: "reference", label: isArabic ? "المرجع" : "Reference" },
      { key: "notes", label: isArabic ? "السبب" : "Reason" },
    ],
    rows: (payroll?.entries || []).map((entry) => ({
      date: entry.entry_date,
      type: entryLabel(entry.entry_type, isArabic),
      effect: entryEffect(entry.entry_type, isArabic),
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
    filters: `${dateFrom} → ${dateTo}`,
    totals: { [isArabic ? "الطلبات المحددة" : "Selected orders"]: selectedOrders.length },
    columns: [
      { key: "reference", label: isArabic ? "الطلب" : "Order" },
      { key: "recipient", label: isArabic ? "المستلم" : "Recipient" },
      { key: "route", label: isArabic ? "المسار" : "Route" },
      { key: "cod", label: "COD" },
      { key: "status", label: isArabic ? "الحالة" : "Status" },
    ],
    rows: selectedOrders.map((order) => ({
      reference: reference(order),
      recipient: order.receiver_name || order.customer_name || "—",
      route: `${order.sender_city || "—"} → ${order.receiver_city || "—"}`,
      cod: money(order.cod_amount, isArabic),
      status: statusLabel(order.status, isArabic),
    })),
    orientation: "landscape",
  };

  const whatsapp = useMemo(() => {
    if (!driver || !payroll) return "";
    return [
      `السلام عليكم ${driver.full_name || driver.name || "مندوبنا الكريم"}،`,
      `كشف راتب DAY NIGHT للفترة ${dateFrom} إلى ${dateTo}:`,
      `راتب الفترة: ${money(payroll.gross_salary, true)}`,
      `الإضافات: ${money(payroll.credits, true)}`,
      `الخصومات والمصاريف والسلف: ${money(deductionsTotal, true)}`,
      `صافي الاستحقاق: ${money(payroll.net_salary, true)}`,
      `المدفوع: ${money(payroll.payments, true)}`,
      `المتبقي: ${money(payroll.outstanding, true)}`,
      "",
      "يرجى مراجعة الكشف والتواصل مع مركز العمليات عند وجود أي ملاحظة.",
    ].join("\n");
  }, [dateFrom, dateTo, deductionsTotal, driver, payroll]);

  if (!driver) {
    return (
      <section className="space-y-4 rounded-[1.8rem] border border-white/10 bg-[#031226] p-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-black text-brand-gold"><Truck className="h-4 w-4" />{isArabic ? "رواتب المناديب المتخصصة" : "Specialized driver payroll"}</span>
            <h2 className="mt-2 text-2xl font-black text-white">{isArabic ? "اختر المندوب لفتح ملف راتبه" : "Choose a driver to open payroll"}</h2>
            <p className="mt-2 text-xs font-bold text-white/45">{isArabic ? "رواتب المناديب منفصلة عن مصروفات الشركة العامة وعن أي موظفين غير مناديب." : "Driver payroll is separated from general company expenses and non-driver staff."}</p>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#071a33] px-4 py-3"><Search className="h-4 w-4 text-white/35" /><input value={driverQuery} onChange={(event) => setDriverQuery(event.target.value)} className="bg-transparent text-sm text-white outline-none" placeholder={isArabic ? "بحث عن مندوب" : "Search drivers"} /></label>
        </header>
        {error ? <p className="rounded-xl bg-rose-500/10 p-3 text-xs text-rose-200">{error}</p> : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleDrivers.map((item) => (
            <article key={item.id} className="rounded-[1.4rem] border border-white/10 bg-[#071a33] p-4">
              <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-white/5 text-brand-gold">{item.avatar_url ? <img src={item.avatar_url} className="h-full w-full object-cover" alt="" /> : <UserRound className="h-5 w-5" />}</span>
              <h3 className="mt-3 text-lg font-black text-white">{item.full_name || item.name || "—"}</h3>
              <p className="mt-1 text-[11px] text-white/45" dir="ltr">{item.phone || "—"} · {item.vehicle_plate || "—"}</p>
              <div className="mt-3 flex justify-between text-[10px] text-white/45"><span>{item.orders.length} {isArabic ? "طلب" : "orders"}</span><span>{money(item.base_salary, isArabic)} · {cycleLabel(item.salary_cycle, isArabic)}</span></div>
              <button type="button" onClick={() => setDriverId(item.id)} className="mt-4 w-full rounded-xl border border-brand-gold/35 bg-brand-gold/10 px-4 py-3 text-xs font-black text-brand-gold">{isArabic ? "فتح ملف الراتب" : "Open payroll"}</button>
            </article>
          ))}
        </div>
        {!loading && !visibleDrivers.length ? <p className="py-10 text-center text-sm text-white/45">{isArabic ? "لا توجد نتائج." : "No results."}</p> : null}
      </section>
    );
  }

  const BackIcon = isArabic ? ArrowRight : ArrowLeft;
  const waPhone = phoneForWhatsApp(driver.phone);

  return (
    <section className="space-y-4">
      <header className="rounded-[1.8rem] border border-brand-gold/25 bg-[#031226] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3"><button type="button" onClick={() => setDriverId("")} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-white"><BackIcon className="h-5 w-5" /></button><span className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-white/5 text-brand-gold">{driver.avatar_url ? <img src={driver.avatar_url} className="h-full w-full object-cover" alt="" /> : <UserRound />}</span><div><span className="text-[10px] font-black text-brand-gold">{isArabic ? "ملف راتب مندوب متخصص" : "SPECIALIZED DRIVER PAYROLL"}</span><h2 className="mt-1 text-2xl font-black text-white">{driver.full_name || driver.name}</h2><p className="mt-1 text-[11px] text-white/48"><Phone className="inline h-3.5 w-3.5" /> {driver.phone || "—"} · <MapPin className="inline h-3.5 w-3.5" /> {driver.emirate || driver.work_area || "—"}</p></div></div>
          <div className="flex flex-wrap gap-2"><span className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-[10px] font-black text-emerald-200"><ShieldCheck className="h-4 w-4" />{isArabic ? "قاعدة بيانات + سجل تدقيق" : "Database + audit trail"}</span><AdminPdfExportButton payload={payrollPdf} label={isArabic ? "كشف الراتب PDF / CSV" : "Payroll PDF / CSV"} /></div>
        </div>
      </header>

      {message ? <p className="rounded-2xl border border-brand-gold/25 bg-brand-gold/10 px-4 py-3 text-xs font-bold leading-6 text-brand-gold">{message}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={isArabic ? "راتب الفترة" : "Period salary"} value={money(payroll?.gross_salary, isArabic)} icon={Banknote} tone="gold" />
        <Metric label={isArabic ? "الإضافات" : "Credits"} value={money(payroll?.credits, isArabic)} icon={CheckCircle2} tone="credit" />
        <Metric label={isArabic ? "الخصومات والسلف والمصاريف" : "Deductions and advances"} value={money(deductionsTotal, isArabic)} icon={XCircle} tone="debit" />
        <Metric label={isArabic ? "صافي الاستحقاق" : "Net entitlement"} value={money(payroll?.net_salary, isArabic)} icon={WalletCards} tone="credit" />
        <Metric label={isArabic ? "المدفوع" : "Paid"} value={money(payroll?.payments, isArabic)} icon={ReceiptText} />
        <Metric label={isArabic ? "المتبقي" : "Outstanding"} value={money(payroll?.outstanding, isArabic)} icon={CalendarDays} tone="gold" />
        <Metric label={isArabic ? "السلف" : "Advances"} value={money(payroll?.advances, isArabic)} icon={Banknote} tone="debit" />
        <Metric label={isArabic ? "زيادة مدفوعة" : "Overpaid"} value={money(payroll?.overpaid, isArabic)} icon={XCircle} tone={num(payroll?.overpaid) > 0 ? "debit" : "normal"} />
      </div>

      <div className="flex gap-3 rounded-[1.4rem] border border-brand-sky/20 bg-brand-sky/[.06] p-4 text-xs font-bold leading-6 text-white/70"><Info className="mt-1 h-5 w-5 shrink-0 text-brand-sky" /><p>{isArabic ? "صافي الاستحقاق = راتب الفترة + المكافآت والتعويضات والتسويات الموجبة − الخصومات والسلف والمصروفات المحملة والتسويات السالبة. دفعة الراتب تقلل المتبقي فقط." : "Net entitlement = period salary + bonuses, reimbursements and credit adjustments − deductions, advances, driver-charged expenses and debit adjustments. Salary payments reduce outstanding only."}</p></div>

      <section className="grid gap-5 rounded-[1.8rem] border border-white/10 bg-[#031226] p-5 xl:grid-cols-2">
        <div><h3 className="flex items-center gap-2 text-lg font-black text-white"><Banknote className="h-5 w-5 text-brand-gold" />{isArabic ? "تعريف الراتب وحفظ تاريخه" : "Salary setup and history"}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><input type="number" min="0" step="0.01" value={salary} onChange={(event) => setSalary(event.target.value)} placeholder={isArabic ? "قيمة الراتب" : "Salary amount"} className="rounded-xl border border-white/10 bg-[#071a33] px-4 py-3 text-sm text-white" /><select value={cycle} onChange={(event) => setCycle(event.target.value)} className="rounded-xl border border-white/10 bg-[#071a33] px-4 py-3 text-sm text-white"><option value="monthly">{isArabic ? "شهري" : "Monthly"}</option><option value="weekly">{isArabic ? "أسبوعي" : "Weekly"}</option><option value="daily">{isArabic ? "يومي" : "Daily"}</option></select><input type="date" max={today()} value={salaryEffectiveFrom} onChange={(event) => setSalaryEffectiveFrom(event.target.value)} className="rounded-xl border border-white/10 bg-[#071a33] px-4 py-3 text-sm text-white" /><button type="button" disabled={busy || num(salary) < 0 || !salaryEffectiveFrom} onClick={() => void saveSalary()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-3 text-xs font-black text-[#071a33] disabled:opacity-50"><Save className="h-4 w-4" />{isArabic ? "حفظ الراتب في الملف والسجل" : "Save salary and history"}</button></div><p className="mt-3 text-[10px] font-bold leading-5 text-white/42">{isArabic ? "يُحفظ الراتب الحالي داخل ملف المندوب، وتُحفظ كل قيمة سابقة في سجل تاريخي مؤرخ. راتب الفترة يحسب يومياً حسب الدورة." : "Current salary is saved in the driver profile and every previous value remains in dated history. Period salary is prorated daily."}</p></div>
        <div><h3 className="flex items-center gap-2 text-lg font-black text-white"><ReceiptText className="h-5 w-5 text-brand-gold" />{isArabic ? "إضافة حركة راتب بمكانها الصحيح" : "Post a classified payroll entry"}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><select value={entryType} onChange={(event) => setEntryType(event.target.value)} className="rounded-xl border border-white/10 bg-[#071a33] px-4 py-3 text-sm text-white sm:col-span-2">{entryOptions.map((option) => <option key={option.value} value={option.value}>{isArabic ? option.ar : option.en}</option>)}</select><input type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} className="rounded-xl border border-white/10 bg-[#071a33] px-4 py-3 text-sm text-white" /><input type="number" min="0" step="0.01" value={entryAmount} onChange={(event) => setEntryAmount(event.target.value)} placeholder={isArabic ? "المبلغ" : "Amount"} className="rounded-xl border border-white/10 bg-[#071a33] px-4 py-3 text-sm text-white" /><input value={entryReference} onChange={(event) => setEntryReference(event.target.value)} placeholder={isArabic ? "مرجع / فاتورة / مخالفة" : "Reference / invoice / violation"} className="rounded-xl border border-white/10 bg-[#071a33] px-4 py-3 text-sm text-white" /><input value={entryNote} onChange={(event) => setEntryNote(event.target.value)} placeholder={isArabic ? "السبب الإلزامي" : "Required reason"} className="rounded-xl border border-white/10 bg-[#071a33] px-4 py-3 text-sm text-white" /></div><p className={`mt-3 rounded-xl border p-3 text-[11px] font-bold ${selectedEntry.effect === "credit" ? "border-emerald-400/20 text-emerald-100" : selectedEntry.effect === "payment" ? "border-brand-sky/20 text-brand-sky" : "border-rose-400/20 text-rose-100"}`}>{isArabic ? selectedEntry.effectAr : selectedEntry.effectEn}</p>{paymentTooHigh ? <p className="mt-2 rounded-xl bg-rose-500/10 p-3 text-[11px] font-bold text-rose-100">{isArabic ? `الدفعة أكبر من المتبقي الحالي ${money(payroll?.outstanding, true)}.` : `Payment exceeds current outstanding ${money(payroll?.outstanding, false)}.`}</p> : null}<button type="button" disabled={busy || amount <= 0 || !entryDate || !entryNote.trim() || paymentTooHigh} onClick={() => void addEntry()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-3 text-xs font-black text-[#071a33] disabled:opacity-50"><Save className="h-4 w-4" />{isArabic ? "ترحيل الحركة إلى سجل الراتب" : "Post to payroll ledger"}</button></div>
      </section>

      {(payroll?.salary_history || []).length > 0 ? <section className="rounded-[1.8rem] border border-white/10 bg-[#031226] p-5"><h3 className="flex items-center gap-2 text-xl font-black text-white"><History className="h-5 w-5 text-brand-gold" />{isArabic ? "تاريخ الرواتب المحفوظ" : "Saved salary history"}</h3><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{payroll?.salary_history.map((row) => <article key={row.id} className="rounded-xl border border-white/10 bg-white/[.035] p-4"><strong className="text-white">{money(row.base_salary, isArabic)}</strong><p className="mt-1 text-[11px] font-bold text-brand-gold">{cycleLabel(row.salary_cycle, isArabic)} · {row.effective_from} → {row.effective_to || (isArabic ? "مستمر" : "Current")}</p><small className="mt-2 block text-white/40">{row.note || "—"}</small></article>)}</div></section> : null}

      {(payroll?.entries || []).length > 0 ? <section className="rounded-[1.8rem] border border-white/10 bg-[#031226] p-5"><h3 className="text-xl font-black text-white">{isArabic ? "حركات الراتب المحفوظة" : "Saved payroll entries"}</h3><div className="mt-4 space-y-2">{payroll?.entries.map((entry: DriverPayrollEntry) => <article key={entry.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[.035] p-3 sm:flex-row sm:items-center sm:justify-between"><div><strong className={entryOption(entry.entry_type).effect === "credit" ? "text-emerald-200" : entryOption(entry.entry_type).effect === "payment" ? "text-brand-sky" : "text-rose-200"}>{entryLabel(entry.entry_type, isArabic)} · {money(entry.amount, isArabic)}</strong><p className="mt-1 text-[10px] font-bold text-white/55">{entryEffect(entry.entry_type, isArabic)}</p><p className="mt-1 text-[10px] text-white/40">{entry.entry_date} · {entry.reference_number || "—"} · {entry.notes}</p></div><div className="flex gap-2"><span className="rounded-full bg-white/5 px-3 py-1 text-[10px] text-white/55">{statusLabel(entry.status, isArabic)}</span>{entry.status !== "void" ? <button type="button" onClick={async () => { await setDriverPayrollEntryStatus(entry.id, "void", isArabic ? "إلغاء من مركز الرواتب" : "Voided from payroll center"); await loadPayroll(driver.id); }} className="rounded-lg bg-rose-500/10 px-3 py-1 text-[10px] font-black text-rose-200">{isArabic ? "إلغاء الحركة" : "Void"}</button> : null}</div></article>)}</div></section> : null}

      <section className="rounded-[1.8rem] border border-white/10 bg-[#031226]"><header className="flex flex-col gap-3 border-b border-white/10 p-4 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="text-xl font-black text-white">{visibleOrders.length} {isArabic ? "طلبية للمندوب" : "driver orders"}</h3><p className="text-xs text-white/45">{dateFrom} → {dateTo}</p></div><div className="flex gap-2"><label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#071a33] px-3 py-2"><Search className="h-4 w-4 text-white/35" /><input value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} className="bg-transparent text-xs text-white outline-none" placeholder={isArabic ? "بحث" : "Search"} /></label><button type="button" onClick={() => setSelected(allSelected ? [] : visibleOrders.map((order) => order.id))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white">{allSelected ? (isArabic ? "إلغاء الكل" : "Clear") : isArabic ? "تحديد الكل" : "Select all"}</button></div></header><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-xs"><thead className="bg-white/[.04] text-white/55"><tr><th className="px-4 py-3">✓</th><th className="px-4 py-3">{isArabic ? "الطلب" : "Order"}</th><th className="px-4 py-3">{isArabic ? "المستلم" : "Recipient"}</th><th className="px-4 py-3">{isArabic ? "المسار" : "Route"}</th><th className="px-4 py-3">COD</th><th className="px-4 py-3">{isArabic ? "الحالة" : "Status"}</th></tr></thead><tbody>{visibleOrders.map((order) => <tr key={order.id} className="border-t border-white/7 text-white/75"><td className="px-4 py-3"><input type="checkbox" checked={selected.includes(order.id)} onChange={() => setSelected((current) => current.includes(order.id) ? current.filter((id) => id !== order.id) : [...current, order.id])} /></td><td className="px-4 py-3 font-black text-white" dir="ltr">{reference(order)}</td><td className="px-4 py-3">{order.receiver_name || "—"}</td><td className="px-4 py-3">{order.sender_city || "—"} → {order.receiver_city || "—"}</td><td className="px-4 py-3" dir="ltr">{money(order.cod_amount, isArabic)}</td><td className="px-4 py-3"><select value={clean(order.status).toLowerCase()} onChange={(event) => void changeStatus(order, event.target.value)} disabled={busy} className="rounded-lg border border-white/10 bg-[#071a33] px-3 py-2 text-xs text-white"><option value="pending">{isArabic ? "جديد" : "Pending"}</option><option value="review">{isArabic ? "مراجعة" : "Review"}</option><option value="confirmed">{isArabic ? "بدأ المهمة" : "Started"}</option><option value="assigned">{isArabic ? "مسند" : "Assigned"}</option><option value="picked_up">{isArabic ? "تم الاستلام" : "Picked up"}</option><option value="in_transit">{isArabic ? "في الطريق" : "In transit"}</option><option value="delivered">{isArabic ? "تم التسليم" : "Delivered"}</option><option value="postponed">{isArabic ? "مؤجل" : "Postponed"}</option><option value="returned">{isArabic ? "راجع" : "Returned"}</option><option value="cancelled">{isArabic ? "ملغي" : "Cancelled"}</option></select></td></tr>)}</tbody></table></div></section>

      <aside className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-[1.5rem] border border-brand-gold/25 bg-[#06172c]/95 p-4 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between"><strong className="text-white">{selectedOrders.length} {isArabic ? "طلبية محددة" : "selected orders"}</strong><div className="flex flex-wrap gap-2">{selectedOrders.length ? <AdminPdfExportButton payload={ordersPdf} label={isArabic ? "كشف الطلبيات" : "Orders statement"} /> : <button type="button" disabled className="dn-admin-pdf-button opacity-40"><FileDown className="h-4 w-4" />{isArabic ? "حدد طلبيات" : "Select orders"}</button>}<a href={waPhone && payroll ? `https://wa.me/${waPhone}?text=${encodeURIComponent(whatsapp)}` : undefined} target="_blank" rel="noreferrer" aria-disabled={!waPhone || !payroll} className="inline-flex items-center gap-2 rounded-xl bg-[#25d366] px-4 py-3 text-xs font-black text-[#031226] aria-disabled:pointer-events-none aria-disabled:opacity-35"><MessageCircle className="h-4 w-4" />{isArabic ? "إرسال كشف الراتب واتساب" : "Send payroll WhatsApp"}</a></div></aside>
    </section>
  );
}
