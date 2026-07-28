import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Link2,
  Loader2,
  MessageCircle,
  PackagePlus,
  Plane,
  X,
} from "lucide-react";
import type { AdminPdfPayload } from "../../lib/adminPdfExport";
import { financialsFromOrder } from "../../lib/orderFinancials";
import {
  internationalTrackingUrl,
  registerAramexShipment,
  type InternationalShipment,
} from "../../lib/internationalTrackingApi";
import {
  buildInternationalTrackingWhatsappMessage,
  buildWhatsAppLink,
} from "../../lib/whatsapp";
import type { Merchant, Order } from "../../types";
import AdminPdfExportButton from "./AdminPdfExportButton";
import "../../styles/dn-international-order-actions.css";

type Props = {
  order: Order;
  merchant?: Merchant | null;
  shipment?: InternationalShipment | null;
  isArabic: boolean;
  onRegistered: (shipment: InternationalShipment) => void | Promise<void>;
};

type FormState = {
  trackingNumber: string;
  originCountry: string;
  originCity: string;
  destinationCountry: string;
  destinationCity: string;
  shipDate: string;
};

function clean(value: unknown) {
  return String(value || "").trim();
}

function trackingNumber(shipment?: InternationalShipment | null) {
  return clean(
    shipment?.carrier_tracking_number_full
      || shipment?.tracking_number
      || shipment?.carrier_tracking_number
      || shipment?.public_tracking_number,
  );
}

function canonicalCountry(value: unknown) {
  const normalized = clean(value).toUpperCase();
  const known: Record<string, string> = {
    UAE: "AE",
    EMIRATES: "AE",
    "UNITED ARAB EMIRATES": "AE",
    KSA: "SA",
    SAUDI: "SA",
    "SAUDI ARABIA": "SA",
    السعودية: "SA",
  };
  return known[normalized] || normalized.slice(0, 3);
}

function orderPdfPayload(order: Order, shipment: InternationalShipment | null | undefined, isArabic: boolean): AdminPdfPayload {
  const financial = financialsFromOrder(order as Order & Record<string, unknown>);
  const awb = trackingNumber(shipment) || (isArabic ? "غير مسجل" : "Not registered");
  return {
    language: isArabic ? "ar" : "en",
    sectionTitle: isArabic ? "تفاصيل الطلب الدولي" : "International order details",
    filters: `${clean(order.tracking_number || order.invoice_number || order.id)} · ${awb}`,
    totals: {
      orders: "1",
      visible: "1",
      income: `${financial.companyRevenue.toFixed(2)} AED`,
    },
    columns: [
      { key: "order", label: isArabic ? "رقم الطلب" : "Order" },
      { key: "awb", label: isArabic ? "بوليصة أرامكس" : "Aramex AWB" },
      { key: "merchant", label: isArabic ? "التاجر" : "Merchant" },
      { key: "customer", label: isArabic ? "العميل" : "Customer" },
      { key: "route", label: isArabic ? "المسار" : "Route" },
      { key: "goods", label: isArabic ? "البضاعة" : "Goods" },
      { key: "delivery", label: isArabic ? "التوصيل" : "Delivery" },
      { key: "total", label: isArabic ? "إجمالي العميل" : "Customer total" },
      { key: "status", label: isArabic ? "الحالة" : "Status" },
    ],
    rows: [{
      order: clean(order.tracking_number || order.invoice_number || order.id),
      awb,
      merchant: clean(order.merchant_name || order.sender_name) || "—",
      customer: clean(order.receiver_name || order.customer_name) || "—",
      route: `${clean(order.sender_city) || "—"} → ${clean(order.receiver_city || order.destination_country) || "—"}`,
      goods: `${financial.goodsValue.toFixed(2)} AED`,
      delivery: `${financial.deliveryFee.toFixed(2)} AED`,
      total: `${financial.customerTotal.toFixed(2)} AED`,
      status: clean(order.status) || "—",
    }],
  };
}

