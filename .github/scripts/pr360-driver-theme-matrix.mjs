import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(`${process.env.PLAYWRIGHT_NODE_PATH}/playwright`);
const { createClient } = require(
  path.resolve(process.cwd(), "artifacts/day-night-delivery/node_modules/@supabase/supabase-js"),
);

const env = process.env;
const required = [
  "TEST_BASE_URL",
  "EXACT_HEAD",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RUNTIME_ADMIN_EMAIL",
  "RUNTIME_ADMIN_PASSWORD",
  "RUNTIME_MERCHANT_EMAIL",
  "RUNTIME_MERCHANT_PASSWORD",
  "RUNTIME_DRIVER_EMAIL",
  "RUNTIME_DRIVER_PASSWORD",
];
const missing = required.filter((name) => !String(env[name] || "").trim());
if (missing.length) throw new Error(`missing_required_environment:${missing.join(",")}`);

const base = String(env.TEST_BASE_URL).replace(/\/$/, "");
const exactHead = String(env.EXACT_HEAD);
const supabaseUrl = String(env.VITE_SUPABASE_URL).replace(/\/$/, "");
const anonKey = String(env.VITE_SUPABASE_ANON_KEY);
const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY);
const evidenceDir = path.resolve(process.cwd(), env.EVIDENCE_DIR || "pr360-chromium-evidence");
const runId = `PR360-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const storageKey = `sb-${projectRef}-auth-token`;
const viewports = [
  { label: "320x568", width: 320, height: 568 },
  { label: "360x800", width: 360, height: 800 },
  { label: "390x844", width: 390, height: 844 },
  { label: "430x932", width: 430, height: 932 },
  { label: "768x1024", width: 768, height: 1024 },
  { label: "1024x1366", width: 1024, height: 1366 },
  { label: "1280x800", width: 1280, height: 800 },
  { label: "1440x900", width: 1440, height: 900 },
];

fs.mkdirSync(evidenceDir, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalize(value) {
  return clean(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function record(value) {
  return value && typeof value === "object" ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function createMemoryStorage() {
  const values = new Map();
  return {
    values,
    adapter: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  };
}

function createPersistentClient(storage) {
  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
      storage,
      storageKey,
    },
  });
}

function serviceClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function loginRole(role, email, password) {
  const memory = createMemoryStorage();
  const client = createPersistentClient(memory.adapter);
  const { data, error } = await client.auth.signInWithPassword({
    email: clean(email).toLowerCase(),
    password: clean(password),
  });
  if (error) throw new Error(`${role}_login_failed:${error.message}`);
  const userId = data?.user?.id;
  assert(userId && data?.session?.access_token, `${role}_session_missing`);
  if (role === "admin") {
    const { data: profile, error: profileError } = await client.from("profiles").select("role").eq("id", userId).single();
    if (profileError) throw new Error(`${role}_profile_failed:${profileError.message}`);
    assert(normalize(profile?.role) === "admin", `${role}_profile_role:${profile?.role || "null"}`);
  } else if (role === "merchant") {
    const { data: merchantPayload, error: merchantError } = await client.rpc("merchant_get_session_profile");
    if (merchantError) throw new Error(`merchant_session_profile_failed:${merchantError.message}`);
    const merchants = array(record(merchantPayload).merchants);
    assert(merchants.length === 1 && merchants[0]?.id, `merchant_session_profile_count:${merchants.length}`);
  } else {
    const { data: driverPayloadRaw, error: driverError } = await client.rpc("driver_get_session_profile");
    if (driverError) throw new Error(`driver_session_profile_failed:${driverError.message}`);
    const driverPayload = record(Array.isArray(driverPayloadRaw) ? driverPayloadRaw[0] : driverPayloadRaw);
    assert(normalize(record(driverPayload.profile).role) === "driver", `driver_session_profile_role:${record(driverPayload.profile).role || "null"}`);
    assert(record(driverPayload.driver).id, "driver_session_profile_id_missing");
  }
  const serializedSession = memory.values.get(storageKey);
  assert(typeof serializedSession === "string" && serializedSession.includes(data.session.access_token), `${role}_serialized_session_missing`);
  return { role, client, serializedSession, userId };
}

async function waitFor(label, probe, timeoutMs = 30000, intervalMs = 500) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await probe();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw lastError || new Error(`${label}_timeout`);
}

async function createDriverFixture(merchantAuth, adminAuth, driverAuth, service) {
  const { data: merchantPayload, error: merchantError } = await merchantAuth.client.rpc("merchant_get_session_profile");
  if (merchantError) throw new Error(`merchant_profile_link_failed:${merchantError.message}`);
  const merchants = array(record(merchantPayload).merchants);
  assert(merchants.length === 1 && merchants[0]?.id, `merchant_profile_link_count:${merchants.length}`);

  const { data: driverPayloadRaw, error: driverError } = await driverAuth.client.rpc("driver_get_session_profile");
  if (driverError) throw new Error(`driver_profile_link_failed:${driverError.message}`);
  const driverPayload = record(Array.isArray(driverPayloadRaw) ? driverPayloadRaw[0] : driverPayloadRaw);
  const driverId = record(driverPayload.driver).id;
  assert(driverId, "driver_profile_id_missing");

  const destination = `Al Reem Island, Abu Dhabi — ${runId}`;
  const { data: createdRaw, error: createError } = await merchantAuth.client.rpc("merchant_create_order", {
    p_order: {
      receiver_name: "PR 360 Chromium Driver QA",
      receiver_phone: "+971501234567",
      receiver_city: "Abu Dhabi",
      receiver_address: destination,
      sender_city: "Mussafah",
      sender_address: `DAY NIGHT QA pickup — ${runId}`,
      package_type: "QA parcel",
      package_description: "Exact-head local Chromium release verification",
      pieces: 1,
      weight: 1,
      service_type: "standard",
      payment_method: "cod",
      cod_amount: 123.45,
      merchant_reference: runId,
      notes: `PR360_CHROMIUM:${runId}`,
    },
  });
  if (createError) throw new Error(`driver_fixture_create_failed:${createError.message}`);
  const order = record(Array.isArray(createdRaw) ? createdRaw[0] : createdRaw);
  assert(order.id, "driver_fixture_order_id_missing");
  assert(String(order.merchant_id) === String(merchants[0].id), "driver_fixture_merchant_mismatch");

  const { data: dispatchRaw, error: dispatchError } = await adminAuth.client.rpc("admin_dispatch_order", {
    p_order_id: order.id,
    p_driver_id: driverId,
    p_action: "assign",
    p_note: `PR #360 exact-head Chromium assignment — ${runId}`,
    p_force: false,
  });
  if (dispatchError) throw new Error(`driver_fixture_dispatch_failed:${dispatchError.message}`);
  const dispatch = record(Array.isArray(dispatchRaw) ? dispatchRaw[0] : dispatchRaw);
  assert(dispatch.ok, `driver_fixture_dispatch_not_ok:${JSON.stringify(dispatch)}`);

  const assigned = await waitFor("driver_fixture_assignment", async () => {
    const { data, error } = await service.from("orders").select("*").eq("id", order.id).single();
    if (error) throw error;
    return String(data.driver_id || data.assigned_driver_id || "") === String(driverId) ? data : null;
  });
  const reference = clean(assigned.tracking_number || assigned.tracking_code || assigned.invoice_number || assigned.id);
  return { id: order.id, driverId, merchantId: merchants[0].id, reference, destination };
}

