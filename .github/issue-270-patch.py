from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "artifacts/day-night-delivery"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return source.replace(old, new, 1)


admin_path = APP / "src/components/AdminPanelLuxury.tsx"
admin = read(admin_path)

admin = replace_once(admin, "  Send,\n", "", "remove legacy Send icon")
admin = replace_once(
    admin,
    'import DriverTrackingPanel from "./admin/DriverTrackingPanel";\nimport KhalifaGuidanceFeed from "./admin/KhalifaGuidanceFeed";\n',
    'import DriverTrackingPanel from "./admin/DriverTrackingPanel";\nimport AbuKhalifaExecutiveCard, {\n  type AbuKhalifaAction,\n} from "./admin/AbuKhalifaExecutiveCard";\n',
    "direct executive card import",
)
admin = replace_once(
    admin,
    'import {\n  AdminIconBadge,\n  AdminStateChip,\n  type AdminIconName,\n} from "./admin/adminIconSystem";\n',
    'import {\n  AdminIconBadge,\n  type AdminIconName,\n} from "./admin/adminIconSystem";\n',
    "remove legacy state chip import",
)
admin = replace_once(
    admin,
    'import khalifaAssets from "./admin/khalifaAssets";\n',
    "",
    "remove legacy Khalifa assets import",
)
admin = replace_once(
    admin,
    'import "../styles/dn-khalifa-final.css";\n',
    'import "../styles/abu-khalifa-executive-card.css";\n',
    "use executive card stylesheet",
)

for old in [
    '    helper: "خليفة",\n',
    '    helperRole: "مساعد العمليات الذكي",\n',
    '    helperText: "متصل بالبيانات الحية ويغيّر إرشاداته حسب القسم الحالي.",\n',
    '    ask: "اسألني أي شيء",\n',
    '    helper: "Khalifa",\n',
    '    helperRole: "Smart Operations Assistant",\n',
    '    helperText: "Connected to live data and changes guidance by section.",\n',
    '    ask: "Ask me anything",\n',
]:
    admin = replace_once(admin, old, "", f"remove obsolete copy: {old.strip()}")

admin = replace_once(
    admin,
    '    preparing: "خليفة يقرأ ملخص الطلبات ويقترح عليك الإجراء التالي.",\n',
    '    preparing: "بطاقة أبو خليفه تفتح إجراءات القيادة والإدارة مباشرة.",\n',
    "update Arabic quick-help copy",
)
admin = replace_once(
    admin,
    '    preparing: "Khalifa reads the order summary and suggests the next action.",\n',
    '    preparing: "The Abu Khalifa card opens leadership and administration actions directly.",\n',
    "update English quick-help copy",
)

legacy_pattern = re.compile(
    r"\nfunction KhalifaPanel\(\{[\s\S]*?\n\}\n\nfunction AdminOrderCommandDeck",
)
replacement = '''
const EMPLOYEE_PATH_EVENT = "dn-employee-hr-path";

function openEmployeeWorkspace() {
  const url = new URL(window.location.href);
  url.pathname = "/admin";
  url.search = "";
  url.searchParams.set("hr", "employees");
  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(
    new PopStateEvent("popstate", { state: window.history.state }),
  );
  window.dispatchEvent(
    new CustomEvent<string>(EMPLOYEE_PATH_EVENT, {
      detail: "employee:directory",
    }),
  );
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function isOrderCreatedToday(order: any) {
  const value = order?.created_at || order?.createdAt || order?.created;
  if (!value) return false;
  const created = new Date(value);
  if (Number.isNaN(created.getTime())) return false;
  const now = new Date();
  return (
    created.getFullYear() === now.getFullYear() &&
    created.getMonth() === now.getMonth() &&
    created.getDate() === now.getDate()
  );
}

function AdminOrderCommandDeck'''
admin, count = legacy_pattern.subn(replacement, admin, count=1)
if count != 1:
    raise RuntimeError(f"remove legacy KhalifaPanel: expected one block, found {count}")

