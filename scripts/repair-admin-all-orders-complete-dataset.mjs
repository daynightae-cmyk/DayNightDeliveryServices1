import fs from "node:fs";

function patchFile(path, patches) {
  let source = fs.readFileSync(path, "utf8");
  let changed = false;

  for (const { label, before, after } of patches) {
    if (source.includes(after)) continue;
    const matches = source.split(before).length - 1;
    if (matches !== 1) {
      throw new Error(`${label}: expected exactly one source match, found ${matches}`);
    }
    source = source.replace(before, after);
    changed = true;
  }

  if (changed) fs.writeFileSync(path, source);
  return changed;
}

const workspacePath =
  "artifacts/day-night-delivery/src/components/admin/AdminSectionWorkspace.tsx";
const legacyPath =
  "artifacts/day-night-delivery/src/components/admin/AdminSectionWorkspaceCompleteLegacy.tsx";

const workspaceChanged = patchFile(workspacePath, [
  {
    label: "pass complete filtered dataset separately from rendered page",
    before: `        <AdminSectionWorkspaceComplete
          {...props}
          orders={renderedWorkspaceOrders}
          merchants={effectiveMerchants}
          onRefresh={refreshCurrentWorkspace}
          searchManaged={showBulkConsole}
        />`,
    after: `        <AdminSectionWorkspaceComplete
          {...props}
          orders={renderedWorkspaceOrders}
          allOrders={visibleSectionOrders}
          merchants={effectiveMerchants}
          onRefresh={refreshCurrentWorkspace}
          searchManaged={showBulkConsole}
        />`,
  },
]);

const legacyChanged = patchFile(legacyPath, [
  {
    label: "declare complete order dataset prop",
    before: `  orders: Order[];
  merchants: Merchant[];`,
    after: `  orders: Order[];
  allOrders?: Order[];
  merchants: Merchant[];`,
  },
  {
    label: "receive complete order dataset prop",
    before: `  orders,
  merchants,`,
    after: `  orders,
  allOrders,
  merchants,`,
  },
  {
    label: "separate rendered page rows from complete filtered rows",
    before: `  const liveOrders = useMemo(
    () =>
      orders.map((order) => {
        const override = statusOverrides[String(order.id || tracking(order))];
        return override && canonicalStatus(order.status) !== override
          ? { ...order, status: override }
          : order;
      }),
    [orders, statusOverrides],
  );

  const baseRows = useMemo(
    () => liveOrders.filter((order) => matchesAdminSection(order, id)),
    [id, liveOrders],
  );

  const rows = useMemo(
    () => searchManaged ? baseRows : baseRows.filter((order) => !query || orderSearchText(order).includes(normalize(query))),
    [baseRows, query, searchManaged],
  );

  const couponCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const order of liveOrders) {
      const couponKey = normalize(order.coupon_number);
      if (!couponKey) continue;
      counts.set(couponKey, (counts.get(couponKey) || 0) + 1);
    }
    return counts;
  }, [liveOrders]);`,
    after: `  const liveOrders = useMemo(
    () =>
      orders.map((order) => {
        const override = statusOverrides[String(order.id || tracking(order))];
        return override && canonicalStatus(order.status) !== override
          ? { ...order, status: override }
          : order;
      }),
    [orders, statusOverrides],
  );

  const liveAllOrders = useMemo(
    () =>
      (allOrders ?? orders).map((order) => {
        const override = statusOverrides[String(order.id || tracking(order))];
        return override && canonicalStatus(order.status) !== override
          ? { ...order, status: override }
          : order;
      }),
    [allOrders, orders, statusOverrides],
  );

  const baseRows = useMemo(
    () => liveOrders.filter((order) => matchesAdminSection(order, id)),
    [id, liveOrders],
  );

  const allBaseRows = useMemo(
    () => liveAllOrders.filter((order) => matchesAdminSection(order, id)),
    [id, liveAllOrders],
  );

  const rows = useMemo(
    () => searchManaged ? baseRows : baseRows.filter((order) => !query || orderSearchText(order).includes(normalize(query))),
    [baseRows, query, searchManaged],
  );

  const allRows = useMemo(
    () => searchManaged ? allBaseRows : allBaseRows.filter((order) => !query || orderSearchText(order).includes(normalize(query))),
    [allBaseRows, query, searchManaged],
  );

  const couponCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const order of liveAllOrders) {
      const couponKey = normalize(order.coupon_number);
      if (!couponKey) continue;
      counts.set(couponKey, (counts.get(couponKey) || 0) + 1);
    }
    return counts;
  }, [liveAllOrders]);`,
  },
  {
    label: "finance receives complete order dataset",
    before: `        orders={liveOrders}`,
    after: `        orders={liveAllOrders}`,
  },
  {
    label: "company revenue uses complete filtered dataset",
    before: `  const deliveryIncome = baseRows.reduce(`,
    after: `  const deliveryIncome = allRows.reduce(`,
  },
  {
    label: "customer totals use complete filtered dataset",
    before: `  const customerExposure = baseRows.reduce(`,
    after: `  const customerExposure = allRows.reduce(`,
  },
  {
    label: "merchant totals use complete filtered dataset",
    before: `  const merchantExposure = baseRows.reduce(`,
    after: `  const merchantExposure = allRows.reduce(`,
  },
  {
    label: "pdf total count uses complete section dataset",
    before: `      orders: String(baseRows.length),`,
    after: `      orders: String(allBaseRows.length),`,
  },
  {
    label: "pdf visible count uses complete filtered dataset",
    before: `      visible: String(rows.length),`,
    after: `      visible: String(allRows.length),`,
  },
  {
    label: "pdf exports complete filtered dataset",
    before: `    rows: rows.map((order) => {`,
    after: `    rows: allRows.map((order) => {`,
  },
  {
    label: "all-orders KPI uses complete dataset count",
    before: `          <strong>{baseRows.length}</strong>`,
    after: `          <strong>{allBaseRows.length}</strong>`,
  },
]);

const workspace = fs.readFileSync(workspacePath, "utf8");
const legacy = fs.readFileSync(legacyPath, "utf8");

const required = [
  [workspace.includes("allOrders={visibleSectionOrders}"), "workspace complete dataset prop"],
  [legacy.includes("allOrders?: Order[];"), "legacy complete dataset type"],
  [legacy.includes("const liveAllOrders = useMemo("), "complete live rows"],
  [legacy.includes("const allBaseRows = useMemo("), "complete section rows"],
  [legacy.includes("const allRows = useMemo("), "complete filtered rows"],
  [legacy.includes("rows: allRows.map((order) => {"), "complete PDF rows"],
  [legacy.includes("<strong>{allBaseRows.length}</strong>"), "complete KPI count"],
];

for (const [ok, label] of required) {
  if (!ok) throw new Error(`repair verification failed: ${label}`);
}

console.log(
  JSON.stringify(
    {
      workspaceChanged,
      legacyChanged,
      repaired: workspaceChanged || legacyChanged,
    },
    null,
    2,
  ),
);