async function cleanupFixture(service, fixture) {
  if (!fixture?.id) return;
  const { error } = await service.from("orders").delete().eq("id", fixture.id);
  if (error) throw new Error(`driver_fixture_cleanup_failed:${error.message}`);
  const { data, error: verifyError } = await service.from("orders").select("id").eq("id", fixture.id).maybeSingle();
  if (verifyError) throw new Error(`driver_fixture_cleanup_verify_failed:${verifyError.message}`);
  assert(!data, "driver_fixture_cleanup_record_remains");
}

function attachTelemetry(page, label) {
  const telemetry = { label, pageErrors: [], fatalConsole: [], assetErrors: [] };
  page.on("pageerror", (error) => telemetry.pageErrors.push(String(error?.stack || error)));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const value = message.text();
    if (/uncaught|typeerror|referenceerror|syntaxerror|failed to fetch dynamically imported module|cannot read propert/i.test(value)) {
      telemetry.fatalConsole.push(value);
    }
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    const url = new URL(response.url());
    if (url.origin !== new URL(base).origin) return;
    if (/\.(?:js|css|woff2?|ttf|png|jpe?g|webp|svg)(?:\?|$)/i.test(url.pathname)) {
      telemetry.assetErrors.push(`${response.status()} ${url.pathname}`);
    }
  });
  return telemetry;
}