admin = replace_once(
    admin,
    '  const metrics = useMemo(() => buildMetrics(orders), [orders]);\n\n  const groupedMenu',
    '  const metrics = useMemo(() => buildMetrics(orders), [orders]);\n  const todayOrders = useMemo(\n    () => orders.filter(isOrderCreatedToday).length,\n    [orders],\n  );\n\n  const groupedMenu',
    "derive today order count",
)

admin = replace_once(
    admin,
    '''  function renderDashboardCenter() {\n''',
    '''  function handleExecutiveAction(action: AbuKhalifaAction) {
    switch (action) {
      case "new-order":
        setSection("new_order");
        return;
      case "orders":
        setSection("all_orders");
        return;
      case "reports":
        setSection("reports");
        return;
      case "messages":
        setSection("support");
        return;
      case "employees":
      case "payroll":
        setActive("dashboard");
        setMobileMenu(false);
        openEmployeeWorkspace();
        return;
    }
  }

  function renderDashboardCenter() {
''',
    "add direct React quick actions",
)

old_render = '''          <div className="dn-admin-home-full">
            <KhalifaPanel
              isArabic={isArabic}
              ui={ui}
              active={active}
              activeTitle={activeTitle}
              orders={orders}
              merchants={merchants}
              financeSummary={financeSummary}
              lastSyncAt={lastSyncAt}
            />

            <div className="dn-admin-workspace-host">{renderWorkspace()}</div>
          </div>'''
new_render = '''          <div className="dn-admin-home-full">
            <aside
              className="dn-admin-left-ai dn-admin-left-ai--executive"
              aria-label={
                isArabic ? "بطاقة أبو خليفه التنفيذية" : "Abu Khalifa executive card"
              }
            >
              <AbuKhalifaExecutiveCard
                isArabic={isArabic}
                isAvailable={!adminLoading && !adminError}
                ordersToday={todayOrders}
                activeServices={metrics.active}
                lastSync={
                  lastSyncAt
                    ? lastSyncAt.toLocaleTimeString(isArabic ? "ar-AE" : "en-AE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"
                }
                currentSection={activeTitle}
                onNavigate={handleExecutiveAction}
              />
            </aside>

            <div className="dn-admin-workspace-host">{renderWorkspace()}</div>
          </div>'''
admin = replace_once(admin, old_render, new_render, "replace legacy panel with direct card")

for forbidden in [
    "function KhalifaPanel(",
    "<KhalifaPanel",
    "KhalifaGuidanceFeed",
    "khalifaAssets",
    "مساعد العمليات الذكي",
    "Smart Operations Assistant",
]:
    if forbidden in admin:
        raise RuntimeError(f"AdminPanelLuxury still contains forbidden legacy token: {forbidden}")

if admin.count("<AbuKhalifaExecutiveCard") != 1:
    raise RuntimeError("AdminPanelLuxury must render exactly one AbuKhalifaExecutiveCard")

write(admin_path, admin)

# The enhancement root now owns only admin form and INP hooks. The executive
# card is rendered by AdminPanelLuxury itself through normal React ownership.
enhancements_path = APP / "src/components/admin/AdminExperienceEnhancements.tsx"
write(
    enhancements_path,
    '''import { useAdminFormKeyboardNavigation } from "../../hooks/useAdminFormKeyboardNavigation";
import { useAdminInteractionPerformanceBudget } from "../../hooks/useAdminInteractionPerformanceBudget";
import "../../styles/dn-admin-form-inputs.css";

/** Administration-only form and interaction-performance enhancements. */
export default function AdminExperienceEnhancements() {
  useAdminFormKeyboardNavigation(true);
  useAdminInteractionPerformanceBudget(true);
  return null;
}
''',
)

bridge_path = APP / "src/components/admin/AbuKhalifaExecutiveCardBridge.tsx"
if not bridge_path.exists():
    raise RuntimeError("Expected AbuKhalifaExecutiveCardBridge.tsx before deletion")
bridge_path.unlink()

