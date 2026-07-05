import { useEffect } from "react";

export function CartoonMascot({ small = false }: { small?: boolean }) {
  return (
    <div className={`dn-cartoon-mascot ${small ? "scale-[0.58]" : ""}`} aria-hidden="true">
      <div className="dn-mascot-arm left"><span className="dn-mascot-hand" /></div>
      <div className="dn-mascot-arm wave"><span className="dn-mascot-hand" /></div>
      <div className="dn-mascot-body" />
      <div className="dn-mascot-head">
        <div className="dn-mascot-hair" />
        <span className="dn-mascot-eye left" />
        <span className="dn-mascot-eye right" />
        <span className="dn-mascot-smile" />
      </div>
    </div>
  );
}

export default function AdminMascotWelcome({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, 4550);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="dn-admin-intro-overlay" role="status" aria-label="DAY NIGHT admin loading">
      <div className="dn-admin-intro-card">
        <button type="button" onClick={onComplete} className="absolute left-5 top-5 z-20 rounded-full border border-brand-gold/25 bg-brand-gold/10 px-4 py-2 text-xs font-black text-brand-gold">
          دخول سريع
        </button>
        <div className="dn-cartoon-stage">
          <CartoonMascot />
          <div className="dn-speech-runner" dir="rtl"><span>نورت الدنيا يا أبو خليفة يا قيادة</span></div>
          <div className="dn-admin-loading"><i /></div>
          <p className="text-center text-xs font-black uppercase tracking-[0.24em] text-white/45">DAY NIGHT ADMIN COMMAND CENTER</p>
        </div>
      </div>
    </div>
  );
}