function assertTelemetry(telemetry) {
  assert(telemetry.pageErrors.length === 0, `${telemetry.label}_page_errors:${telemetry.pageErrors.join(" | ")}`);
  assert(telemetry.fatalConsole.length === 0, `${telemetry.label}_fatal_console:${telemetry.fatalConsole.join(" | ")}`);
  assert(telemetry.assetErrors.length === 0, `${telemetry.label}_asset_errors:${telemetry.assetErrors.join(" | ")}`);
}

async function createRoleContext(browser, auth, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, locale: "ar-AE", colorScheme: "light", reducedMotion: "reduce" });
  await context.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
      if (!window.localStorage.getItem("dn_theme_mode")) window.localStorage.setItem("dn_theme_mode", "light");
      if (!window.localStorage.getItem("dn_lang_explicit_v2")) {
        window.localStorage.setItem("dn_lang_preference", "ar");
        window.localStorage.setItem("dn_lang_explicit_v2", "1");
      }
      window.__dnThemeTrace = [];
      const capture = () => {
        const root = document.documentElement;
        const snapshot = `${root.getAttribute("data-theme") || "unset"}|${root.className}`;
        if (window.__dnThemeTrace.at(-1) !== snapshot) window.__dnThemeTrace.push(snapshot);
      };
      capture();
      new MutationObserver(capture).observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "data-dn-admin-theme"] });
    },
    { key: storageKey, value: auth.serializedSession },
  );
  return context;
}

async function setPreferences(page, theme = "light", language = "ar") {
  await page.evaluate(({ theme, language }) => {
    localStorage.setItem("dn_theme_mode", theme);
    localStorage.setItem("dn_lang_preference", language);
    localStorage.setItem("dn_lang_explicit_v2", "1");
  }, { theme, language });
}

const rootByRole = {
  driver: ".dn-driver-shell-v3",
  merchant: '.dn-merchant-app[data-merchant-authenticated="true"]',
  admin: ".dncc-shell",
};

async function openRole(page, role) {
  await page.goto(`${base}/${role}?nosplash=1&lang=ar&__dn_acceptance=pr360_exact_head`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.locator(rootByRole[role]).waitFor({ state: "visible", timeout: 90000 });
  if (role === "driver") await page.locator(".dn-driver-mission-focus").waitFor({ state: "visible", timeout: 60000 });
  if (role === "admin") await page.locator(".dn-admin-fullscreen").waitFor({ state: "attached", timeout: 90000 });
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForTimeout(450);
}

async function clickFirstVisible(locator, label) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const item = locator.nth(index);
    if (await item.isVisible().catch(() => false)) {
      await item.click();
      return item;
    }
  }
  throw new Error(`${label}_visible_control_missing`);
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  const excess = Math.max(overflow.document, overflow.body) - overflow.viewport;
  assert(excess <= 3, `${label}_horizontal_overflow:${JSON.stringify(overflow)}`);
}

async function assertVisibleAndContained(locator, label, viewport, edgeTolerance = 2) {
  await locator.waitFor({ state: "visible", timeout: 30000 });
  const box = await locator.boundingBox();
  assert(box && box.width > 0 && box.height > 0, `${label}_empty_box`);
  assert(box.x + box.width >= -edgeTolerance && box.x <= viewport.width + edgeTolerance, `${label}_outside_horizontal:${JSON.stringify(box)}`);
  assert(box.y + box.height >= -edgeTolerance && box.y <= viewport.height + edgeTolerance, `${label}_outside_vertical:${JSON.stringify(box)}`);
  const style = await locator.evaluate((element) => {
    const value = getComputedStyle(element);
    return { display: value.display, visibility: value.visibility, opacity: Number(value.opacity), pointerEvents: value.pointerEvents };
  });
  assert(style.display !== "none" && style.visibility !== "hidden" && style.opacity > 0.05, `${label}_not_rendered:${JSON.stringify(style)}`);
  return box;
}

