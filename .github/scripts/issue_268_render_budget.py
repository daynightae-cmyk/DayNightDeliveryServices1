from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


bulk_path = Path("artifacts/day-night-delivery/src/components/admin/AdminOrderBulkOperations.tsx")
bulk = bulk_path.read_text()
bulk = replace_once(
    bulk,
    'import { useMemo } from "react";',
    'import { useMemo, useState } from "react";',
    "bulk import",
)
bulk = replace_once(
    bulk,
    'const clean = (value: unknown) => String(value ?? "").trim();',
    'const SELECTOR_PAGE_SIZE = 30;\nconst clean = (value: unknown) => String(value ?? "").trim();',
    "bulk page constant",
)
bulk = replace_once(
    bulk,
    '  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);',
    '  const [selectorOpen, setSelectorOpen] = useState(false);\n'
    '  const [selectorPage, setSelectorPage] = useState(0);\n'
    '  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);',
    "bulk selector state",
)
bulk = replace_once(
    bulk,
    '  const selectedPayload = useMemo(() => makePayload(selectedOrders.length ? selectedOrders : orders, isArabic, sectionId, selectedOrders.length > 0), [isArabic, orders, sectionId, selectedOrders]);\n'
    '  const allPayload = useMemo(() => makePayload(orders, isArabic, sectionId, false), [isArabic, orders, sectionId]);\n'
    '  const printRows = selectedOrders.length ? selectedOrders : orders;',
    '  const allPayload = useMemo(() => makePayload(orders, isArabic, sectionId, false), [isArabic, orders, sectionId]);\n'
    '  const selectedPayload = useMemo(\n'
    '    () => selectedOrders.length ? makePayload(selectedOrders, isArabic, sectionId, true) : allPayload,\n'
    '    [allPayload, isArabic, sectionId, selectedOrders],\n'
    '  );\n'
    '  const printRows = selectedOrders.length ? selectedOrders : orders;\n'
    '  const selectorPageCount = Math.max(1, Math.ceil(orders.length / SELECTOR_PAGE_SIZE));\n'
    '  const selectorSafePage = Math.min(selectorPage, selectorPageCount - 1);\n'
    '  const selectorStart = selectorSafePage * SELECTOR_PAGE_SIZE;\n'
    '  const selectorRows = selectorOpen ? orders.slice(selectorStart, selectorStart + SELECTOR_PAGE_SIZE) : [];',
    "bulk payload model",
)

bulk_pattern = re.compile(
    r'      <details className="dn-admin-bulk-selector" open>[\s\S]*?      </details>'
)
bulk_replacement = '''      <details
        className="dn-admin-bulk-selector"
        open={selectorOpen}
        onToggle={(event) => setSelectorOpen(event.currentTarget.open)}
      >
        <summary>
          <FileDown className="inline h-4 w-4" />{" "}
          {isArabic ? "اختيار الطلبات بالاسم ورقم التتبع" : "Choose orders by name and tracking"}
        </summary>
        {selectorOpen && (
          <>
            <div className="dn-admin-bulk-selector-list">
              {selectorRows.map((order) => {
                const id = orderId(order);
                const checked = selected.has(id);
                return (
                  <button
                    type="button"
                    className={`dn-admin-bulk-order-option ${checked ? "is-selected" : ""}`}
                    key={id}
                    onClick={() => toggle(order)}
                    aria-pressed={checked}
                  >
                    {checked ? <CheckSquare2 className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                    <span>
                      <strong dir="ltr">{reference(order)}</strong>
                      <small>
                        {clean(order.merchant_name || order.sender_name) || "—"} ·{" "}
                        {clean(order.receiver_name || order.customer_name) || "—"}
                      </small>
                    </span>
                    <em>{statusLabel(order.status, isArabic)}</em>
                  </button>
                );
              })}
              {!orders.length && (
                <p>{isArabic ? "لا توجد طلبات مطابقة للفلاتر الحالية." : "No orders match the current filters."}</p>
              )}
            </div>
            {selectorPageCount > 1 && (
              <div className="dn-admin-order-pagination">
                <span>{isArabic ? "صفحة" : "Page"} {selectorSafePage + 1} / {selectorPageCount}</span>
                <div>
                  <button type="button" disabled={selectorSafePage === 0} onClick={() => setSelectorPage((value) => Math.max(0, value - 1))}>
                    {isArabic ? "السابق" : "Previous"}
                  </button>
                  <button type="button" disabled={selectorSafePage >= selectorPageCount - 1} onClick={() => setSelectorPage((value) => Math.min(selectorPageCount - 1, value + 1))}>
                    {isArabic ? "التالي" : "Next"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </details>'''
bulk, count = bulk_pattern.subn(bulk_replacement, bulk, count=1)
if count != 1:
    raise SystemExit(f"bulk selector: expected one match, found {count}")
bulk_path.write_text(bulk)

complete_path = Path("artifacts/day-night-delivery/src/components/admin/AdminSectionWorkspaceComplete.tsx")
complete = complete_path.read_text()
complete = replace_once(
    complete,
    "const ORDER_STATUS_VALUES = new Set(orderStatusOptions.map((option) => option.value));",
    "const ORDER_STATUS_VALUES = new Set(orderStatusOptions.map((option) => option.value));\nconst ORDER_PAGE_SIZE = 20;",
    "table page constant",
)
complete = replace_once(
    complete,
    '  const [query, setQuery] = useState("");',
    '  const [query, setQuery] = useState("");\n  const [page, setPage] = useState(0);',
    "table page state",
)
complete = replace_once(
    complete,
    '    setQuery("");\n    setNotice("");',
    '    setQuery("");\n    setPage(0);\n    setNotice("");',
    "table page reset",
)
old_rows = '''  const rows = useMemo(
    () =>
      baseRows
        .filter((order) => !query || orderSearchText(order).includes(normalize(query)))
        .slice(0, 200),
    [baseRows, query],
  );'''
