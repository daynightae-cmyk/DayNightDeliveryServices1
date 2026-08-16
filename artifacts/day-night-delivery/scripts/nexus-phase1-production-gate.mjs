import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(`NEXUS_PHASE1_GATE_FAILED: ${message}`);
};

const componentPath = 'src/components/admin/AdminNexusControlTower.tsx';
const commandMapPath = 'src/components/admin/AdminNexusLiveCommandMap.tsx';
const orbitalMapPath = 'src/components/admin/AdminNexusOrbitalLiveCommandMap.tsx';
const orbitalResizerPath = 'src/components/admin/AdminNexusOrbitalLiveResizer.tsx';
const orbitalMapStylePath = 'src/styles/dn-nexus-orbital-live.css';
const mapboxPath = 'src/lib/nexusMapbox.ts';
const commandMapStylePath = 'src/styles/dn-nexus-live-command-map.css';
const entryPath = 'src/components/admin/AdminNexusEntry.tsx';
const routeBridgePath = 'src/components/admin/AdminNexusRouteBridge.tsx';
const enginePath = 'src/lib/nexusRiskEngine.ts';
const stylePath = 'src/styles/dn-nexus-control-tower.css';
const launcherStylePath = 'src/styles/dn-nexus-command-launcher.css';
const mainPath = 'src/main.tsx';
const packagePath = 'package.json';

for (const file of [
  componentPath,
  commandMapPath,
  orbitalMapPath,
  orbitalResizerPath,
  orbitalMapStylePath,
  mapboxPath,
  commandMapStylePath,
  entryPath,
  routeBridgePath,
  enginePath,
  stylePath,
  launcherStylePath,
  mainPath,
  packagePath,
]) {
  assert(fs.existsSync(path.join(root, file)), `missing ${file}`);
}

const component = read(componentPath);
const commandMap = read(commandMapPath);
const orbitalMap = read(orbitalMapPath);
const orbitalResizer = read(orbitalResizerPath);
const orbitalMapStyles = read(orbitalMapStylePath);
const mapbox = read(mapboxPath);
const commandMapStyles = read(commandMapStylePath);
const entry = read(entryPath);
const routeBridge = read(routeBridgePath);
const engine = read(enginePath);
const styles = read(stylePath);
const launcherStyles = read(launcherStylePath);
const main = read(mainPath);
const packageJson = read(packagePath);

const requiredComponentContracts = [
  'fetchAdminOrders()',
  'fetchMerchants()',
  'fetchFinanceSummary()',
  'buildNexusSnapshot(',
  '<AdminNexusLiveCommandMap',
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
  'AdminNexusOrbitalLiveResizer',
  'AdminNexusOrbitalLiveCommandMap',
]) {
  assert(commandMap.includes(contract), `stable NEXUS map wrapper contract missing: ${contract}`);
}
assert(orbitalResizer.includes('AdminNexusOrbitalLiveCommandMap'), 'orbital resizer must render the live implementation');

const requiredLiveMapContracts = [
  'useAdminDrivers()',
  'VITE_MAPBOX_ACCESS_TOKEN',
  'import("mapbox-gl")',
  'mapbox://styles/mapbox/standard-satellite',
  'admin_dispatch_candidates',
  'admin_dispatch_order_runtime',
  'fetchMapboxTrafficRoutes(',
  'fetchMapboxTrafficMatrix(',
  'explicitOrderPickup(',
  'explicitOrderDestination(',
  'driverLocationPoint(',
  'force: false',
  'setData(driverFeatures)',
  'setData(orderFeatures)',
  'cluster: true',
  'dn-nexus-command-map__truth-strip',
];
for (const contract of requiredLiveMapContracts) {
  assert(orbitalMap.includes(contract), `live command map implementation contract missing: ${contract}`);
}

const forbiddenLiveMapFallbacks = [
  'interpolatePoint(',
  'progressFromStatus(',
  'resolveUaePoint(',
  'defaultLocations',
  'Math.random(',
  'random coordinates',
  'fake GPS',
  'simulated courier',
];
for (const forbidden of forbiddenLiveMapFallbacks) {
  assert(!orbitalMap.includes(forbidden), `fake/derived location fallback detected: ${forbidden}`);
}

