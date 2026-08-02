import type { Plugin } from "vite";
import { merchantStatementLayoutPlugin as legacyMerchantStatementLayoutPlugin } from "./merchant-statement-layout-plugin-legacy";

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

export function merchantStatementLayoutPlugin(): Plugin {
  const legacy = legacyMerchantStatementLayoutPlugin();
  const legacyTransform = legacy.transform;

  return {
    ...legacy,
    name: "day-night-merchant-statement-bottom-summary-v1-routed",
    transform(this: unknown, source: string, id: string, ...rest: unknown[]) {
      const normalized = id.replace(/\\/g, "/").split("?")[0];

      // The old public file is now only a stable re-export boundary.
      if (normalized.endsWith("/src/components/admin/AdminMerchantStatementsCenter.tsx")) {
        return null;
      }

      // The rebuilt PDF workspace already supplies goodsValue from the real order
      // row. Reapplying the historical source patch would fail the production build.
      if (normalized.endsWith("/src/components/admin/AdminMerchantStatementsCenterPdf.tsx")) {
        if (!source.includes("goodsValue: goodsValue(order)")) {
          throw new Error("DAY NIGHT PDF statement rows are missing goodsValue");
        }
        return null;
      }

      // Preserve the audited canvas/PDF layout transformations unchanged.
      return callLegacyTransform(legacyTransform, this, source, id, rest);
    },
  };
}
