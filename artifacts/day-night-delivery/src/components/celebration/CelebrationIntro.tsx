import { useEffect, useRef, useState, type CSSProperties } from "react";
import { khalifaBirthdayConfig as cfg } from "../../config/khalifaBirthday";
import CelebrationConfetti from "./CelebrationConfetti";
import KhalifaParticleTitle from "./KhalifaParticleTitle";

type Props = {
  reduced: boolean;
  isMobile: boolean;
  onDone: () => void;
};

type BurstState = {
  id: number;
  kind: "opening" | "hero" | "emotion";
};

export default function CelebrationIntro({ reduced, isMobile, onDone }: Props) {
  const timing = reduced ? cfg.reduced : cfg;
  const steps = timing.steps;
  const [index, setIndex] = useState(0);
  const [stagePhase, setStagePhase] = useState<"pre" | "in" | "out">("pre");
  const [formed, setFormed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [burst, setBurst] = useState<BurstState>({ id: 1, kind: "opening" });
  const heroRef = useRef<HTMLHeadingElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const step = steps[index];

  useEffect(() => {
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };

    const fadeIn = timing.fadeInMs;
    const fadeOut = timing.fadeOutMs;

    later(() => setStagePhase("in"), 35);

    if (step.confetti && !reduced) {
      later(
        () => setBurst((current) => ({ id: current.id + 1, kind: "emotion" })),
        fadeIn + 180,
      );
    }

    later(() => setStagePhase("out"), 35 + fadeIn + step.holdMs);

    later(() => {
      if (index + 1 < steps.length) {
        setStagePhase("pre");
        setFormed(false);
        setIndex((current) => current + 1);
        return;
      }

      setLeaving(true);
      later(() => doneRef.current(), cfg.exitFadeMs);
    }, 35 + fadeIn + step.holdMs + fadeOut);

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [index, reduced, step.confetti, step.holdMs, steps.length, timing.fadeInMs, timing.fadeOutMs]);

  const style = {
    "--kb-in": timing.fadeInMs + "ms",
    "--kb-out": timing.fadeOutMs + "ms",
    "--kb-exit": cfg.exitFadeMs + "ms",
  } as CSSProperties;

  const stageClass =
    "kb-stage kb-stage-" +
    step.variant +
    (stagePhase === "in" ? " is-in" : "") +
    (stagePhase === "out" ? " is-out" : "");

  return (
    <div
      className={"kb-intro" + (leaving ? " is-leaving" : "")}
      style={style}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      lang="ar"
      dir="rtl"
    >
      <div className="kb-intro-bg" />

      <div key={step.id} className={stageClass}>
        {step.variant === "hero" ? (
          <div className="kb-hero">
            <div className="kb-first-birthday-number" aria-hidden="true">
              01
            </div>
            <h1 ref={heroRef} className={"kb-hero-text" + (formed ? " is-formed" : "")}>
              {step.text}
            </h1>
            <KhalifaParticleTitle
              text={step.text}
              textRef={heroRef}
              isMobile={isMobile}
              reduced={reduced}
              onFormed={() => {
                setFormed(true);
                if (!reduced) {
                  setBurst((current) => ({ id: current.id + 1, kind: "hero" }));
                }
              }}
            />
            <p className={"kb-hero-subtitle" + (formed ? " is-formed" : "")}>
              {cfg.hero.subtitle1}
            </p>
            <p className={"kb-hero-subtitle kb-hero-subtitle-gold" + (formed ? " is-formed" : "")}>
              {cfg.hero.subtitle2}
            </p>
            <span className={"kb-hero-badge" + (formed ? " is-formed" : "")}>
              {cfg.hero.badge}
            </span>
          </div>
        ) : (
          <p className="kb-story-line">{step.text}</p>
        )}
      </div>

      <CelebrationConfetti
        trigger={burst.id}
        kind={burst.kind}
        isMobile={isMobile}
        reduced={reduced}
      />
    </div>
  );
}
