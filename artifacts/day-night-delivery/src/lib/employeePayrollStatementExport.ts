import { jsPDF } from "jspdf";
import type {
  Employee,
  EmployeePayrollEntry,
  EmployeePayrollSnapshot,
  EmployeeSalaryHistory,
} from "./adminEmployees";

export type EmployeePayrollStatementLanguage = "ar" | "en";

export type EmployeePayrollStatementPayload = {
  language: EmployeePayrollStatementLanguage;
  employee: Employee;
  snapshot: EmployeePayrollSnapshot;
  logoUrl?: string;
  generatedBy?: string;
};

type PdfLink = { x: number; y: number; width: number; height: number; url: string };

type MovementColumnKey = "date" | "type" | "reason" | "reference" | "effect" | "amount" | "status";
type MovementColumn = {
  key: MovementColumnKey;
  ar: string;
  en: string;
  weight: number;
  ltr?: boolean;
  lines?: number;
};

const LOCAL_LOGO_URL = "/assets/daynight/merchant-statement-logo.png";
const REMOTE_LOGO_URL = "https://i.postimg.cc/XqnP282D/cropped-circle-image-(9).png";
const WEBSITE_URL = "https://www.daynightae.com";
const WHATSAPP_URL = "https://wa.me/971568757331";
const EMAIL_URL = "mailto:Admin@daynightae.com";
const PAGE_FONT = "Tahoma, Arial, 'Noto Sans Arabic', 'Segoe UI', sans-serif";

const movementColumns: MovementColumn[] = [
  { key: "date", ar: "التاريخ", en: "Date", weight: 0.9, ltr: true },
  { key: "type", ar: "الحركة", en: "Movement", weight: 1.2, lines: 2 },
  { key: "reason", ar: "السبب", en: "Reason", weight: 2.25, lines: 2 },
  { key: "reference", ar: "المرجع", en: "Reference", weight: 1.0, ltr: true, lines: 2 },
  { key: "effect", ar: "الأثر", en: "Effect", weight: 0.9, lines: 2 },
  { key: "amount", ar: "القيمة", en: "Amount", weight: 1.05, ltr: true },
  { key: "status", ar: "الحالة", en: "Status", weight: 0.82, lines: 2 },
];

function clean(value: unknown, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown, language: EmployeePayrollStatementLanguage) {
  const amount = numeric(value);
  return language === "ar" ? `${amount.toFixed(2)} درهم` : `${amount.toFixed(2)} AED`;
}

function safeFileName(payload: EmployeePayrollStatementPayload) {
  const employee = clean(payload.employee.full_name, "Employee")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 55);
  return `DAY_NIGHT_Employee_Payroll_${employee}_${payload.snapshot.period_from}_${payload.snapshot.period_to}`;
}

function downloadBlob(blob: Blob, filename: string) {
  if (typeof document === "undefined" || typeof URL === "undefined") return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function setFont(ctx: CanvasRenderingContext2D, size: number, weight = "500", color = "#0b172a") {
  ctx.font = `${weight} ${size}px ${PAGE_FONT}`;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
}

function fitSingleLine(ctx: CanvasRenderingContext2D, value: unknown, maxWidth: number) {
  let text = clean(value).replace(/\s+/g, " ");
  if (ctx.measureText(text).width <= maxWidth) return text;
  while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);
  return `${text}…`;
}

function wrapLines(ctx: CanvasRenderingContext2D, value: unknown, maxWidth: number, maxLines = 2) {
  const source = clean(value).replace(/\s+/g, " ");
  if (maxLines <= 1) return [fitSingleLine(ctx, source, maxWidth)];
  const words = source.split(" ");
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      return;
    }
    if (line) lines.push(line);
    line = word;
  });
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = fitSingleLine(ctx, `${kept[maxLines - 1]} ${lines.slice(maxLines).join(" ")}`, maxWidth);
  return kept;
}

function drawWrappedText(ctx: CanvasRenderingContext2D, value: unknown, x: number, y: number, width: number, height: number, align: CanvasTextAlign, options: { size?: number; weight?: string; color?: string; maxLines?: number; direction?: CanvasDirection } = {}) {
  const size = options.size ?? 8.5;
  setFont(ctx, size, options.weight ?? "500", options.color ?? "#0b172a");
  ctx.textAlign = align;
  ctx.direction = options.direction ?? "inherit";
  const lines = wrapLines(ctx, value, width - 10, options.maxLines ?? 2);
  const lineHeight = size + 3;
  const startY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => ctx.fillText(line, x, startY + index * lineHeight, width - 10));
}

