import { useEffect, useRef, type RefObject } from "react";
import { khalifaBirthdayConfig as cfg } from "../../config/khalifaBirthday";

type Particle = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  delay: number;
  radius: number;
  color: string;
};

type Props = {
  text: string;
  textRef: RefObject<HTMLHeadingElement | null>;
  isMobile: boolean;
  reduced: boolean;
  onFormed: () => void;
};

const seeded = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export default function KhalifaParticleTitle({
  text,
  textRef,
  isMobile,
  reduced,
  onFormed,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const callbackRef = useRef(onFormed);
  callbackRef.current = onFormed;

  useEffect(() => {
    if (reduced) {
      callbackRef.current();
      return;
    }

    const canvas = canvasRef.current;
    const textElement = textRef.current;
    if (!canvas || !textElement) {
      callbackRef.current();
      return;
    }

    let raf = 0;
    let cancelled = false;

    const run = () => {
      if (cancelled) return;

      const width = Math.max(1, Math.round(canvas.clientWidth));
      const height = Math.max(1, Math.round(canvas.clientHeight));
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        callbackRef.current();
        return;
      }

      const offscreen = document.createElement("canvas");
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      const offCtx = offscreen.getContext("2d");
      if (!offCtx) {
        callbackRef.current();
        return;
      }

      const computed = window.getComputedStyle(textElement);
      offCtx.scale(dpr, dpr);
      offCtx.font =
        computed.fontWeight + " " + computed.fontSize + " " + computed.fontFamily;
      offCtx.textAlign = "center";
      offCtx.textBaseline = "middle";
      offCtx.direction = "rtl";
      offCtx.fillStyle = "#fff";
      offCtx.fillText(text, width / 2, height / 2);

      const image = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
      const gap = Math.max(3, Math.round(4 * dpr));
      const sampled: Array<[number, number]> = [];

      for (let y = 0; y < offscreen.height; y += gap) {
        for (let x = 0; x < offscreen.width; x += gap) {
          const alpha = image.data[(y * offscreen.width + x) * 4 + 3];
          if (alpha > 150) sampled.push([x / dpr, y / dpr]);
        }
      }

      const random = seeded(20261002);
      for (let i = sampled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        const tmp = sampled[i];
        sampled[i] = sampled[j];
        sampled[j] = tmp;
      }

      const maxParticles = isMobile
        ? cfg.hero.maxParticles.mobile
        : cfg.hero.maxParticles.desktop;
      const selected = sampled.slice(0, maxParticles);

      if (!selected.length) {
        callbackRef.current();
        return;
      }

      const particles: Particle[] = selected.map(([x1, y1], index) => {
        const angle = random() * Math.PI * 2;
        const distance = Math.max(width, height) * (0.55 + random() * 0.65);
        return {
          x0: width / 2 + Math.cos(angle) * distance,
          y0: height / 2 + Math.sin(angle) * distance,
          x1,
          y1,
          delay: random() * 0.28,
          radius: 1.1 + random() * 1.2,
          color: cfg.hero.particleColors[index % cfg.hero.particleColors.length],
        };
      });

      const startedAt = performance.now();
      const duration = cfg.hero.formMs;

      const draw = (now: number) => {
        if (cancelled) return;
        if (document.hidden) {
          raf = window.requestAnimationFrame(draw);
          return;
        }

        const progress = Math.min(1, (now - startedAt) / duration);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        for (const particle of particles) {
          const local = Math.min(
            1,
            Math.max(0, (progress - particle.delay) / (1 - particle.delay)),
          );
          const eased = 1 - Math.pow(1 - local, 3);
          const sway =
            (1 - eased) *
            Math.sin(local * 9 + particle.delay * 22) *
            (isMobile ? 4 : 7);

          ctx.globalAlpha = 0.3 + eased * 0.7;
          ctx.fillStyle = particle.color;
          ctx.beginPath();
          ctx.arc(
            particle.x0 + (particle.x1 - particle.x0) * eased + sway,
            particle.y0 + (particle.y1 - particle.y0) * eased,
            particle.radius,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }

        if (progress < 1) {
          raf = window.requestAnimationFrame(draw);
        } else {
          callbackRef.current();
        }
      };

      raf = window.requestAnimationFrame(draw);
    };

    const fonts = document.fonts?.ready;
    if (fonts) void fonts.then(run);
    else run();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [isMobile, reduced, text, textRef]);

  return <canvas ref={canvasRef} className="kb-hero-canvas" aria-hidden="true" />;
}