async function assertScrollable(page, label) {
  const result = await page.evaluate(() => {
    const scrollers = [document.scrollingElement, document.querySelector(".dn-driver-workspace-v3"), document.querySelector(".dn-merchant-content"), document.querySelector(".dncc-main")].filter(Boolean);
    return scrollers.map((element) => ({
      tag: element.tagName,
      className: element.className || "",
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY,
    }));
  });
  const contentFits = result.every((item) => item.scrollHeight <= item.clientHeight + 2);
  const usableScroller = result.some((item) => item.scrollHeight <= item.clientHeight + 2 || !["hidden", "clip"].includes(item.overflowY));
  assert(contentFits || usableScroller, `${label}_scroll_locked:${JSON.stringify(result)}`);
}

async function assertTouchTarget(locator, label) {
  const box = await locator.boundingBox();
  assert(box && box.width >= 40 && box.height >= 40, `${label}_touch_target:${JSON.stringify(box)}`);
}

async function assertPressStability(page, locator, label) {
  const before = await locator.boundingBox();
  assert(before, `${label}_press_box_missing`);
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(80);
  const during = await locator.boundingBox();
  await page.mouse.up();
  assert(during, `${label}_press_box_lost`);
  const beforeCenter = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
  const duringCenter = { x: during.x + during.width / 2, y: during.y + during.height / 2 };
  const movement = Math.hypot(beforeCenter.x - duringCenter.x, beforeCenter.y - duringCenter.y);
  assert(movement <= 4, `${label}_press_transform_displaced:${movement.toFixed(2)}`);
}

async function screenshot(page, name, fullPage = false) {
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage });
}

async function driverMatrix(page, telemetry, fixture) {
  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    if (page.url().startsWith(base)) await setPreferences(page, "light", "ar");
    await openRole(page, "driver");
    const root = page.locator(rootByRole.driver);
    assert(await root.getAttribute("dir") === "rtl", `driver_${viewport.label}_rtl_missing`);
    assert(await root.getAttribute("data-driver-theme") === "light", `driver_${viewport.label}_light_missing`);

    const mission = page.locator(".dn-driver-mission-focus");
    const missionText = clean(await mission.innerText());
    assert(missionText.includes(fixture.reference), `driver_${viewport.label}_reference_missing:${missionText.slice(0, 260)}`);
    assert(missionText.includes(runId), `driver_${viewport.label}_destination_missing`);
    assert(missionText.includes("123.45 AED"), `driver_${viewport.label}_cod_missing`);
    assert(await mission.locator('a[href^="tel:"]').count() === 1, `driver_${viewport.label}_call_action_missing`);
    await assertNoHorizontalOverflow(page, `driver_${viewport.label}`);
    await assertScrollable(page, `driver_${viewport.label}`);

    const themeButton = page.locator(".dn-driver-theme-button");
    const languageButton = page.locator(".dn-driver-language-button");
    await assertVisibleAndContained(themeButton, `driver_${viewport.label}_theme`, viewport);
    await assertVisibleAndContained(languageButton, `driver_${viewport.label}_language`, viewport);
    if (viewport.width <= 980) {
      const dock = page.locator(".dn-driver-mobile-dock-v3");
      const dockBox = await assertVisibleAndContained(dock, `driver_${viewport.label}_dock`, viewport);
      assert(dockBox.y + dockBox.height <= viewport.height + 3, `driver_${viewport.label}_dock_safe_area`);
      await assertTouchTarget(dock.locator("button").first(), `driver_${viewport.label}_dock_button`);
      await assertTouchTarget(themeButton, `driver_${viewport.label}_theme_button`);
      await assertPressStability(page, dock.locator("button").first(), `driver_${viewport.label}_dock_press`);
      const bottomPadding = await page.locator(".dn-driver-workspace-v3").evaluate((element) => parseFloat(getComputedStyle(element).paddingBottom));
      assert(bottomPadding >= dockBox.height + 20, `driver_${viewport.label}_dock_content_padding:${bottomPadding}:${dockBox.height}`);
    } else {
      assert(!(await page.locator(".dn-driver-mobile-dock-v3").isVisible()), `driver_${viewport.label}_desktop_dock_visible`);
    }

    if (["320x568", "390x844", "768x1024", "1440x900"].includes(viewport.label)) {
      await screenshot(page, `driver-${viewport.label}-light`);
    }
    results.push({ viewport: viewport.label, horizontalOverflow: "PASS", mission: "PASS", navigation: "PASS" });
  }
  assertTelemetry(telemetry);
  return results;
}

