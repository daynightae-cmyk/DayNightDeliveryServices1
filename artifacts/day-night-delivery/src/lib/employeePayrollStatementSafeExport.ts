import { jsPDF } from "jspdf";
import type { EmployeePayrollEntry, EmployeeSalaryHistory } from "./adminEmployees";
import {
  createEmployeePayrollPdfBlob,
  type EmployeePayrollStatementPayload,
} from "./employeePayrollStatementExport";

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN = 28;
const FONT = "Tahoma, Arial, 'Segoe UI', sans-serif";

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value: unknown, fallback = "—") {
  const valueText = String(value ?? "").trim();
  return valueText || fallback;
}

function money(value: unknown, language: "ar" | "en") {
  return language === "ar" ? `${numberValue(value).toFixed(2)} درهم` : `${numberValue(value).toFixed(2)} AED`;
}

function fileName(payload: EmployeePayrollStatementPayload) {
  const employee = textValue(payload.employee.full_name, "Employee")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 55);
  return `DAY_NIGHT_Employee_Payroll_${employee}_${payload.snapshot.period_from}_${payload.snapshot.period_to}.pdf`;
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3500);
}

function createCanvas() {
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_WIDTH * scale;
  canvas.height = PAGE_HEIGHT * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("payroll_pdf_canvas_unavailable");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  return { canvas, ctx };
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

function setFont(ctx: CanvasRenderingContext2D, size: number, weight = 600, color = "#0b172a") {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
}

function fitText(ctx: CanvasRenderingContext2D, value: unknown, maxWidth: number) {
  let result = textValue(value).replace(/\s+/g, " ");
  if (ctx.measureText(result).width <= maxWidth) return result;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) result = result.slice(0, -1);
  return `${result}…`;
}

function drawText(ctx: CanvasRenderingContext2D, value: unknown, x: number, y: number, maxWidth: number, align: CanvasTextAlign, language: "ar" | "en", size = 9, weight = 600, color = "#0b172a") {
  setFont(ctx, size, weight, color);
  ctx.textAlign = align;
  ctx.direction = language === "ar" ? "rtl" : "ltr";
  ctx.fillText(fitText(ctx, value, maxWidth), x, y, maxWidth);
}