async function loadOneImage(url: string): Promise<HTMLImageElement | null> {
  if (typeof window === "undefined" || typeof Image === "undefined") return null;
  try {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) return null;
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("image_load_failed"));
      image.src = objectUrl;
    });
    URL.revokeObjectURL(objectUrl);
    return image;
  } catch {
    return null;
  }
}

async function loadLogo(payloadLogo?: string) {
  const candidates = [LOCAL_LOGO_URL, payloadLogo, REMOTE_LOGO_URL]
    .map((value) => String(value || "").trim())
    .filter((value, index, all) => value && all.indexOf(value) === index);
  for (const candidate of candidates) {
    const image = await loadOneImage(candidate);
    if (image) return image;
  }
  return null;
}

function drawCircularImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement | null, x: number, y: number, size: number, fallback: string) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, size, size);
  if (image) {
    const ratio = Math.max(size / image.naturalWidth, size / image.naturalHeight);
    const drawWidth = image.naturalWidth * ratio;
    const drawHeight = image.naturalHeight * ratio;
    ctx.drawImage(image, x + (size - drawWidth) / 2, y + (size - drawHeight) / 2, drawWidth, drawHeight);
  } else {
    setFont(ctx, 18, "900", "#03101f");
    ctx.textAlign = "center";
    ctx.direction = "ltr";
    ctx.fillText(fallback, x + size / 2, y + size / 2 + 1);
  }
  ctx.restore();
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.stroke();
}

function statusLabel(value: unknown, language: EmployeePayrollStatementLanguage) {
  const status = clean(value, "").toLowerCase();
  const labels: Record<string, [string, string]> = {
    active: ["نشط", "Active"], inactive: ["غير نشط", "Inactive"], on_leave: ["في إجازة", "On leave"], suspended: ["موقوف", "Suspended"], terminated: ["انتهت الخدمة", "Terminated"], approved: ["معتمد", "Approved"], draft: ["مسودة", "Draft"], void: ["ملغى", "Void"],
  };
  return labels[status]?.[language === "ar" ? 0 : 1] || status || "—";
}

function cycleLabel(value: unknown, language: EmployeePayrollStatementLanguage) {
  const cycle = clean(value, "monthly").toLowerCase();
  if (cycle === "daily") return language === "ar" ? "يومي" : "Daily";
  if (cycle === "weekly") return language === "ar" ? "أسبوعي" : "Weekly";
  return language === "ar" ? "شهري" : "Monthly";
}

function employeeTypeLabel(value: unknown, language: EmployeePayrollStatementLanguage) {
  const type = clean(value, "other").toLowerCase();
  const labels: Record<string, [string, string]> = {
    driver: ["سائق / مندوب", "Driver"], accountant: ["محاسب", "Accountant"], developer: ["مطور برمجيات", "Developer"], operations: ["موظف عمليات", "Operations"], customer_service: ["خدمة عملاء", "Customer Service"], sales: ["مبيعات", "Sales"], warehouse: ["مخزن وتجهيز", "Warehouse"], supervisor: ["مشرف", "Supervisor"], manager: ["مدير", "Manager"], support: ["دعم فني", "Technical Support"], other: ["وظيفة أخرى", "Other"],
  };
  return labels[type]?.[language === "ar" ? 0 : 1] || clean(value);
}

function movementTypeLabel(value: unknown, language: EmployeePayrollStatementLanguage) {
  const type = clean(value, "adjustment").toLowerCase();
  const labels: Record<string, [string, string]> = {
    bonus: ["مكافأة", "Bonus"], overtime: ["عمل إضافي", "Overtime"], allowance: ["بدل / حافز", "Allowance"], reimbursement: ["تعويض مصروف", "Reimbursement"], adjustment: ["تسوية إضافة", "Credit adjustment"], deduction: ["خصم من الراتب", "Salary deduction"], advance: ["سلفة", "Advance"], penalty: ["جزاء مالي", "Penalty"], expense: ["مصروف على الموظف", "Employee expense"], debit_adjustment: ["تسوية خصم", "Debit adjustment"], payment: ["دفعة راتب", "Salary payment"],
  };
  return labels[type]?.[language === "ar" ? 0 : 1] || type.replace(/_/g, " ");
}

function movementEffect(entry: EmployeePayrollEntry, language: EmployeePayrollStatementLanguage) {
  if (entry.entry_type === "payment") return language === "ar" ? "سداد" : "Payment";
  if (entry.direction === "credit") return language === "ar" ? "إضافة" : "Credit";
  return language === "ar" ? "خصم" : "Debit";
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "DN";
}

