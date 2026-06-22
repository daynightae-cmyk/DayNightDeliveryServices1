import React, { useRef, useState, useEffect } from "react";
import { useAppContext } from "../../lib/AppContext";
import { translations } from "../../data/translations";
import { PenTool, XCircle, CheckCircle2 } from "lucide-react";

interface SignatureCaptureProps {
  onSave?: (dataUrl: string) => void;
  status?: string;
}

export default function SignatureCapture({ onSave, status }: SignatureCaptureProps) {
  const { language } = useAppContext();
  const t = translations[language].signature;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only show if status is 'delivered' or 'out for delivery'
  const normalizedStatus = status ? status.toLowerCase().replace(/_/g, " ") : "";
  if (normalizedStatus && !['delivered', 'out for delivery'].includes(normalizedStatus)) {
     return null;
  }

  // Adjust canvas size for styling (mock implementation of responsiveness)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Set actual internal dimensions to match the CSS styling
      // to avoid drawing offset scale issues
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = 200; // Fixed visual height
      }
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "white"; // Or any base color
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#000000"; // Signature ink color
      }
    }
  }, [savedSignature]); // Re-init on clear/reset

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    setError(null);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault(); // Prevent scrolling while touching
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const finishDrawing = () => {
    setIsDrawing(false);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.closePath();
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
    setSavedSignature(null);
    setError(null);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Basic check if canvas is blank: checking pixel data could be heavier, but we can assume if they clicked save, and dataUrl matches blank, it's empty
      // In a real app we might check the image data buffer.
      const dataUrl = canvas.toDataURL("image/png");
      setSavedSignature(dataUrl);
      if (onSave) onSave(dataUrl);
    }
  };

  if (savedSignature) {
    return (
      <div className="bg-brand-cool/20 border border-brand-gold/30 rounded-2xl p-6 mt-8">
         <div className={`flex items-center gap-2 mb-4 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
             <CheckCircle2 className="w-5 h-5 text-green-500" />
             <h3 className="text-white font-bold">{t.saved}</h3>
         </div>
         <div className="bg-white rounded-xl p-2 max-w-sm mx-auto border-2 border-brand-gold">
            <img src={savedSignature} alt="Captured Signature" className="w-full h-auto" />
         </div>
         <div className={`mt-4 flex ${language === 'ar' ? 'justify-start' : 'justify-end'}`}>
            <button 
              onClick={handleClear}
              className="text-white/50 text-xs hover:text-white underline"
            >
              Reset
            </button>
         </div>
      </div>
    );
  }

  return (
    <div className="bg-brand-cool/20 border border-white/10 rounded-2xl p-6 mt-8 hover:border-brand-blue/30 transition-colors">
       <div className={`flex items-center gap-2 mb-4 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
           <PenTool className="w-5 h-5 text-brand-gold" />
           <div className={language === 'ar' ? 'text-right' : 'text-left'}>
             <h3 className="text-white font-bold text-lg leading-tight">{t.title}</h3>
             <p className="text-white/60 text-xs mt-1">{t.description}</p>
           </div>
       </div>

       <div className="w-full rounded-xl overflow-hidden border-2 border-dashed border-white/20 relative touch-none bg-white">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={finishDrawing}
            onMouseLeave={finishDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={finishDrawing}
            className="w-full h-[200px] cursor-crosshair"
          ></canvas>
       </div>

       {error && (
         <p className={`text-red-400 text-xs mt-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>{error}</p>
       )}

       <div className={`flex mt-5 gap-3 ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
          <button 
            onClick={handleSave}
            className="flex-1 bg-brand-gold text-brand-deep font-bold py-3 rounded-xl hover:bg-brand-blue hover:text-white transition-colors"
          >
            {t.save}
          </button>
          <button 
            onClick={handleClear}
            className="px-5 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-colors flex items-center gap-2"
          >
            <XCircle className="w-4 h-4" />
            <span>{t.clear}</span>
          </button>
       </div>
    </div>
  );
}
