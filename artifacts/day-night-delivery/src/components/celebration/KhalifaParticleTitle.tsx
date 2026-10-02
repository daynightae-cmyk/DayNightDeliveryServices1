import { useEffect, useRef } from "react";

/** Short-lived glyph formation; the accessible DOM heading takes over at 1.7s. */
export default function KhalifaParticleTitle({ mobile }: { mobile: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0, cancelled = false;
    const box = canvas.getBoundingClientRect();
    const width = box.width, height = box.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = width * dpr; canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    const fontSize = mobile ? 112 : Math.min(210, width * .31);
    const font = `700 ${fontSize}px Cairo, sans-serif`;
    const start = async () => {
      // Bound font readiness so an unavailable external font cannot stall the reveal.
      let fontTimer = 0;
      await Promise.race([document.fonts.load(font, "خليفة").catch(() => []), new Promise(resolve => { fontTimer = window.setTimeout(resolve, 250); })]);
      window.clearTimeout(fontTimer);
      if (cancelled) return;
      const mask = document.createElement("canvas"); mask.width = Math.ceil(width); mask.height = Math.ceil(height);
      const mc = mask.getContext("2d"); if (!mc) return;
      mc.font = font; mc.textAlign = "center"; mc.textBaseline = "middle"; mc.direction = "rtl";
      mc.fillText("خليفة", width / 2, height / 2);
      const data = mc.getImageData(0, 0, mask.width, mask.height).data;
      const candidates: { x: number; y: number }[] = [];
      for (let y = 0; y < mask.height; y += 3) for (let x = 0; x < mask.width; x += 3) if (data[(y * mask.width + x) * 4 + 3] > 160) candidates.push({ x, y });
      const cap = mobile ? 240 : 440;
      const particles = Array.from({ length: Math.min(cap, candidates.length) }, (_, i) => {
        const target = candidates[Math.floor(i * candidates.length / Math.min(cap, candidates.length))];
        const angle = i * 2.39996;
        return { ...target, sx: width / 2 + Math.cos(angle) * width * .65, sy: height / 2 + Math.sin(angle) * height * .95, bend: Math.sin(i * 7.1) * 90, radius: .75 + (i % 4) * .22 };
      });
      const started = performance.now();
      const render = (now: number) => {
        if (cancelled) return;
        const t = Math.min((now - started) / 1350, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        ctx.clearRect(0, 0, width, height);
        ctx.globalAlpha = Math.min(t * 4, 1) * (t > .92 ? Math.max(0, 1 - (t - .92) / .08) : 1);
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const x = p.sx + (p.x - p.sx) * ease + Math.sin(t * Math.PI) * p.bend;
          const y = p.sy + (p.y - p.sy) * ease;
          ctx.fillStyle = i % 5 === 0 ? "#fff8df" : "#e6c579";
          ctx.beginPath(); ctx.arc(x, y, p.radius, 0, Math.PI * 2); ctx.fill();
        }
        if (t < 1) frame = requestAnimationFrame(render);
        else ctx.clearRect(0, 0, width, height);
      };
      frame = requestAnimationFrame(render);
    };
    void start();
    return () => { cancelled = true; cancelAnimationFrame(frame); ctx.clearRect(0, 0, width, height); };
  }, [mobile]);
  return <canvas ref={ref} className="kb-particle-title" aria-hidden="true" />;
}