async function driverMissionFlow(page, fixture, service) {
  const viewport = { width: 390, height: 844 };
  await page.setViewportSize(viewport);
  await setPreferences(page, "light", "ar");
  await openRole(page, "driver");

  const mission = page.locator(".dn-driver-mission-focus");
  await clickFirstVisible(mission.getByRole("button", { name: /إدارة المهمة|Manage mission/i }), "driver_manage_mission");
  await page.getByRole("heading", { name: /الطلبات المسندة الآن|Current assigned orders/i }).waitFor({ state: "visible", timeout: 30000 });
  const card = page.locator(".dn-driver-order-card-v2").filter({ hasText: fixture.reference }).first();
  await card.waitFor({ state: "visible", timeout: 30000 });
  await card.locator(".dn-driver-action-grid button").filter({ hasText: /بدء تنفيذ المهمة|Start job/i }).waitFor({ state: "visible", timeout: 30000 });
  await screenshot(page, "driver-390-active-orders");

  await clickFirstVisible(page.locator(".dn-driver-mobile-dock-v3 button").filter({ hasText: /الرئيسية|Home/i }), "driver_home_dock");
  await mission.waitFor({ state: "visible", timeout: 30000 });
  await clickFirstVisible(mission.getByRole("button", { name: /ابدأ الملاحة|Start navigation/i }), "driver_start_navigation");
  const navigation = page.locator(".dn-driver-navigation-workspace");
  await navigation.waitFor({ state: "visible", timeout: 60000 });
  await page.locator(".dn-driver-navigation-map .leaflet-container").waitFor({ state: "visible", timeout: 60000 });
  assert(clean(await navigation.innerText()).includes(fixture.reference), "driver_navigation_reference_missing");
  await assertNoHorizontalOverflow(page, "driver_navigation_390");

  const zoomControl = page.locator(".dn-driver-navigation-map .leaflet-control-zoom-in").first();
  await zoomControl.waitFor({ state: "visible", timeout: 30000 });
  const controlBox = await zoomControl.boundingBox();
  assert(controlBox, "driver_map_control_box_missing");
  const hit = await page.evaluate(({ x, y }) => {
    const hitElement = document.elementFromPoint(x, y);
    return Boolean(hitElement?.closest(".leaflet-control-zoom"));
  }, { x: controlBox.x + controlBox.width / 2, y: controlBox.y + controlBox.height / 2 });
  assert(hit, "driver_map_control_z_index_collision");

  const dock = page.locator(".dn-driver-mobile-dock-v3");
  const dockBox = await dock.boundingBox();
  const closeButton = page.locator(".dn-driver-navigation-header button").first();
  await assertVisibleAndContained(closeButton, "driver_navigation_close", viewport);
  await page.locator(".dn-driver-navigation-sync").scrollIntoViewIfNeeded();
  const syncBox = await page.locator(".dn-driver-navigation-sync").boundingBox();
  assert(!dockBox || !syncBox || syncBox.y + syncBox.height <= dockBox.y + 2, "driver_navigation_sync_covered_by_dock");
  await screenshot(page, "driver-390-navigation-map");
  await assertPressStability(page, zoomControl, "driver_map_zoom_press");

  await closeButton.click();
  await mission.waitFor({ state: "visible", timeout: 30000 });
  await clickFirstVisible(mission.getByRole("button", { name: /إدارة المهمة|Manage mission/i }), "driver_manage_after_navigation");
  const confirmedCard = page.locator(".dn-driver-order-card-v2").filter({ hasText: fixture.reference }).first();
  const pickedUp = confirmedCard.locator(".dn-driver-action-grid button").filter({ hasText: /تم استلام الشحنة|Picked up/i });
  await pickedUp.waitFor({ state: "visible", timeout: 30000 });
  await pickedUp.click();
  await waitFor("driver_status_picked_up", async () => {
    const { data, error } = await service.from("orders").select("status").eq("id", fixture.id).single();
    if (error) throw error;
    return normalize(data.status) === "picked_up" ? data : null;
  });
  await confirmedCard.locator(".dn-driver-status").filter({ hasText: /تم الاستلام|Picked up/i }).waitFor({ state: "visible", timeout: 30000 });

  await clickFirstVisible(page.locator(".dn-driver-mobile-dock-v3 button").filter({ hasText: /ملفي|Profile/i }), "driver_profile_dock");
  await page.getByRole("heading", { name: /ملف المندوب الكامل|Complete driver profile/i }).waitFor({ state: "visible", timeout: 30000 });
  await page.locator(".dn-driver-profile-editor-v2").waitFor({ state: "visible", timeout: 30000 });
  await assertNoHorizontalOverflow(page, "driver_profile_390");
  await screenshot(page, "driver-390-profile");

  await page.locator(".dn-driver-language-button").click();
  await page.locator(rootByRole.driver).evaluate((element) => element.getAttribute("dir") === "ltr");
  await page.getByRole("heading", { name: /Complete driver profile/i }).waitFor({ state: "visible", timeout: 30000 });
  assert(await page.locator(rootByRole.driver).getAttribute("dir") === "ltr", "driver_ltr_not_applied");
  await assertNoHorizontalOverflow(page, "driver_profile_390_ltr");
  await screenshot(page, "driver-390-profile-english");
  await page.locator(".dn-driver-language-button").click();
  await page.getByRole("heading", { name: /ملف المندوب الكامل/i }).waitFor({ state: "visible", timeout: 30000 });
}

