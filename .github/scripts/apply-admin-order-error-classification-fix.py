from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / "artifacts/day-night-delivery/src/lib/adminOrderEditPersistence.ts"

source = TARGET.read_text(encoding="utf-8")

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
TARGET.write_text(source, encoding="utf-8")
print("PASS: precise RPC-missing classification applied")
