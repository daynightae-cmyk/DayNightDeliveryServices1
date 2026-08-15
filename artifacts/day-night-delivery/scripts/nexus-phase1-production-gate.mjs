import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(`NEXUS_PHASE1_GATE_FAILED: ${message}`);
};

const componentPath = 'src/components/admin/AdminNexusControlTower.tsx';
const entryPath = 'src/components/admin/AdminNexusEntry.tsx';
const routeBridgePath = 'src/components/admin/AdminNexusRouteBridge.tsx';
const enginePath = 'src/lib/nexusRiskEngine.ts';
const stylePath = 'src/styles/dn-nexus-control-tower.css';
const launcherStylePath = 'src/styles/dn-nexus-command-launcher.css';
const mainPath = 'src/main.tsx';

for (const file of [
  componentPath,
  entryPath,
  routeBridgePath,
  enginePath,
  stylePath,
  launcherStylePath,
  mainPath,
]) {
  assert(fs.existsSync(path.join(root, file)), `missing ${file}`);
}

const component = read(componentPath);
const entry = read(entryPath);
const routeBridge = read(routeBridgePath);
const engine = read(enginePath);
const styles = read(stylePath);
const launcherStyles = read(launcherStylePath);
const main = read(mainPath);

const requiredComponentContracts = [
  'fetchAdminOrders()',
  'fetchMerchants()',
  'fetchFinanceSummary()',
  'buildNexusSnapshot(',
  '<AdminLiveOperationsMap',
  'table: "orders"',
  'table: "cod_collections"',
  '30_000',
  'dn-nexus-launcher',
  'dn-nexus-risk-totals',
  'dn-nexus-actions-card',
  'dn-nexus-finance-card',
  'No demo data is used.',
];
for (const contract of requiredComponentContracts) {
  assert(component.includes(contract), `component contract missing: ${contract}`);
}

for (const contract of [
  '.dncc-navigation',
  'findVisibleCommandNavigation',
  'dn-nexus-command-launcher',
  'window.innerWidth <= 980',
  'triggerNexusControlTower',
]) {
  assert(entry.includes(contract), `active command-center launcher contract missing: ${contract}`);
}

for (const contract of [
  'lazy(() => import("./AdminNexusEntry"))',
  'isAdminLocation',
  '/^\\/admin(?:\\/|$)/i',
  'window.setInterval(sync, 500)',
  '<AdminNexusEntry />',
]) {
  assert(routeBridge.includes(contract), `SPA-aware route bridge contract missing: ${contract}`);
}

const forbiddenDirectWrites = [
  '.insert(',
  '.update(',
  '.delete(',
  '.upsert(',
  'updateOrderStatus(',
  'createAdminOrder(',
  'markCodCollected(',
  'markCodReconciled(',
];
for (const forbidden of forbiddenDirectWrites) {
  assert(!component.includes(forbidden), `direct write detected in control tower: ${forbidden}`);
  assert(!engine.includes(forbidden), `direct write detected in risk engine: ${forbidden}`);
  assert(!entry.includes(forbidden), `direct write detected in launcher bridge: ${forbidden}`);
  assert(!routeBridge.includes(forbidden), `direct write detected in route bridge: ${forbidden}`);
}

const requiredRiskContracts = [
  'financial_posted_at',
  'normalizeOrderStatus(',
  'isInternationalAdminOrder(',
  'createdAge >= 2',
  'age >= 8',
  'age >= 24',
  '<= 0.5',
  'cod_pending',
  'driver_visibility',
  'Asia/Dubai',
  'buildNexusSnapshot(',
];
for (const contract of requiredRiskContracts) {
  assert(engine.includes(contract), `risk contract missing: ${contract}`);
}

assert(
  main.includes('import AdminNexusRouteBridge from "./components/admin/AdminNexusRouteBridge";'),
  'main must mount the lightweight NEXUS route bridge',
);
assert(main.includes('<AdminNexusRouteBridge />'), 'main must render the NEXUS route bridge');
assert(!main.includes('import AdminNexusEntry from'), 'eager NEXUS entry import detected');
assert(!main.includes('import AdminNexusControlTower from'), 'eager NEXUS control tower import detected');
assert(!main.includes('lazy(() => import("./components/admin/AdminNexusEntry"))'), 'NEXUS lazy loading must live inside the SPA-aware route bridge');

for (const breakpoint of ['max-width: 1360px', 'max-width: 1050px', 'max-width: 760px', 'max-width: 430px']) {
  assert(styles.includes(breakpoint), `responsive contract missing: ${breakpoint}`);
}
assert(styles.includes('100dvh'), 'mobile safe viewport contract missing');
assert(styles.includes('prefers-reduced-motion'), 'reduced-motion contract missing');
assert(launcherStyles.includes('safe-area-inset-bottom'), 'mobile launcher safe-area contract missing');
assert(launcherStyles.includes('.dncc-shell[data-theme="light"]'), 'light command-center launcher contract missing');

console.log('NEXUS Phase 1 production gate: PASS');
console.log('  - real Admin orders / merchants / finance sources required');
console.log('  - Risk Radar thresholds and financial-posting checks present');
console.log('  - Action Queue is navigation/recommendation only');
console.log('  - no direct order/finance write primitives detected');
console.log('  - active Command Center + mobile launcher enforced');
console.log('  - SPA-aware Admin-only lazy loading enforced');
console.log('  - responsive/mobile contracts present');
