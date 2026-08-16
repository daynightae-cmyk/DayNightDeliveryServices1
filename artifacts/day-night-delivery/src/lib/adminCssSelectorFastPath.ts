const FAST_PATH_FLAG = "__dnAdminCssSelectorFastPathInstalled";
const ADMIN_ROOT_CLASS = "dn-admin-performance-root";
const COMMAND_ROOT_CLASS = "dn-command-center-root";

const SELECTOR_REWRITES: readonly [string, string][] = [
  ["html body:has(.dn-admin-fullscreen)", `html body.${ADMIN_ROOT_CLASS}`],
  ["html:has(.dn-admin-fullscreen)", `html.${ADMIN_ROOT_CLASS}`],
  ["body:has(.dn-admin-fullscreen)", `body.${ADMIN_ROOT_CLASS}`],
  ["html body:has(.dncc-shell)", `html body.${COMMAND_ROOT_CLASS}`],
  ["html:has(.dncc-shell)", `html.${COMMAND_ROOT_CLASS}`],
  ["body:has(.dncc-shell)", `body.${COMMAND_ROOT_CLASS}`],
];

type FastPathWindow = Window & {
  [FAST_PATH_FLAG]?: boolean;
};

type RuleWithChildren = CSSRule & {
  cssRules?: CSSRuleList;
};

function isAdminRoute() {
  return /^\/admin(?:\/|$)/i.test(window.location.pathname);
}

function syncRootClasses() {
  const active = isAdminRoute();
  document.documentElement.classList.toggle(ADMIN_ROOT_CLASS, active);
  document.documentElement.classList.toggle(COMMAND_ROOT_CLASS, active);
  document.body?.classList.toggle(ADMIN_ROOT_CLASS, active);
  document.body?.classList.toggle(COMMAND_ROOT_CLASS, active);
}

function rewriteSelector(selector: string) {
  let next = selector;
  for (const [source, target] of SELECTOR_REWRITES) {
    if (next.includes(source)) next = next.split(source).join(target);
  }
  return next;
}

function rewriteRuleList(rules: CSSRuleList): number {
  let rewritten = 0;

  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      const nextSelector = rewriteSelector(rule.selectorText);
      if (nextSelector !== rule.selectorText) {
        try {
          rule.selectorText = nextSelector;
          rewritten += 1;
        } catch {
          // Keep the original selector if a browser rejects a rewritten rule.
        }
      }
    }

    const nestedRules = (rule as RuleWithChildren).cssRules;
    if (nestedRules) rewritten += rewriteRuleList(nestedRules);
  }

  return rewritten;
}

function rewriteLoadedStyleSheets() {
  // The optimization is Admin-only. Avoid touching the CSSOM on auth, public,
  // merchant, driver, tracking, or native-role routes so their startup cost and
  // rendering path remain completely unchanged.
  if (!isAdminRoute()) return;

  let rewritten = 0;

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      rewritten += rewriteRuleList(sheet.cssRules);
    } catch {
      // Cross-origin stylesheets are intentionally ignored. DAY NIGHT bundles are same-origin.
    }
  }

  if (rewritten > 0) {
    const current = Number(document.documentElement.dataset.dnAdminSelectorFastPathCount || 0);
    document.documentElement.dataset.dnAdminSelectorFastPathCount = String(current + rewritten);
  }
}

function patchHistoryNavigation(sync: () => void) {
  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function pushState(
    data: unknown,
    unused: string,
    url?: string | URL | null,
  ) {
    const result = originalPushState.call(this, data, unused, url);
    queueMicrotask(sync);
    return result;
  };

  window.history.replaceState = function replaceState(
    data: unknown,
    unused: string,
    url?: string | URL | null,
  ) {
    const result = originalReplaceState.call(this, data, unused, url);
    queueMicrotask(sync);
    return result;
  };
}

/**
 * Chrome keeps relational :has() selectors in its style invalidation graph.
 * The Admin CSS historically used root :has(.dn-admin-fullscreen/.dncc-shell)
 * selectors only as route/mount guards. On a 4–5k element Admin DOM, mounting a
 * drawer, flyout, or order-details tree could therefore trigger a full-tree
 * style pass even though the guard remained true.
 *
 * This fast path preserves the exact selector semantics with route-scoped root
 * classes and rewrites only those two known root guards in same-origin CSSOM.
 * It is dormant outside /admin and also handles late-loaded Admin CSS chunks.
 * No business data, auth behavior, route destination, or visual declaration is
 * changed.
 */
export function installAdminCssSelectorFastPath() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const fastPathWindow = window as FastPathWindow;
  if (fastPathWindow[FAST_PATH_FLAG]) return;
  fastPathWindow[FAST_PATH_FLAG] = true;

  const resync = () => {
    syncRootClasses();
    rewriteLoadedStyleSheets();
  };

  // This first sync is cheap on every route; the CSSOM walk below is a no-op
  // unless the browser is currently on /admin.
  resync();

  // SPA transitions from /auth -> /admin must activate both the root classes and
  // the selector rewrite after the URL changes. Leaving /admin removes classes;
  // already-rewritten Admin selectors then remain inert outside the Admin route.
  patchHistoryNavigation(resync);
  window.addEventListener("popstate", resync, { passive: true });
  window.addEventListener("load", resync, { once: true });

  document.addEventListener(
    "load",
    (event) => {
      const target = event.target;
      if (target instanceof HTMLLinkElement && target.rel === "stylesheet") {
        rewriteLoadedStyleSheets();
      }
    },
    true,
  );

  // Admin route chunks can finish after the bootstrap module. Outside /admin all
  // of these callbacks return immediately without enumerating document.styleSheets.
  queueMicrotask(rewriteLoadedStyleSheets);
  window.setTimeout(rewriteLoadedStyleSheets, 120);
  window.setTimeout(rewriteLoadedStyleSheets, 600);
  window.setTimeout(rewriteLoadedStyleSheets, 1400);
}
