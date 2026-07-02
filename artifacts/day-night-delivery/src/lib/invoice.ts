import type { Order } from "../types";
import companyMeta from "../data/companyMeta";
import { supabase } from "../supabase";

function safeText(value?: unknown) {
  const text = String(value ?? "").trim();
  return text || "—";
}

export function generateInvoiceNumber(date = new Date(), seed?: string) {
  const year = date.getUTCFullYear();
  const rawSeed = String(seed || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
  const clean = rawSeed.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const tail = clean.replace(/^DNINV/i, "").replace(/^INV/i, "").replace(/^DN/i, "").slice(-12) || clean.slice(-8) || "00000";
  return `DN-INV-${year}-${tail}`;
}

export function invoiceNumberForOrder(order: Order) {
  const existing = safeText(order.invoice_number || order.invoiceNumber);
  if (existing !== "—") return existing;
  const ref = order.tracking_code || order.tracking_number || order.id;
  return generateInvoiceNumber(order.created_at ? new Date(order.created_at) : new Date(), ref);
}

function trackingReference(order: Order) {
  return order.tracking_code || order.tracking_number || order.id;
}

export function buildInvoiceData(order: Order, lang: "en" | "ar" = "en") {
  const total = Number(order.delivery_price || order.price || 0);
  const invoiceNo = invoiceNumberForOrder(order);

  return {
    invoiceNo,
    lang,
    createdAt: order.created_at || new Date().toISOString(),
    company: {
      name: companyMeta.name,
      nameAr: companyMeta.legalNameAr,
      website: companyMeta.displayWebsite,
      email: companyMeta.email,
      phone: companyMeta.phone,
      address: lang === "ar" ? companyMeta.addressAr : companyMeta.addressEn
    },
    customer: {
      senderName: safeText(order.sender_name),
      senderPhone: safeText(order.sender_phone),
      senderCity: safeText(order.sender_city),
      senderAddress: safeText(order.sender_address),
      receiverName: safeText(order.receiver_name),
      receiverPhone: safeText(order.receiver_phone),
      receiverCity: safeText(order.receiver_city),
      receiverAddress: safeText(order.receiver_address),
      customerName: safeText(order.customer_name || order.sender_name),
      customerPhone: safeText(order.customer_phone || order.sender_phone || order.receiver_phone),
      customerEmail: safeText(order.customer_email || order.sender_email || order.receiver_email)
    },
    shipment: {
      trackingCode: trackingReference(order),
      packageType: safeText(order.package_type),
      description: safeText(order.package_description || order.package_type || order.notes),
      weight: order.weight ?? "—",
      pieces: order.pieces ?? 1,
      serviceType: safeText(order.service_type || "Standard"),
      fromCity: safeText(order.sender_city),
      toCity: safeText(order.receiver_city),
      route: `${safeText(order.sender_city)} → ${safeText(order.receiver_city)}`,
      status: safeText(order.status),
      paymentMethod: safeText(order.payment_method),
      codAmount: order.cod_amount ?? null,
      notes: safeText(order.notes)
    },
    financials: {
      total: total.toFixed(2),
      cod: Number(order.cod_amount || 0).toFixed(2),
      currency: "AED"
    }
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function invoiceHtml(invoice: ReturnType<typeof buildInvoiceData>) {
  const rtl = invoice.lang === "ar";
  const dir = rtl ? "rtl" : "ltr";
  const locale = rtl ? "ar-AE" : "en-AE";
  const labels = rtl
    ? {
        invoice: "فاتورة توصيل رسمية",
        invoiceNo: "رقم الفاتورة",
        tracking: "رقم التتبع",
        date: "تاريخ الطلب",
        sender: "بيانات المرسل",
        receiver: "بيانات المستلم",
        customer: "بيانات العميل",
        name: "الاسم",
        phone: "رقم الهاتف",
        email: "البريد الإلكتروني",
        city: "المدينة",
        address: "العنوان التفصيلي",
        route: "خط السير",
        package: "محتوى الشحنة",
        weightPieces: "الوزن / القطع",
        service: "نوع الخدمة",
        finalPrice: "رسوم التوصيل",
        total: "الإجمالي",
        payment: "طريقة الدفع",
        status: "الحالة",
        cod: "مبلغ COD",
        notes: "ملاحظات",
        terms: "يمكن للعميل تتبع الشحنة برقم الفاتورة أو رقم التتبع أو رقم الهاتف المسجل في الطلب. هذه الفاتورة صادرة من نظام DAY NIGHT DELIVERY SERVICES.",
        printHint: "احفظ من نافذة الطباعة بصيغة PDF عند الحاجة."
      }
    : {
        invoice: "Official Delivery Invoice",
        invoiceNo: "Invoice No",
        tracking: "Tracking No",
        date: "Order Date",
        sender: "Sender Details",
        receiver: "Receiver Details",
        customer: "Customer Details",
        name: "Name",
        phone: "Phone",
        email: "Email",
        city: "City",
        address: "Full Address",
        route: "Route",
        package: "Shipment Content",
        weightPieces: "Weight / Pieces",
        service: "Service",
        finalPrice: "Delivery Fee",
        total: "Total",
        payment: "Payment",
        status: "Status",
        cod: "COD Amount",
        notes: "Notes",
        terms: "The customer can track this shipment by invoice number, tracking number, or the registered phone number. This invoice is issued by DAY NIGHT DELIVERY SERVICES.",
        printHint: "Use the print dialog to save as PDF when needed."
      };

  const trackingLink = `${companyMeta.website}/tracking?code=${encodeURIComponent(String(invoice.invoiceNo))}`;

  return `<!DOCTYPE html>
<html lang="${invoice.lang}" dir="${dir}">
<head>
<meta charset="UTF-8"/>
<title>${escapeHtml(invoice.invoiceNo)} — DAY NIGHT</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: ${rtl ? "Tahoma, Arial, 'Segoe UI', sans-serif" : "Inter, 'Segoe UI', Arial, sans-serif"}; color: #0A1C3A; margin: 0; padding: 22px; background: #EEF5FF; direction: ${dir}; }
  .card { background: #fff; border: 1px solid #dbe7f6; border-radius: 20px; padding: 28px; max-width: 860px; margin: 0 auto; box-shadow: 0 12px 42px rgba(7,26,51,0.12); }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid #D4AF37; padding-bottom: 18px; margin-bottom: 18px; gap: 20px; }
  .brand h1 { margin: 0; color: #071A33; font-size: 23px; letter-spacing: 0.02em; }
  .brand p { margin: 5px 0 0; color: #52627A; font-size: 12px; line-height: 1.55; }
  .meta { min-width: 260px; text-align: ${rtl ? "left" : "right"}; font-size: 12px; color: #22314A; }
  .meta .main { display: inline-block; background: #071A33; color: #D4AF37; padding: 8px 12px; border-radius: 12px; font-weight: 900; margin-bottom: 8px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 14px 0; }
  .box { background: #F5F8FC; border: 1px solid #E5EDF8; border-radius: 14px; padding: 13px; font-size: 12px; line-height: 1.8; }
  .box strong { display: block; color: #071A33; margin-bottom: 5px; font-size: 12px; font-weight: 900; }
  .section-title { margin: 18px 0 8px; background: #071A33; color: #D4AF37; padding: 9px 12px; border-radius: 12px; font-size: 13px; font-weight: 900; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
  th, td { padding: 10px 9px; border-bottom: 1px solid #E5EDF8; text-align: ${rtl ? "right" : "left"}; vertical-align: top; }
  th { background: #071A33; color: #fff; font-weight: 800; }
  .totals { margin-top: 16px; max-width: 340px; margin-${rtl ? "right" : "left"}: auto; font-size: 13px; border: 1px solid #E5EDF8; border-radius: 14px; padding: 10px 14px; }
  .totals div { display: flex; justify-content: space-between; gap: 16px; padding: 7px 0; }
  .total-row { font-weight: 900; color: #071A33; border-top: 2px solid #D4AF37; padding-top: 10px !important; font-size: 17px; }
  .footer { margin-top: 22px; font-size: 11px; color: #52627A; border-top: 1px solid #E5EDF8; padding-top: 12px; line-height: 1.8; }
  .gold { color: #D4AF37; font-weight: 900; }
  .ltr { direction: ltr; unicode-bidi: embed; }
  @media print { body { background: #fff; padding: 0; } .card { box-shadow: none; border-radius: 0; border: none; } }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="brand">
      <h1>DAY NIGHT DELIVERY SERVICES</h1>
      <p>${escapeHtml(invoice.company.nameAr)}</p>
      <p>${escapeHtml(invoice.company.website)} • ${escapeHtml(invoice.company.email)} • ${escapeHtml(invoice.company.phone)}</p>
      <p>${escapeHtml(invoice.company.address)}</p>
    </div>
    <div class="meta">
      <div class="main">${labels.invoice}</div>
      <div><strong>${labels.invoiceNo}</strong>: <span class="ltr">${escapeHtml(invoice.invoiceNo)}</span></div>
      <div><strong>${labels.tracking}</strong>: <span class="ltr">${escapeHtml(invoice.shipment.trackingCode)}</span></div>
      <div><strong>${labels.date}</strong>: ${escapeHtml(new Date(invoice.createdAt).toLocaleString(locale))}</div>
    </div>
  </div>

  <div class="grid">
    <div class="box"><strong>${labels.sender}</strong>${labels.name}: ${escapeHtml(invoice.customer.senderName)}<br/>${labels.phone}: <span class="ltr">${escapeHtml(invoice.customer.senderPhone)}</span><br/>${labels.city}: ${escapeHtml(invoice.customer.senderCity)}<br/>${labels.address}: ${escapeHtml(invoice.customer.senderAddress)}</div>
    <div class="box"><strong>${labels.receiver}</strong>${labels.name}: ${escapeHtml(invoice.customer.receiverName)}<br/>${labels.phone}: <span class="ltr">${escapeHtml(invoice.customer.receiverPhone)}</span><br/>${labels.city}: ${escapeHtml(invoice.customer.receiverCity)}<br/>${labels.address}: ${escapeHtml(invoice.customer.receiverAddress)}</div>
    <div class="box"><strong>${labels.customer}</strong>${labels.name}: ${escapeHtml(invoice.customer.customerName)}<br/>${labels.phone}: <span class="ltr">${escapeHtml(invoice.customer.customerPhone)}</span><br/>${labels.email}: <span class="ltr">${escapeHtml(invoice.customer.customerEmail)}</span></div>
    <div class="box"><strong>${labels.route}</strong>${escapeHtml(invoice.shipment.route)}<br/>${labels.status}: ${escapeHtml(invoice.shipment.status)}<br/>${labels.payment}: ${escapeHtml(invoice.shipment.paymentMethod)}</div>
  </div>

  <div class="section-title">${labels.package}</div>
  <table>
    <thead><tr><th>${labels.package}</th><th>${labels.service}</th><th>${labels.weightPieces}</th><th>${labels.finalPrice}</th></tr></thead>
    <tbody>
      <tr>
        <td>${escapeHtml(invoice.shipment.description)}</td>
        <td>${escapeHtml(invoice.shipment.serviceType)}</td>
        <td class="ltr">${escapeHtml(invoice.shipment.weight)} kg / ${escapeHtml(invoice.shipment.pieces)} pcs</td>
        <td class="ltr">${escapeHtml(invoice.financials.total)} ${escapeHtml(invoice.financials.currency)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div><span>${labels.payment}</span><span>${escapeHtml(invoice.shipment.paymentMethod)}</span></div>
    <div><span>${labels.cod}</span><span class="ltr">${escapeHtml(invoice.financials.cod)} ${escapeHtml(invoice.financials.currency)}</span></div>
    <div class="total-row"><span>${labels.total}</span><span class="ltr">${escapeHtml(invoice.financials.total)} ${escapeHtml(invoice.financials.currency)}</span></div>
  </div>

  <div class="footer">
    ${escapeHtml(labels.terms)}<br/>
    ${labels.notes}: ${escapeHtml(invoice.shipment.notes)}<br/>
    ${escapeHtml(labels.printHint)}<br/>
    Track: <span class="ltr">${escapeHtml(trackingLink)}</span>
  </div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},350);}</script>
</body></html>`;
}

export function downloadInvoicePdf(order: Order, lang: "en" | "ar" = "en") {
  const invoice = buildInvoiceData(order, lang);
  const html = invoiceHtml(invoice);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoice.invoiceNo}.html`;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** @deprecated use downloadInvoicePdf */
export function downloadInvoiceHtml(order: Order) {
  downloadInvoicePdf(order, "en");
}

export async function uploadInvoiceHtml(order: Order) {
  if (!supabase) return null;
  const invoice = buildInvoiceData(order);
  const fileName = `${invoice.invoiceNo}.html`;
  const content = invoiceHtml(invoice);
  const file = new Blob([content], { type: "text/html" });
  const { error } = await supabase.storage.from("invoices").upload(fileName, file, { upsert: true });
  if (error) return null;
  return fileName;
}

export async function sendInvoiceEmail(order: Order) {
  if (!supabase) return false;
  const invoice = buildInvoiceData(order);
  const { error } = await supabase.functions.invoke("send-email", {
    body: {
      to: companyMeta.email,
      subject: `Invoice ${invoice.invoiceNo}`,
      language: "en",
      template: "invoice",
      data: invoice
    }
  });
  return !error;
}
