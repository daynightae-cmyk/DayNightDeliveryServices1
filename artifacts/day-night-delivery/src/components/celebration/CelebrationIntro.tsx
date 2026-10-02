import { useEffect, useState } from "react";
import { khalifaBirthdayConfig as cfg } from "../../config/khalifaBirthday";
import KhalifaParticleTitle from "./KhalifaParticleTitle";
import CelebrationBurst from "./CelebrationBurst";

const moments = [
  { at: 1400, label: "TONIGHT AT DAY NIGHT", text: "اليوم مش يوم عادي في Day Night...", kind: "story" },
  { at: 2700, label: "A VERY SPECIAL LITTLE ONE", text: "النهارده عيد ميلاد خليفة", kind: "story" },
  { at: 3700, label: "KHALIFA · 01", text: "خليفة", kind: "hero" },
  { at: 6500, label: "ONE YEAR. A WORLD OF LOVE.", text: "أول عيد ميلاد لخليفة مع عائلة Day Night", kind: "story" },
  { at: 7700, label: "OUR LITTLE LIGHT", text: "كل سنة وإنت منور دنيتنا يا خليفة", kind: "wish" },
  { at: 9600, label: "DAY NIGHT FAMILY", text: "من عائلة داي نايت لخدمات التوصيل والشحن", kind: "signature" },
  { at: 11000, label: "THE ONE & ONLY", text: "يلا يا بلد... مجبتش خليفة غيري 😎", kind: "playful" },
] as const;

export default function CelebrationIntro({ mobile, reduced, onDone }: { mobile: boolean; reduced: boolean; onDone: () => void }) {
  const [index, setIndex] = useState(-1);
  const [previous, setPrevious] = useState(-1);
  useEffect(() => {
    const times = reduced ? [100, 650, 1200, 2500, 3200, 4200, 4900] : moments.map(m => m.at);
    const timers = times.flatMap((time, i) => [
      window.setTimeout(() => { setPrevious(i - 1); setIndex(i); }, time),
      window.setTimeout(() => setPrevious(-1), time + (reduced ? 200 : 800)),
    ]);
    timers.push(window.setTimeout(onDone, reduced ? cfg.reducedDurationMs : cfg.introDurationMs));
    return () => timers.forEach(window.clearTimeout);
  }, [reduced, onDone]);
  const m = moments[index];
  const renderMoment = (moment: typeof moments[number], outgoing = false) => <div key={outgoing ? `old-${previous}` : index} className={`kb-moment kb-moment-${moment.kind}${outgoing ? " kb-moment-out" : ""}`} aria-hidden={outgoing || undefined}>
    <p className="kb-eyebrow" dir="ltr">{moment.label}</p>
    {moment.kind === "hero" ? <>
      <span className="kb-year" aria-hidden="true">01</span>
      <div className={`kb-name-stage${reduced ? " kb-name-static" : ""}`}>
        {!reduced && !outgoing && <KhalifaParticleTitle mobile={mobile} />}
        <h2 className="kb-name">خليفة</h2>
      </div>
      <div className="kb-hero-caption"><p>ظبي الإمارات الصغير</p><p className="kb-crown">ولي عهد <span dir="ltr">Day Night</span></p><span className="kb-first" dir="ltr">FIRST BIRTHDAY</span></div>
    </> : <h2 className="kb-story">{moment.text}</h2>}
    <span className="kb-gold-rule" aria-hidden="true" />
  </div>;
  return <section className="kb-intro" data-kb-moment={m?.kind || "opening"} aria-label="احتفال أول عيد ميلاد لخليفة">
    <div className="kb-veil" aria-hidden="true" />
    <div className="kb-halo" aria-hidden="true" />
    <div className="kb-editorial-header" aria-hidden="true"><span>DAY NIGHT <b>AFTER DARK</b></span><span>02 OCTOBER 2026</span></div>
    <div className="kb-frame" aria-hidden="true" />
    {!reduced && <CelebrationBurst />}
    <div className="kb-stage" aria-live="polite" aria-atomic="true">
      {previous >= 0 && renderMoment(moments[previous], true)}
      {m && renderMoment(m)}
    </div>
    <div className="kb-editorial-footer" aria-hidden="true"><span>KHALIFA’S FIRST CHAPTER</span><span>WITH LOVE, DAY NIGHT</span></div>
    <div className="kb-progress" aria-hidden="true" style={{ animationDuration: `${reduced ? cfg.reducedDurationMs : cfg.introDurationMs}ms` }} />
  </section>;
}
