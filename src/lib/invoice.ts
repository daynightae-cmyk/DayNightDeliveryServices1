import type { Order } from "../types";
import companyMeta from "../data/companyMeta";
import { supabase } from "../supabase";

function maskPhone(phone?: string | null) {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  return `${phone.slice(0, 4)}****${digits.slice(-2)}`;
}

export function generateInvoiceNumber(date = new Date()) {
  const year = date.getUTCFullYear();
  const serial = String(Math.floor(10000 + Math.random() * 90000));
  return `INV-${year}-${serial}`;
}

export function buildInvoiceData(order: Order, lang: "en" | "ar" = "en") {
  const subtotal = Number(order.delivery_price || order.price || 0);
  const total = Math.round(subtotal * 100) / 100;
  const invoiceNo = generateInvoiceNumber();

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
      senderName: order.sender_name || "—",
      senderPhone: maskPhone(order.sender_phone),
      receiverName: order.receiver_name || "—",
      receiverPhone: maskPhone(order.receiver_phone)
    },
    shipment: {
      trackingCode: order.tracking_number || order.id,
      packageType: order.package_type || "—",
      description: order.package_description || order.notes || "—",
      weight: order.weight ?? "—",
      pieces: order.pieces ?? 1,
      serviceType: order.service_type || "Standard",
      fromCity: order.sender_city || "—",
      toCity: order.receiver_city || "—",
      status: order.status || "—",
      paymentMethod: order.payment_method || "—",
      codAmount: order.cod_amount ?? null
    },
    financials: {
      subtotal: subtotal.toFixed(2),
      total: total.toFixed(2),
      currency: "AED"
    }
  };
}

function invoiceHtml(invoice: ReturnType<typeof buildInvoiceData>) {
  const rtl = invoice.lang === "ar";
  const dir = rtl ? "rtl" : "ltr";
  const labels = rtl
    ? {
        invoice: "فاتورة",
        tracking: "رقم التتبع",
        date: "تاريخ الطلب",
        sender: "المرسل",
        receiver: "المستلم",
        from: "مدينة الاستلام",
        to: "مدينة التسليم",
        package: "نوع الشحنة",
        weight: "الوزن",
        service: "نوع الخدمة",
        subtotal: "سعر الخدمة",
        total: "الإجمالي النهائي",
        payment: "طريقة الدفع",
        status: "الحالة",
        terms: "الشروط: الأسعار المعروضة للعميل نهائية. للاستفسارات تواصل معنا."
      }
    : {
        invoice: "Invoice",
        tracking: "Tracking No",
        date: "Order Date",
        sender: "Sender",
        receiver: "Receiver",
        from: "Pickup City",
        to: "Delivery City",
        package: "Package Type",
        weight: "Weight",
        service: "Service",
        subtotal: "Service Price",
        total: "Final Total",
        payment: "Payment",
        status: "Status",
        terms: "Terms: Customer-facing prices are shown as final prices. Contact us for support."
      };

  return `<!DOCTYPE html>
<html lang="${invoice.lang}" dir="${dir}">
<head>
<meta charset="UTF-8"/>
<title>${invoice.invoiceNo} — ${companyMeta.name}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: ${rtl ? "'Cairo', 'Segoe UI', Tahoma" : "'Inter', 'Segoe UI', sans-serif"}; color: #111827; margin: 0; padding: 24px; background: #F5F8FC; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 28px; max-width: 800px; margin: 0 auto; box-shadow: 0 8px 30px rgba(7,26,51,0.08); }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #D4AF37; padding-bottom: 16px; margin-bottom: 20px; gap: 16px; }
  .brand { color: #071A33; }
  .brand h1 { margin: 0; font-size: 20px; letter-spacing: 0.02em; }
  .brand p { margin: 4px 0 0; color: #6B7280; font-size: 12px; }
  .meta { text-align: ${rtl ? "left" : "right"}; font-size: 12px; color: #374151; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
  .box { background: #F5F8FC; border-radius: 10px; padding: 12px; font-size: 12px; }
  .box strong { display: block; color: #071A33; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th, td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: ${rtl ? "right" : "left"}; }
  th { background: #071A33; color: #fff; font-weight: 600; }
  .totals { margin-top: 12px; max-width: 280px; margin-${rtl ? "right" : "left"}: auto; font-size: 13px; }
  .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
  .total-row { font-weight: 800; color: #071A33; border-top: 2px solid #D4AF37; padding-top: 8px !important; font-size: 16px; }
  .footer { margin-top: 24px; font-size: 11px; color: #6B7280; border-top: 1px solid #e5e7eb; padding-top: 12px; }
  .gold { color: #D4AF37; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="brand">
      <h1>${invoice.company.name}</h1>
      <p>${invoice.company.nameAr}</p>
      <p>${invoice.company.website} • ${invoice.company.email}</p>
      <p>${invoice.company.phone}</p>
      <p>${invoice.company.address}</p>
    </div>
    <div class="meta">
      <div><strong class="gold">${labels.invoice}</strong></div>
      <div>${invoice.invoiceNo}</div>
      <div style="margin-top:8px"><strong>${labels.tracking}</strong>: ${invoice.shipment.trackingCode}</div>
      <div><strong>${labels.date}</strong>: ${new Date(invoice.createdAt).toLocaleString(invoice.lang === "ar" ? "ar-AE" : "en-AE")}</div>
    </div>
  </div>

  <div class="grid">
    <div class="box"><strong>${labels.sender}</strong>${invoice.customer.senderName}<br/>${invoice.customer.senderPhone}</div>
    <div class="box"><strong>${labels.receiver}</strong>${invoice.customer.receiverName}<br/>${invoice.customer.receiverPhone}</div>
    <div class="box"><strong>${labels.from}</strong>${invoice.shipment.fromCity}</div>
    <div class="box"><strong>${labels.to}</strong>${invoice.shipment.toCity}</div>
    <div class="box"><strong>${labels.package}</strong>${invoice.shipment.packageType}</div>
    <div class="box"><strong>${labels.weight}</strong>${invoice.shipment.weight} kg • ${invoice.shipment.pieces} pcs</div>
    <div class="box"><strong>${labels.service}</strong>${invoice.shipment.serviceType}</div>
    <div class="box"><strong>${labels.status}</strong>${invoice.shipment.status}</div>
  </div>

  <table>
    <thead><tr><th>${labels.package}</th><th>${labels.service}</th><th>${labels.subtotal}</th></tr></thead>
    <tbody>
      <tr>
        <td>${invoice.shipment.description}</td>
        <td>${invoice.shipment.serviceType}</td>
        <td>${invoice.financials.subtotal} ${invoice.financials.currency}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div><span>${labels.subtotal}</span><span>${invoice.financials.subtotal} ${invoice.financials.currency}</span></div>
    <div class="total-row"><span>${labels.total}</span><span>${invoice.financials.total} ${invoice.financials.currency}</span></div>
    <div><span>${labels.payment}</span><span>${invoice.shipment.paymentMethod}${invoice.shipment.codAmount ? ` (COD: ${invoice.shipment.codAmount})` : ""}</span></div>
  </div>

  <div class="footer">${labels.terms}<br/>Track: ${companyMeta.website}/tracking?code=${encodeURIComponent(String(invoice.shipment.trackingCode))}</div>
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
}

export function downloadInvoicePdf(order: Order, lang: "en" | "ar" = "en") {
  const invoice = buildInvoiceData(order, lang);
  const html = invoiceHtml(invoice);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
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
