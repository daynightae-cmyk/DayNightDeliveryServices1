import type { Order } from "../types";
import { buildInvoiceData, downloadInvoiceHtml } from "../lib/invoice";

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
      <p className="text-white/70" dir="ltr">Delivery price: {invoice.financials.subtotal} AED</p>
      <p className="text-white font-bold" dir="ltr">Total: {invoice.financials.total} AED</p>
      <button onClick={() => downloadInvoiceHtml(order)} className="px-4 py-2 bg-brand-gold text-brand-deep rounded-xl font-bold">
        Download Invoice
      </button>
    </div>
  );
}