for (const contract of [
  'NEXUS EARTH LIVE 3D · UAE',
  'UAE_LIVE_CITY_TOUR',
  'zoom: 15.55',
  'projection: "mercator"',
  'show3dObjects: true',
  'show3dBuildings: true',
  'show3dTrees: true',
  'show3dLandmarks: true',
  'show3dFacades: true',
  'showPedestrianRoads: true',
  'SATELLITE + 3D BUILDINGS',
  'lightPreset: "day"',
  'duration: 6500',
]) {
  assert(orbitalMap.includes(contract), `Earth Live 3D visual contract missing: ${contract}`);
}
assert(!orbitalMap.includes('zoom: 6.35'), 'high-altitude radar default must not return');
assert(!orbitalMap.includes('projection: "globe"'), 'Earth Live 3D must start in close mercator street mode');
assert(orbitalMapStyles.includes('display: none'), 'legacy radar scan overlay must remain disabled');

for (const contract of [
  '/directions/v5/mapbox/driving-traffic/',
  '/directions-matrix/v1/mapbox/driving-traffic/',
  'alternatives: "true"',
  'congestion,congestion_numeric',
  'explicitOrderPickup(',
  'explicitOrderDestination(',
  'driverLocationPoint(',
  'isValidNexusLngLat(',
  'routeCacheKey(',
]) {
  assert(mapbox.includes(contract), `Mapbox routing contract missing: ${contract}`);
}
assert(!mapbox.includes('Math.random('), 'Mapbox utilities must never fabricate coordinates');
assert(packageJson.includes('"mapbox-gl"'), 'mapbox-gl dependency missing');

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
assert(!orbitalMap.includes('.from("orders").update('), 'NEXUS map must not bypass canonical dispatch RPC');
assert(!orbitalMap.includes('.from("orders").insert('), 'NEXUS map must not create orders directly');
assert(!orbitalMap.includes('.from("orders").delete('), 'NEXUS map must not delete orders directly');

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
assert(!main.includes('mapbox-gl'), 'Mapbox must not be eagerly imported by main');
assert(!main.includes('AdminNexusLiveCommandMap'), 'NEXUS command map must not be eagerly imported by main');

for (const breakpoint of ['max-width: 1360px', 'max-width: 1050px', 'max-width: 760px', 'max-width: 430px']) {
  assert(styles.includes(breakpoint), `responsive contract missing: ${breakpoint}`);
}
assert(styles.includes('100dvh'), 'mobile safe viewport contract missing');
assert(styles.includes('prefers-reduced-motion'), 'reduced-motion contract missing');
assert(launcherStyles.includes('safe-area-inset-bottom'), 'mobile launcher safe-area contract missing');
assert(launcherStyles.includes('.dncc-shell[data-theme="light"]'), 'light command-center launcher contract missing');
assert(commandMapStyles.includes('max-width: 820px'), 'NEXUS command map tablet/mobile contract missing');
assert(commandMapStyles.includes('max-width: 520px'), 'NEXUS command map phone contract missing');
assert(commandMapStyles.includes('prefers-reduced-motion'), 'NEXUS command map reduced-motion contract missing');

console.log('NEXUS Phase 1 / Live Command Center production gate: PASS');
console.log('  - real Admin orders / merchants / finance sources required');
console.log('  - real driver_locations via isolated useAdminDrivers hook required');
console.log('  - explicit order coordinates only; no interpolated/fabricated courier GPS');
console.log('  - Mapbox GL loaded lazily inside NEXUS only');
console.log('  - Earth Live 3D close street camera + Standard 3D buildings/trees/landmarks/facades required');
console.log('  - driving-traffic Directions + Matrix + returned congestion required');
console.log('  - canonical dispatch candidate/runtime RPCs required for assignment');
console.log('  - no direct order/finance table writes from NEXUS');
console.log('  - Risk Radar, Action Queue, finance pulse and responsive shell preserved');
