import { useAppContext } from "../../lib/AppContext";
import { translations } from "../../data/translations";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";

interface ShipmentProgressBarProps {
  status: string;
}

export default function ShipmentProgressBar({ status }: ShipmentProgressBarProps) {
  const { language } = useAppContext();
  const t = translations[language].progress;

  const normalizedStatus = status.toLowerCase().replace(/_/g, " ");

  const isError = ["cancelled", "failed", "failed delivery"].includes(normalizedStatus);

  // Map low-level status to progress steps
  let stepIndex = 0;
  if (["processing", "confirmed", "accepted", "pickup scheduled", "driver assigned", "picked up", "in transit", "assigned"].includes(normalizedStatus)) stepIndex = 1;
  if (["out for delivery"].includes(normalizedStatus)) stepIndex = 2;
  if (["delivered"].includes(normalizedStatus)) stepIndex = 3;

  const steps = [
    { label: t.orderPlaced, index: 0 },
    { label: t.processing, index: 1 },
    { label: t.outForDelivery, index: 2 },
    { label: t.delivered, index: 3 }
  ];

  if (isError) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 mt-6 mb-8">
        <div className={`flex items-center gap-3 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
           <AlertCircle className="w-6 h-6 text-red-500" />
           <p className="text-red-500 font-bold text-sm">{t.issue}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-brand-cool/20 border border-white/10 rounded-2xl p-6 sm:p-8 mt-6 mb-8 hover:border-brand-gold/30 transition-colors">
       <h3 className={`text-white font-bold mb-6 ${language === 'ar' ? 'text-right' : 'text-left'}`}>{t.title}</h3>
       
       <div className={`relative flex items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
          {/* Connecting line */}
          <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-white/10 rounded-full z-0"></div>
          
          <div 
            className={`absolute top-1/2 -translate-y-1/2 h-1 bg-brand-gold rounded-full z-0 transition-all duration-700 ${language === 'ar' ? 'right-0' : 'left-0'}`}
            style={{ width: `${(stepIndex / (steps.length - 1)) * 100}%` }}
          ></div>

          {steps.map((step, i) => {
            const isCompleted = i < stepIndex;
            const isActive = i === stepIndex;
            const isPending = i > stepIndex;

            return (
              <div key={i} className="relative z-10 flex flex-col items-center gap-2">
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isCompleted ? 'bg-brand-gold border-brand-gold text-brand-deep' : isActive ? 'bg-brand-blue border-brand-blue/50 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'bg-brand-deep border-white/20 text-white/20'}`}>
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Circle className={`w-4 h-4 ${isActive ? 'animate-pulse fill-white' : ''}`} />}
                 </div>
                 <span className={`text-[10px] sm:text-xs font-bold text-center max-w-[70px] sm:max-w-[100px] leading-tight ${isCompleted ? 'text-brand-gold' : isActive ? 'text-white' : 'text-white/40'}`}>
                    {step.label}
                 </span>
              </div>
            );
          })}
       </div>
    </div>
  );
}
