import { useId, type CSSProperties } from "react";

function Balloon({ tone, index }: { tone: "gold" | "navy" | "pearl" | "glass"; index: number }) {
  const id = useId().replace(/:/g, "");
  const colors = { gold: ["#fff4c7", "#d5af50", "#866017", "#362710"], navy: ["#92a6bd", "#19365b", "#071426", "#020710"], pearl: ["#fffef2", "#e5dfce", "#9d9f9f", "#454d59"], glass: ["#fff3d1", "#a9997140", "#263b5040", "#0c182630"] }[tone];
  return <svg className={`kb-balloon kb-balloon-${index}`} viewBox="0 0 180 350" style={{ "--kb-float-delay": `${-index * 1.7}s` } as CSSProperties}>
    <defs>
      <radialGradient id={`${id}-body`} cx="32%" cy="23%" r="82%"><stop stopColor={colors[0]} /><stop offset=".3" stopColor={colors[1]} /><stop offset=".76" stopColor={colors[2]} /><stop offset="1" stopColor={colors[3]} /></radialGradient>
      <linearGradient id={`${id}-rim`}><stop stopColor="#fff6d4" stopOpacity=".55" /><stop offset=".5" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#d4af37" stopOpacity=".5" /></linearGradient>
    </defs>
    <path d="M90 188 C62 180 22 143 22 84 C22 36 50 12 87 12 C131 12 157 47 156 88 C154 139 117 176 94 188 Z" fill={`url(#${id}-body)`} stroke={`url(#${id}-rim)`} strokeWidth="1" />
    <path d="M53 38 C33 55 30 83 37 102 C34 70 46 55 60 44" fill="#fff" opacity={tone === "glass" ? ".7" : ".42"} />
    <ellipse cx="73" cy="31" rx="18" ry="4" fill="#fff" opacity=".2" transform="rotate(-23 73 31)" />
    <path d="M92 186 l-5 10 q6 -3 12 0 l-5 -10" fill={colors[2]} stroke="#ead29e" strokeOpacity=".3" />
    <path d="M92 196 C54 242 128 264 87 333" fill="none" stroke="#d9c99e" strokeOpacity=".55" strokeWidth=".8" />
    <path d="M133 70 C145 104 125 152 104 168" fill="none" stroke="#e9d294" strokeWidth="1.5" opacity=".23" />
  </svg>;
}

export default function CelebrationDecor({ mobile, intro }: { mobile: boolean; intro: boolean }) {
  const bulbs = Array.from({ length: mobile ? 16 : 28 }, (_, i) => {
    const x = 20 + i * (960 / (mobile ? 15 : 27));
    const y = 13 + 42 * Math.sin((x / 1000) * Math.PI);
    return { x, y, i };
  });
  return <div className="kb-decor" aria-hidden="true">
    <svg className="kb-lights" viewBox="0 0 1000 110" preserveAspectRatio="none">
      <path d="M0 10 Q500 106 1000 10" fill="none" stroke="#ae915e" strokeOpacity=".65" strokeWidth="1.2" />
      {bulbs.map(({ x, y, i }) => <g key={i} className="kb-bulb" style={{ animationDelay: `${intro ? i * .045 + .08 : 0}s` }}>
        <path d={`M${x} ${y}v9`} stroke="#ae915e" strokeWidth=".9" />
        <ellipse cx={x} cy={y + 15} rx="9" ry="15" fill="#edbc57" opacity=".08" />
        <ellipse cx={x} cy={y + 15} rx="4.4" ry="7" fill="#f4ce76" opacity=".2" />
        <ellipse cx={x} cy={y + 15} rx="1.8" ry="3.8" fill="#ffedb5" opacity="0.85" />
        <circle cx={x - .5} cy={y + 13} r=".7" fill="#fffef1" />
      </g>)}
    </svg>
    <div className="kb-cluster kb-cluster-left"><Balloon tone="navy" index={0} /><Balloon tone="pearl" index={1} />{!mobile && <Balloon tone="gold" index={2} />}</div>
    <div className="kb-cluster kb-cluster-right"><Balloon tone="gold" index={3} /><Balloon tone="glass" index={4} />{!mobile && <Balloon tone="navy" index={5} />}</div>
    {Array.from({ length: mobile ? 4 : 7 }, (_, i) => <i key={`glass-${i}`} className={`kb-bubble kb-bubble-${i}`} style={{ "--kb-drift": `${14 + i * 3}s` } as CSSProperties} />)}
    <div className="kb-dust">{Array.from({ length: mobile ? 16 : 32 }, (_, i) => <i key={i} style={{ left: `${(i * 37 + 7) % 100}%`, top: `${(i * 23 + 14) % 100}%`, animationDelay: `${-i * .7}s`, animationDuration: `${6 + i % 5}s` }} />)}</div>
    {!intro && <div className="kb-petals">{Array.from({ length: mobile ? 2 : 3 }, (_, i) => <i key={i} style={{ left: `${15 + i * 35}%`, animationDelay: `${-i * 8}s`, animationDuration: `${28 + i * 3}s` }} />)}</div>}
    {intro && <><div className="kb-activation" /><div className="kb-flare kb-flare-left" /><div className="kb-flare kb-flare-right" /></>}
  </div>;
}
