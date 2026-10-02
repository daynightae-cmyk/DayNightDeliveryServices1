import type { CSSProperties } from "react";
import { khalifaBirthdayConfig as cfg, type BirthdayDecorMode } from "../../config/khalifaBirthday";

const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

type Props = {
  mode: BirthdayDecorMode;
  isMobile: boolean;
};

export default function CelebrationDecor({ mode, isMobile }: Props) {
  const density = cfg.density[isMobile ? "mobile" : "desktop"];
  const maximum = density.intro;
  const visible = density[mode];
  const bulbCount = isMobile ? cfg.lights.mobile : cfg.lights.desktop;
  const segment = 100 / bulbCount;
  const showGarland = mode === "intro" || mode === "normal";

  let wire = "M0,1";
  for (let i = 0; i < bulbCount; i += 1) {
    wire += " Q" + ((i + 0.5) * segment).toFixed(2) + ",7 " + ((i + 1) * segment).toFixed(2) + ",1";
  }

  return (
    <div className={"kb-decor kb-mode-" + mode} aria-hidden="true">
      <div className="kb-lights">
        <svg viewBox="0 0 100 9" preserveAspectRatio="none">
          <path d={wire} />
        </svg>
        {Array.from({ length: bulbCount }, (_, i) => (
          <span
            key={"light-" + i}
            className="kb-bulb"
            style={{
              left: ((i + 0.5) * segment).toFixed(2) + "%",
              animationDelay:
                i * cfg.lights.stepMs + "ms, " +
                (i * cfg.lights.stepMs + 700 + (i % 4) * 250) + "ms",
            }}
          />
        ))}
      </div>

      {showGarland && (
        <div className="kb-garland">
          <span>{cfg.hero.badge}</span>
          <span className="kb-garland-copy">DAY NIGHT • KHALIFA • FIRST BIRTHDAY</span>
        </div>
      )}

      {cfg.balloons.slice(0, maximum.balloons).map((balloon, i) => (
        <span
          key={"balloon-" + i}
          className={
            "kb-balloon kb-tone-" + balloon.tone +
            (i >= visible.balloons ? " kb-off" : "")
          }
          style={
            {
              [balloon.side]: balloon.edge + "%",
              top: balloon.top + "%",
              "--kb-balloon-size": balloon.size + "px",
              "--kb-float-duration": balloon.duration + "s",
              "--kb-float-delay": balloon.delay + "s",
            } as CSSProperties
          }
        >
          <span className="kb-balloon-string" />
        </span>
      ))}

      {Array.from({ length: maximum.bubbles }, (_, i) => {
        const duration = 12 + rnd(i + 40) * 8;
        return (
          <span
            key={"bubble-" + i}
            className={"kb-bubble" + (i >= visible.bubbles ? " kb-off" : "")}
            style={
              {
                left: (6 + rnd(i + 1) * 88).toFixed(1) + "%",
                "--kb-bubble-size": (10 + rnd(i + 20) * 24).toFixed(0) + "px",
                "--kb-bubble-duration": duration.toFixed(1) + "s",
                "--kb-bubble-delay": "-" + (rnd(i + 60) * duration).toFixed(1) + "s",
                "--kb-bubble-drift": ((rnd(i + 90) - 0.5) * 110).toFixed(0) + "px",
              } as CSSProperties
            }
          />
        );
      })}

      {Array.from({ length: maximum.particles }, (_, i) => (
        <span
          key={"spark-" + i}
          className={"kb-spark" + (i >= visible.particles ? " kb-off" : "")}
          style={
            {
              left: (rnd(i + 100) * 100).toFixed(1) + "%",
              top: (8 + rnd(i + 200) * 82).toFixed(1) + "%",
              "--kb-spark-size": (2 + rnd(i + 300) * 3).toFixed(1) + "px",
              "--kb-spark-duration": (3 + rnd(i + 400) * 3).toFixed(1) + "s",
              "--kb-spark-delay": "-" + (rnd(i + 500) * 5).toFixed(1) + "s",
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
