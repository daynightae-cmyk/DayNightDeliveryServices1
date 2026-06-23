const WA_NUMBER = "971568757331";

function waLink(message: string) {
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function whatsappOrderConfirmation(trackingCode: string) {
  return waLink(`Order confirmed. Tracking code: ${trackingCode}. Track: https://www.daynightae.com/tracking?code=${trackingCode}`);
}

export function whatsappStatusUpdate(trackingCode: string, status: string) {
  return waLink(`Shipment update. Tracking ${trackingCode} is now ${status}.`);
}

export function whatsappDeliveryReminder(trackingCode: string) {
  return waLink(`Delivery reminder for tracking ${trackingCode}.`);
}

export function whatsappRatingRequest(trackingCode: string) {
  return waLink(`Thank you for using DAY NIGHT DELIVERY SERVICES. Please rate your experience for ${trackingCode}.`);
}
