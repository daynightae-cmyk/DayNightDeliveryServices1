import { useEffect } from "react";

export const ADMIN_INP_BUDGET_MS = 200;
export const ADMIN_INP_EVENT = "dn-admin-inp-sample";

type InteractionEntry = PerformanceEntry & {
  duration: number;
  interactionId?: number;
  target?: EventTarget | null;
};

type AdminInpDetail = {
  duration: number;
  budget: number;
  overBudget: boolean;
  interactionId: number;
  target: string;
  measuredAt: string;
};

function targetLabel(target: EventTarget | null | undefined) {
  if (!(target instanceof Element)) return "unknown";
  const id = target.id ? `#${target.id}` : "";
  const classes = Array.from(target.classList).slice(0, 3).map((name) => `.${name}`).join("");
  return `${target.tagName.toLowerCase()}${id}${classes}`.slice(0, 180);
}

/**
 * Measures real interaction latency on the admin route without adding event
 * handlers to application controls. The browser PerformanceObserver supplies
 * event timing entries; samples are exposed as a custom event for monitoring.
 */
export function useAdminInteractionPerformanceBudget(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof PerformanceObserver === "undefined") return;

    const supported = PerformanceObserver.supportedEntryTypes || [];
    if (!supported.includes("event")) return;

    let worstDuration = 0;
    const observer = new PerformanceObserver((list) => {
      for (const rawEntry of list.getEntries()) {
        const entry = rawEntry as InteractionEntry;
        const interactionId = Number(entry.interactionId || 0);
        if (!interactionId || entry.duration <= worstDuration) continue;

        worstDuration = entry.duration;
        const detail: AdminInpDetail = {
          duration: Math.round(entry.duration * 10) / 10,
          budget: ADMIN_INP_BUDGET_MS,
          overBudget: entry.duration > ADMIN_INP_BUDGET_MS,
          interactionId,
          target: targetLabel(entry.target),
          measuredAt: new Date().toISOString(),
        };

        window.dispatchEvent(new CustomEvent<AdminInpDetail>(ADMIN_INP_EVENT, { detail }));
        if (detail.overBudget) {
          console.warn(
            `[DAY NIGHT admin INP] ${detail.duration}ms exceeded ${detail.budget}ms at ${detail.target}`,
          );
        }
      }
    });

    try {
      observer.observe({ type: "event", buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
    } catch {
      observer.disconnect();
      return;
    }

    return () => observer.disconnect();
  }, [enabled]);
}