new_rows = '''  const filteredRows = useMemo(
    () => baseRows.filter((order) => !query || orderSearchText(order).includes(normalize(query))),
    [baseRows, query],
  );
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / ORDER_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = useMemo(
    () => filteredRows.slice(safePage * ORDER_PAGE_SIZE, (safePage + 1) * ORDER_PAGE_SIZE),
    [filteredRows, safePage],
  );

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);'''
complete = replace_once(complete, old_rows, new_rows, "table paginated rows")
complete = replace_once(
    complete,
    "      visible: String(rows.length),",
    "      visible: String(filteredRows.length),",
    "pdf visible total",
)
complete = replace_once(
    complete,
    "    rows: rows.map((order) => {",
    "    rows: filteredRows.map((order) => {",
    "pdf all filtered rows",
)
complete = replace_once(
    complete,
    '                onChange={(event) => setQuery(event.target.value)}',
    '                onChange={(event) => { setQuery(event.target.value); setPage(0); }}',
    "query resets page",
)
complete = replace_once(
    complete,
    '        {notice && <p className="dn-clean-note">{notice}</p>}\n        <div className="dn-section-table-wrap">',
    '''        {notice && <p className="dn-clean-note">{notice}</p>}
        {filteredRows.length > 0 && (
          <div className="dn-admin-order-pagination">
            <span>
              {isArabic ? "عرض" : "Showing"} {safePage * ORDER_PAGE_SIZE + 1}–{Math.min((safePage + 1) * ORDER_PAGE_SIZE, filteredRows.length)} / {filteredRows.length}
            </span>
            <div>
              <button type="button" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
                {isArabic ? "السابق" : "Previous"}
              </button>
              <strong>{safePage + 1} / {pageCount}</strong>
              <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>
                {isArabic ? "التالي" : "Next"}
              </button>
            </div>
          </div>
        )}
        <div className="dn-section-table-wrap">''',
    "table pagination controls",
)
complete = replace_once(
    complete,
    "          {!rows.length && (",
    "          {!filteredRows.length && (",
    "empty state source",
)
complete = replace_once(
    complete,
    '<button type="button" onClick={() => setQuery("")}>',
    '<button type="button" onClick={() => { setQuery(""); setPage(0); }}>',
    "clear query page",
)
complete_path.write_text(complete)

css_path = Path("artifacts/day-night-delivery/src/styles/dn-admin-inp-acceptance.css")
css = css_path.read_text()
marker = "/* Phase 4 render-budget optimization. */"
if marker in css:
    raise SystemExit("render budget marker already present")
css += r'''

/* Phase 4 render-budget optimization. */
.dn-admin-fullscreen .dn-section-table-card,
.dn-admin-fullscreen .dn-admin-bulk-console,
.dn-admin-fullscreen .dn-section-panels > article,
.dn-admin-fullscreen .dn-section-kpis > article {
  contain: layout paint style;
}

.dn-admin-fullscreen .dn-section-table-wrap tbody tr {
  content-visibility: auto;
  contain-intrinsic-size: 132px;
}

.dn-admin-order-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 12px 0;
  padding: 10px 12px;
  border: 1px solid rgba(212, 175, 55, 0.24);
  border-radius: 14px;
  background: rgba(4, 20, 42, 0.72);
  font-size: 12px;
  font-weight: 800;
}

.dn-admin-order-pagination > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dn-admin-order-pagination button {
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  font-weight: 800;
}

.dn-admin-order-pagination button:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .dn-admin-fullscreen .dncc-mobile-layer,
  .dn-admin-fullscreen .dncc-mobile-backdrop,
  .dn-admin-fullscreen .dncc-mobile-drawer,
  .dn-admin-fullscreen .abu-khalifa-flyout,
  .dn-admin-fullscreen .abu-khalifa-launcher,
  .dn-admin-fullscreen .dn-section-workspace,
  .dn-admin-fullscreen .dn-section-table-card,
  .dn-admin-fullscreen .dn-admin-bulk-console,
  .dn-admin-fullscreen .dn-section-panels > article,
  .dn-admin-fullscreen .dn-section-kpis > article {
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
    filter: none !important;
  }

  .dn-admin-fullscreen .dncc-mobile-drawer,
  .dn-admin-fullscreen .abu-khalifa-flyout,
  .dn-admin-fullscreen .dn-section-workspace,
  .dn-admin-fullscreen .dn-section-table-card,
  .dn-admin-fullscreen .dn-admin-bulk-console {
    transition-duration: 80ms !important;
    animation-duration: 120ms !important;
    box-shadow: none !important;
  }

  .dn-admin-order-pagination {
    align-items: stretch;
    flex-direction: column;
  }

  .dn-admin-order-pagination > div {
    justify-content: space-between;
  }
}
'''
css_path.write_text(css)

Path(".github/scripts/issue_268_render_budget.py").unlink()
Path(".github/workflows/issue-268-render-budget-generator.yml").unlink()
