import companyMeta from "../data/companyMeta";

const QR_BASE = "https://api.qrserver.com/v1/create-qr-code";

function qrUrl(data: string, size = 512) {
  return `${QR_BASE}/?size=${size}x${size}&color=071A33&bgcolor=FFFFFF&data=${encodeURIComponent(data)}`;
}

const site = companyMeta.website.replace(/\/$/, "");

export function buildTrackingQrUrl(trackingCode: string) {
  return qrUrl(`${site}/tracking/${encodeURIComponent(trackingCode)}`);
}

export function buildWhatsappQrUrl(trackingCode: string) {
  const msg = `Tracking code: ${trackingCode}`;
  return qrUrl(`${companyMeta.whatsappUrl}?text=${encodeURIComponent(msg)}`);
}

export function buildWhatsappSupportQrUrl() {
  return qrUrl(companyMeta.whatsappUrl);
}

export function buildRequestDeliveryQrUrl() {
  return qrUrl(`${site}/request`);
}

export function buildPricingQrUrl() {
  return qrUrl(`${site}/pricing`);
}

export function buildTrackingPageQrUrl() {
  return qrUrl(`${site}/tracking`);
}

export function buildQrHubQrUrl() {
  return qrUrl(`${site}/qr`);
}

export function buildMapsQrUrl() {
  return qrUrl(companyMeta.mapUrl);
}

export function buildInstagramQrUrl() {
  return qrUrl(companyMeta.socials.instagram);
}

export function buildTikTokQrUrl() {
  return qrUrl(companyMeta.socials.tiktok);
}

export function buildVCardData() {
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "N:;DAY NIGHT DELIVERY SERVICES;;;",
    "FN:DAY NIGHT DELIVERY SERVICES",
    "ORG:DAY NIGHT DELIVERY SERVICES",
    `TEL;TYPE=CELL:${companyMeta.phone.replace(/\s/g, "")}`,
    `EMAIL:${companyMeta.email}`,
    `URL:${companyMeta.website}`,
    "ADR;TYPE=WORK:;;Mussafah 40;Abu Dhabi;;UAE;United Arab Emirates",
    "NOTE:Fast Reliable Delivery Services 24/7 - UAE Delivery and International Shipping",
    "END:VCARD",
  ].join("\n");
}

export function buildContactQrUrl() {
  return qrUrl(buildVCardData());
}

export function buildWebsiteQrUrl() {
  return qrUrl(site);
}

export function downloadQr(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.click();
}

export async function downloadQrAsPdf(
  qrImgUrl: string,
  title: string,
  subtitle: string
): Promise<void> {
  const { jsPDF } = await import("jspdf");

  const res = await fetch(qrImgUrl);
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(7, 26, 51);
  doc.rect(0, 0, W, 42, "F");

  doc.setTextColor(212, 175, 55);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("DAY NIGHT", W / 2, 16, { align: "center" });

  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.text("DELIVERY SERVICES", W / 2, 24, { align: "center" });

  doc.setFontSize(7.5);
  doc.setTextColor(212, 175, 55);
  doc.text(`${companyMeta.displayWebsite}  |  ${companyMeta.phone}`, W / 2, 31, { align: "center" });

  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.7);
  doc.line(10, 42, W - 10, 42);

  doc.setTextColor(7, 26, 51);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(title, W / 2, 55, { align: "center" });

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(subtitle, W / 2, 63, { align: "center", maxWidth: W - 20 });
  }

  const qrSize = 85;
  doc.addImage(dataUrl, "PNG", (W - qrSize) / 2, 70, qrSize, qrSize);

  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.4);
  doc.line(10, 160, W - 10, 160);

  doc.setTextColor(110, 110, 110);
  doc.setFontSize(7.5);
  doc.text(
    `${companyMeta.email}  |  ${companyMeta.displayWebsite}`,
    W / 2,
    167,
    { align: "center" }
  );
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.text(
    "DAY NIGHT DELIVERY SERVICES — UAE, Abu Dhabi, Mussafah 40",
    W / 2,
    173,
    { align: "center" }
  );

  const safeName = title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  doc.save(`daynight-qr-${safeName}.pdf`);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