function drawHeader(ctx: CanvasRenderingContext2D, payload: EmployeePayrollStatementPayload, logo: HTMLImageElement | null, width: number, page: number, totalPages: number) {
  const isArabic = payload.language === "ar";
  const margin = 22;
  roundedRect(ctx, margin, 16, width - margin * 2, 82, 16);
  ctx.fillStyle = "#03101f";
  ctx.fill();
  ctx.fillStyle = "#d4af37";
  ctx.fillRect(margin, 93, width - margin * 2, 5);
  const logoSize = 58;
  const logoX = isArabic ? width - margin - logoSize - 10 : margin + 10;
  drawCircularImage(ctx, logo, logoX, 28, logoSize, "DN");
  const brandX = isArabic ? logoX - 14 : logoX + logoSize + 14;
  ctx.textAlign = isArabic ? "right" : "left";
  ctx.direction = isArabic ? "rtl" : "ltr";
  setFont(ctx, 18, "900", "#d4af37");
  ctx.fillText("DAY NIGHT", brandX, 45, 240);
  setFont(ctx, 9.5, "700", "#ffffff");
  ctx.fillText(isArabic ? "داي نايت لخدمات التوصيل والشحن" : "DAY NIGHT DELIVERY SERVICES", brandX, 68, 280);
  const metaX = isArabic ? margin + 12 : width - margin - 12;
  ctx.textAlign = isArabic ? "left" : "right";
  setFont(ctx, 11, "900", "#d4af37");
  ctx.fillText(isArabic ? "كشف راتب الموظف" : "EMPLOYEE PAYROLL STATEMENT", metaX, 40, 280);
  setFont(ctx, 8.2, "600", "#ffffff");
  ctx.fillText(`${isArabic ? "الفترة" : "Period"}: ${payload.snapshot.period_from} - ${payload.snapshot.period_to}`, metaX, 61, 280);
  setFont(ctx, 8, "700", "#d4af37");
  ctx.fillText(`${isArabic ? "صفحة" : "Page"} ${page} / ${totalPages}`, metaX, 79, 180);
}

function drawEmployeeCard(ctx: CanvasRenderingContext2D, payload: EmployeePayrollStatementPayload, employeeImage: HTMLImageElement | null, width: number) {
  const isArabic = payload.language === "ar";
  const employee = payload.employee;
  const margin = 22;
  const cardY = 112;
  const cardHeight = 112;
  roundedRect(ctx, margin, cardY, width - margin * 2, cardHeight, 14);
  ctx.fillStyle = "#f7f9fc";
  ctx.fill();
  ctx.strokeStyle = "#d9e2ef";
  ctx.stroke();
  const photoSize = 68;
  const photoX = isArabic ? width - margin - photoSize - 12 : margin + 12;
  drawCircularImage(ctx, employeeImage, photoX, cardY + 15, photoSize, initials(employee.full_name));
  const nameX = isArabic ? photoX - 15 : photoX + photoSize + 15;
  ctx.textAlign = isArabic ? "right" : "left";
  ctx.direction = isArabic ? "rtl" : "ltr";
  setFont(ctx, 16, "900", "#03101f");
  ctx.fillText(employee.full_name, nameX, cardY + 26, 330);
  setFont(ctx, 9, "800", "#926f00");
  ctx.fillText(`${employeeTypeLabel(employee.employee_type, payload.language)} - ${clean(employee.custom_job_title || employee.department)}`, nameX, cardY + 48, 340);
  setFont(ctx, 8.2, "700", "#3c4a60");
  ctx.fillText(`${clean(employee.employee_code)} | ${statusLabel(employee.employment_status, payload.language)}`, nameX, cardY + 69, 330);
  setFont(ctx, 8, "600", "#5b687b");
  ctx.fillText(`${isArabic ? "تاريخ الالتحاق" : "Joined"}: ${clean(employee.joined_at)} | ${isArabic ? "دورة الراتب" : "Salary cycle"}: ${cycleLabel(employee.salary_cycle, payload.language)}`, nameX, cardY + 90, 390);
  const details = [
    [isArabic ? "الهاتف" : "Phone", employee.phone], [isArabic ? "البريد" : "Email", employee.email], [isArabic ? "الإمارة" : "Emirate", employee.emirate], [isArabic ? "العنوان" : "Address", employee.address], [isArabic ? "الجنسية" : "Nationality", employee.nationality], [isArabic ? "الهوية" : "ID number", employee.identity_number],
  ];
  const infoX = isArabic ? margin + 12 : width - margin - 12;
  const infoWidth = 230;
  details.forEach(([label, value], index) => {
    const y = cardY + 18 + index * 15;
    setFont(ctx, 7.2, "800", "#926f00");
    ctx.textAlign = isArabic ? "left" : "right";
    ctx.direction = isArabic ? "rtl" : "ltr";
    ctx.fillText(label, infoX, y, 70);
    setFont(ctx, 7.8, "600", "#0b172a");
    ctx.fillText(fitSingleLine(ctx, value, infoWidth - 72), isArabic ? infoX + 74 : infoX - 74, y, infoWidth - 72);
  });
}

