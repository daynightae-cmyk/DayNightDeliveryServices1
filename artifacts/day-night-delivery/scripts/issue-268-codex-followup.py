from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"PATCHED {label}")


workspace = ROOT / "artifacts/day-night-delivery/src/components/admin/AdminSectionWorkspace.tsx"
bulk = ROOT / "artifacts/day-night-delivery/src/components/admin/AdminOrderBulkOperations.tsx"
complete = ROOT / "artifacts/day-night-delivery/src/components/admin/AdminSectionWorkspaceComplete.tsx"
gate = ROOT / "artifacts/day-night-delivery/scripts/personal-orders-admin-gate.mjs"

replace_once(
    workspace,
    "        <AdminSectionWorkspaceComplete {...props} orders={renderedWorkspaceOrders} />",
    """        <AdminSectionWorkspaceComplete
          {...props}
          orders={workspaceOrders}
          renderedOrders={renderedWorkspaceOrders}
        />""",
    "workspace passes full aggregates plus paged rows",
)

replace_once(
    bulk,
    'import { useMemo, useState } from "react";',
    'import { useEffect, useMemo, useState } from "react";',
    "bulk selector imports useEffect",
)
replace_once(
    bulk,
    "  const selectorRows = orders.slice(selectorStart, selectorStart + SELECTOR_PAGE_SIZE);\n",
    """  const selectorRows = orders.slice(selectorStart, selectorStart + SELECTOR_PAGE_SIZE);

  useEffect(() => {
    if (selectorPage !== selectorSafePage) setSelectorPage(selectorSafePage);
  }, [selectorPage, selectorSafePage]);
""",
    "bulk selector page synchronization",
)

replace_once(
    complete,
    "  orders: Order[];\n  merchants: Merchant[];",
    "  orders: Order[];\n  renderedOrders?: Order[];\n  merchants: Merchant[];",
    "workspace complete renderedOrders prop",
)
replace_once(
    complete,
    "  orders,\n  merchants,",
    "  orders,\n  renderedOrders,\n  merchants,",
    "workspace complete renderedOrders destructuring",
)
replace_once(
    complete,
    """  const liveOrders = useMemo(
    () =>
      orders.map((order) => {
        const override = statusOverrides[String(order.id || tracking(order))];
        return override && canonicalStatus(order.status) !== override
          ? { ...order, status: override }
          : order;
      }),
    [orders, statusOverrides],
  );
""",
    """  const liveOrders = useMemo(
    () =>
      orders.map((order) => {
        const override = statusOverrides[String(order.id || tracking(order))];
        return override && canonicalStatus(order.status) !== override
          ? { ...order, status: override }
          : order;
      }),
    [orders, statusOverrides],
  );

  const renderedLiveOrders = useMemo(
    () =>
      (renderedOrders || orders).map((order) => {
        const override = statusOverrides[String(order.id || tracking(order))];
        return override && canonicalStatus(order.status) !== override
          ? { ...order, status: override }
          : order;
      }),
    [orders, renderedOrders, statusOverrides],
  );
""",
    "workspace complete full and rendered live orders",
)
replace_once(
    complete,
    """  const baseRows = useMemo(
    () => liveOrders.filter((order) => matchesAdminSection(order, id)),
    [id, liveOrders],
  );

  const rows = useMemo(
    () =>
      baseRows
        .filter((order) => !query || orderSearchText(order).includes(normalize(query)))
        .slice(0, 200),
    [baseRows, query],
  );
""",
    """  const baseRows = useMemo(
    () => liveOrders.filter((order) => matchesAdminSection(order, id)),
    [id, liveOrders],
  );

  const renderedBaseRows = useMemo(
    () => renderedLiveOrders.filter((order) => matchesAdminSection(order, id)),
    [id, renderedLiveOrders],
  );

  const searchedRows = useMemo(
    () =>
      baseRows.filter(
        (order) => !query || orderSearchText(order).includes(normalize(query)),
      ),
    [baseRows, query],
  );

  const rows = useMemo(
    () => (query ? searchedRows : renderedBaseRows).slice(0, 200),
    [query, renderedBaseRows, searchedRows],
  );

  const pdfRows = useMemo(() => searchedRows.slice(0, 200), [searchedRows]);
""",
    "workspace complete global aggregates and bounded rendering",
)
replace_once(
    complete,
    "    rows: rows.map((order) => {",
    "    rows: pdfRows.map((order) => {",
    "workspace complete PDF uses full searched result set",
)

replace_once(
    gate,
    'expect(bulk, /<details[^>]+open>/, "order selector stays open");',
    'expect(bulk, /<details[^>]+open>/, "order selector stays open");\nexpect(bulk, /selectorPage !== selectorSafePage[\\s\\S]*setSelectorPage\\(selectorSafePage\\)/, "selector page resets after filtering");',
    "gate protects selector page synchronization",
)
replace_once(
    gate,
    'expect(workspace, /const workspaceOrders = filteredOrders/, "selection no longer hides unselected rows");',
    'expect(workspace, /const workspaceOrders = filteredOrders/, "selection no longer hides unselected rows");\nexpect(workspace, /orders=\\{workspaceOrders\\}[\\s\\S]*renderedOrders=\\{renderedWorkspaceOrders\\}/, "workspace preserves full aggregates and pages rendered rows");',
    "gate protects aggregate and rendering split",
)

print("Issue #268 Codex review follow-up patch completed.")
