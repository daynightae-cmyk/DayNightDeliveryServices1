import React, { useRef, useState, useEffect } from 'react';

type Props = {
  orderId?: string;
  trackingNumber?: string;
  language?: 'en' | 'ar';
  onSignatureSave?: (dataUrl: string) => void;
};

export default function SignatureCapture({ orderId, trackingNumber, language = 'en', onSignatureSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.floor(w * ratio);
      canvas.height = Math.floor(h * ratio);
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(ratio, ratio);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  function getCtx() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }

  function pointerDown(e: React.PointerEvent) {
    const ctx = getCtx();
    if (!ctx) return;
    setDrawing(true);
    ctx.beginPath();
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }

  function pointerMove(e: React.PointerEvent) {
    if (!drawing) return;
    const ctx = getCtx();
    if (!ctx) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }

  function pointerUp() {
    setDrawing(false);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDataUrl(null);
  }

  function saveSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    if (!url || url === '') {
      alert(language === 'ar' ? 'يرجى إضافة التوقيع قبل الحفظ.' : 'Please add a signature before saving.');
      return;
    }
    setDataUrl(url);
    if (onSignatureSave) onSignatureSave(url);
    // optional demo storage
    try {
      localStorage.setItem(`signature_${trackingNumber || orderId || 'demo'}`, url);
    } catch (e) {}
    alert(language === 'ar' ? 'تم حفظ التوقيع بنجاح.' : 'Signature captured successfully.');
  }

  return (
    <div className="bg-brand-cool/30 rounded-2xl p-4 border border-white/10">
      <h4 className="font-bold text-white mb-2">{language === 'ar' ? 'توقيع الاستلام' : 'Delivery Signature'}</h4>
      <p className="text-xs text-white/60 mb-3">{language === 'ar' ? 'يرجى التوقيع أدناه لتأكيد استلام الشحنة.' : 'Please sign below to confirm parcel delivery.'}</p>
      <div className="w-full h-40 bg-white/5 rounded-md overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerLeave={pointerUp}
          style={{ width: '100%', height: '100%', touchAction: 'none' }}
        />
      </div>

      <div className="mt-3 flex gap-3">
        <button onClick={clearCanvas} className="px-4 py-2 rounded-lg bg-rose-600 text-white font-bold">{language === 'ar' ? 'مسح' : 'Clear'}</button>
        <button onClick={saveSignature} className="px-4 py-2 rounded-lg bg-brand-gold text-brand-deep font-bold">{language === 'ar' ? 'حفظ التوقيع' : 'Save Signature'}</button>
      </div>

      <p className="text-xs text-white/50 mt-3 italic">{language === 'ar' ? 'مكان مخصص للربط لاحقًا مع Supabase Storage' : 'Supabase storage integration placeholder'}</p>
    </div>
  );
}