async function driverNoPhoneCondition(browser, driverAuth, fixture) {
  const context = await createRoleContext(browser, driverAuth, { width: 390, height: 844 });
  const page = await context.newPage();
  const telemetry = attachTelemetry(page, "driver_no_phone");
  await page.route("**/rest/v1/orders*", async (route) => {
    const response = await route.fetch();
    const contentType = response.headers()["content-type"] || "";
    if (!contentType.includes("application/json")) return route.fulfill({ response });
    const payload = await response.json();
    if (!Array.isArray(payload)) return route.fulfill({ response, json: payload });
    const patched = payload.map((order) => String(order.id) === String(fixture.id)
      ? { ...order, receiver_phone: null, customer_phone: null }
      : order);
    return route.fulfill({ response, json: patched });
  });
  await openRole(page, "driver");
  const mission = page.locator(".dn-driver-mission-focus");
  assert(clean(await mission.innerText()).includes(fixture.reference), "driver_no_phone_fixture_not_current");
  assert(await mission.locator('a[href^="tel:"]').count() === 0, "driver_no_phone_call_action_rendered");
  await screenshot(page, "driver-390-current-mission-no-phone");
  assertTelemetry(telemetry);
  await context.close();
}

function roleThemeConfig(role) {
  if (role === "driver") return {
    root: rootByRole.driver,
    themeAttribute: "data-driver-theme",
    button: ".dn-driver-theme-button",
  };
  if (role === "merchant") return {
    root: rootByRole.merchant,
    themeAttribute: "data-merchant-theme",
    button: ".dn-merchant-header-actions .is-theme",
  };
  return {
    root: rootByRole.admin,
    themeAttribute: "data-theme",
    button: '.dncc-topbar-actions button[aria-label*="الوضع"], .dncc-topbar-actions button[aria-label="Dark mode"], .dncc-topbar-actions button[aria-label="Light mode"]',
  };
}

async function openRepresentativeState(page, role, viewport) {
  if (role === "driver") {
    if (viewport.width <= 980) {
      await clickFirstVisible(page.locator(".dn-driver-mobile-dock-v3 button").filter({ hasText: /ملفي|Profile/i }), "driver_theme_profile");
    } else {
      await clickFirstVisible(page.locator('.dn-driver-rail-v3 nav button[title="ملفي"], .dn-driver-rail-v3 nav button[title="Profile"]'), "driver_theme_profile_desktop");
    }
    await page.getByRole("heading", { name: /ملف المندوب الكامل|Complete driver profile/i }).waitFor({ state: "visible", timeout: 30000 });
    const input = page.locator(".dn-driver-profile-editor-v2 input").first();
    if (await input.count()) await input.waitFor({ state: "visible", timeout: 30000 });
    return { marker: page.getByRole("heading", { name: /ملف المندوب الكامل|Complete driver profile/i }), surface: input };
  }

  if (role === "merchant") {
    const candidates = page.locator(".dn-merchant-bottom-nav button, .dn-merchant-sidebar-nav button").filter({ hasText: /إضافة طلب|إنشاء طلب|Create order|Create/i });
    await clickFirstVisible(candidates, "merchant_theme_create_order");
    const marker = page.getByRole("heading", { name: /بيانات الاستلام|Pickup details/i });
    await marker.waitFor({ state: "visible", timeout: 30000 });
    const surface = page.locator(".dn-merchant-form-grid input").first();
    await surface.waitFor({ state: "visible", timeout: 30000 });
    return { marker, surface };
  }

  const command = page.locator('[data-dn-command-section="new_order"]');
  let clicked = false;
  for (let index = 0; index < await command.count(); index += 1) {
    if (await command.nth(index).isVisible().catch(() => false)) {
      await command.nth(index).click();
      clicked = true;
      break;
    }
  }
  if (!clicked) {
    await page.locator(".dncc-mobile-menu").click();
    await page.locator(".dncc-mobile-layer").waitFor({ state: "visible", timeout: 30000 });
    await clickFirstVisible(command, "admin_theme_new_order_mobile");
  }
  const surface = page.locator('form[data-admin-new-order-form="merchant"]');
  await surface.waitFor({ state: "visible", timeout: 60000 });
  return { marker: surface, surface: surface.locator("input").first() };
}