function drawSummary(ctx: CanvasRenderingContext2D, payload: EmployeePayrollStatementPayload, width: number) {
  const isArabic = payload.language === "ar";
  const snapshot = payload.snapshot;
  const margin = 22;
  const gap = 7;
  const startY = 234;
  const deductions = numeric(snapshot.debits) || (numeric(snapshot.deductions) + numeric(snapshot.advances) + numeric(snapshot.penalties) + numeric(snapshot.expenses) + numeric(snapshot.debit_adjustments));
  const cards = [
    [isArabic ? "الراتب الأساسي" : "Base salary", money(payload.employee.base_salary, payload.language), "normal"], [isArabic ? "راتب الفترة" : "Period salary", money(snapshot.gross_salary, payload.language), "normal"], [isArabic ? "المكافآت والإضافات" : "Credits & bonuses", money(snapshot.credits, payload.language), "credit"], [isArabic ? "الخصومات والسلف" : "Deductions & advances", money(deductions, payload.language), "debit"], [isArabic ? "صافي الاستحقاق" : "Net entitlement", money(snapshot.net_salary, payload.language), "gold"], [isArabic ? "المدفوع" : "Paid", money(snapshot.payments, payload.language), "normal"], [isArabic ? "المتبقي للموظف" : "Outstanding", money(snapshot.outstanding, payload.language), "credit"], [isArabic ? "مستحق على الموظف" : "Employee liability", money(snapshot.employee_liability, payload.language), "debit"],
  ] as const;
  const columns = 4;
  const cardWidth = (width - margin * 2 - gap * (columns - 1)) / columns;
  cards.forEach(([label, value, tone], index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const x = isArabic ? width - margin - cardWidth - column * (cardWidth + gap) : margin + column * (cardWidth + gap);
    const y = startY + row * 48;
    roundedRect(ctx, x, y, cardWidth, 41, 9);
    ctx.fillStyle = tone === "gold" ? "#fff8d8" : tone === "credit" ? "#eaf8f1" : tone === "debit" ? "#fff0ef" : "#ffffff";
    ctx.fill();
    ctx.strokeStyle = tone === "gold" ? "#d4af37" : tone === "credit" ? "#79caa5" : tone === "debit" ? "#e8aaa5" : "#dbe3ee";
    ctx.stroke();
    setFont(ctx, 7.4, "800", tone === "debit" ? "#a52b23" : tone === "credit" ? "#16794b" : "#926f00");
    ctx.textAlign = "center";
    ctx.direction = isArabic ? "rtl" : "ltr";
    ctx.fillText(label, x + cardWidth / 2, y + 12, cardWidth - 10);
    setFont(ctx, 9.2, "900", tone === "debit" ? "#b42318" : tone === "credit" ? "#16794b" : "#03101f");
    ctx.fillText(fitSingleLine(ctx, value, cardWidth - 10), x + cardWidth / 2, y + 29, cardWidth - 10);
  });
  roundedRect(ctx, margin, startY + 98, width - margin * 2, 30, 9);
  ctx.fillStyle = "#03101f";
  ctx.fill();
  setFont(ctx, 8.2, "700", "#ffffff");
  ctx.textAlign = isArabic ? "right" : "left";
  ctx.direction = isArabic ? "rtl" : "ltr";
  const formula = isArabic
    ? `المعادلة: راتب الفترة + الإضافات - الخصومات والسلف = ${money(snapshot.net_salary, payload.language)} | المتبقي بعد المدفوع = ${money(snapshot.outstanding, payload.language)}`
    : `Formula: period salary + credits - deductions = ${money(snapshot.net_salary, payload.language)} | outstanding after payments = ${money(snapshot.outstanding, payload.language)}`;
  ctx.fillText(formula, isArabic ? width - margin - 12 : margin + 12, startY + 113, width - margin * 2 - 24);
}