function drawHeader(ctx: CanvasRenderingContext2D, payload: EmployeePayrollStatementPayload, page: number, totalPages: number) {
  const ar = payload.language === "ar";
  roundedRect(ctx, MARGIN, 20, PAGE_WIDTH - MARGIN * 2, 76, 16);
  ctx.fillStyle = "#031226";
  ctx.fill();
  ctx.fillStyle = "#d4af37";
  ctx.fillRect(MARGIN, 91, PAGE_WIDTH - MARGIN * 2, 5);
  ctx.beginPath();
  ctx.arc(ar ? PAGE_WIDTH - 75 : 75, 58, 27, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 3;
  ctx.stroke();
  drawText(ctx, "DN", ar ? PAGE_WIDTH - 75 : 75, 59, 50, "center", "en", 13, 950, "#031226");
  drawText(ctx, "DAY NIGHT", ar ? PAGE_WIDTH - 118 : 118, 44, 280, ar ? "right" : "left", payload.language, 17, 950, "#d4af37");
  drawText(ctx, ar ? "داي نايت لخدمات التوصيل والشحن" : "DAY NIGHT DELIVERY SERVICES", ar ? PAGE_WIDTH - 118 : 118, 68, 330, ar ? "right" : "left", payload.language, 9, 800, "#ffffff");
  drawText(ctx, ar ? "كشف راتب الموظف" : "EMPLOYEE PAYROLL STATEMENT", ar ? MARGIN + 15 : PAGE_WIDTH - MARGIN - 15, 43, 300, ar ? "left" : "right", payload.language, 12, 950, "#d4af37");
  drawText(ctx, `${ar ? "الفترة" : "Period"}: ${payload.snapshot.period_from} - ${payload.snapshot.period_to}`, ar ? MARGIN + 15 : PAGE_WIDTH - MARGIN - 15, 66, 310, ar ? "left" : "right", payload.language, 8, 700, "#ffffff");
  drawText(ctx, `${ar ? "صفحة" : "Page"} ${page}/${totalPages}`, ar ? MARGIN + 15 : PAGE_WIDTH - MARGIN - 15, 83, 120, ar ? "left" : "right", payload.language, 7.5, 800, "#d4af37");
}

function drawEmployeeInfo(ctx: CanvasRenderingContext2D, payload: EmployeePayrollStatementPayload) {
  const ar = payload.language === "ar";
  roundedRect(ctx, MARGIN, 112, PAGE_WIDTH - MARGIN * 2, 92, 14);
  ctx.fillStyle = "#f6f8fb";
  ctx.fill();
  ctx.strokeStyle = "#dce4ee";
  ctx.stroke();
  const employee = payload.employee;
  const primaryX = ar ? PAGE_WIDTH - MARGIN - 18 : MARGIN + 18;
  drawText(ctx, employee.full_name, primaryX, 132, 420, ar ? "right" : "left", payload.language, 16, 950, "#031226");
  drawText(ctx, `${textValue(employee.employee_code)} · ${textValue(employee.custom_job_title || employee.department || employee.employee_type)}`, primaryX, 156, 450, ar ? "right" : "left", payload.language, 9, 850, "#906d00");
  drawText(ctx, `${ar ? "الهاتف" : "Phone"}: ${textValue(employee.phone)}  |  ${ar ? "الإمارة" : "Emirate"}: ${textValue(employee.emirate)}`, primaryX, 178, 460, ar ? "right" : "left", payload.language, 8, 700, "#42516a");
  const secondaryX = ar ? MARGIN + 18 : PAGE_WIDTH - MARGIN - 18;
  drawText(ctx, `${ar ? "تاريخ الالتحاق" : "Joined"}: ${textValue(employee.joined_at)}`, secondaryX, 133, 250, ar ? "left" : "right", payload.language, 8, 700, "#42516a");
  drawText(ctx, `${ar ? "دورة الراتب" : "Salary cycle"}: ${textValue(employee.salary_cycle)}`, secondaryX, 156, 250, ar ? "left" : "right", payload.language, 8, 700, "#42516a");
  drawText(ctx, `${ar ? "البريد" : "Email"}: ${textValue(employee.email)}`, secondaryX, 179, 300, ar ? "left" : "right", payload.language, 8, 700, "#42516a");
}

function drawSummary(ctx: CanvasRenderingContext2D, payload: EmployeePayrollStatementPayload) {
  const ar = payload.language === "ar";
  const snapshot = payload.snapshot;
  const deductions = numberValue(snapshot.debits) || numberValue(snapshot.deductions) + numberValue(snapshot.advances) + numberValue(snapshot.penalties) + numberValue(snapshot.expenses) + numberValue(snapshot.debit_adjustments);
  const cards = [
    [ar ? "الراتب الأساسي" : "Base salary", money(payload.employee.base_salary, payload.language), "#ffffff", "#031226"],
    [ar ? "راتب الفترة" : "Period salary", money(snapshot.gross_salary, payload.language), "#ffffff", "#031226"],
    [ar ? "الإضافات" : "Credits", money(snapshot.credits, payload.language), "#eaf8f1", "#16794b"],
    [ar ? "الخصومات والسلف" : "Deductions", money(deductions, payload.language), "#fff0ef", "#b42318"],
    [ar ? "صافي الاستحقاق" : "Net entitlement", money(snapshot.net_salary, payload.language), "#fff8d8", "#7a5b00"],
    [ar ? "المدفوع" : "Paid", money(snapshot.payments, payload.language), "#ffffff", "#031226"],
    [ar ? "المتبقي" : "Outstanding", money(snapshot.outstanding, payload.language), "#eaf8f1", "#16794b"],
    [ar ? "على الموظف" : "Employee liability", money(snapshot.employee_liability, payload.language), "#fff0ef", "#b42318"],
  ] as const;
  const gap = 8;
  const width = (PAGE_WIDTH - MARGIN * 2 - gap * 3) / 4;
  cards.forEach((card, index) => {
    const row = Math.floor(index / 4);
    const column = index % 4;
    const x = ar ? PAGE_WIDTH - MARGIN - width - column * (width + gap) : MARGIN + column * (width + gap);
    const y = 220 + row * 54;
    roundedRect(ctx, x, y, width, 46, 10);
    ctx.fillStyle = card[2];
    ctx.fill();
    ctx.strokeStyle = index === 4 ? "#d4af37" : "#dce4ee";
    ctx.stroke();
    drawText(ctx, card[0], x + width / 2, y + 14, width - 12, "center", payload.language, 7.5, 850, card[3]);
    drawText(ctx, card[1], x + width / 2, y + 32, width - 12, "center", payload.language, 9.5, 950, card[3]);
  });
}

function movementLabel(entry: EmployeePayrollEntry, language: "ar" | "en") {
  const labels: Record<string, [string, string]> = {
    bonus: ["مكافأة", "Bonus"], overtime: ["عمل إضافي", "Overtime"], allowance: ["بدل", "Allowance"], reimbursement: ["تعويض", "Reimbursement"], adjustment: ["تسوية إضافة", "Credit adjustment"], deduction: ["خصم من الراتب", "Salary deduction"], advance: ["سلفة", "Advance"], penalty: ["جزاء مالي", "Penalty"], expense: ["مصروف على الموظف", "Employee expense"], debit_adjustment: ["تسوية خصم", "Debit adjustment"], payment: ["دفعة راتب", "Salary payment"],
  };
  const key = String(entry.original_entry_type || entry.entry_type || "adjustment").toLowerCase();
  return labels[key]?.[language === "ar" ? 0 : 1] || key.replace(/_/g, " ");
}

function drawEntries(ctx: CanvasRenderingContext2D, payload: EmployeePayrollStatementPayload, rows: EmployeePayrollEntry[], startY: number) {
  const ar = payload.language === "ar";
  drawText(ctx, ar ? "تفاصيل حركات الراتب" : "Payroll movements", ar ? PAGE_WIDTH - MARGIN : MARGIN, startY - 16, PAGE_WIDTH - MARGIN * 2, ar ? "right" : "left", payload.language, 12, 950, "#031226");
  const columns = ar
    ? [{ key: "status", label: "الحالة", w: 80 }, { key: "amount", label: "القيمة", w: 100 }, { key: "effect", label: "الأثر", w: 85 }, { key: "reason", label: "السبب", w: 250 }, { key: "type", label: "الحركة", w: 135 }, { key: "date", label: "التاريخ", w: 120 }]
    : [{ key: "date", label: "Date", w: 120 }, { key: "type", label: "Movement", w: 135 }, { key: "reason", label: "Reason", w: 250 }, { key: "effect", label: "Effect", w: 85 }, { key: "amount", label: "Amount", w: 100 }, { key: "status", label: "Status", w: 80 }];
  const total = columns.reduce((sum, column) => sum + column.w, 0);
  const scale = (PAGE_WIDTH - MARGIN * 2) / total;
  let cursor = MARGIN;
  columns.forEach((column) => {
    const width = column.w * scale;
    ctx.fillStyle = "#d4af37";
    ctx.fillRect(cursor, startY, width, 27);
    drawText(ctx, column.label, cursor + width / 2, startY + 14, width - 8, "center", payload.language, 7.5, 950, "#031226");
    cursor += width;
  });
  let y = startY + 27;
  rows.forEach((entry, index) => {
    cursor = MARGIN;
    columns.forEach((column) => {
      const width = column.w * scale;
      ctx.fillStyle = index % 2 ? "#f6f8fb" : "#ffffff";
      ctx.fillRect(cursor, y, width, 36);
      ctx.strokeStyle = "#dce4ee";
      ctx.strokeRect(cursor, y, width, 36);
      const effect = entry.entry_type === "payment" ? (ar ? "سداد" : "Payment") : entry.direction === "credit" ? (ar ? "إضافة" : "Credit") : (ar ? "خصم" : "Debit");
      const values: Record<string, unknown> = {
        date: entry.entry_date,
        type: movementLabel(entry, payload.language),
        reason: entry.notes,
        effect,
        amount: money(entry.amount, payload.language),
        status: entry.status,
      };
      const color = column.key === "amount" || column.key === "effect" ? entry.direction === "credit" ? "#16794b" : entry.entry_type === "payment" ? "#0057b8" : "#b42318" : "#0b172a";
      drawText(ctx, values[column.key], cursor + width / 2, y + 18, width - 8, "center", column.key === "date" || column.key === "amount" ? "en" : payload.language, column.key === "reason" ? 7.2 : 7.6, column.key === "amount" ? 900 : 650, color);
      cursor += width;
    });
    y += 36;
  });
}

function drawHistory(ctx: CanvasRenderingContext2D, payload: EmployeePayrollStatementPayload, rows: EmployeeSalaryHistory[], startY: number) {
  const ar = payload.language === "ar";
  drawText(ctx, ar ? "تاريخ الراتب الأساسي" : "Base salary history", ar ? PAGE_WIDTH - MARGIN : MARGIN, startY, PAGE_WIDTH - MARGIN * 2, ar ? "right" : "left", payload.language, 13, 950, "#031226");
  let y = startY + 25;
  rows.forEach((row, index) => {
    roundedRect(ctx, MARGIN, y, PAGE_WIDTH - MARGIN * 2, 42, 9);
    ctx.fillStyle = index % 2 ? "#f6f8fb" : "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#dce4ee";
    ctx.stroke();
    drawText(ctx, `${row.effective_from} → ${row.effective_to || (ar ? "مستمر" : "Current")}`, ar ? PAGE_WIDTH - MARGIN - 15 : MARGIN + 15, y + 13, 260, ar ? "right" : "left", "en", 8, 800, "#42516a");
    drawText(ctx, money(row.base_salary, payload.language), ar ? PAGE_WIDTH - MARGIN - 15 : MARGIN + 15, y + 30, 260, ar ? "right" : "left", payload.language, 9, 950, "#031226");
    drawText(ctx, row.note || (ar ? "تغيير الراتب الأساسي" : "Base salary change"), ar ? MARGIN + 15 : PAGE_WIDTH - MARGIN - 15, y + 22, 430, ar ? "left" : "right", payload.language, 8, 700, "#42516a");
    y += 49;
  });
}

function drawFooter(ctx: CanvasRenderingContext2D, payload: EmployeePayrollStatementPayload) {
  const ar = payload.language === "ar";
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(MARGIN, PAGE_HEIGHT - 48);
  ctx.lineTo(PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 48);
  ctx.stroke();
  drawText(ctx, ar ? `شكرًا ${payload.employee.full_name} على جهودك والتزامك مع DAY NIGHT.` : `Thank you ${payload.employee.full_name} for your contribution to DAY NIGHT.`, ar ? PAGE_WIDTH - MARGIN : MARGIN, PAGE_HEIGHT - 34, PAGE_WIDTH - MARGIN * 2, ar ? "right" : "left", payload.language, 8, 800, "#031226");
  drawText(ctx, "www.daynightae.com  |  +971 56 875 7331  |  Admin@daynightae.com", PAGE_WIDTH / 2, PAGE_HEIGHT - 18, PAGE_WIDTH - MARGIN * 2, "center", "en", 7.5, 850, "#0057b8");
}

function renderPage(payload: EmployeePayrollStatementPayload, page: number, totalPages: number, entries: EmployeePayrollEntry[], histories: EmployeeSalaryHistory[], first: boolean) {
  const { canvas, ctx } = createCanvas();
  drawHeader(ctx, payload, page, totalPages);
  if (first) {
    drawEmployeeInfo(ctx, payload);
    drawSummary(ctx, payload);
    drawEntries(ctx, payload, entries, 340);
  } else if (entries.length) {
    drawEntries(ctx, payload, entries, 128);
  } else {
    drawHistory(ctx, payload, histories, 130);
  }
  drawFooter(ctx, payload);
  return canvas;
}

function normalizePayload(payload: EmployeePayrollStatementPayload): EmployeePayrollStatementPayload {
  return {
    ...payload,
    employee: {
      ...payload.employee,
      full_name: textValue(payload.employee.full_name, "DAY NIGHT Employee"),
      employee_code: textValue(payload.employee.employee_code, "DN-EMP"),
      phone: textValue(payload.employee.phone, "Not set"),
      joined_at: textValue(payload.employee.joined_at, payload.snapshot.period_from),
      employment_status: textValue(payload.employee.employment_status, "active"),
      base_salary: numberValue(payload.employee.base_salary),
      salary_currency: textValue(payload.employee.salary_currency, "AED"),
      salary_cycle: textValue(payload.employee.salary_cycle, "monthly"),
      salary_effective_from: textValue(payload.employee.salary_effective_from, payload.snapshot.period_from),
    },
    snapshot: {
      ...payload.snapshot,
      period_from: textValue(payload.snapshot.period_from, new Date().toISOString().slice(0, 10)),
      period_to: textValue(payload.snapshot.period_to, new Date().toISOString().slice(0, 10)),
      entries: Array.isArray(payload.snapshot.entries) ? payload.snapshot.entries : [],
      salary_history: Array.isArray(payload.snapshot.salary_history) ? payload.snapshot.salary_history : [],
    },
  };
}

async function fallbackPdfBlob(input: EmployeePayrollStatementPayload) {
  const payload = normalizePayload(input);
  const entryFirst = payload.snapshot.entries.slice(0, 5);
  const entryRest: EmployeePayrollEntry[][] = [];
  for (let index = 5; index < payload.snapshot.entries.length; index += 10) entryRest.push(payload.snapshot.entries.slice(index, index + 10));
  const histories: EmployeeSalaryHistory[][] = [];
  for (let index = 0; index < payload.snapshot.salary_history.length; index += 8) histories.push(payload.snapshot.salary_history.slice(index, index + 8));
  if (!histories.length) histories.push([]);
  const totalPages = 1 + entryRest.length + histories.length;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4", compress: true });
  let page = 1;
  const add = (canvas: HTMLCanvasElement, firstPage: boolean) => {
    if (!firstPage) doc.addPage("a4", "landscape");
    const image = canvas.toDataURL("image/png");
    doc.addImage(image, "PNG", 0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), undefined, "FAST");
  };
  add(renderPage(payload, page++, totalPages, entryFirst, [], true), true);
  entryRest.forEach((entries) => add(renderPage(payload, page++, totalPages, entries, [], false), false));
  histories.forEach((history) => add(renderPage(payload, page++, totalPages, [], history, false), false));
  doc.setProperties({
    title: `${payload.language === "ar" ? "كشف راتب الموظف" : "Employee payroll statement"} - ${payload.employee.full_name}`,
    subject: `${payload.snapshot.period_from} - ${payload.snapshot.period_to}`,
    author: payload.generatedBy || "DAY NIGHT DELIVERY SERVICES",
    creator: "DAY NIGHT HR & Payroll Center - Safe Export",
  });
  const blob = doc.output("blob");
  if (!(blob instanceof Blob) || blob.size < 500) throw new Error("payroll_pdf_fallback_empty");
  return blob;
}

