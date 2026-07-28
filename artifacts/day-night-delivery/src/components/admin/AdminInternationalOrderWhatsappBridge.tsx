import { useEffect } from "react";
import { fetchAdminOrders, fetchMerchants } from "../../lib/adminData";
import {
  runTrack17Admin,
  type InternationalShipment,
} from "../../lib/internationalTrackingApi";
import {
  buildInternationalTrackingWhatsappMessage,
  buildWhatsAppLink,
} from "../../lib/whatsapp";
import type { Merchant, Order } from "../../types";

const ADMIN_ROUTE = /^\/admin(?:\/|$)/i;
const ACTIONS_CLASS = "dn-intl-whatsapp-actions";
const INTERNATIONAL_SHIPMENT_UPDATED_EVENT = "dn-international-shipment-updated";

type TrackingCenterData = {
  ok: boolean;
  shipments?: InternationalShipment[];
};

function clean(value: unknown) {
  return String(value || "").trim();
}

function normalized(value: unknown) {
  return clean(value).toLocaleLowerCase().replace(/\s+/g, " ");
}

function orderReferences(order: Order) {
  return [
    order.id,
    order.tracking_code,
    order.tracking_number,
    order.invoice_number,
    order.invoiceNumber,
    order.coupon_number,
  ].map(clean).filter(Boolean);
}

function currentSectionIsInternational() {
  const title = normalized(document.querySelector(".dn-admin-current-section strong")?.textContent);
  const activeButton = normalized(document.querySelector(".dn-admin-side-nav button.is-active")?.textContent);
  const commandTitle = normalized(document.querySelector(".dn-admin-command-heading h1, .dn-admin-command-heading strong")?.textContent);
  const combined = `${title} ${activeButton} ${commandTitle}`;
  return combined.includes("الطلبات الدولية") || combined.includes("international orders");
}

function merchantForOrder(order: Order, merchants: Merchant[]) {
  const byId = clean(order.merchant_id);
  if (byId) {
    const found = merchants.find((merchant) => clean(merchant.id) === byId);
    if (found) return found;
  }

  const byCode = normalized(order.merchant_code);
  if (byCode) {
    const found = merchants.find((merchant) => normalized(merchant.merchant_code) === byCode);
    if (found) return found;
  }

  const byName = normalized(order.merchant_name);
  if (byName) {
    return merchants.find((merchant) =>
      normalized(merchant.trade_name) === byName || normalized(merchant.owner_name) === byName,
    ) || null;
  }

  return null;
}

function trackingNumberForShipment(shipment: InternationalShipment | undefined) {
  return clean(
    shipment?.carrier_tracking_number_full
      || shipment?.tracking_number
      || shipment?.carrier_tracking_number
      || shipment?.public_tracking_number,
  );
}

function makeActionLink(options: {
  href: string;
  label: string;
  title: string;
  kind: "customer" | "merchant";
}) {
  const anchor = document.createElement("a");
  anchor.href = options.href;
  anchor.target = "_blank";
  anchor.rel = "noreferrer noopener";
  anchor.className = `dn-wa-btn dn-wa-btn-${options.kind}`;
  anchor.setAttribute("aria-label", options.title);
  anchor.title = options.title;
  anchor.innerHTML = `<span aria-hidden="true">◉</span><b>${options.label}</b>`;
  return anchor;
}

