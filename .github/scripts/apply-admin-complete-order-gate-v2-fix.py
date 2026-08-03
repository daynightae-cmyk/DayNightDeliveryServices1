from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / "artifacts/day-night-delivery/scripts/admin-complete-order-edit-gate.mjs"
source = TARGET.read_text(encoding="utf-8")

old_rpc = '''assert(
  persistence.includes('supabase.rpc("admin_update_order_complete_verified"'),
  "client does not use complete verified RPC",
);
'''
new_rpc = '''assert(
  /admin_update_order_complete_verified(?:_v2)?/.test(persistence),
  "client does not use complete verified RPC",
);
'''
if old_rpc not in source:
    raise SystemExit("legacy complete-order RPC gate assertion not found")
source = source.replace(old_rpc, new_rpc, 1)

old_messages = '''assert(
  modal.includes("رقم التتبع والفاتورة لا بيتغيروش"),
  "immutable order identity is not explained in the UI",
);
assert(
  modal.includes("العملية اتلغت بالكامل ومفيش تعديل جزئي"),
  "atomic rollback failure messaging source contract missing",
);

assert(
  friendlyPlugin.includes("complete order save exact rejection messages"),
  "complete editor is not converted to exact save rejection messages at build time",
);
assert(
  friendlyPlugin.includes("انتهت جلسة الإدارة") &&
    friendlyPlugin.includes("رقم الكوبون مستخدم بالفعل") &&
    friendlyPlugin.includes("التاجر المختار غير مرتبط") &&
    friendlyPlugin.includes("القيم المالية غير صالحة") &&
    friendlyPlugin.includes("يوجد تعارض في ملكية الطلب"),
  "specific Arabic save rejection categories are incomplete",
);
assert(
  friendlyPlugin.includes("لم يتم حفظ الطلب لأن قاعدة البيانات رفضت العملية") &&
    friendlyPlugin.includes("لم يحدث أي تعديل جزئي"),
  "unknown save rejection does not give a truthful non-generic fallback",
);
'''
new_messages = '''assert(
  modal.includes("لا يمكن تغيير رقم التتبع أو رقم الفاتورة من محرر البيانات"),
  "immutable order identity is not explained professionally in the UI",
);
assert(
  modal.includes("الحفظ ذري") && modal.includes("دون حفظ جزئي"),
  "atomic rollback messaging source contract missing",
);

assert(
  modal.includes("function professionalEditError") &&
    modal.includes("انتهت جلسة الإدارة") &&
    modal.includes("رقم الكوبون مستخدم في طلب آخر") &&
    modal.includes("تعذر اعتماد التاجر المختار") &&
    modal.includes("تعذر اعتماد القيم المالية") &&
    modal.includes("تم تعديل الطلب من عملية أخرى"),
  "specific professional Arabic save rejection categories are incomplete",
);
assert(
  modal.includes('data-admin-order-error-card="true"') &&
    modal.includes('data-admin-error-reference="true"') &&
    modal.includes("safeEditDiagnostic") &&
    modal.includes("editErrorReference") &&
    modal.includes("عرض السبب التشخيصي الدقيق"),
  "exact safe database diagnostics are not exposed in the editor",
);
assert(
  modal.includes("رفضت قاعدة البيانات العملية لسبب لم يُصنَّف بعد") &&
    modal.includes("أُلغيت العملية بالكامل دون حفظ جزئي"),
  "unknown save rejection does not give a truthful diagnostic fallback",
);
'''
if old_messages not in source:
    raise SystemExit("legacy colloquial complete-order message gate block not found")
source = source.replace(old_messages, new_messages, 1)

TARGET.write_text(source, encoding="utf-8")
print("PASS: complete-order gate accepts verified v2 RPC and professional diagnostics")