export default function AdminInternationalOrderTrackingActions({
  order,
  merchant,
  shipment,
  isArabic,
  onRegistered,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<FormState>({
    trackingNumber: trackingNumber(shipment),
    originCountry: clean(shipment?.origin_country) || "AE",
    originCity: clean(shipment?.origin_city || order.sender_city),
    destinationCountry: clean(shipment?.destination_country) || canonicalCountry(order.destination_country),
    destinationCity: clean(shipment?.destination_city || order.receiver_city),
    shipDate: "",
  });

  const awb = trackingNumber(shipment);
  const trackingUrl = awb ? internationalTrackingUrl(awb) : "";
  const customerPhone = clean(order.receiver_phone || order.customer_phone);
  const merchantPhone = clean(merchant?.phone || merchant?.alt_phone || ((order.merchant_id || order.merchant_code || order.merchant_name) ? order.sender_phone : ""));

  const customerWhatsApp = useMemo(() => {
    if (!awb || !customerPhone) return "";
    return buildWhatsAppLink(customerPhone, buildInternationalTrackingWhatsappMessage({
      recipientName: clean(order.receiver_name || order.customer_name),
      trackingNumber: awb,
      role: "customer",
    }));
  }, [awb, customerPhone, order.customer_name, order.receiver_name]);

  const merchantWhatsApp = useMemo(() => {
    if (!awb || !merchantPhone) return "";
    return buildWhatsAppLink(merchantPhone, buildInternationalTrackingWhatsappMessage({
      recipientName: clean(merchant?.trade_name || merchant?.owner_name || order.merchant_name),
      trackingNumber: awb,
      role: "merchant",
    }));
  }, [awb, merchant?.owner_name, merchant?.trade_name, merchantPhone, order.merchant_name]);

  const pdfPayload = useMemo(() => orderPdfPayload(order, shipment, isArabic), [isArabic, order, shipment]);

  function toggleEditor() {
    setError("");
    setSuccess("");
    if (awb) {
      setForm((current) => ({
        ...current,
        trackingNumber: awb,
        originCountry: clean(shipment?.origin_country) || current.originCountry || "AE",
        originCity: clean(shipment?.origin_city || order.sender_city) || current.originCity,
        destinationCountry: clean(shipment?.destination_country) || current.destinationCountry || canonicalCountry(order.destination_country),
        destinationCity: clean(shipment?.destination_city || order.receiver_city) || current.destinationCity,
      }));
    }
    setOpen((value) => !value);
  }

  async function saveTracking() {
    const number = clean(form.trackingNumber).toUpperCase();
    if (!number) {
      setError(isArabic ? "اكتب رقم بوليصة أرامكس أولًا." : "Enter the Aramex AWB first.");
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await registerAramexShipment({
        order_id: clean(order.id),
        tracking_number: number,
        origin_country: clean(form.originCountry) || "AE",
        origin_city: clean(form.originCity),
        destination_country: clean(form.destinationCountry),
        destination_city: clean(form.destinationCity),
        ship_date: clean(form.shipDate),
      });
      if (!result.ok || !result.shipment) throw new Error("tracking_registration_failed");
      await onRegistered(result.shipment);
      setSuccess(isArabic
        ? "تم ربط رقم التتبع بالطلب. رابط المتابعة ورسائل واتساب جاهزة الآن."
        : "The AWB is linked. Tracking link and WhatsApp messages are ready.");
      setOpen(false);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "tracking_registration_failed";
      setError(isArabic ? `تعذر حفظ رقم التتبع: ${message}` : `Unable to save tracking number: ${message}`);
    } finally {
      setBusy(false);
    }
  }

  async function copyTrackingLink() {
    if (!trackingUrl) return;
    await navigator.clipboard.writeText(trackingUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="dn-intl-native-actions">
      <div className="dn-intl-native-actions__buttons">
        <button type="button" className="is-track" onClick={toggleEditor}>
          {open ? <X /> : <PackagePlus />}
          {awb
            ? (isArabic ? "تعديل رقم التتبع" : "Edit tracking number")
            : (isArabic ? "إضافة رقم التتبع" : "Add tracking number")}
        </button>

        {trackingUrl && (
          <>
            <a href={trackingUrl} target="_blank" rel="noreferrer" className="is-link">
              <Link2 />{isArabic ? "فتح التتبع" : "Open tracking"}
            </a>
            <button type="button" onClick={() => void copyTrackingLink()} className="is-copy">
              {copied ? <Check /> : <Copy />}{copied ? (isArabic ? "تم النسخ" : "Copied") : (isArabic ? "نسخ الرابط" : "Copy link")}
            </button>
          </>
        )}

        {customerWhatsApp && (
          <a href={customerWhatsApp} target="_blank" rel="noreferrer" className="is-whatsapp">
            <MessageCircle />{isArabic ? "إرسال للعميل" : "Send to customer"}
          </a>
        )}

        {merchantWhatsApp && (
          <a href={merchantWhatsApp} target="_blank" rel="noreferrer" className="is-whatsapp is-merchant">
            <MessageCircle />{isArabic ? "إرسال للتاجر" : "Send to merchant"}
          </a>
        )}

        <AdminPdfExportButton payload={pdfPayload} label={isArabic ? "PDF الطلب" : "Order PDF"} />
      </div>

      {awb && (
        <div className="dn-intl-native-actions__linked">
          <Plane />
          <span>{isArabic ? "رقم التتبع الدولي" : "International tracking"}</span>
          <strong dir="ltr">{awb}</strong>
          <a href={trackingUrl} target="_blank" rel="noreferrer" dir="ltr">{trackingUrl}</a>
        </div>
      )}

      {open && (
        <div className="dn-intl-native-editor">
          <header>
            <Plane />
            <div>
              <strong>{isArabic ? "ربط بوليصة أرامكس بالطلب" : "Link Aramex AWB to order"}</strong>
              <small>{clean(order.tracking_number || order.invoice_number || order.id)}</small>
            </div>
          </header>
          <div className="dn-intl-native-editor__grid">
            <label className="is-wide">
              <span>{isArabic ? "رقم بوليصة أرامكس" : "Aramex AWB"}</span>
              <input dir="ltr" value={form.trackingNumber} onChange={(event) => setForm({ ...form, trackingNumber: event.target.value.toUpperCase() })} placeholder="37313304803" />
            </label>
            <label>
              <span>{isArabic ? "دولة المنشأ" : "Origin country"}</span>
              <input dir="ltr" maxLength={3} value={form.originCountry} onChange={(event) => setForm({ ...form, originCountry: event.target.value.toUpperCase() })} />
            </label>
            <label>
              <span>{isArabic ? "مدينة المنشأ" : "Origin city"}</span>
              <input value={form.originCity} onChange={(event) => setForm({ ...form, originCity: event.target.value })} placeholder="Ajman" />
            </label>
            <label>
              <span>{isArabic ? "دولة الوجهة" : "Destination country"}</span>
              <input dir="ltr" maxLength={3} value={form.destinationCountry} onChange={(event) => setForm({ ...form, destinationCountry: event.target.value.toUpperCase() })} placeholder="SA" />
            </label>
            <label>
              <span>{isArabic ? "مدينة الوجهة" : "Destination city"}</span>
              <input value={form.destinationCity} onChange={(event) => setForm({ ...form, destinationCity: event.target.value })} placeholder="Riyadh" />
            </label>
            <label className="is-wide">
              <span>{isArabic ? "تاريخ الشحن" : "Ship date"}</span>
              <input type="date" value={form.shipDate} onChange={(event) => setForm({ ...form, shipDate: event.target.value })} />
            </label>
          </div>
          <button type="button" className="dn-intl-native-editor__save" onClick={() => void saveTracking()} disabled={busy || !clean(form.trackingNumber)}>
            {busy ? <Loader2 className="animate-spin" /> : <PackagePlus />}
            {busy ? (isArabic ? "جاري الربط…" : "Linking…") : (isArabic ? "حفظ وربط رقم التتبع" : "Save and link tracking")}
          </button>
        </div>
      )}

      {success && <p className="dn-intl-native-actions__notice is-success">{success}</p>}
      {error && <p className="dn-intl-native-actions__notice is-error">{error}</p>}
    </div>
  );
}
