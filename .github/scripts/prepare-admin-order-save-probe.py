from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
REVIEWED = "origin/fix/admin-order-save-real-edits-20260802"


def show(path: str) -> str:
    return subprocess.check_output(
        ["git", "show", f"{REVIEWED}:{path}"],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
    )


for relative in (
    "supabase/migrations/20260802102000_admin_complete_order_legacy_validation_hotfix.sql",
    "supabase/migrations/20260802103000_admin_complete_order_sender_identity_fallback.sql",
    "supabase/migrations/20260802104000_admin_complete_order_save_compatibility_alias.sql",
):
    target = ROOT / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(show(relative), encoding="utf-8")
    print(f"PASS restored {relative}")

probe_source = show(".github/scripts/admin-complete-order-save-production-probe.mjs")

probe_source, count = re.subn(
    r"  const \{ data: reviewedOrder, error: reviewedError \} = await supabase[\s\S]*?  assert\(reviewedOrder\?\.merchant_id, 'production_save_probe_requires_merchant_order'\);",
    """  const { data: reviewedRows, error: reviewedError } = await supabase
    .from('orders')
    .select('*')
    .not('merchant_id', 'is', null)
    .not('coupon_number', 'is', null)
    .order('created_at', { ascending: false })
    .limit(250);
  if (reviewedError) {
    throw new Error(`production_save_probe_order_lookup_failed: ${errorDetail(reviewedError)}`);
  }
  const reviewedOrder = (reviewedRows || []).find(
    (row) => row?.id && row?.merchant_id && text(row?.coupon_number),
  );
  assert(reviewedOrder?.id, 'production_save_probe_order_missing');
  assert(reviewedOrder?.merchant_id, 'production_save_probe_requires_merchant_order');""",
    probe_source,
    count=1,
)
if count != 1:
    raise SystemExit(f"reviewed order patch failed: {count}")

probe_source, count = re.subn(
    r"  const \{ data: links, error: linksError \} = await supabase[\s\S]*?    \.limit\(500\);",
    """  const { data: links, error: linksError } = await supabase
    .from('merchant_user_links')
    .select('*')
    .limit(500);""",
    probe_source,
    count=1,
)
if count != 1:
    raise SystemExit(f"merchant link query patch failed: {count}")

probe_source, count = re.subn(
    r"  const linkedIds = Array\.from\([\s\S]*?\n  \);",
    """  const linkedIds = Array.from(
    new Set(
      (links || [])
        .filter((row) => row.is_active ?? row.active ?? true)
        .map((row) => text(row.merchant_id))
        .filter(Boolean),
    ),
  );""",
    probe_source,
    count=1,
)
if count != 1:
    raise SystemExit(f"linked merchant id patch failed: {count}")

probe = ROOT / ".github/scripts/admin-complete-order-real-edit-production-probe.mjs"
probe.write_text(probe_source, encoding="utf-8")
print("PASS prepared rollback-safe production real-edit probe")
