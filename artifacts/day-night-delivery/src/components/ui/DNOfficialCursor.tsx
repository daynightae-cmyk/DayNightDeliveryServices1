import { useEffect, useRef } from "react";

const INTERACTIVE_SELECTOR = "a, button, input, textarea, select, [role='button'], [data-cursor='interactive']";

export function DNOfficialCursor() {
  const ringRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const finePointer = window.matchMedia("(pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!finePointer.matches || reducedMotion.matches) return;

    const ring = ringRef.current;
    const dot = dotRef.current;
    if (!ring || !dot) return;

    const root = document.documentElement;
    let pointerX = -120;
    let pointerY = -120;
    let ringX = pointerX;
    let ringY = pointerY;
    let frame = 0;

    const paint = () => {
      ringX += (pointerX - ringX) * 0.18;
      ringY += (pointerY - ringY) * 0.18;

      ring.style.setProperty("--dn-cursor-x", `${ringX}px`);
      ring.style.setProperty("--dn-cursor-y", `${ringY}px`);
      dot.style.setProperty("--dn-cursor-x", `${pointerX}px`);
      dot.style.setProperty("--dn-cursor-y", `${pointerY}px`);

      frame = window.requestAnimationFrame(paint);
    };

    const setInteractive = (target: EventTarget | null) => {
      const element = target instanceof Element ? target : null;
      const interactive = Boolean(element?.closest(INTERACTIVE_SELECTOR));
      ring.classList.toggle("dn-cursor-ring--interactive", interactive);
      dot.classList.toggle("dn-cursor-dot--interactive", interactive);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      root.classList.add("dn-custom-cursor-visible");
      setInteractive(event.target);
    };

    const onPointerDown = () => root.classList.add("dn-custom-cursor-pressed");
    const onPointerUp = () => root.classList.remove("dn-custom-cursor-pressed");
    const onMouseLeave = () => root.classList.remove("dn-custom-cursor-visible");
    const onMouseEnter = () => root.classList.add("dn-custom-cursor-visible");

    root.classList.add("dn-custom-cursor-enabled");
    frame = window.requestAnimationFrame(paint);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);

    return () => {
      window.cancelAnimationFrame(frame);
      root.classList.remove("dn-custom-cursor-enabled", "dn-custom-cursor-visible", "dn-custom-cursor-pressed");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
    };
  }, []);

  return (
    <>
      <div ref={ringRef} className="dn-cursor-ring" aria-hidden="true" />
      <div ref={dotRef} className="dn-cursor-dot" aria-hidden="true" />
    </>
  );
}
