import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleMinus,
  CirclePlus,
  Clock3,
  FileText,
  History,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  ReceiptText,
  Save,
  Search,
  ShieldCheck,
  UserPlus,
  UsersRound,
  WalletCards,
  XCircle,
} from "lucide-react";
import { useAdminDrivers } from "../../hooks/useAdminDrivers";
import {
  createEmployee,
  createEmployeePayrollEntry,
  employeeErrorMessage,
  fetchEmployeePayrollSnapshot,
  fetchEmployees,
  setEmployeePayrollEntryStatus,
  setEmployeeSalary,
  type Employee,
  type EmployeePayrollSnapshot,
  type NewEmployeeInput,
} from "../../lib/adminEmployees";

export type EmployeeCenterMode = "new" | "directory";

type Props = {
  isArabic: boolean;
  mode: EmployeeCenterMode;
  onNavigate?: (path: "/admin/new-employee" | "/admin/employees") => void;
};

type Option = { value: string; ar: string; en: string };
type PayrollOption = Option & { effect: "credit" | "debit" | "payment"; helpAr: string; helpEn: string };

const employeeTypes: Option[] = [
  { value: "driver", ar: "سائق / مندوب", en: "Driver" },
  { value: "accountant", ar: "محاسب", en: "Accountant" },
  { value: "developer", ar: "مطور برمجيات", en: "Developer" },
  { value: "operations", ar: "موظف عمليات", en: "Operations" },
  { value: "customer_service", ar: "خدمة عملاء", en: "Customer Service" },
  { value: "sales", ar: "مبيعات", en: "Sales" },
  { value: "warehouse", ar: "مخزن وتجهيز", en: "Warehouse" },
  { value: "supervisor", ar: "مشرف", en: "Supervisor" },
  { value: "manager", ar: "مدير", en: "Manager" },
  { value: "support", ar: "دعم فني", en: "Technical Support" },
  { value: "other", ar: "وظيفة أخرى", en: "Other" },
];

const payrollOptions: PayrollOption[] = [
  { value: "bonus", ar: "مكافأة", en: "Bonus", effect: "credit", helpAr: "تُضاف فورًا إلى صافي استحقاق الموظف.", helpEn: "Adds immediately to employee entitlement." },
  { value: "overtime", ar: "عمل إضافي", en: "Overtime", effect: "credit", helpAr: "يُضاف إلى الراتب كاستحقاق إضافي.", helpEn: "Adds overtime value to entitlement." },
  { value: "allowance", ar: "بدل / حافز", en: "Allowance", effect: "credit", helpAr: "يُضاف إلى الراتب للفترة المختارة.", helpEn: "Adds an allowance to the selected period." },
  { value: "reimbursement", ar: "تعويض مصروف", en: "Reimbursement", effect: "credit", helpAr: "مبلغ دفعه الموظف ويُعاد له مع الراتب.", helpEn: "Reimburses an employee-paid expense." },
  { value: "adjustment", ar: "تسوية إضافة", en: "Credit adjustment", effect: "credit", helpAr: "تسوية موجبة ترفع صافي الاستحقاق.", helpEn: "Positive correction to entitlement." },
  { value: "deduction", ar: "خصم من الراتب", en: "Salary deduction", effect: "debit", helpAr: "يُخصم تلقائيًا من صافي الراتب والمتبقي.", helpEn: "Automatically reduces net salary and outstanding." },
  { value: "advance", ar: "سلفة", en: "Advance", effect: "debit", helpAr: "مبلغ استلمه الموظف مقدمًا ويُخصم من استحقاقه.", helpEn: "Records an advance and reduces entitlement." },
  { value: "penalty", ar: "جزاء مالي", en: "Penalty", effect: "debit", helpAr: "جزاء مع سبب موثق يُخصم من الراتب.", helpEn: "Documented penalty deducted from salary." },
  { value: "expense", ar: "مصروف محمّل على الموظف", en: "Employee-charged expense", effect: "debit", helpAr: "مصروف تتحمله ذمة الموظف ويقلل استحقاقه.", helpEn: "Charges an expense to the employee." },
  { value: "debit_adjustment", ar: "تسوية خصم", en: "Debit adjustment", effect: "debit", helpAr: "تسوية سالبة تقلل صافي الاستحقاق.", helpEn: "Negative correction to entitlement." },
  { value: "payment", ar: "دفعة راتب مسددة", en: "Salary payment", effect: "payment", helpAr: "تقلل المتبقي فقط ولا تخصم الراتب مرتين.", helpEn: "Pays down outstanding without reducing entitlement twice." },
];

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;
const clean = (value: unknown) => String(value ?? "").trim();
const numberValue = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const money = (value: unknown, isArabic: boolean) =>
  isArabic ? `${numberValue(value).toFixed(2)} درهم` : `${numberValue(value).toFixed(2)} AED`;
const normalize = (value: unknown) => clean(value).toLowerCase().replace(/[\s_-]+/g, "");
const inputClass = "w-full rounded-2xl border border-white/10 bg-[#071a33] px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-white/30 focus:border-brand-gold/55 focus:ring-2 focus:ring-brand-gold/10 disabled:opacity-50";

function emptyEmployee(): NewEmployeeInput {
  return {
    full_name: "",
    employee_type: "operations",
    custom_job_title: "",
    department: "Operations",
    phone: "",
    alternate_phone: "",
    email: "",
    nationality: "",
    emirate: "Abu Dhabi",
    address: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    identity_number: "",
    passport_number: "",
    visa_expiry: "",
    joined_at: today(),
    employment_status: "active",
    base_salary: 0,
    salary_cycle: "monthly",
    salary_effective_from: today(),
    avatar_url: "",
    notes: "",
    driver_profile_id: "",
  };
}

