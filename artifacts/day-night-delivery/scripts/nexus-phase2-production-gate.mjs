import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(`NEXUS_PHASE2_GATE_FAILED: ${message}`);
};

const engine = read("src/lib/nexusPhase2Engine.ts");
const component = read("src/components/admin/AdminNexusPhase2Intelligence.tsx");
const entry = read("src/components/admin/AdminNexusEntry.tsx");
const css = read("src/styles/dn-nexus-phase2.css");

for (const token of [
  "buildDispatchRecommendations",
  "buildMerchantHealth",
  "buildProfitIntelligence",
  "buildBrief",
  "haversineKm",
  "distanceScore",
  "presenceScore",
  "merchantTier",
]) {
  assert(engine.includes(token), `missing explainable engine primitive: ${token}`);
}

for (const token of [
  "SMART DISPATCH",
  "MERCHANT HEALTH",
  "PROFIT INTELLIGENCE",
  "AI OPERATIONS BRIEF",
  "Recommendation Only",
  "driver_profiles",
  "driver_locations",
  "fetchAdminOrders",
  "fetchFinanceSummary",
  "fetchMerchants",
  "findVisibleNexusContent",
]) {
  assert(component.includes(token), `missing Phase 2 runtime contract: ${token}`);
}

assert(entry.includes("AdminNexusPhase2Intelligence"), "Phase 2 is not mounted by AdminNexusEntry");
assert(component.includes('querySelectorAll<HTMLElement>(".dn-nexus-content")'), "Phase 2 must mount only into an open NEXUS content host");
assert(component.includes('table: "orders"'), "orders realtime refresh is missing");
assert(component.includes('table: "driver_locations"'), "driver location realtime refresh is missing");
assert(component.includes('table: "merchants"'), "merchant realtime refresh is missing");
assert(css.includes("@media (max-width: 430px)"), "mobile 430px contract is missing");
assert(css.includes(".dn-nexus-overlay.is-light .dn-nexus2"), "Light Mode Phase 2 contract is missing");

const forbiddenWritePatterns = [
  /\.insert\s*\(/,
  /\.update\s*\(/,
  /\.upsert\s*\(/,
  /\.delete\s*\(/,
  /admin_assign_driver/i,
  /admin_reassign_driver/i,
  /admin_unassign_driver/i,
  /admin_update_order/i,
  /markCodCollected/i,
  /markCodReconciled/i,
  /createExpense/i,
  /approveExpense/i,
];

for (const pattern of forbiddenWritePatterns) {
  assert(!pattern.test(component), `Phase 2 component contains forbidden write primitive: ${pattern}`);
  assert(!pattern.test(engine), `Phase 2 engine contains forbidden write primitive: ${pattern}`);
}

assert(!/Math\.random\s*\(/.test(engine), "Phase 2 score cannot use random values");
assert(!/mockOrders|demoOrders|sampleOrders|fakeOrders/i.test(engine + component), "mock/demo order dataset marker found");
assert(engine.includes("Distance unavailable — excluded from score"), "dispatch score must disclose missing distance instead of inventing it");
assert(engine.includes("contributionBeforeSharedExpenses"), "profit intelligence must distinguish contribution before shared expenses");
assert(engine.includes("authoritativeNetEstimate"), "authoritative finance net must remain separate");

console.log("NEXUS Phase 2 production safety gate: PASS");
