from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / "artifacts/day-night-delivery/src/components/admin/AdminHistoryAutocomplete.tsx"
source = TARGET.read_text(encoding="utf-8")
old = '        input.dataset.adminSmartAutocompleteBound = "true";\n'
new = '        input.setAttribute("data-admin-smart-autocomplete-bound", "true");\n'
if old not in source:
    raise SystemExit("autocomplete binding assignment not found")
TARGET.write_text(source.replace(old, new, 1), encoding="utf-8")
print("PASS: autocomplete binding uses an explicit data attribute")