async function assertThemeState(page, role, expected) {
  const config = roleThemeConfig(role);
  const root = page.locator(config.root);
  await root.waitFor({ state: "visible", timeout: 60000 });
  await page.waitForFunction(
    ({ selector, attribute, expected }) => document.querySelector(selector)?.getAttribute(attribute) === expected,
    { selector: config.root, attribute: config.themeAttribute, expected },
    { timeout: 30000 },
  );
  const state = await page.evaluate(({ role, expected }) => {
    const html = document.documentElement;
    const body = document.body;
    const meta = document.querySelector('meta[name="theme-color"]')?.getAttribute("content")?.toLowerCase();
    const opposite = expected === "dark" ? "light" : "dark";
    const roleRoot = role === "driver" ? document.querySelector(".dn-driver-shell-v3") : role === "merchant" ? document.querySelector(".dn-merchant-app") : document.querySelector(".dncc-shell");
    const rootStyle = roleRoot ? getComputedStyle(roleRoot) : null;
    return {
      htmlTheme: html.dataset.theme,
      htmlClass: html.className,
      bodyClass: body.className,
      meta,
      stored: localStorage.getItem("dn_theme_mode"),
      opposite,
      roleClass: roleRoot?.className || "",
      visibility: rootStyle?.visibility,
      opacity: Number(rootStyle?.opacity ?? 0),
    };
  }, { role, expected });
  assert(state.htmlTheme === expected, `${role}_${expected}_html_theme:${JSON.stringify(state)}`);
  assert(state.htmlClass.includes(`${expected}-theme`) && !state.htmlClass.includes(`${state.opposite}-theme`), `${role}_${expected}_html_class_stale:${state.htmlClass}`);
  assert(state.bodyClass.includes(`${expected}-theme`) && !state.bodyClass.includes(`${state.opposite}-theme`), `${role}_${expected}_body_class_stale:${state.bodyClass}`);
  assert(state.meta === (expected === "dark" ? "#041226" : "#edf5ff"), `${role}_${expected}_theme_color:${state.meta}`);
  assert(state.stored === expected, `${role}_${expected}_storage:${state.stored}`);
  assert(state.visibility !== "hidden" && state.opacity > 0.05, `${role}_${expected}_root_hidden`);
}

