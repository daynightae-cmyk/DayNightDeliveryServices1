import { useEffect, useState } from "react";
import { buildTrackingQrUrl, buildWhatsappQrUrl, downloadQr } from "../lib/qrGenerator";

interface QRGeneratorProps {
  trackingCode: string;
}

export default function QRGenerator({ trackingCode }: QRGeneratorProps) {
  const [trackingQr, setTrackingQr] = useState("");
  const [whatsappQr, setWhatsappQr] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([buildTrackingQrUrl(trackingCode), buildWhatsappQrUrl(trackingCode)]).then(([tracking, whatsapp]) => {
      if (cancelled) return;
      setTrackingQr(tracking);
      setWhatsappQr(whatsapp);
    });
    return () => {
      cancelled = true;
    };
  }, [trackingCode]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="bg-brand-cool/20 border border-white/10 rounded-2xl p-4 text-center space-y-2">
        <p className="text-xs text-white/70">Tracking QR</p>
        {trackingQr ? <img src={trackingQr} alt="Tracking QR" className="w-40 h-40 mx-auto rounded-xl bg-white p-2" loading="lazy" /> : <div className="w-40 h-40 mx-auto rounded-xl bg-white/10 animate-pulse" />}
        <button disabled={!trackingQr} onClick={() => downloadQr(trackingQr, `${trackingCode}-tracking.png`)} className="px-3 py-2 text-xs bg-brand-gold text-brand-deep rounded-lg font-bold disabled:opacity-50">Download PNG</button>
      </div>
      <div className="bg-brand-cool/20 border border-white/10 rounded-2xl p-4 text-center space-y-2">
        <p className="text-xs text-white/70">WhatsApp QR</p>
        {whatsappQr ? <img src={whatsappQr} alt="WhatsApp QR" className="w-40 h-40 mx-auto rounded-xl bg-white p-2" loading="lazy" /> : <div className="w-40 h-40 mx-auto rounded-xl bg-white/10 animate-pulse" />}
        <button disabled={!whatsappQr} onClick={() => downloadQr(whatsappQr, `${trackingCode}-whatsapp.png`)} className="px-3 py-2 text-xs bg-brand-gold text-brand-deep rounded-lg font-bold disabled:opacity-50">Download PNG</button>
      </div>
    </div>
  );
}
