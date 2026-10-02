import type { CSSProperties } from "react";
import { khalifaBirthdayConfig as cfg } from "../../config/khalifaBirthday";

type BurstKind = "opening" | "hero" | "emotion";

type Props = {
  trigger: number;
  kind: BurstKind;
  isMobile: boolean;
  reduced: boolean;
};

const rnd = (n: number) => {
  const x = Math.sin(n * 91.7 + 17.3) * 43758.5453;
  return x - Math.floor(x);
};

export default function CelebrationConfetti({ trigger, kind, isMobile, reduced }: Props) {
  if (!trigger || reduced) return null;

  const count = isMobile ? cfg.confetti.mobile : cfg.confetti.desktop;
  const confettiCount = kind === "opening" ? Math.round(count * 0.55) : count;
  const fireworks = kind === "emotion" ? 1 : kind === "hero" ? 2 : 3;
  const flareLeft = kind === "opening" ? 50 : kind === "hero" ? 48 : 54;
  const flareTop = kind === "opening" ? 38 : kind === "hero" ? 42 : 46;

  return (
    <div className={"kb-burst kb-burst-" + kind} aria-hidden="true" key={trigger}>
      <span
        className="kb-flare"
        style={{ left: flareLeft + "%", top: flareTop + "%" }}
      />

      {Array.from({ length: confettiCount }, (_, i) => {
        const angle = -Math.PI / 2 + (rnd(i + trigger * 7) - 0.5) * Math.PI * 0.95;
        const speed = (isMobile ? 90 : 130) + rnd(i + 30) * (isMobile ? 90 : 150);
        return (
          <span
            key={"conf-" + trigger + "-" + i}
            className="kb-confetti-piece"
            style={
              {
                left: (45 + rnd(i + 70) * 10).toFixed(2) + "%",
                top: (38 + rnd(i + 90) * 8).toFixed(2) + "%",
                background: cfg.confetti.colors[i % cfg.confetti.colors.length],
                "--kb-cx": (Math.cos(angle) * speed).toFixed(0) + "px",
                "--kb-cy": (Math.sin(angle) * speed + (90 + rnd(i + 120) * 120)).toFixed(0) + "px",
                "--kb-cr": (360 + rnd(i + 150) * 540).toFixed(0) + "deg",
                "--kb-ct": (1.6 + rnd(i + 180) * 0.9).toFixed(2) + "s",
                "--kb-cd": (rnd(i + 210) * 0.2).toFixed(2) + "s",
              } as CSSProperties
            }
          />
        );
      })}

      {Array.from({ length: fireworks }, (_, group) => {
        const centerX = 24 + group * (52 / Math.max(1, fireworks - 1));
        const centerY = kind === "opening" ? 23 + (group % 2) * 12 : 30 + (group % 2) * 8;
        const rays = isMobile ? 9 : 13;
        return Array.from({ length: rays }, (_, i) => {
          const angle = (i / rays) * Math.PI * 2;
          const distance = (isMobile ? 34 : 50) + rnd(group * 100 + i) * (isMobile ? 36 : 56);
          return (
            <span
              key={"fw-" + trigger + "-" + group + "-" + i}
              className="kb-firework-dot"
              style={
                {
                  left: centerX + "%",
                  top: centerY + "%",
                  background: cfg.confetti.colors[(group + i) % cfg.confetti.colors.length],
                  "--kb-fx": (Math.cos(angle) * distance).toFixed(1) + "px",
                  "--kb-fy": (Math.sin(angle) * distance).toFixed(1) + "px",
                  "--kb-fd": (0.85 + rnd(group * 20 + i) * 0.35).toFixed(2) + "s",
                  "--kb-fdelay": (group * 0.12 + rnd(i + group) * 0.12).toFixed(2) + "s",
                } as CSSProperties
              }
            />
          );
        });
      })}
    </div>
  );
}
