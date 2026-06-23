import QRCode from "qrcode";

const qrOptions = {
  errorCorrectionLevel: "H" as const,
  margin: 2,
  width: 512,
  color: {
    dark: "#071A33",
    light: "#FFFFFF"
  }
};

export function buildTrackingUrl(trackingCode: string) {
  return `https://daynightae.com/tracking?code=${encodeURIComponent(trackingCode)}`;
}

export function buildWhatsappUrl(trackingCode: string) {
  const msg = encodeURIComponent(`Tracking code: ${trackingCode}`);
  return `https://wa.me/971568757331?text=${msg}`;
}

export async function buildQrDataUrl(value: string) {
  return QRCode.toDataURL(value, qrOptions);
}

export async function buildTrackingQrUrl(trackingCode: string) {
  return buildQrDataUrl(buildTrackingUrl(trackingCode));
}

export async function buildWhatsappQrUrl(trackingCode: string) {
  return buildQrDataUrl(buildWhatsappUrl(trackingCode));
}

export function downloadQr(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener noreferrer";
  a.click();
}