export type { EmployeePayrollStatementPayload } from "./employeePayrollStatementExport";

export async function createEmployeePayrollPdfBlobSafe(payload: EmployeePayrollStatementPayload) {
  try {
    const primary = await createEmployeePayrollPdfBlob(normalizePayload(payload));
    if (primary instanceof Blob && primary.size >= 500) return primary;
    throw new Error("payroll_pdf_primary_empty");
  } catch (primaryError) {
    console.warn("Primary employee payroll PDF failed; using safe renderer.", primaryError);
    try {
      return await fallbackPdfBlob(payload);
    } catch (fallbackError) {
      console.error("Safe employee payroll PDF renderer failed.", fallbackError);
      const primaryCode = primaryError instanceof Error ? primaryError.message : String(primaryError || "primary_failed");
      const fallbackCode = fallbackError instanceof Error ? fallbackError.message : String(fallbackError || "fallback_failed");
      throw new Error(`payroll_pdf_failed:${primaryCode}:${fallbackCode}`);
    }
  }
}

export async function downloadEmployeePayrollPdfSafe(payload: EmployeePayrollStatementPayload) {
  downloadBlob(await createEmployeePayrollPdfBlobSafe(payload), fileName(payload));
}

export async function shareEmployeePayrollPdfSafe(payload: EmployeePayrollStatementPayload) {
  const blob = await createEmployeePayrollPdfBlobSafe(payload);
  const filename = fileName(payload);
  const file = new File([blob], filename, { type: "application/pdf" });
  const shareData = {
    title: payload.language === "ar" ? `كشف راتب ${payload.employee.full_name}` : `${payload.employee.full_name} payroll statement`,
    text: payload.language === "ar" ? `كشف راتب ${payload.employee.full_name} للفترة ${payload.snapshot.period_from} إلى ${payload.snapshot.period_to}.` : `${payload.employee.full_name} payroll statement for ${payload.snapshot.period_from} to ${payload.snapshot.period_to}.`,
    files: [file],
  };
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    await navigator.share(shareData);
    return "shared" as const;
  }
  downloadBlob(blob, filename);
  const phone = textValue(payload.employee.phone, "").replace(/\D/g, "").replace(/^0/, "971");
  if (phone) {
    const message = payload.language === "ar" ? `السلام عليكم ${payload.employee.full_name}، تم تجهيز كشف راتبك للفترة ${payload.snapshot.period_from} إلى ${payload.snapshot.period_to}. تم تنزيل الملف؛ يرجى إرفاقه في هذه المحادثة.` : `Hello ${payload.employee.full_name}, your payroll statement is ready. The PDF was downloaded; please attach it here.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }
  return "downloaded" as const;
}
