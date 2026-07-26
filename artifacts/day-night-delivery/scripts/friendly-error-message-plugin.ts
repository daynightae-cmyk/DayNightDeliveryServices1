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
    name: "day-night-friendly-error-messages-v1",
    enforce: "pre",
    transform(source, id) {
      const normalized = id.replace(/\\/g, "/").split("?")[0];

      if (normalized.endsWith("/src/lib/adminOperationsData.ts")) {
        let code = addImport(
          source,
          'import { createDayNightInvoiceNumber } from "./printableDocuments";',
          'import { currentUiIsArabic, friendlyDatabaseErrorMessage } from "./friendlyErrorMessage";',
          "admin operations friendly-error import",
        );

        code = replaceRequired(
          code,
          /export function opsErrorDetail\(error: unknown\) \{[\s\S]*?\n\}\n\nfunction operationsError\(error: unknown, fallback: string\) \{[\s\S]*?\n\}\n\nasync function rpcOne/,
          `export function opsErrorDetail(error: unknown) {
  return friendlyDatabaseErrorMessage(error, currentUiIsArabic(), "operation");
}

function operationsError(error: unknown, fallback: string) {
  const record = error as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
    constraint?: string;
    dbDetail?: string;
  };
  const technicalDetail = [
    record?.dbDetail,
    record?.message,
    record?.details,
    record?.hint,
    record?.code,
    record?.constraint,
  ]
    .map(clean)
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(" | ");

  if (technicalDetail) console.warn("Admin operations DB detail:", technicalDetail);

  const wrapped = new Error(
    friendlyDatabaseErrorMessage(error, currentUiIsArabic(), "operation", fallback),
  ) as Error & { dbDetail?: string };
  wrapped.dbDetail = technicalDetail;
  return wrapped;
}

async function rpcOne`,
          "admin operations technical-to-friendly error conversion",
        );
        return { code, map: null };
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
