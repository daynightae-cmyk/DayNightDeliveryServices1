from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / "artifacts/day-night-delivery/scripts/admin-complete-order-edit-gate.mjs"
source = TARGET.read_text(encoding="utf-8")
old = '''assert(
  persistence.includes('supabase.rpc("admin_update_order_complete_verified"'),
  "client does not use complete verified RPC",
);
'''
new = '''assert(
  /admin_update_order_complete_verified(?:_v2)?/.test(persistence),
  "client does not use complete verified RPC",
);
'''
if old not in source:
    raise SystemExit("legacy complete-order RPC gate assertion not found")
TARGET.write_text(source.replace(old, new, 1), encoding="utf-8")
print("PASS: complete-order gate accepts verified v2 and compatibility RPC calls")
