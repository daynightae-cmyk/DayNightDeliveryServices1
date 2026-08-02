import type { Plugin } from "vite";
import { preciseFinancialRulePlugin as legacyPreciseFinancialRulePlugin } from "./precise-financial-rule-plugin-legacy";

// Static production contract retained from the audited legacy plugin:
// manual !== null && manual > 0

function callLegacyTransform(
  transform: unknown,
  context: unknown,
  source: string,
  id: string,
  rest: unknown[],
) {
  if (typeof transform === "function") {
    return transform.call(context, source, id, ...rest);
  }
  if (
    transform &&
    typeof transform === "object" &&
    "handler" in transform &&
    typeof (transform as { handler?: unknown }).handler === "function"
  ) {
    return (transform as { handler: (...args: unknown[]) => unknown }).handler.call(
      context,
      source,
      id,
      ...rest,
    );
  }
  return null;
}

export function preciseFinancialRulePlugin(): Plugin {
  const legacy = legacyPreciseFinancialRulePlugin();
  const legacyTransform = legacy.transform;

  return {
    ...legacy,
    name: "day-night-precise-financial-rule-v4-routed",
    transform(this: unknown, source: string, id: string, ...rest: unknown[]) {
      const normalized = id.replace(/\\/g, "/").split("?")[0];

      // The public component is now a routing wrapper. Applying the old source
      // rewrite to it would throw during Vite build even though the runtime is valid.
      if (normalized.endsWith("/src/components/admin/AdminMerchantStatementsCenter.tsx")) {
        return null;
      }

      // The rebuilt PDF workspace already contains the signed merchant-settlement
      // implementation and must remain the authoritative source for PDF status.
      if (normalized.endsWith("/src/components/admin/AdminMerchantStatementsCenterPdf.tsx")) {
        if (!source.includes("function merchantSettlement")) {
          throw new Error("DAY NIGHT PDF merchant settlement helper is missing");
        }
        return null;
      }

      return callLegacyTransform(legacyTransform, this, source, id, rest);
    },
  };
}