function movementColumnRects(width: number, margin: number, language: EmployeePayrollStatementLanguage) {
  const tableWidth = width - margin * 2;
  const totalWeight = movementColumns.reduce((sum, column) => sum + column.weight, 0);
  const rects: Array<MovementColumn & { x: number; width: number }> = [];
  if (language === "ar") {
    let cursor = width - margin;
    movementColumns.forEach((column) => {
      const columnWidth = tableWidth * (column.weight / totalWeight);
      cursor -= columnWidth;
      rects.push({ ...column, x: cursor, width: columnWidth });
    });
  } else {
    let cursor = margin;
    movementColumns.forEach((column) => {
      const columnWidth = tableWidth * (column.weight / totalWeight);
      rects.push({ ...column, x: cursor, width: columnWidth });
      cursor += columnWidth;
    });
  }
  return rects;
}

function movementValue(entry: EmployeePayrollEntry, key: MovementColumnKey, language: EmployeePayrollStatementLanguage) {
  if (key === "date") return entry.entry_date;
  if (key === "type") return movementTypeLabel(entry.original_entry_type || entry.entry_type, language);
  if (key === "reason") return entry.notes;
  if (key === "reference") return entry.reference_number || "—";
  if (key === "effect") return movementEffect(entry, language);
  if (key === "amount") return money(entry.amount, language);
  return statusLabel(entry.status, language);
}

function drawMovementTable(ctx: CanvasRenderingContext2D, payload: EmployeePayrollStatementPayload, rows: EmployeePayrollEntry[], width: number, startY: number) {
  const isArabic = payload.language === "ar";
  const margin = 22;
  const headerHeight = 28;
  const rowHeight = 38;
  const rects = movementColumnRects(width, margin, payload.language);
  setFont(ctx, 12, "900", "#03101f");
  ctx.textAlign = isArabic ? "right" : "left";
  ctx.direction = isArabic ? "rtl" : "ltr";
  ctx.fillText(isArabic ? "تفاصيل حركات الراتب" : "Payroll movement details", isArabic ? width - margin : margin, startY - 14, width - margin * 2);
  rects.forEach((column) => {
    ctx.fillStyle = "#d4af37";
    ctx.fillRect(column.x, startY, column.width, headerHeight);
    ctx.strokeStyle = "#b88f16";
    ctx.strokeRect(column.x, startY, column.width, headerHeight);
    drawWrappedText(ctx, isArabic ? column.ar : column.en, column.x + column.width / 2, startY, column.width, headerHeight, "center", { size: 7.5, weight: "900", color: "#03101f", maxLines: 2, direction: isArabic ? "rtl" : "ltr" });
  });
  let y = startY + headerHeight;
  rows.forEach((entry, index) => {
    rects.forEach((column) => {
      ctx.fillStyle = index % 2 === 0 ? "#ffffff" : "#f6f8fb";
      ctx.fillRect(column.x, y, column.width, rowHeight);
      ctx.strokeStyle = "#dce3ec";
      ctx.strokeRect(column.x, y, column.width, rowHeight);
      const value = movementValue(entry, column.key, payload.language);
      const isCredit = entry.direction === "credit";
      const isDebit = entry.direction === "debit" && entry.entry_type !== "payment";
      drawWrappedText(ctx, value, column.x + column.width / 2, y, column.width, rowHeight, "center", { size: column.key === "reason" ? 7.2 : 7.6, weight: column.key === "amount" || column.key === "effect" ? "800" : "600", color: column.key === "amount" || column.key === "effect" ? isCredit ? "#16794b" : isDebit ? "#b42318" : "#0057b8" : "#0b172a", maxLines: column.lines ?? 1, direction: column.ltr ? "ltr" : isArabic ? "rtl" : "ltr" });
    });
    y += rowHeight;
  });
}