function typeLabel(value: unknown, isArabic: boolean) {
  const option = employeeTypes.find((item) => item.value === clean(value));
  return option ? (isArabic ? option.ar : option.en) : clean(value).replace(/_/g, " ") || "—";
}

function statusLabel(value: unknown, isArabic: boolean) {
  const status = clean(value).toLowerCase();
  const labels: Record<string, [string, string]> = {
    active: ["نشط", "Active"],
    inactive: ["غير نشط", "Inactive"],
    on_leave: ["في إجازة", "On leave"],
    suspended: ["موقوف", "Suspended"],
    terminated: ["انتهت الخدمة", "Terminated"],
    approved: ["معتمد", "Approved"],
    draft: ["مسودة", "Draft"],
    void: ["ملغي مع حفظ الأثر", "Void"],
  };
  return labels[status]?.[isArabic ? 0 : 1] || status || "—";
}

function cycleLabel(value: unknown, isArabic: boolean) {
  if (clean(value) === "daily") return isArabic ? "يومي" : "Daily";
  if (clean(value) === "weekly") return isArabic ? "أسبوعي" : "Weekly";
  return isArabic ? "شهري" : "Monthly";
}

function payrollOption(value: unknown) {
  return payrollOptions.find((item) => item.value === clean(value)) || payrollOptions[0];
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "DN";
}

function Metric({ label, value, tone = "normal" }: { label: string; value: string; tone?: "normal" | "credit" | "debit" | "gold" }) {
  const classes = tone === "credit"
    ? "border-emerald-400/25 bg-emerald-400/[.07] text-emerald-200"
    : tone === "debit"
      ? "border-rose-400/25 bg-rose-400/[.07] text-rose-200"
      : tone === "gold"
        ? "border-brand-gold/35 bg-brand-gold/[.09] text-brand-gold"
        : "border-white/10 bg-white/[.035] text-white";
  return <article className={`rounded-[1.25rem] border p-4 ${classes}`}><small className="block text-[10px] font-black opacity-60">{label}</small><strong className="mt-2 block text-lg font-black" dir="ltr">{value}</strong></article>;
}

