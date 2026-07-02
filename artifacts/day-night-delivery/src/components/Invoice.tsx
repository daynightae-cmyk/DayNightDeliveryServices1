import type { Order } from "../types";
import { buildInvoiceData, downloadInvoicePdf } from "../lib/invoice";
import companyMeta from "../data/companyMeta";
import { useAppContext } from "../lib/AppContext";

interface InvoiceProps {
  order: Order;
}

export default function Invoice({ order }: InvoiceProps) {
  const { language } = useAppContext();
  const lang = language === "ar" ? "ar" : "en";
  const invoice = buildInvoiceData(order, lang);
  const isArabic = lang === "ar";

  return (
    <div className="bg-brand-cool/30 border border-white/10 rounded-2xl p-4 space-y-3 text-xs" dir={isArabic ? "rtl" : "ltr"}>
      <h3 className="text-brand-gold font-bold">{isArabic ? "فاتورة" : "Invoice"} <span dir="ltr">{invoice.invoiceNo}</span></h3>
      <p className="text-white/70">{isArabic ? "رقم التتبع" : "Tracking"}: <span dir="ltr">{invoice.shipment.trackingCode}</span></p>
      <p className="text-white/70">{isArabic ? "العميل" : "Customer"}: {invoice.customer.senderName} {"->"} {invoice.customer.receiverName}</p>
      <p className="text-white/70">{isArabic ? "الهاتف" : "Phone"}: <span dir="ltr">{invoice.customer.senderPhone}</span></p>
      <p className="text-white font-bold" dir="ltr">Final price: {invoice.financials.total} AED</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => downloadInvoicePdf(order, lang)} className="px-4 py-2 bg-brand-gold text-brand-deep rounded-xl font-bold">
          {isArabic ? "تحميل / طباعة الفاتورة" : "Download / Print Invoice"}
        </button>
        <a href={`mailto:${companyMeta.email}?subject=Invoice ${invoice.invoiceNo}&body=Tracking: ${invoice.shipment.trackingCode}`} className="px-4 py-2 border border-white/10 rounded-xl font-bold text-white/80">
          {isArabic ? "إرسال بالبريد" : "Send by Email"}
        </a>
        <a href={`${companyMeta.whatsappUrl}?text=${encodeURIComponent(`Invoice ${invoice.invoiceNo} - Tracking ${invoice.shipment.trackingCode}`)}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-emerald-600 rounded-xl font-bold text-white">
          {isArabic ? "مشاركة واتساب" : "Share WhatsApp"}
        </a>
      </div>
    </div>
  );
}
