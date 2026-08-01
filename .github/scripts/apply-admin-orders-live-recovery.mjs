import fs from "node:fs";

function patchFile(path, patches) {
  let source = fs.readFileSync(path, "utf8");
  let changed = false;
  for (const { before, after, label } of patches) {
    if (source.includes(after)) continue;
    const count = source.split(before).length - 1;
    if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
    source = source.replace(before, after);
    changed = true;
  }
  if (changed) fs.writeFileSync(path, source);
}

patchFile("artifacts/day-night-delivery/src/lib/liveDeploymentRuntime.ts", [
  {
    label: "protected reload key",
    before: 'const RECOVERY_QUERY_KEYS = ["__dn_live_reload", "__dn_cache_recovered", "__dn_entry", "__dn_portal_shell"];',
    after: 'const RECOVERY_QUERY_KEYS = ["__dn_live_reload", "__dn_cache_recovered", "__dn_entry", "__dn_portal_shell"];\nconst PROTECTED_RELOAD_KEY = "dn_protected_build_reload";',
  },
  {
    label: "protected deployment freshness",
    before: `/**
 * Protected portals are deliberately mounted on the first navigation. An older
 * implementation forced an additional cache-busted navigation whenever any
 * public-site service worker existed, which made the admin launcher appear only
 * after a refresh. The current HTML is already delivered with no-store headers,
 * so protected routes only remove obsolete PWA state in the background and never
 * interrupt or reload the operator's screen.
 */
export async function ensureCurrentProtectedDeployment() {
  if (typeof window === "undefined" || !isProtectedRoute()) return true;
  if (window.__DAY_NIGHT_PROTECTED_DEPLOYMENT_PROMISE__) {
    return window.__DAY_NIGHT_PROTECTED_DEPLOYMENT_PROMISE__;
  }

  window.__DAY_NIGHT_PROTECTED_DEPLOYMENT_PROMISE__ = (async () => {
    removeRecoveryQueryParameters();
    await clearStaleProtectedRuntime();
    return true;
  })();

  return window.__DAY_NIGHT_PROTECTED_DEPLOYMENT_PROMISE__;
}`,
    after: `/**
 * Protected portals must never remain on an obsolete JavaScript bundle. Before
 * mounting an operational portal, compare the embedded build with version.json,
 * clear stale PWA state, and perform one cache-busted navigation when they differ.
 */
export async function ensureCurrentProtectedDeployment() {
  if (typeof window === "undefined" || !isProtectedRoute()) return true;
  if (window.__DAY_NIGHT_PROTECTED_DEPLOYMENT_PROMISE__) {
    return window.__DAY_NIGHT_PROTECTED_DEPLOYMENT_PROMISE__;
  }

  window.__DAY_NIGHT_PROTECTED_DEPLOYMENT_PROMISE__ = (async () => {
    removeRecoveryQueryParameters();
    await clearStaleProtectedRuntime();

    try {
      const latestVersion = await fetchLatestVersion();
      const latestBuildId = String(latestVersion.buildId || "").trim();
      if (latestBuildId && latestBuildId !== DAY_NIGHT_BUILD_ID) {
        const reloadKey = `${PROTECTED_RELOAD_KEY}:${latestBuildId}`;
        if (window.sessionStorage.getItem(reloadKey) !== "1") {
          window.sessionStorage.setItem(reloadKey, "1");
          const next = new URL(window.location.href);
          next.searchParams.set("__dn_live_reload", latestBuildId);
          window.location.replace(next.toString());
          return false;
        }
      }
    } catch {
      // A temporary version endpoint failure must not block an authenticated portal.
    }

    return true;
  })();

  return window.__DAY_NIGHT_PROTECTED_DEPLOYMENT_PROMISE__;
}`,
  },
]);

patchFile("artifacts/day-night-delivery/src/lib/adminData.ts", [
  {
    label: "admin session verifier",
    before: `function safeLike(value: string) {
  return value.replace(/[%,]/g, "").trim();
}

export async function fetchAdminOrdersPage(params: AdminOrderPageParams = {}): Promise<AdminOrderPageResult> {`,
    after: `function safeLike(value: string) {
  return value.replace(/[%,]/g, "").trim();
}

async function ensureAdminOrdersSession() {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.user?.id) {
    throw new Error("admin_session_missing");
  }

  const checkRole = async () => {
    const { data, error } = await supabase.rpc("is_admin_or_support");
    return !error && data === true;
  };

  if (await checkRole()) return;

  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !(await checkRole())) {
    throw new Error("admin_session_not_authorized_for_orders");
  }
}

export async function fetchAdminOrdersPage(params: AdminOrderPageParams = {}): Promise<AdminOrderPageResult> {`,
  },
  {
    label: "admin session enforcement",
    before: `  if (!supabase) return { rows: [], count: 0, page, pageSize, totalPages: 0, source: "fallback", warning: "Supabase is not configured." };
  let query = supabase.from("orders").select("*", { count: "exact" });`,
    after: `  if (!supabase) return { rows: [], count: 0, page, pageSize, totalPages: 0, source: "fallback", warning: "Supabase is not configured." };
  try {
    await ensureAdminOrdersSession();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error || "");
    return {
      rows: [],
      count: 0,
      page,
      pageSize,
      totalPages: 0,
      source: "fallback",
      warning: detail === "admin_session_missing"
        ? "Admin session is missing. Sign in again to load the real orders."
        : "Admin session could not read orders. The page will not display a false zero.",
    };
  }
  let query = supabase.from("orders").select("*", { count: "exact" });`,
  },
]);

patchFile("artifacts/day-night-delivery/src/components/ProtectedAdminRoute.tsx", [
  {
    label: "protected admin role verification",
    before: `        const { data, error } = await supabase.auth.getUser();

        if (error || !data.user?.id) {
          clearAdminStepUp();
          if (active) setStatus("denied");
          return;
        }

        const allowed = await isAdminUser(data.user.id);

        if (active) {
          if (!allowed) clearAdminStepUp(data.user.id);
          setStatus(allowed ? "allowed" : "denied");
        }`,
    after: `        let { data, error } = await supabase.auth.getUser();

        if (error || !data.user?.id) {
          const refreshed = await supabase.auth.refreshSession();
          if (!refreshed.error) {
            const retried = await supabase.auth.getUser();
            data = retried.data;
            error = retried.error;
          }
        }

        if (error || !data.user?.id) {
          clearAdminStepUp();
          if (active) setStatus("denied");
          return;
        }

        const [profileAllowed, databaseRole] = await Promise.all([
          isAdminUser(data.user.id),
          supabase.rpc("is_admin_or_support"),
        ]);
        const allowed = profileAllowed && !databaseRole.error && databaseRole.data === true;

        if (active) {
          if (!allowed) clearAdminStepUp(data.user.id);
          setStatus(allowed ? "allowed" : "denied");
        }`,
  },
]);

console.log("Admin live data recovery patch applied.");
