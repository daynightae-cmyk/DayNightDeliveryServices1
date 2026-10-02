import type { CSSProperties } from "react";
export default function CelebrationBurst() {
  return <div className="kb-bursts" aria-hidden="true">
    {[0, 1].map(side => <div key={side} className={`kb-spark-origin kb-spark-origin-${side}`}>
      {Array.from({ length: 12 }, (_, i) => <i key={i} style={{ "--kb-angle": `${i * 30}deg`, "--kb-delay": `${.25 + side * .3}s` } as CSSProperties} />)}
    </div>)}
    <div className="kb-confetti">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ left: `${18 + i * 4.2}%`, "--kb-delay": `${7.45 + i * .018}s`, "--kb-angle": `${i * 47}deg` } as CSSProperties} />)}</div>
  </div>;
}
