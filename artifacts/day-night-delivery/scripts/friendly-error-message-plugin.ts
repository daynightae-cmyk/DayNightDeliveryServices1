import type { Plugin } from "vite";

function replaceRequired(
  source: string,
  pattern: string | RegExp,
  replacement: string,
  label: string,
) {
  const next = source.replace(pattern, replacement);
  if (next === source) {
    throw new Error(`DAY NIGHT friendly error plugin could not apply: ${label}`);
  }
  return next;
}

function addImport(source: string, marker: string, statement: string, label: string) {
  if (source.includes(statement)) return source;
  return replaceRequired(source, marker, `${statement}\n${marker}`, label);
}

export function friendlyErrorMessagePlugin(): Plugin {
  return {
    name: "day-night-friendly-error-messages-v5",
    enforce: "pre",
    transform(source, id) {
      const normalized = id.replace(/\\/g, "/").split("?")[0];

      if (normalized.endsWith("/src/lib/adminOperationsData.ts")) {
        return null;
      }

      if (normalized.endsWith("/src/components/admin/AdminOrderEditModalComplete.tsx")) {
        return null;
      }

      if (normalized.endsWith("/src/components/admin/AdminNewMerchant.tsx")) {
        let code = addImport(
          source,
          'import type { Merchant } from "../../types";',
          'import { friendlyDatabaseErrorMessage } from "../../lib/friendlyErrorMessage";',
          "new merchant friendly-error import",
        );
        code = replaceRequired(
          code,
          '      setError(String((cause as Error).message || cause));',
          '      setError(friendlyDatabaseErrorMessage(cause, isArabic, "merchant"));',
          "new merchant duplicate and validation message",
        );
        return { code, map: null };
      }

      if (normalized.endsWith("/src/lib/adminEmployees.ts")) {
        let code = addImport(
          source,
          'import { supabase } from "../supabase";',
          'import { friendlyDatabaseErrorMessage } from "./friendlyErrorMessage";',
          "employee friendly-error import",
        );
        code = replaceRequired(
          code,
          /export function employeeErrorMessage\(error: unknown, isArabic: boolean\) \{[\s\S]*?\n\}\s*$/,
          `export function employeeErrorMessage(error: unknown, isArabic: boolean) {
  return friendlyDatabaseErrorMessage(error, isArabic, "employee");
}
`,
          "employee duplicate and payroll error translation",
        );
        return { code, map: null };
      }

      return null;
    },
  };
}