function installRowActions(
  orders: Order[],
  merchants: Merchant[],
  shipments: InternationalShipment[],
) {
  if (!currentSectionIsInternational()) return;

  const orderByReference = new Map<string, Order>();
  orders.forEach((order) => orderReferences(order).forEach((reference) => orderByReference.set(normalized(reference), order)));

  const shipmentByOrder = new Map<string, InternationalShipment>();
  shipments.forEach((shipment) => {
    const orderId = clean(shipment.order_id);
    if (orderId && trackingNumberForShipment(shipment)) shipmentByOrder.set(orderId, shipment);
  });

  document.querySelectorAll<HTMLTableRowElement>(".dn-section-table-card tbody tr").forEach((row) => {
    const reference = normalized(row.querySelector(".dn-order-track-ref")?.textContent);
    const order = orderByReference.get(reference);
    const actionsCell = row.querySelectorAll<HTMLTableCellElement>("td").item(5);
    if (!actionsCell) return;

    const existing = actionsCell.querySelector<HTMLElement>(`.${ACTIONS_CLASS}`);
    if (!order) {
      existing?.remove();
      return;
    }

    const shipment = shipmentByOrder.get(clean(order.id));
    const trackingNumber = trackingNumberForShipment(shipment);
    if (!trackingNumber) {
      existing?.remove();
      return;
    }

    const merchant = merchantForOrder(order, merchants);
    const customerPhone = clean(order.receiver_phone || order.customer_phone);
    const merchantPhone = clean(merchant?.phone || merchant?.alt_phone || ((order.merchant_id || order.merchant_code || order.merchant_name) ? order.sender_phone : ""));
    const signature = `${trackingNumber}|${customerPhone}|${merchantPhone}`;
    if (existing?.dataset.signature === signature) return;

    const container = existing || document.createElement("div");
    container.className = ACTIONS_CLASS;
    container.dataset.signature = signature;
    container.replaceChildren();

    if (customerPhone) {
      const message = buildInternationalTrackingWhatsappMessage({
        recipientName: order.receiver_name || order.customer_name,
        trackingNumber,
        role: "customer",
      });
      const href = buildWhatsAppLink(customerPhone, message);
      if (href) container.appendChild(makeActionLink({
        href,
        label: "إرسال للعميل",
        title: `إرسال رابط تتبع ${trackingNumber} للعميل عبر واتساب`,
        kind: "customer",
      }));
    }

    if (merchantPhone) {
      const message = buildInternationalTrackingWhatsappMessage({
        recipientName: merchant?.trade_name || merchant?.owner_name || order.merchant_name,
        trackingNumber,
        role: "merchant",
      });
      const href = buildWhatsAppLink(merchantPhone, message);
      if (href) container.appendChild(makeActionLink({
        href,
        label: "إرسال للتاجر",
        title: `إرسال رابط تتبع ${trackingNumber} للتاجر عبر واتساب`,
        kind: "merchant",
      }));
    }

    if (!container.childElementCount) {
      container.remove();
      return;
    }

    if (!existing) actionsCell.appendChild(container);
  });
}

export default function AdminInternationalOrderWhatsappBridge() {
  useEffect(() => {
    if (!ADMIN_ROUTE.test(window.location.pathname)) return;

    let disposed = false;
    let queuedFrame = 0;
    let requestRunning = false;
    let rerunAfterRequest = false;
    let orders: Order[] = [];
    let merchants: Merchant[] = [];
    let shipments: InternationalShipment[] = [];

    const apply = () => {
      if (disposed || !orders.length) return;
      installRowActions(orders, merchants, shipments);
    };

    const refreshData = async () => {
      if (disposed || !currentSectionIsInternational()) return;
      if (requestRunning) {
        rerunAfterRequest = true;
        return;
      }

      requestRunning = true;
      rerunAfterRequest = false;
      try {
        const [ordersResult, merchantsResult, trackingResult] = await Promise.allSettled([
          fetchAdminOrders(),
          fetchMerchants(),
          runTrack17Admin<TrackingCenterData>("list", { limit: 200 }),
        ]);
        if (disposed) return;
        if (ordersResult.status === "fulfilled") orders = Array.isArray(ordersResult.value) ? ordersResult.value : [];
        if (merchantsResult.status === "fulfilled") merchants = Array.isArray(merchantsResult.value) ? merchantsResult.value : [];
        if (trackingResult.status === "fulfilled") shipments = trackingResult.value.shipments || [];
        apply();
      } finally {
        requestRunning = false;
        if (!disposed && rerunAfterRequest) void refreshData();
      }
    };

    const schedule = () => {
      window.cancelAnimationFrame(queuedFrame);
      queuedFrame = window.requestAnimationFrame(() => {
        if (!currentSectionIsInternational()) return;
        if (!orders.length) void refreshData();
        else apply();
      });
    };

    const refreshImmediately = () => {
      orders = [];
      shipments = [];
      void refreshData();
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
    const interval = window.setInterval(() => void refreshData(), 12_000);
    window.addEventListener("focus", refreshData);
    window.addEventListener(INTERNATIONAL_SHIPMENT_UPDATED_EVENT, refreshImmediately);
    schedule();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(queuedFrame);
      window.clearInterval(interval);
      observer.disconnect();
      window.removeEventListener("focus", refreshData);
      window.removeEventListener(INTERNATIONAL_SHIPMENT_UPDATED_EVENT, refreshImmediately);
    };
  }, []);

  return null;
}
