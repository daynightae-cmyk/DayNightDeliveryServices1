from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PERSISTENCE = ROOT / "artifacts/day-night-delivery/src/lib/adminOrderEditPersistence.ts"
EDITOR = ROOT / "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx"

source = PERSISTENCE.read_text(encoding="utf-8")

old = '''function isMissingFinancialUpdateRuntime(error: unknown) {
  const detail = errorDetail(error).toLowerCase();
  if (
    /not_authorized|permission denied|row-level security|financials_locked|delivered settlements are locked/.test(
      detail,
    )
  ) {
    return false;
  }
  return /admin_update_order_with_financials|pgrst202|schema cache|could not find the function|function .* does not exist|migration/.test(
    detail,
  );
}

function isMissingCompleteEditRuntime(error: unknown) {
  const detail = errorDetail(error).toLowerCase();
  return /admin_update_order_complete_verified|pgrst202|could not find the function|function .* does not exist|schema cache/.test(
    detail,
  );
}
'''

new = '''function databaseErrorCode(error: unknown) {
  return clean((error as { code?: string })?.code).toUpperCase();
}

function isMissingRpcRuntime(error: unknown, functionNames: readonly string[]) {
  const code = databaseErrorCode(error);
  if (code === "PGRST202" || code === "42883") return true;

  const detail = errorDetail(error).toLowerCase();
  return functionNames.some((functionName) => {
    const bare = functionName.toLowerCase();
    const qualified = `public.${bare}`;
    return (
      detail.includes(`could not find the function ${bare}`) ||
      detail.includes(`could not find the function ${qualified}`) ||
      (detail.includes(`function ${bare}`) && detail.includes("does not exist")) ||
      (detail.includes(`function ${qualified}`) && detail.includes("does not exist"))
    );
  });
}

function isMissingFinancialUpdateRuntime(error: unknown) {
  return isMissingRpcRuntime(error, ["admin_update_order_with_financials"]);
}

function isMissingCompleteEditRuntime(error: unknown) {
  return isMissingRpcRuntime(error, [
    "admin_update_order_complete_verified_v2",
    "admin_update_order_complete_verified",
  ]);
}
'''

if old not in source:
    raise SystemExit("expected broad runtime classification block was not found")

source = source.replace(old, new, 1)
PERSISTENCE.write_text(source, encoding="utf-8")
print("PASS: precise RPC-missing classification applied")

editor = EDITOR.read_text(encoding="utf-8")
old_error_rule = '''  if (/pgrst202|schema cache|could not find the function|runtime_missing|does not exist/.test(reason)) {
    return isArabic
      ? "خدمة حفظ التعديلات غير متاحة في نسخة قاعدة البيانات الحالية. حدّث الصفحة بعد اكتمال تحديث قاعدة البيانات. لم يُحفظ أي تعديل جزئي."
      : "The complete-save service is unavailable in the current database version. Refresh after the database update completes. No partial change was stored.";
  }
'''
new_error_rule = '''  if (
    /pgrst202|runtime_missing|could not find the function (public\\.)?admin_update_order_(complete_verified(_v2)?|with_financials)|function (public\\.)?admin_update_order_(complete_verified(_v2)?|with_financials).*does not exist/.test(
      reason,
    )
  ) {
    return isArabic
      ? "خدمة حفظ التعديلات غير متاحة حاليًا بسبب عدم اكتمال مكوّن قاعدة البيانات المسؤول عن الحفظ. لم يُحفظ أي تعديل جزئي."
      : "The order-save database component is currently unavailable. No partial change was stored.";
  }
'''
if old_error_rule not in editor:
    raise SystemExit("expected broad professional runtime error rule was not found")
editor = editor.replace(old_error_rule, new_error_rule, 1)
EDITOR.write_text(editor, encoding="utf-8")
print("PASS: precise professional Arabic runtime message mapping applied")
