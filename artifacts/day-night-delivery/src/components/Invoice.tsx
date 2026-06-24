import type { Order } from "../types";
import { buildInvoiceData, downloadInvoicePdf } from "../lib/invoice";
import companyMeta from "../data/companyMeta";

interface InvoiceProps {
  order: Order;
}

export default function Invoice({ order }: InvoiceProps) {
  const invoice = buildInvoiceData(order);

  return (
    <div className="bg-brand-cool/30 border border-white/10 rounded-2xl p-4 space-y-3 text-xs">
      <h3 className="text-brand-gold font-bold">Invoice {invoice.invoiceNo}</h3>
      <p className="text-white/70">Tracking: {invoice.shipment.trackingCode}</p>
      <p className="text-white/70">Customer: {invoice.customer.senderName} {"->"} {invoice.customer.receiverName}</p>
      <p className="text-white font-bold" dir="ltr">Final price: {invoice.financials.total} AED</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => downloadInvoicePdf(order)} className="px-4 py-2 bg-brand-gold text-brand-deep rounded-xl font-bold">
          Download / Print Invoice
        </button>
        <a href={`mailto:${companyMeta.email}?subject=Invoice ${invoice.invoiceNo}&body=Tracking: ${invoice.shipment.trackingCode}`} className="px-4 py-2 border border-white/10 rounded-xl font-bold text-white/80">
          Send by Email
        </a>
        <a href={`${companyMeta.whatsappUrl}?text=${encodeURIComponent(`Invoice ${invoice.invoiceNo} - Tracking ${invoice.shipment.trackingCode}`)}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-emerald-600 rounded-xl font-bold text-white">
          Share WhatsApp
        </a>
      </div>
    </div>
  );
}