export default function AdminEmployeesCenter({ isArabic, mode, onNavigate }: Props) {
  const { drivers } = useAdminDrivers();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState<NewEmployeeInput>(emptyEmployee);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [selectedId, setSelectedId] = useState("");
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(today());
  const [snapshot, setSnapshot] = useState<EmployeePayrollSnapshot | null>(null);
  const [salary, setSalary] = useState("");
  const [salaryCycle, setSalaryCycle] = useState("monthly");
  const [salaryDate, setSalaryDate] = useState(today());
  const [salaryReason, setSalaryReason] = useState("");
  const [entryType, setEntryType] = useState("bonus");
  const [entryDate, setEntryDate] = useState(today());
  const [entryAmount, setEntryAmount] = useState("");
  const [entryReference, setEntryReference] = useState("");
  const [entryNote, setEntryNote] = useState("");

  const selected = employees.find((employee) => employee.id === selectedId) || null;
  const linkedDriverIds = new Set(employees.map((employee) => employee.driver_profile_id).filter(Boolean));
  const availableDrivers = drivers.filter((driver) => !linkedDriverIds.has(driver.id) || driver.id === form.driver_profile_id);
  const selectedPayrollOption = payrollOption(entryType);

  async function loadEmployees() {
    setLoading(true);
    setError("");
    try {
      setEmployees(await fetchEmployees());
    } catch (cause) {
      setError(employeeErrorMessage(cause, isArabic));
    } finally {
      setLoading(false);
    }
  }

  async function loadSnapshot(employeeId = selectedId) {
    if (!employeeId) return;
    setBusy(true);
    setError("");
    try {
      const next = await fetchEmployeePayrollSnapshot(employeeId, dateFrom, dateTo);
      setSnapshot(next);
      setSalary(String(next.employee.base_salary ?? 0));
      setSalaryCycle(next.employee.salary_cycle || "monthly");
      setSalaryDate(next.employee.salary_effective_from || today());
    } catch (cause) {
      setSnapshot(null);
      setError(employeeErrorMessage(cause, isArabic));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void loadEmployees(); }, []);
  useEffect(() => { if (selectedId) void loadSnapshot(selectedId); else setSnapshot(null); }, [selectedId, dateFrom, dateTo]);

  function setField<K extends keyof NewEmployeeInput>(key: K, value: NewEmployeeInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  }

  function chooseDriver(driverId: string) {
    const driver = drivers.find((item) => item.id === driverId);
    if (!driver) {
      setField("driver_profile_id", "");
      return;
    }
    setForm((current) => ({
      ...current,
      driver_profile_id: driver.id,
      employee_type: "driver",
      full_name: clean(driver.full_name || driver.name || current.full_name),
      phone: clean(driver.phone || current.phone),
      email: clean(driver.email || current.email),
      nationality: clean(driver.nationality || current.nationality),
      emirate: clean(driver.emirate || current.emirate),
      address: clean(driver.address || current.address),
      emergency_contact_phone: clean(driver.emergency_contact || current.emergency_contact_phone),
      base_salary: numberValue(driver.base_salary ?? current.base_salary),
      salary_cycle: driver.salary_cycle || current.salary_cycle,
      salary_effective_from: driver.salary_effective_from || current.salary_effective_from,
      joined_at: driver.joined_at?.slice(0, 10) || current.joined_at,
      avatar_url: clean(driver.avatar_url || driver.avatar_path || current.avatar_url),
      department: "Delivery Operations",
      custom_job_title: current.custom_job_title || "Delivery Driver",
    }));
  }

  async function saveNewEmployee() {
    if (!form.full_name.trim() || !form.phone.trim() || numberValue(form.base_salary) < 0) {
      setError(isArabic ? "أدخل اسم الموظف ورقم الهاتف والراتب بصورة صحيحة." : "Enter a valid employee name, phone, and salary.");
      return;
    }
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const saved = await createEmployee({ ...form, base_salary: numberValue(form.base_salary) });
      setMessage(isArabic
        ? `تم إنشاء بطاقة ${saved.full_name} برقم ${saved.employee_code} وحفظ الراتب وسجل بداية الخدمة.`
        : `${saved.full_name} was created as ${saved.employee_code}, including salary and employment history.`);
      setForm(emptyEmployee());
      await loadEmployees();
    } catch (cause) {
      setError(employeeErrorMessage(cause, isArabic));
    } finally {
      setBusy(false);
    }
  }

  async function saveSalaryRevision() {
    if (!selected || numberValue(salary) < 0 || !salaryReason.trim()) {
      setError(isArabic ? "أدخل الراتب الجديد وسبب الزيادة أو التعديل." : "Enter the new salary and revision reason.");
      return;
    }
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const previous = numberValue(selected.base_salary);
      const next = numberValue(salary);
      await setEmployeeSalary({ employeeId: selected.id, baseSalary: next, cycle: salaryCycle, effectiveFrom: salaryDate, note: salaryReason });
      await Promise.all([loadEmployees(), loadSnapshot(selected.id)]);
      const difference = next - previous;
      setSalaryReason("");
      setMessage(difference > 0
        ? (isArabic ? `تمت زيادة راتب ${selected.full_name} بمقدار ${money(difference, true)}، وأصبح الراتب ${money(next, true)} تلقائيًا من ${salaryDate}.` : `Salary increased by ${money(difference, false)} to ${money(next, false)} from ${salaryDate}.`)
        : (isArabic ? `تم تحديث راتب ${selected.full_name} إلى ${money(next, true)} من ${salaryDate}.` : `Salary updated to ${money(next, false)} from ${salaryDate}.`));
    } catch (cause) {
      setError(employeeErrorMessage(cause, isArabic));
    } finally {
      setBusy(false);
    }
  }

  async function addPayrollEntry() {
    if (!selected || numberValue(entryAmount) <= 0 || !entryNote.trim()) {
      setError(isArabic ? "أدخل قيمة الحركة وسببها قبل الحفظ." : "Enter the payroll amount and reason before saving.");
      return;
    }
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await createEmployeePayrollEntry({
        employeeId: selected.id,
        entryDate,
        entryType,
        amount: numberValue(entryAmount),
        reference: entryReference,
        notes: entryNote,
        status: "approved",
      });
      const amount = numberValue(entryAmount);
      setEntryAmount("");
      setEntryReference("");
      setEntryNote("");
      await loadSnapshot(selected.id);
      setMessage(isArabic
        ? `تم تسجيل ${selectedPayrollOption.ar} بقيمة ${money(amount, true)}. ${selectedPayrollOption.helpAr}`
        : `${selectedPayrollOption.en} of ${money(amount, false)} was posted. ${selectedPayrollOption.helpEn}`);
    } catch (cause) {
      setError(employeeErrorMessage(cause, isArabic));
    } finally {
      setBusy(false);
    }
  }

  async function voidEntry(entryId: string) {
    if (!selected || !window.confirm(isArabic ? "إلغاء الحركة مع الاحتفاظ بها في سجل التدقيق؟" : "Void this entry while preserving its audit trail?")) return;
    setBusy(true);
    try {
      await setEmployeePayrollEntryStatus({ employeeId: selected.id, entryId, status: "void", note: isArabic ? "إلغاء من بطاقة الموظف" : "Voided from employee card" });
      await loadSnapshot(selected.id);
      setMessage(isArabic ? "تم إلغاء أثر الحركة مع الاحتفاظ بالسجل." : "The entry effect was voided while preserving the record.");
    } catch (cause) {
      setError(employeeErrorMessage(cause, isArabic));
    } finally {
      setBusy(false);
    }
  }

  const visibleEmployees = useMemo(() => {
    const needle = normalize(query);
    return employees.filter((employee) => {
      const searchMatches = !needle || normalize([
        employee.full_name, employee.employee_code, employee.phone, employee.email,
        employee.employee_type, employee.custom_job_title, employee.department,
      ].join(" ")).includes(needle);
      const typeMatches = typeFilter === "all" || employee.employee_type === typeFilter;
      const statusMatches = statusFilter === "all" || employee.employment_status === statusFilter;
      return searchMatches && typeMatches && statusMatches;
    });
  }, [employees, query, statusFilter, typeFilter]);

  const totals = useMemo(() => ({
    all: employees.length,
    active: employees.filter((employee) => employee.employment_status === "active").length,
    drivers: employees.filter((employee) => employee.employee_type === "driver").length,
    monthlyBase: employees.filter((employee) => employee.employment_status === "active").reduce((sum, employee) => {
      const salary = numberValue(employee.base_salary);
      if (employee.salary_cycle === "daily") return sum + salary * 30;
      if (employee.salary_cycle === "weekly") return sum + salary * 4.345;
      return sum + salary;
    }, 0),
  }), [employees]);

  const salaryDifference = selected ? numberValue(salary) - numberValue(selected.base_salary) : 0;
  const whatsappPhone = clean(selected?.phone).replace(/\D/g, "").replace(/^0/, "971");
  const whatsappText = selected && snapshot ? [
    `السلام عليكم ${selected.full_name}،`,
    "ملخص الراتب من DAY NIGHT لخدمات التوصيل والشحن:",
    `الفترة: ${snapshot.period_from} إلى ${snapshot.period_to}`,
    `راتب الفترة: ${money(snapshot.gross_salary, true)}`,
    `الإضافات والمكافآت: ${money(snapshot.credits, true)}`,
    `الخصومات والسلف: ${money(snapshot.debits ?? (snapshot.deductions + snapshot.advances + snapshot.expenses + snapshot.debit_adjustments), true)}`,
    `صافي الاستحقاق: ${money(snapshot.net_salary, true)}`,
    `المدفوع: ${money(snapshot.payments, true)}`,
    `المتبقي: ${money(snapshot.outstanding, true)}`,
    "مع تحيات إدارة DAY NIGHT.",
  ].join("\n") : "";

  if (mode === "new") {
    return (
      <section className="space-y-5" dir={isArabic ? "rtl" : "ltr"}>
        <header className="relative overflow-hidden rounded-[2rem] border border-brand-gold/25 bg-[#031226] p-5 sm:p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgba(212,175,55,.18),transparent_32rem)]" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4"><span className="grid h-14 w-14 place-items-center rounded-2xl border border-brand-gold/35 bg-brand-gold/10 text-brand-gold"><UserPlus className="h-7 w-7" /></span><div><span className="text-xs font-black text-brand-gold">{isArabic ? "الموارد البشرية" : "HUMAN RESOURCES"}</span><h2 className="mt-1 text-2xl font-black text-white">{isArabic ? "إضافة موظف جديد" : "Add new employee"}</h2><p className="mt-2 max-w-3xl text-xs font-bold leading-6 text-white/50">{isArabic ? "أنشئ ملف الموظف والوظيفة والاتصال والراتب من نقطة واحدة. السائق يمكن ربطه بملف مندوب قائم حتى لا يتكرر حساب راتبه." : "Create the employee, role, contact and salary in one place. Drivers can link to an existing driver profile to avoid duplicate payroll."}</p></div></div>
            <button type="button" onClick={() => onNavigate?.("/admin/employees")} className="rounded-xl border border-brand-sky/30 bg-brand-sky/10 px-4 py-3 text-xs font-black text-brand-sky">{isArabic ? "فتح دليل الموظفين" : "Open employee directory"}</button>
          </div>
        </header>

        {error && <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm font-bold text-rose-100">{error}</div>}
        {message && <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-100">{message}</div>}

        <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
          <section className="space-y-4 rounded-[1.7rem] border border-white/10 bg-[#031226] p-5">
            <h3 className="flex items-center gap-2 text-base font-black text-white"><BriefcaseBusiness className="h-5 w-5 text-brand-gold" />{isArabic ? "الوظيفة والبيانات الأساسية" : "Role and core details"}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1"><span className="text-[10px] font-black text-white/50">{isArabic ? "نوع الموظف *" : "Employee type *"}</span><select value={form.employee_type} onChange={(event) => setField("employee_type", event.target.value)} className={inputClass}>{employeeTypes.map((item) => <option key={item.value} value={item.value}>{isArabic ? item.ar : item.en}</option>)}</select></label>
              <label className="space-y-1"><span className="text-[10px] font-black text-white/50">{isArabic ? "المسمى الوظيفي" : "Job title"}</span><input value={form.custom_job_title || ""} onChange={(event) => setField("custom_job_title", event.target.value)} className={inputClass} placeholder={isArabic ? "مثال: محاسب رئيسي" : "Example: Senior Accountant"} /></label>
            </div>
            {form.employee_type === "driver" && <label className="space-y-1"><span className="text-[10px] font-black text-brand-gold">{isArabic ? "ربط بمندوب قائم — اختياري" : "Link existing driver — optional"}</span><select value={form.driver_profile_id || ""} onChange={(event) => chooseDriver(event.target.value)} className={inputClass}><option value="">{isArabic ? "موظف سائق جديد بدون ربط" : "New driver employee without link"}</option>{availableDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.full_name || driver.name || driver.phone || driver.id} — {driver.phone || "—"}</option>)}</select></label>}
            <div className="grid gap-3 sm:grid-cols-2"><input value={form.full_name} onChange={(event) => setField("full_name", event.target.value)} className={inputClass} placeholder={isArabic ? "الاسم الكامل *" : "Full name *"} /><input value={form.department || ""} onChange={(event) => setField("department", event.target.value)} className={inputClass} placeholder={isArabic ? "القسم / الإدارة" : "Department"} /></div>
            <div className="grid gap-3 sm:grid-cols-2"><input value={form.phone} onChange={(event) => setField("phone", event.target.value)} className={inputClass} placeholder={isArabic ? "رقم الهاتف *" : "Phone *"} dir="ltr" /><input value={form.alternate_phone || ""} onChange={(event) => setField("alternate_phone", event.target.value)} className={inputClass} placeholder={isArabic ? "هاتف بديل" : "Alternate phone"} dir="ltr" /></div>
            <div className="grid gap-3 sm:grid-cols-2"><input value={form.email || ""} onChange={(event) => setField("email", event.target.value)} className={inputClass} placeholder={isArabic ? "البريد الإلكتروني" : "Email"} dir="ltr" /><input value={form.nationality || ""} onChange={(event) => setField("nationality", event.target.value)} className={inputClass} placeholder={isArabic ? "الجنسية" : "Nationality"} /></div>
            <div className="grid gap-3 sm:grid-cols-2"><input value={form.emirate || ""} onChange={(event) => setField("emirate", event.target.value)} className={inputClass} placeholder={isArabic ? "الإمارة" : "Emirate"} /><input value={form.address || ""} onChange={(event) => setField("address", event.target.value)} className={inputClass} placeholder={isArabic ? "العنوان" : "Address"} /></div>
          </section>

          <section className="space-y-4 rounded-[1.7rem] border border-brand-gold/25 bg-brand-gold/[.055] p-5">
            <h3 className="flex items-center gap-2 text-base font-black text-white"><BadgeDollarSign className="h-5 w-5 text-brand-gold" />{isArabic ? "الراتب وبداية العمل" : "Salary and employment"}</h3>
            <label className="space-y-1"><span className="text-[10px] font-black text-white/50">{isArabic ? "الراتب الأساسي *" : "Base salary *"}</span><input type="number" min={0} step="0.01" value={form.base_salary} onChange={(event) => setField("base_salary", numberValue(event.target.value))} className={inputClass} /></label>
            <div className="grid gap-3 sm:grid-cols-2"><select value={form.salary_cycle} onChange={(event) => setField("salary_cycle", event.target.value)} className={inputClass}><option value="monthly">{isArabic ? "راتب شهري" : "Monthly salary"}</option><option value="weekly">{isArabic ? "راتب أسبوعي" : "Weekly salary"}</option><option value="daily">{isArabic ? "راتب يومي" : "Daily salary"}</option></select><input type="date" value={form.salary_effective_from} onChange={(event) => setField("salary_effective_from", event.target.value)} className={inputClass} /></div>
            <div className="grid gap-3 sm:grid-cols-2"><input type="date" value={form.joined_at} onChange={(event) => setField("joined_at", event.target.value)} className={inputClass} /><select value={form.employment_status} onChange={(event) => setField("employment_status", event.target.value)} className={inputClass}><option value="active">{isArabic ? "نشط" : "Active"}</option><option value="on_leave">{isArabic ? "في إجازة" : "On leave"}</option><option value="inactive">{isArabic ? "غير نشط" : "Inactive"}</option><option value="suspended">{isArabic ? "موقوف" : "Suspended"}</option></select></div>
            <div className="rounded-2xl border border-brand-gold/20 bg-[#031226]/70 p-4"><small className="text-white/45">{isArabic ? "سيتم حفظه" : "Will be saved as"}</small><strong className="mt-1 block text-2xl font-black text-brand-gold" dir="ltr">{money(form.base_salary, isArabic)}</strong><span className="text-[10px] font-bold text-white/45">{cycleLabel(form.salary_cycle, isArabic)} · {form.salary_effective_from}</span></div>
          </section>
        </div>

        <details className="rounded-[1.5rem] border border-white/10 bg-[#031226] p-5 text-white"><summary className="cursor-pointer text-sm font-black text-brand-gold">{isArabic ? "بيانات الهوية والطوارئ والملاحظات" : "Identity, emergency and notes"}</summary><div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={form.emergency_contact_name || ""} onChange={(event) => setField("emergency_contact_name", event.target.value)} className={inputClass} placeholder={isArabic ? "اسم جهة اتصال الطوارئ" : "Emergency contact name"} /><input value={form.emergency_contact_phone || ""} onChange={(event) => setField("emergency_contact_phone", event.target.value)} className={inputClass} placeholder={isArabic ? "هاتف الطوارئ" : "Emergency phone"} dir="ltr" /><input value={form.identity_number || ""} onChange={(event) => setField("identity_number", event.target.value)} className={inputClass} placeholder={isArabic ? "رقم الهوية" : "ID number"} /><input value={form.passport_number || ""} onChange={(event) => setField("passport_number", event.target.value)} className={inputClass} placeholder={isArabic ? "رقم الجواز" : "Passport number"} /><input type="date" value={form.visa_expiry || ""} onChange={(event) => setField("visa_expiry", event.target.value)} className={inputClass} /><input value={form.avatar_url || ""} onChange={(event) => setField("avatar_url", event.target.value)} className={inputClass} placeholder={isArabic ? "رابط صورة الموظف" : "Employee photo URL"} dir="ltr" /><textarea rows={3} value={form.notes || ""} onChange={(event) => setField("notes", event.target.value)} className={`${inputClass} sm:col-span-2`} placeholder={isArabic ? "ملاحظات عقد العمل أو الإدارة" : "Employment or management notes"} /></div></details>

        <button type="button" disabled={busy} onClick={() => void saveNewEmployee()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-gold px-5 py-4 text-sm font-black text-[#031226] disabled:opacity-60">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}{busy ? (isArabic ? "جارٍ الحفظ..." : "Saving...") : (isArabic ? "حفظ الموظف وفتح ملف راتب" : "Save employee and create payroll file")}</button>
      </section>
    );
  }

  if (selected && snapshot) {
    const BackIcon = isArabic ? ArrowRight : ArrowLeft;
    const deductions = snapshot.debits ?? (snapshot.deductions + snapshot.advances + snapshot.expenses + snapshot.debit_adjustments + numberValue(snapshot.penalties));
    return (
      <section className="space-y-5" dir={isArabic ? "rtl" : "ltr"}>
        <header className="rounded-[2rem] border border-brand-gold/25 bg-[#031226] p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-3"><button type="button" onClick={() => setSelectedId("")} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-white"><BackIcon className="h-5 w-5" /></button><span className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border border-brand-gold/30 bg-brand-gold/10 text-xl font-black text-brand-gold">{selected.avatar_url ? <img src={selected.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(selected.full_name)}</span><div><span className="text-[10px] font-black text-brand-gold">{selected.employee_code}</span><h2 className="text-2xl font-black text-white">{selected.full_name}</h2><p className="mt-1 text-xs font-bold text-white/50">{typeLabel(selected.employee_type, isArabic)} · {selected.custom_job_title || selected.department || "—"} · {statusLabel(selected.employment_status, isArabic)}</p></div></div><div className="flex flex-wrap gap-2"><a href={selected.phone ? `tel:${selected.phone}` : undefined} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white"><Phone className="h-4 w-4" />{isArabic ? "اتصال" : "Call"}</a><a href={whatsappPhone ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(whatsappText)}` : undefined} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-xs font-black text-[#031226]"><MessageCircle className="h-4 w-4" />{isArabic ? "ملخص الراتب واتساب" : "WhatsApp payroll"}</a></div></div></header>

        {error && <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm font-bold text-rose-100">{error}</div>}
        {message && <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-100">{message}</div>}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7"><Metric label={isArabic ? "راتب الفترة" : "Period salary"} value={money(snapshot.gross_salary, isArabic)} /><Metric label={isArabic ? "المكافآت والإضافات" : "Credits & bonuses"} value={money(snapshot.credits, isArabic)} tone="credit" /><Metric label={isArabic ? "الخصومات والسلف" : "Deductions & advances"} value={money(deductions, isArabic)} tone="debit" /><Metric label={isArabic ? "صافي الاستحقاق" : "Net entitlement"} value={money(snapshot.net_salary, isArabic)} tone="gold" /><Metric label={isArabic ? "المدفوع" : "Paid"} value={money(snapshot.payments, isArabic)} /><Metric label={isArabic ? "المتبقي للموظف" : "Outstanding"} value={money(snapshot.outstanding, isArabic)} tone="credit" /><Metric label={isArabic ? "مستحق على الموظف" : "Employee liability"} value={money(snapshot.employee_liability || 0, isArabic)} tone="debit" /></div>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="space-y-4 rounded-[1.7rem] border border-brand-gold/25 bg-brand-gold/[.055] p-5"><div><h3 className="flex items-center gap-2 text-base font-black text-white"><BadgeDollarSign className="h-5 w-5 text-brand-gold" />{isArabic ? "زيادة أو تعديل الراتب الأساسي" : "Salary revision"}</h3><p className="mt-1 text-[10px] font-bold text-white/45">{isArabic ? "أي زيادة تصبح الراتب الأساسي الجديد من تاريخ السريان وتُحفظ في التاريخ." : "An increase becomes the new base salary from its effective date and stays in history."}</p></div><div className="grid gap-3 sm:grid-cols-2"><input type="number" min={0} step="0.01" value={salary} onChange={(event) => setSalary(event.target.value)} className={inputClass} /><select value={salaryCycle} onChange={(event) => setSalaryCycle(event.target.value)} className={inputClass}><option value="monthly">{isArabic ? "شهري" : "Monthly"}</option><option value="weekly">{isArabic ? "أسبوعي" : "Weekly"}</option><option value="daily">{isArabic ? "يومي" : "Daily"}</option></select></div><input type="date" value={salaryDate} onChange={(event) => setSalaryDate(event.target.value)} className={inputClass} /><textarea rows={2} value={salaryReason} onChange={(event) => setSalaryReason(event.target.value)} className={inputClass} placeholder={isArabic ? "سبب الزيادة أو التعديل *" : "Salary revision reason *"} /><div className={`rounded-2xl border p-3 text-xs font-black ${salaryDifference > 0 ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : salaryDifference < 0 ? "border-rose-400/25 bg-rose-400/10 text-rose-200" : "border-white/10 bg-white/5 text-white/55"}`}>{salaryDifference > 0 ? (isArabic ? `زيادة تلقائية: +${money(salaryDifference, true)}` : `Automatic increase: +${money(salaryDifference, false)}`) : salaryDifference < 0 ? (isArabic ? `تخفيض: ${money(Math.abs(salaryDifference), true)}` : `Decrease: ${money(Math.abs(salaryDifference), false)}`) : (isArabic ? "لا يوجد فرق عن الراتب الحالي" : "No change from current salary")}</div><button type="button" disabled={busy} onClick={() => void saveSalaryRevision()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-3 text-xs font-black text-[#031226] disabled:opacity-50"><Save className="h-4 w-4" />{isArabic ? "اعتماد الراتب الجديد" : "Approve new salary"}</button></section>

          <section className="space-y-4 rounded-[1.7rem] border border-white/10 bg-[#031226] p-5"><div><h3 className="flex items-center gap-2 text-base font-black text-white"><ReceiptText className="h-5 w-5 text-brand-gold" />{isArabic ? "إضافة حركة راتب" : "Add payroll movement"}</h3><p className="mt-1 text-[10px] font-bold text-white/45">{isArabic ? "المكافأة تُضاف والخصم يُطرح تلقائيًا فور الاعتماد." : "Bonuses add and deductions subtract automatically after approval."}</p></div><select value={entryType} onChange={(event) => setEntryType(event.target.value)} className={inputClass}>{payrollOptions.map((item) => <option key={item.value} value={item.value}>{isArabic ? item.ar : item.en}</option>)}</select><div className={`rounded-2xl border p-3 text-xs font-bold ${selectedPayrollOption.effect === "credit" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100" : selectedPayrollOption.effect === "debit" ? "border-rose-400/25 bg-rose-400/10 text-rose-100" : "border-brand-sky/25 bg-brand-sky/10 text-brand-sky"}`}>{isArabic ? selectedPayrollOption.helpAr : selectedPayrollOption.helpEn}</div><div className="grid gap-3 sm:grid-cols-2"><input type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} className={inputClass} /><input type="number" min={0.01} step="0.01" value={entryAmount} onChange={(event) => setEntryAmount(event.target.value)} className={inputClass} placeholder={isArabic ? "القيمة" : "Amount"} /></div><input value={entryReference} onChange={(event) => setEntryReference(event.target.value)} className={inputClass} placeholder={isArabic ? "مرجع أو رقم إيصال — اختياري" : "Reference — optional"} /><textarea rows={2} value={entryNote} onChange={(event) => setEntryNote(event.target.value)} className={inputClass} placeholder={isArabic ? "سبب الحركة *" : "Movement reason *"} /><button type="button" disabled={busy} onClick={() => void addPayrollEntry()} className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black disabled:opacity-50 ${selectedPayrollOption.effect === "credit" ? "bg-emerald-400 text-[#031226]" : selectedPayrollOption.effect === "debit" ? "bg-rose-400 text-[#031226]" : "bg-brand-sky text-[#031226]"}`}>{selectedPayrollOption.effect === "credit" ? <CirclePlus className="h-4 w-4" /> : <CircleMinus className="h-4 w-4" />}{isArabic ? "حفظ وترحيل الحركة" : "Save and post movement"}</button></section>
        </div>

        <section className="rounded-[1.7rem] border border-white/10 bg-[#031226] p-5"><header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="flex items-center gap-2 text-base font-black text-white"><CalendarDays className="h-5 w-5 text-brand-gold" />{isArabic ? "كشف راتب الفترة" : "Payroll period"}</h3><p className="mt-1 text-[10px] font-bold text-white/45">{snapshot.source === "driver_payroll" ? (isArabic ? "مرتبط بسجل رواتب المندوب الأصلي — لا يوجد ازدواج حسابي." : "Linked to the original driver payroll without double counting.") : (isArabic ? "محسوب يوميًا حسب تاريخ الرواتب والحركات المعتمدة." : "Daily prorated from salary history and approved entries.")}</p></div><div className="grid grid-cols-2 gap-2"><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className={inputClass} /><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className={inputClass} /></div></header><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-start text-xs"><thead className="bg-white/[.045] text-white/50"><tr><th className="px-3 py-3">{isArabic ? "التاريخ" : "Date"}</th><th className="px-3 py-3">{isArabic ? "الحركة" : "Movement"}</th><th className="px-3 py-3">{isArabic ? "السبب" : "Reason"}</th><th className="px-3 py-3">{isArabic ? "الأثر" : "Effect"}</th><th className="px-3 py-3">{isArabic ? "القيمة" : "Amount"}</th><th className="px-3 py-3">{isArabic ? "الحالة" : "Status"}</th><th className="px-3 py-3">{isArabic ? "إجراء" : "Action"}</th></tr></thead><tbody>{snapshot.entries.map((entry) => { const option = payrollOption(entry.original_entry_type || entry.entry_type); return <tr key={entry.id} className="border-t border-white/7 text-white/70"><td className="px-3 py-3" dir="ltr">{entry.entry_date}</td><td className="px-3 py-3 font-black text-white">{isArabic ? option.ar : option.en}</td><td className="max-w-[280px] whitespace-normal px-3 py-3">{entry.notes || "—"}</td><td className={`px-3 py-3 font-black ${option.effect === "credit" ? "text-emerald-200" : option.effect === "debit" ? "text-rose-200" : "text-brand-sky"}`}>{option.effect === "credit" ? (isArabic ? "إضافة" : "Credit") : option.effect === "debit" ? (isArabic ? "خصم" : "Debit") : (isArabic ? "سداد" : "Payment")}</td><td className="px-3 py-3 font-black" dir="ltr">{money(entry.amount, isArabic)}</td><td className="px-3 py-3">{statusLabel(entry.status, isArabic)}</td><td className="px-3 py-3">{entry.status !== "void" && <button type="button" onClick={() => void voidEntry(entry.id)} className="rounded-lg border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-[10px] font-black text-rose-200">{isArabic ? "إلغاء الأثر" : "Void"}</button>}</td></tr>; })}</tbody></table>{!snapshot.entries.length && <div className="grid min-h-32 place-items-center text-xs font-bold text-white/35">{isArabic ? "لا توجد حركات راتب في هذه الفترة." : "No payroll movements in this period."}</div>}</div></section>

        <section className="rounded-[1.7rem] border border-white/10 bg-[#031226] p-5"><h3 className="mb-4 flex items-center gap-2 text-base font-black text-white"><History className="h-5 w-5 text-brand-gold" />{isArabic ? "تاريخ الراتب الأساسي" : "Base salary history"}</h3><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{snapshot.salary_history.map((history) => <article key={history.id} className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><div className="flex items-center justify-between gap-2"><strong className="text-lg font-black text-white" dir="ltr">{money(history.base_salary, isArabic)}</strong><span className={`rounded-full px-2 py-1 text-[9px] font-black ${numberValue(history.change_amount) > 0 ? "bg-emerald-400/10 text-emerald-200" : numberValue(history.change_amount) < 0 ? "bg-rose-400/10 text-rose-200" : "bg-white/5 text-white/45"}`}>{numberValue(history.change_amount) > 0 ? `+${numberValue(history.change_amount).toFixed(2)}` : numberValue(history.change_amount).toFixed(2)}</span></div><p className="mt-2 text-[10px] font-bold text-white/45">{cycleLabel(history.salary_cycle, isArabic)} · {history.effective_from} → {history.effective_to || (isArabic ? "مستمر" : "Current")}</p><small className="mt-2 block text-[10px] text-white/35">{history.note || "—"}</small></article>)}</div></section>
      </section>
    );
  }

  return (
    <section className="space-y-5" dir={isArabic ? "rtl" : "ltr"}>
      <header className="relative overflow-hidden rounded-[2rem] border border-brand-gold/25 bg-[#031226] p-5 sm:p-6"><div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgba(212,175,55,.16),transparent_32rem)]" /><div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div className="flex items-start gap-4"><span className="grid h-14 w-14 place-items-center rounded-2xl border border-brand-gold/35 bg-brand-gold/10 text-brand-gold"><UsersRound className="h-7 w-7" /></span><div><span className="text-xs font-black text-brand-gold">{isArabic ? "الموارد البشرية والرواتب" : "HR & PAYROLL"}</span><h2 className="mt-1 text-2xl font-black text-white">{isArabic ? "دليل الموظفين" : "Employee directory"}</h2><p className="mt-2 text-xs font-bold text-white/50">{isArabic ? "افتح بطاقة أي موظف لمراجعة بياناته وراتبه والخصومات والمكافآت والزيادات والسلف والمدفوعات." : "Open any employee card to review profile, salary, deductions, bonuses, increases, advances and payments."}</p></div></div><button type="button" onClick={() => onNavigate?.("/admin/new-employee")} className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-3 text-xs font-black text-[#031226]"><UserPlus className="h-4 w-4" />{isArabic ? "إضافة موظف" : "Add employee"}</button></div></header>

      {error && <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm font-bold text-rose-100">{error}</div>}
      {message && <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-100">{message}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label={isArabic ? "إجمالي الموظفين" : "Total employees"} value={String(totals.all)} /><Metric label={isArabic ? "الموظفون النشطون" : "Active employees"} value={String(totals.active)} tone="credit" /><Metric label={isArabic ? "السائقون المرتبطون" : "Linked drivers"} value={String(totals.drivers)} /><Metric label={isArabic ? "تقدير الرواتب الشهرية" : "Estimated monthly payroll"} value={money(totals.monthlyBase, isArabic)} tone="gold" /></div>

      <section className="rounded-[1.7rem] border border-white/10 bg-[#031226] p-4 sm:p-5"><div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]"><label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#071a33] px-4 py-3"><Search className="h-4 w-4 text-white/35" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none" placeholder={isArabic ? "الاسم، الكود، الهاتف، الوظيفة..." : "Name, code, phone, role..."} /></label><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className={inputClass}><option value="all">{isArabic ? "كل الوظائف" : "All roles"}</option>{employeeTypes.map((item) => <option key={item.value} value={item.value}>{isArabic ? item.ar : item.en}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}><option value="all">{isArabic ? "كل الحالات" : "All statuses"}</option><option value="active">{isArabic ? "نشط" : "Active"}</option><option value="on_leave">{isArabic ? "في إجازة" : "On leave"}</option><option value="inactive">{isArabic ? "غير نشط" : "Inactive"}</option><option value="suspended">{isArabic ? "موقوف" : "Suspended"}</option><option value="terminated">{isArabic ? "انتهت الخدمة" : "Terminated"}</option></select></div></section>

      {loading ? <div className="grid min-h-60 place-items-center rounded-[1.7rem] border border-white/10 bg-[#031226] text-white/50"><Loader2 className="h-7 w-7 animate-spin" /></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleEmployees.map((employee) => <article key={employee.id} className="rounded-[1.55rem] border border-white/10 bg-[#031226] p-5 transition hover:-translate-y-0.5 hover:border-brand-gold/35"><div className="flex items-start justify-between gap-3"><span className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border border-brand-gold/25 bg-brand-gold/10 text-lg font-black text-brand-gold">{employee.avatar_url ? <img src={employee.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(employee.full_name)}</span><span className={`rounded-full border px-3 py-1 text-[10px] font-black ${employee.employment_status === "active" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-amber-300/25 bg-amber-300/10 text-amber-100"}`}>{statusLabel(employee.employment_status, isArabic)}</span></div><h3 className="mt-4 text-lg font-black text-white">{employee.full_name}</h3><p className="mt-1 text-[11px] font-bold text-brand-gold">{typeLabel(employee.employee_type, isArabic)} · {employee.custom_job_title || employee.department || "—"}</p><div className="mt-4 space-y-2 border-t border-white/8 pt-3 text-[10px] font-bold text-white/45"><p dir="ltr"><Phone className="inline h-3.5 w-3.5" /> {employee.phone}</p><p><MapPin className="inline h-3.5 w-3.5" /> {employee.emirate || employee.address || "—"}</p><p><ShieldCheck className="inline h-3.5 w-3.5" /> {employee.employee_code}</p></div><div className="mt-4 rounded-2xl border border-white/10 bg-white/[.035] p-3"><small className="text-white/45">{isArabic ? "الراتب الأساسي" : "Base salary"}</small><strong className="mt-1 block text-xl font-black text-white" dir="ltr">{money(employee.base_salary, isArabic)}</strong><span className="text-[9px] font-bold text-white/35">{cycleLabel(employee.salary_cycle, isArabic)} · {employee.driver_profile_id ? (isArabic ? "مرتبط بالمندوب" : "Linked driver") : (isArabic ? "ملف موظف" : "Employee payroll")}</span></div><button type="button" onClick={() => setSelectedId(employee.id)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-gold/35 bg-brand-gold/10 px-4 py-3 text-xs font-black text-brand-gold hover:bg-brand-gold hover:text-[#031226]"><FileText className="h-4 w-4" />{isArabic ? "فتح بطاقة الموظف والراتب" : "Open employee and payroll card"}</button></article>)}</div>}
      {!loading && !visibleEmployees.length && <div className="grid min-h-48 place-items-center rounded-[1.7rem] border border-dashed border-white/10 bg-[#031226] text-center text-sm font-bold text-white/40"><div><XCircle className="mx-auto h-8 w-8" /><p className="mt-3">{isArabic ? "لا يوجد موظف مطابق للبحث." : "No employee matches the filters."}</p></div></div>}
    </section>
  );
}
