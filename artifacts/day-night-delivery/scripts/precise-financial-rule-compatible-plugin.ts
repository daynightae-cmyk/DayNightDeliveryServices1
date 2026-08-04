import type { Plugin } from "vite";
import { preciseFinancialRulePlugin } from "./precise-financial-rule-plugin";

/**
 * Compatibility wrapper for the historical source-rewrite plugin.
 *
 * The legacy plugin still protects older operational surfaces by injecting the
 * precise 25 AED/manual-zero settlement rules. The rebuilt audited order editor
 * already consumes calculateFinancialOpsOrder(), which applies those rules in
 * the authoritative TypeScript finance layer. Rewriting that new component by
 * matching its former source shape would be both unnecessary and brittle.
 */
export function preciseFinancialRuleCompatiblePlugin(): Plugin {
  const legacy = preciseFinancialRulePlugin();
  const legacyTransform = legacy.transform as any;

  return {
    ...legacy,
    name: "day-night-precise-financial-rule-compatible-v5",
    async transform(source, id, options) {
      const normalized = id.replace(/\\/g, "/").split("?")[0];
      const isAuditedCompleteEditor =
        normalized.endsWith(
          "/src/components/admin/AdminOrderEditModalComplete.tsx",
        ) &&
        source.includes('data-admin-complete-order-merchant="true"') &&
        source.includes("calculateFinancialOpsOrder") &&
        source.includes("saveAdminOrderEdit");
      const isAuthoritativeNewOrder =
        normalized.endsWith(
          "/src/components/admin/AdminNewOrderComplete.tsx",
        ) &&
        source.includes("effectiveDeliveryFeeMode") &&
        source.includes("calculateFinancialOpsOrder") &&
        source.includes('data-admin-new-order-form="merchant"');

      if (isAuditedCompleteEditor || isAuthoritativeNewOrder) {
        return { code: source, map: null };
      }

      if (!legacyTransform) return null;
      if (typeof legacyTransform === "function") {
        return await legacyTransform.call(this, source, id, options);
      }
      if (typeof legacyTransform.handler === "function") {
        return await legacyTransform.handler.call(this, source, id, options);
      }
      return null;
    },
  };
}