css_path = APP / "src/styles/abu-khalifa-executive-card.css"
css = read(css_path)
css = replace_once(
    css,
    '''.dn-admin-left-ai.dn-admin-left-ai--executive {
  align-self: start;
  overflow: visible;
}

.dn-admin-left-ai.dn-admin-left-ai--executive > :not(.dn-abu-khalifa-executive-host) {
  display: none !important;
}

.dn-abu-khalifa-executive-host,
.abu-khalifa-card-shell {''',
    '''.dn-admin-left-ai.dn-admin-left-ai--executive {
  align-self: start;
  overflow: visible;
}

.abu-khalifa-card-shell {''',
    "remove bridge-only CSS hiding",
)
if "dn-abu-khalifa-executive-host" in css:
    raise RuntimeError("Executive card CSS still references the injected host")
write(css_path, css)

card_path = APP / "src/components/admin/AbuKhalifaExecutiveCard.tsx"
card = read(card_path)
card = replace_once(
    card,
    '<div className="abu-khalifa-card-shell" dir={direction}>',
    '<div className="abu-khalifa-card-shell" dir={direction} data-testid="abu-khalifa-executive-card">',
    "add executive card test id",
)
card = replace_once(
    card,
    '        className="abu-khalifa-launcher"\n        aria-expanded={isOpen}',
    '        className="abu-khalifa-launcher"\n        data-testid="abu-khalifa-executive-launcher"\n        aria-expanded={isOpen}',
    "add launcher test id",
)
write(card_path, card)

gate_path = APP / "scripts/p1-production-hardening-gate.mjs"
gate = read(gate_path)
old_gate = '''const bridge = read("src/components/admin/AbuKhalifaExecutiveCardBridge.tsx");
requireText(bridge, 'const ADMIN_ROOT_SELECTOR = ".dn-admin-fullscreen"', "executive card admin scope");
forbidText(bridge, "observer.observe(document.body", "executive card document observer");
forbidText(bridge, "characterData: true", "executive card character observer");
'''
new_gate = '''const adminPanel = read("src/components/AdminPanelLuxury.tsx");
requireText(adminPanel, 'from "./admin/AbuKhalifaExecutiveCard"', "direct executive card import");
requireSingleOccurrence(adminPanel, "<AbuKhalifaExecutiveCard", "direct executive card render count");
requireText(adminPanel, "onNavigate={handleExecutiveAction}", "React-owned executive navigation");
forbidText(adminPanel, "function KhalifaPanel(", "legacy Khalifa component");
forbidText(adminPanel, "<KhalifaPanel", "legacy Khalifa render");
forbidText(adminPanel, "مساعد العمليات الذكي", "legacy assistant identity");
forbidText(adminPanel, "Smart Operations Assistant", "legacy assistant identity English");

const enhancements = read("src/components/admin/AdminExperienceEnhancements.tsx");
forbidText(enhancements, "AbuKhalifaExecutiveCardBridge", "executive bridge mount");
if (fs.existsSync(path.resolve(ROOT, "src/components/admin/AbuKhalifaExecutiveCardBridge.tsx"))) {
  throw new Error("executive bridge file must be deleted");
}

const executiveCard = read("src/components/admin/AbuKhalifaExecutiveCard.tsx");
requireText(executiveCard, 'data-testid="abu-khalifa-executive-card"', "executive card DOM contract");
requireText(executiveCard, 'data-testid="abu-khalifa-executive-launcher"', "executive launcher DOM contract");

const executiveCss = read("src/styles/abu-khalifa-executive-card.css");
forbidText(executiveCss, "dn-abu-khalifa-executive-host", "injected executive host CSS");
forbidText(executiveCss, "> :not(.dn-abu-khalifa-executive-host)", "legacy child hiding CSS");
'''
gate = replace_once(gate, old_gate, new_gate, "replace bridge gate with direct integration gate")
write(gate_path, gate)

# Final source-level acceptance checks.
if "AbuKhalifaExecutiveCardBridge" in read(enhancements_path):
    raise RuntimeError("Enhancements still mount the bridge")
if bridge_path.exists():
    raise RuntimeError("Bridge file deletion failed")

print("Issue #270 direct Abu Khalifa integration patch applied successfully.")