function drawSalaryHistory(ctx: CanvasRenderingContext2D, payload: EmployeePayrollStatementPayload, rows: EmployeeSalaryHistory[], width: number, startY: number) {
  const isArabic = payload.language === "ar";
  const margin = 22;
  setFont(ctx, 12, "900", "#03101f");
  ctx.textAlign = isArabic ? "right" : "left";
  ctx.direction = isArabic ? "rtl" : "ltr";
  ctx.fillText(isArabic ? "تاريخ الراتب الأساسي" : "Base salary history", isArabic ? width - margin : margin, startY, width - margin * 2);
  const headers = isArabic ? ["من", "إلى", "الراتب", "الدورة", "التغيير", "السبب"] : ["From", "To", "Salary", "Cycle", "Change", "Reason"];
  const weights = [0.8, 0.8, 1, 0.8, 0.8, 2.6];
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const tableWidth = width - margin * 2;
  const headerY = startY + 14;
  const headerHeight = 27;
  const rowHeight = 35;
  const rects: Array<{ x: number; width: number }> = [];
  if (isArabic) {
    let cursor = width - margin;
    weights.forEach((weight) => { const columnWidth = tableWidth * weight / totalWeight; cursor -= columnWidth; rects.push({ x: cursor, width: columnWidth }); });
  } else {
    let cursor = margin;
    weights.forEach((weight) => { const columnWidth = tableWidth * weight / totalWeight; rects.push({ x: cursor, width: columnWidth }); cursor += columnWidth; });
  }
  rects.forEach((rect, index) => {
    ctx.fillStyle = "#03101f";
    ctx.fillRect(rect.x, headerY, rect.width, headerHeight);
    ctx.strokeStyle = "#d4af37";
    ctx.strokeRect(rect.x, headerY, rect.width, headerHeight);
    drawWrappedText(ctx, headers[index], rect.x + rect.width / 2, headerY, rect.width, headerHeight, "center", { size: 7.3, weight: "900", color: "#d4af37", maxLines: 2, direction: isArabic ? "rtl" : "ltr" });
  });
  let y = headerY + headerHeight;
  rows.forEach((history, index) => {
    const values = [history.effective_from, history.effective_to || (isArabic ? "مستمر" : "Current"), money(history.base_salary, payload.language), cycleLabel(history.salary_cycle, payload.language), `${numeric(history.change_amount) >= 0 ? "+" : ""}${numeric(history.change_amount).toFixed(2)}`, history.note || "—"];
    rects.forEach((rect, column) => {
      ctx.fillStyle = index % 2 === 0 ? "#ffffff" : "#f6f8fb";
      ctx.fillRect(rect.x, y, rect.width, rowHeight);
      ctx.strokeStyle = "#dce3ec";
      ctx.strokeRect(rect.x, y, rect.width, rowHeight);
      drawWrappedText(ctx, values[column], rect.x + rect.width / 2, y, rect.width, rowHeight, "center", { size: column === 5 ? 7.1 : 7.5, weight: column === 2 || column === 4 ? "800" : "600", color: column === 4 ? numeric(history.change_amount) >= 0 ? "#16794b" : "#b42318" : "#0b172a", maxLines: column === 5 ? 2 : 1, direction: column <= 4 ? "ltr" : isArabic ? "rtl" : "ltr" });
    });
    y += rowHeight;
  });
  return y;
}

function drawSignatures(ctx: CanvasRenderingContext2D, payload: EmployeePayrollStatementPayload, width: number, startY: number) {
  const isArabic = payload.language === "ar";
  const margin = 22;
  const gap = 18;
  const boxWidth = (width - margin * 2 - gap) / 2;
  const labels = isArabic ? [["اعتماد الإدارة", "الاسم والتوقيع والختم"], ["استلام الموظف", "الاسم والتوقيع والتاريخ"]] : [["Management approval", "Name, signature and stamp"], ["Employee acknowledgement", "Name, signature and date"]];
  labels.forEach(([title, subtitle], index) => {
    const x = isArabic ? width - margin - boxWidth - index * (boxWidth + gap) : margin + index * (boxWidth + gap);
    roundedRect(ctx, x, startY, boxWidth, 55, 10);
    ctx.fillStyle = "#f7f9fc";
    ctx.fill();
    ctx.strokeStyle = "#d4af37";
    ctx.stroke();
    setFont(ctx, 8.5, "900", "#03101f");
    ctx.textAlign = "center";
    ctx.direction = isArabic ? "rtl" : "ltr";
    ctx.fillText(title, x + boxWidth / 2, startY + 13, boxWidth - 10);
    ctx.strokeStyle = "#aeb9c8";
    ctx.beginPath();
    ctx.moveTo(x + 18, startY + 36);
    ctx.lineTo(x + boxWidth - 18, startY + 36);
    ctx.stroke();
    setFont(ctx, 6.8, "600", "#6b7789");
    ctx.fillText(subtitle, x + boxWidth / 2, startY + 47, boxWidth - 10);
  });
}

