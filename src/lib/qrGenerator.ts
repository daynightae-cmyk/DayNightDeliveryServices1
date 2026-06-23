export function buildTrackingQrUrl(trackingCode: string) {
  const encoded = encodeURIComponent(`https://daynightae.com/tracking?code=${trackingCode}`);
  return `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encoded}`;
}

export function buildWhatsappQrUrl(trackingCode: string) {
  const msg = encodeURIComponent(`Tracking code: ${trackingCode}`);
  const url = encodeURIComponent(`https://wa.me/971568757331?text=${msg}`);
  return `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${url}`;
}

export function downloadQr(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.click();
}
