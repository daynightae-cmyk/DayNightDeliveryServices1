import companyMeta from "../data/companyMeta";
import type { ExportLanguage, OrderPDFData } from "./exportUtils";

function escapeHtml(value: unknown) {
  return String(value ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function createDayNightInvoiceNumber(seed?: unknown, date = new Date()) {
  const year = date.getUTCFullYear();
  const fallback = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const clean = String(seed || fallback).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const core = clean.replace(/^DNINV/i, "").replace(/^INV/i, "").replace(/^DN/i, "").slice(-12) || fallback.toUpperCase();
  return `DN-INV-${year}-${core}`;
}

export function orderInvoiceNumber(data: OrderPDFData) {
  return data.invoiceNumber || createDayNightInvoiceNumber(data.trackingCode, data.createdAt ? new Date(data.createdAt) : new Date());
}

function printHtml(title: string, html: string) {
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[\\/:*?\"<>|]/g, "_")}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
  }, 450);
}

function shell(title: string, body: string, language: ExportLanguage) {
  const isArabic = language === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  return `<!DOCTYPE html><html lang="${language}" dir="${dir}"><head><meta charset="UTF-8"/><title>${escapeHtml(title)}</title><style>
  @page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;padding:22px;background:#eef5ff;color:#0a1c3a;direction:${dir};font-family:${isArabic ? "Tahoma,Arial,'Segoe UI',sans-serif" : "Inter,'Segoe UI',Arial,sans-serif"}}.page{max-width:900px;margin:0 auto;background:#fff;border:1px solid #dbe7f6;border-radius:20px;padding:28px;box-shadow:0 12px 42px rgba(7,26,51,.12)}.top{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;border-bottom:4px solid #d4af37;padding-bottom:16px;margin-bottom:18px}.brand h1{margin:0;color:#071a33;font-size:23px}.brand p{margin:5px 0 0;color:#52627a;font-size:12px;line-height:1.6}.badge{background:#071a33;color:#d4af37;border-radius:12px;padding:9px 12px;font-weight:900;display:inline-block}.meta{text-align:${isArabic ? "left" : "right"};font-size:12px;line-height:1.8;color:#22314a;min-width:270px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0}.box{background:#f5f8fc;border:1px solid #e5edf8;border-radius:14px;padding:13px;font-size:12px;line-height:1.8}.box strong{display:block;color:#071a33;margin-bottom:5px;font-size:12px;font-weight:900}.section{margin:18px 0 8px;background:#071a33;color:#d4af37;padding:9px 12px;border-radius:12px;font-size:13px;font-weight:900}table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}th,td{padding:9px;border-bottom:1px solid #e5edf8;vertical-align:top;text-align:${isArabic ? "right" : "left"}}th{background:#071a33;color:#fff;font-weight:900}.total{margin-top:16px;max-width:360px;margin-${isArabic ? "right" : "left"}:auto;border:1px solid #e5edf8;border-radius:14px;padding:12px}.total div{display:flex;justify-content:space-between;gap:18px;padding:6px 0}.grand{border-top:2px solid #d4af37;padding-top:10px!important;color:#071a33;font-size:18px;font-weight:900}.footer{margin-top:22px;font-size:11px;color:#52627a;border-top:1px solid #e5edf8;padding-top:12px;line-height:1.8}.ltr{direction:ltr;unicode-bidi:embed}@media print{body{background:#fff;padding:0}.page{border:none;border-radius:0;box-shadow:none;padding:0}}</style></head><body><div class="page"><div class="top"><div class="brand"><h1>DAY NIGHT DELIVERY SERVICES</h1><p>داي نايت لخدمات التوصيل والشحن</p><p>${escapeHtml(companyMeta.displayWebsite)} • ${escapeHtml(companyMeta.email)} • ${escapeHtml(companyMeta.phone)}</p></div><div class="meta"><span class="badge">${escapeHtml(title)}</span></div></div>${body}</div></body></html>`;
}

export function printOrderDocument(data: OrderPDFData, type: "invoice" | "summary" | "label", language: ExportLanguage) {
  const isArabic = language === "ar";
  const invoice = orderInvoiceNumber(data);
  const title = type === "invoice"
    ? (isArabic ? "فاتورة التوصيل" : "Delivery Invoice")
    : type === "label"
      ? (isArabic ? "ملصق الشحنة" : "Shipping Label")
      : (isArabic ? "ملخص الطلب" : "Order Summary");
  const L = isArabic ? {
    invoice: "رقم الفاتورة", tracking: "رقم التتبع", date: "التاريخ", sender: "بيانات المرسل", receiver: "بيانات المستلم", customer: "بيانات العميل", name: "الاسم", phone: "الهاتف", city: "المدينة", address: "العنوان", route: "خط السير", package: "الشحنة والخدمة", service: "الخدمة", payment: "طريقة الدفع", cod: "مبلغ COD", notes: "ملاحظات", total: "إجمالي رسوم التوصيل", track: "يمكن التتبع برقم الفاتورة أو رقم التتبع أو رقم الهاتف المسجل."
  } : {
    invoice: "Invoice No", tracking: "Tracking No", date: "Date", sender: "Sender Details", receiver: "Receiver Details", customer: "Customer Details", name: "Name", phone: "Phone", city: "City", address: "Address", route: "Route", package: "Package & Service", service: "Service", payment: "Payment", cod: "COD Amount", notes: "Notes", total: "Delivery Fee Total", track: "Customer can track by invoice number, tracking number, or registered phone."
  };
  const trackUrl = `${companyMeta.website}/tracking?code=${encodeURIComponent(invoice)}`;
  const body = `<div class="grid"><div class="box"><strong>${L.invoice}</strong><span class="ltr">${escapeHtml(invoice)}</span></div><div class="box"><strong>${L.tracking}</strong><span class="ltr">${escapeHtml(data.trackingCode)}</span></div><div class="box"><strong>${L.date}</strong>${escapeHtml(data.createdAt || "—")}</div><div class="box"><strong>${L.route}</strong>${escapeHtml(data.senderCity)} → ${escapeHtml(data.receiverCity)}</div></div><div class="grid"><div class="box"><strong>${L.sender}</strong>${L.name}: ${escapeHtml(data.senderName)}<br/>${L.phone}: <span class="ltr">${escapeHtml(data.senderPhone)}</span><br/>${L.city}: ${escapeHtml(data.senderCity)}<br/>${L.address}: ${escapeHtml(data.senderAddress)}</div><div class="box"><strong>${L.receiver}</strong>${L.name}: ${escapeHtml(data.receiverName)}<br/>${L.phone}: <span class="ltr">${escapeHtml(data.receiverPhone)}</span><br/>${L.city}: ${escapeHtml(data.receiverCity)}<br/>${L.address}: ${escapeHtml(data.receiverAddress)}</div></div><div class="box"><strong>${L.customer}</strong>${L.name}: ${escapeHtml(data.customerName || data.senderName)} &nbsp; | &nbsp; ${L.phone}: <span class="ltr">${escapeHtml(data.customerPhone || data.senderPhone || data.receiverPhone)}</span>${data.customerEmail ? ` &nbsp; | &nbsp; ${escapeHtml(data.customerEmail)}` : ""}</div><div class="section">${L.package}</div><table><thead><tr><th>${L.package}</th><th>${L.service}</th><th>${L.payment}</th><th>${L.total}</th></tr></thead><tbody><tr><td>${escapeHtml(data.packageType)}</td><td>${escapeHtml(data.serviceType)}</td><td>${escapeHtml(data.paymentMethod.replace(/_/g, " "))}</td><td class="ltr">${Number(data.deliveryFee || 0).toFixed(2)} AED</td></tr></tbody></table><div class="total"><div><span>${L.cod}</span><span class="ltr">${escapeHtml(data.codAmount || "0")} AED</span></div><div class="grand"><span>${L.total}</span><span class="ltr">${Number(data.deliveryFee || 0).toFixed(2)} AED</span></div></div><div class="footer">${L.notes}: ${escapeHtml(data.notes || "—")}<br/>${L.track}<br/>Track: <span class="ltr">${escapeHtml(trackUrl)}</span></div>`;
  printHtml(`${title}_${invoice}`, shell(title, body, language));
}