async function themeCycle(browser, auth, role, viewport, label) {
  const context = await createRoleContext(browser, auth, viewport);
  const page = await context.newPage();
  const telemetry = attachTelemetry(page, `${role}_theme_${label}`);
  await openRole(page, role);
  await assertThemeState(page, role, "light");
  const representative = await openRepresentativeState(page, role, viewport);
  await representative.marker.waitFor({ state: "visible", timeout: 30000 });
  if (representative.surface && await representative.surface.count()) await representative.surface.waitFor({ state: "visible", timeout: 30000 });
  await assertNoHorizontalOverflow(page, `${role}_${label}_light`);
  await screenshot(page, `${role}-${label}-light`);

  const config = roleThemeConfig(role);
  await clickFirstVisible(page.locator(config.button), `${role}_${label}_theme_toggle_dark`);
  await assertThemeState(page, role, "dark");
  await representative.marker.waitFor({ state: "visible", timeout: 30000 });
  if (representative.surface && await representative.surface.count()) await representative.surface.waitFor({ state: "visible", timeout: 30000 });
  await assertNoHorizontalOverflow(page, `${role}_${label}_dark`);
  await screenshot(page, `${role}-${label}-dark`);

  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator(config.root).waitFor({ state: "visible", timeout: 90000 });
  await assertThemeState(page, role, "dark");
  const trace = await page.evaluate(() => window.__dnThemeTrace || []);
  assert(!trace.some((item) => String(item).startsWith("light|")), `${role}_${label}_dark_reload_wrong_theme_flash:${JSON.stringify(trace)}`);

  await clickFirstVisible(page.locator(config.button), `${role}_${label}_theme_toggle_light`);
  await assertThemeState(page, role, "light");
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator(config.root).waitFor({ state: "visible", timeout: 90000 });
  await assertThemeState(page, role, "light");
  await assertNoHorizontalOverflow(page, `${role}_${label}_light_reload`);
  assertTelemetry(telemetry);
  await context.close();
  return { role, viewport: label, lightToDark: "PASS", darkToLight: "PASS", persistence: "PASS", noWrongThemeFlash: "PASS" };
}

const service = serviceClient();
let browser;
let fixture;
let adminAuth;
let merchantAuth;
let driverAuth;
let cleanupError;
const report = {
  exactHead,
  exactLocalBuild: true,
  runId,
  driver: {},
  themes: [],
  viewportMatrix: [],
  cleanup: "PENDING",
  result: "RUNNING",
};

try {
  adminAuth = await loginRole("admin", env.RUNTIME_ADMIN_EMAIL, env.RUNTIME_ADMIN_PASSWORD);
  merchantAuth = await loginRole("merchant", env.RUNTIME_MERCHANT_EMAIL, env.RUNTIME_MERCHANT_PASSWORD);
  driverAuth = await loginRole("driver", env.RUNTIME_DRIVER_EMAIL, env.RUNTIME_DRIVER_PASSWORD);
  fixture = await createDriverFixture(merchantAuth, adminAuth, driverAuth, service);

  browser = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
  const driverContext = await createRoleContext(browser, driverAuth, { width: 390, height: 844 });
  const driverPage = await driverContext.newPage();
  const driverTelemetry = attachTelemetry(driverPage, "driver_matrix_and_flow");
  report.viewportMatrix = await driverMatrix(driverPage, driverTelemetry, fixture);
  await driverMissionFlow(driverPage, fixture, service);
  assertTelemetry(driverTelemetry);
  await driverContext.close();
  await driverNoPhoneCondition(browser, driverAuth, fixture);
  report.driver = {
    authenticatedRoute: "PASS",
    home: "PASS",
    currentMission: "PASS",
    currentMissionNoPhoneCondition: "PASS",
    activeOrders: "PASS",
    missionDetails: "PASS",
    statusCallbacks: "PASS",
    navigationMap: "PASS",
    mapControlZIndex: "PASS",
    profileNavigation: "PASS",
    mobileBottomNavigation: "PASS",
    rtlArabic: "PASS",
    ltrEnglish: "PASS",
    scroll: "PASS",
    pressTransform: "PASS",
  };

  for (const [role, auth] of [["admin", adminAuth], ["merchant", merchantAuth], ["driver", driverAuth]]) {
    report.themes.push(await themeCycle(browser, auth, role, { width: 320, height: 568 }, "320x568"));
    report.themes.push(await themeCycle(browser, auth, role, { width: 1440, height: 900 }, "1440x900"));
  }
  report.result = "PASS";
} catch (error) {
  report.result = "FAIL";
  report.error = String(error?.stack || error);
  throw error;
} finally {
  if (browser) await browser.close().catch(() => {});
  try {
    await cleanupFixture(service, fixture);
    report.cleanup = "PASS";
  } catch (error) {
    cleanupError = error;
    report.cleanup = `FAIL:${error instanceof Error ? error.message : String(error)}`;
  }
  for (const auth of [driverAuth, merchantAuth, adminAuth]) {
    if (auth?.client) await auth.client.auth.signOut({ scope: "local" }).catch(() => {});
  }
  fs.writeFileSync(path.join(evidenceDir, "report.json"), JSON.stringify(report, null, 2));
  if (cleanupError) throw cleanupError;
}

console.log(JSON.stringify(report, null, 2));