function drawFooter(ctx: CanvasRenderingContext2D, payload: EmployeePayrollStatementPayload, width: number, height: number) {
  const isArabic = payload.language === "ar";
  const margin = 22;
  const links: PdfLink[] = [];
  const lineY = height - 53;
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(margin, lineY);
  ctx.lineTo(width - margin, lineY);
  ctx.stroke();
  const thankYou = isArabic ? `شكرًا ${payload.employee.full_name} على جهودك والتزامك مع فريق DAY NIGHT.` : `Thank you ${payload.employee.full_name} for your commitment and contribution to DAY NIGHT.`;
  setFont(ctx, 8.2, "800", "#03101f");
  ctx.textAlign = isArabic ? "right" : "left";
  ctx.direction = isArabic ? "rtl" : "ltr";
  ctx.fillText(thankYou, isArabic ? width - margin : margin, height - 39, width - margin * 2);
  const footerLinks = [{ label: "www.daynightae.com", url: WEBSITE_URL }, { label: "+971 56 875 7331", url: WHATSAPP_URL }, { label: "Admin@daynightae.com", url: EMAIL_URL }];
  const gap = 9;
  const itemWidth = (width - margin * 2 - gap * (footerLinks.length - 1)) / footerLinks.length;
  footerLinks.forEach((item, index) => {
    const x = isArabic ? width - margin - itemWidth - index * (itemWidth + gap) : margin + index * (itemWidth + gap);
    roundedRect(ctx, x, height - 28, itemWidth, 17, 6);
    ctx.fillStyle = "#f0f5fb";
    ctx.fill();
    ctx.strokeStyle = "#cad7e7";
    ctx.stroke();
    setFont(ctx, 7.2, "800", "#0057b8");
    ctx.textAlign = "center";
    ctx.direction = "ltr";
    ctx.fillText(fitSingleLine(ctx, item.label, itemWidth - 8), x + itemWidth / 2, height - 19.5, itemWidth - 8);
    links.push({ x, y: height - 30, width: itemWidth, height: 20, url: item.url });
  });
  return links;
}

function createCanvas(width: number, height: number) {
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  return { canvas, ctx };
}

function drawFirstPage(payload: EmployeePayrollStatementPayload, logo: HTMLImageElement | null, employeeImage: HTMLImageElement | null, entries: EmployeePayrollEntry[], page: number, totalPages: number, width: number, height: number) {
  const { canvas, ctx } = createCanvas(width, height);
  ctx.direction = payload.language === "ar" ? "rtl" : "ltr";
  drawHeader(ctx, payload, logo, width, page, totalPages);
  drawEmployeeCard(ctx, payload, employeeImage, width);
  drawSummary(ctx, payload, width);
  drawMovementTable(ctx, payload, entries, width, 376);
  return { canvas, links: drawFooter(ctx, payload, width, height) };
}

function drawMovementContinuationPage(payload: EmployeePayrollStatementPayload, logo: HTMLImageElement | null, entries: EmployeePayrollEntry[], page: number, totalPages: number, width: number, height: number) {
  const { canvas, ctx } = createCanvas(width, height);
  ctx.direction = payload.language === "ar" ? "rtl" : "ltr";
  drawHeader(ctx, payload, logo, width, page, totalPages);
  drawMovementTable(ctx, payload, entries, width, 128);
  return { canvas, links: drawFooter(ctx, payload, width, height) };
}

function drawHistoryPage(payload: EmployeePayrollStatementPayload, logo: HTMLImageElement | null, histories: EmployeeSalaryHistory[], page: number, totalPages: number, width: number, height: number) {
  const { canvas, ctx } = createCanvas(width, height);
  ctx.direction = payload.language === "ar" ? "rtl" : "ltr";
  drawHeader(ctx, payload, logo, width, page, totalPages);
  const endY = drawSalaryHistory(ctx, payload, histories, width, 126);
  if (endY + 75 < height - 65) drawSignatures(ctx, payload, width, endY + 16);
  return { canvas, links: drawFooter(ctx, payload, width, height) };
}

