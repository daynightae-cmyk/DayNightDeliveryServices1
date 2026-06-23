import type { Order } from "../types";
import { supabase } from "../supabase";

export function generateInvoiceNumber(date = new Date()) {
  const year = date.getUTCFullYear();
  const serial = String(Math.floor(10000 + Math.random() * 90000));
  return `INV-${year}-${serial}`;
}

export function buildInvoiceData(order: Order) {
  const invoiceNo = generateInvoiceNumber();
  const subtotal = Number(order.delivery_price / 1.05).toFixed(2);
  const vat = Number(order.delivery_price - Number(subtotal)).toFixed(2);

  return {
    invoiceNo,
    createdAt: new Date().toISOString(),
    customer: {
      senderName: order.sender_name,
      senderPhone: order.sender_phone,
      receiverName: order.receiver_name,
      receiverPhone: order.receiver_phone
    },
    shipment: {
      trackingCode: order.id,
      packageType: order.package_type,
      weight: order.weight,
      serviceType: order.service_type,
      fromCity: order.sender_city,
      toCity: order.receiver_city
    },
    financials: {
      subtotal,
      vat,
      total: Number(order.delivery_price).toFixed(2)
    }
  };
}

export function downloadInvoiceHtml(order: Order) {
  const invoice = buildInvoiceData(order);
  const html = `<!doctype html><html><body><h1>${invoice.invoiceNo}</h1><p>Tracking: ${invoice.shipment.trackingCode}</p><p>Total: ${invoice.financials.total} AED</p></body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${invoice.invoiceNo}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function uploadInvoiceHtml(order: Order) {
  if (!supabase) return null;
  const invoice = buildInvoiceData(order);
  const fileName = `${invoice.invoiceNo}.html`;
  const content = `Invoice ${invoice.invoiceNo} | Tracking ${invoice.shipment.trackingCode}`;
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
      to: "Admin@daynightae.com",
      subject: `Invoice ${invoice.invoiceNo}`,
      language: "en",
      template: "invoice",
      data: invoice
    }
  });
  return !error;
}