function buildPdfDocument(payload: EmployeePayrollStatementPayload, logo: HTMLImageElement | null, employeeImage: HTMLImageElement | null) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4", compress: true });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const firstCapacity = 4;
  const continuationCapacity = 10;
  const historyCapacity = 9;
  const entries = payload.snapshot.entries || [];
  const histories = payload.snapshot.salary_history || [];
  const entryPages: EmployeePayrollEntry[][] = [entries.slice(0, firstCapacity)];
  for (let index = firstCapacity; index < entries.length; index += continuationCapacity) entryPages.push(entries.slice(index, index + continuationCapacity));
  if (!entryPages.length) entryPages.push([]);
  const historyPages: EmployeeSalaryHistory[][] = [];
  for (let index = 0; index < histories.length; index += historyCapacity) historyPages.push(histories.slice(index, index + historyCapacity));
  if (!historyPages.length) historyPages.push([]);
  const totalPages = entryPages.length + historyPages.length;
  let pageNumber = 1;
  const addRendered = (rendered: { canvas: HTMLCanvasElement; links: PdfLink[] }, addPage: boolean) => {
    if (addPage) doc.addPage("a4", "landscape");
    doc.addImage(rendered.canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, width, height, undefined, "FAST");
    rendered.links.forEach((link) => doc.link(link.x, link.y, link.width, link.height, { url: link.url }));
  };
  entryPages.forEach((pageEntries, index) => {
    const rendered = index === 0 ? drawFirstPage(payload, logo, employeeImage, pageEntries, pageNumber, totalPages, width, height) : drawMovementContinuationPage(payload, logo, pageEntries, pageNumber, totalPages, width, height);
    addRendered(rendered, pageNumber > 1);
    pageNumber += 1;
  });
  historyPages.forEach((pageHistories) => {
    addRendered(drawHistoryPage(payload, logo, pageHistories, pageNumber, totalPages, width, height), pageNumber > 1);
    pageNumber += 1;
  });
  doc.setProperties({ title: `${payload.language === "ar" ? "كشف راتب الموظف" : "Employee payroll statement"} - ${payload.employee.full_name}`, subject: `${payload.snapshot.period_from} - ${payload.snapshot.period_to}`, author: payload.generatedBy || "DAY NIGHT DELIVERY SERVICES", creator: "DAY NIGHT HR & Payroll Center", keywords: "DAY NIGHT, payroll, employee, salary, deductions, advances" });
  return doc;
}

export async function createEmployeePayrollPdfBlob(input: EmployeePayrollStatementPayload) {
  if (typeof window === "undefined" || typeof document === "undefined") throw new Error("browser_required");
  const payload: EmployeePayrollStatementPayload = { ...input, snapshot: { ...input.snapshot, entries: Array.isArray(input.snapshot.entries) ? input.snapshot.entries : [], salary_history: Array.isArray(input.snapshot.salary_history) ? input.snapshot.salary_history : [] } };
  const [logo, employeeImage] = await Promise.all([loadLogo(payload.logoUrl), payload.employee.avatar_url ? loadOneImage(payload.employee.avatar_url) : Promise.resolve(null)]);
  return buildPdfDocument(payload, logo, employeeImage).output("blob");
}

export async function downloadEmployeePayrollPdf(payload: EmployeePayrollStatementPayload) {
  downloadBlob(await createEmployeePayrollPdfBlob(payload), `${safeFileName(payload)}.pdf`);
}

export async function shareEmployeePayrollPdf(payload: EmployeePayrollStatementPayload) {
  const blob = await createEmployeePayrollPdfBlob(payload);
  const filename = `${safeFileName(payload)}.pdf`;
  const file = new File([blob], filename, { type: "application/pdf" });
  const shareData = { title: payload.language === "ar" ? `كشف راتب ${payload.employee.full_name}` : `${payload.employee.full_name} payroll statement`, text: payload.language === "ar" ? `كشف راتب ${payload.employee.full_name} للفترة ${payload.snapshot.period_from} إلى ${payload.snapshot.period_to} من DAY NIGHT.` : `${payload.employee.full_name} payroll statement for ${payload.snapshot.period_from} to ${payload.snapshot.period_to} from DAY NIGHT.`, files: [file] };
  if (typeof navigator !== "undefined" && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    await navigator.share(shareData);
    return "shared" as const;
  }
  downloadBlob(blob, filename);
  const phone = clean(payload.employee.phone, "").replace(/\D/g, "").replace(/^0/, "971");
  if (phone && typeof window !== "undefined") {
    const message = payload.language === "ar" ? `السلام عليكم ${payload.employee.full_name}، تم تجهيز كشف راتبك للفترة ${payload.snapshot.period_from} إلى ${payload.snapshot.period_to}. تم تنزيل ملف PDF على الجهاز؛ يرجى إرفاقه في هذه المحادثة.` : `Hello ${payload.employee.full_name}, your payroll statement for ${payload.snapshot.period_from} to ${payload.snapshot.period_to} is ready. The PDF was downloaded; please attach it to this chat.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }
  return "downloaded" as const;
}
