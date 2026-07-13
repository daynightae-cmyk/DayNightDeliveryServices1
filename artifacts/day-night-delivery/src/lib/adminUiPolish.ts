import { supabase } from "../supabase";

const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

const AR_REPLACEMENTS: Array<[RegExp, string]> = [
  [/إضافة طلب جديد/g, "إضافة طلبية جديدة"],
  [/إضافة طلب(?!ية)/g, "إضافة طلبية"],
  [/طلب جديد/g, "طلبية جديدة"],
  [/طلب محمل/g, "طلبية محملة"],
  [/طلب ملغي/g, "طلبية ملغية"],
  [/طلب مكتمل/g, "طلبية مكتملة"],
  [/طلب تم تسليمه/g, "طلبية تم تسليمها"],
  [/طلب قيد الانتظار/g, "طلبية قيد الانتظار"],
  [/التحصيل\s*COD/g, "التحصيل عند التسليم"],
  [/إجمالي\s*COD/g, "إجمالي التحصيل"],
  [/COD\s*معلق/g, "تحصيل معلق"],
  [/تحصيل أول\s*COD/g, "تحصيل أول طلبية"],
  [/تسوية أول\s*COD/g, "تسوية أول تحصيل"],
  [/نسبة\s*COD/g, "نسبة التحصيل"],
  [/تعرض\s*COD\s*المعلق/g, "التعرض للتحصيل المعلق"],
  [/صف\s*COD\s*حي/g, "صف تحصيل حي"],
  [/COD\s*الطلب/g, "تحصيل الطلبية"],
  [/COD/g, "تحصيل"],
];

const EN_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bCOD\s*Collection\b/g, "Cash on Delivery"],
  [/\bPending\s*COD\b/g, "Pending Cash"],
  [/\bOrder\s*COD\b/g, "Order Cash"],
  [/\bCOD\b/g, "Cash on Delivery"],
];

type AdminCommandMetrics = {
  total: number;
  review: number;
  cancelled: number;
  postponed: number;
  returned: number;
  pickup: number;
  abuDhabi: number;
  external: number;
  outScope: number;
};

type AdminCommandCard = {
  id: string;
  metric: keyof AdminCommandMetrics;
  tone: string;
  ar: string;
  en: string;
  hintAr: string;
  hintEn: string;
  navAr: string[];
  navEn: string[];
};

const EMPTY_COMMAND_METRICS: AdminCommandMetrics = {
  total: 0,
  review: 0,
  cancelled: 0,
  postponed: 0,
  returned: 0,
  pickup: 0,
  abuDhabi: 0,
  external: 0,
  outScope: 0,
};

const COMMAND_CARDS: AdminCommandCard[] = [
  { id: "all_orders", metric: "total", tone: "all", ar: "الكل", en: "All", hintAr: "كل الطلبيات", hintEn: "All shipments", navAr: ["كافة الطلبات", "كافة الطلبيات"], navEn: ["All Orders", "All Shipments"] },
  { id: "review", metric: "review", tone: "review", ar: "قيد المراجعة", en: "Review", hintAr: "تحتاج قرار", hintEn: "Needs action", navAr: ["الطلبات قيد المراجعة", "الطلبيات قيد المراجعة", "قيد المراجعة"], navEn: ["Under Review"] },
  { id: "cancelled", metric: "cancelled", tone: "cancelled", ar: "ملغية", en: "Cancelled", hintAr: "طلبات ملغية", hintEn: "Cancelled", navAr: ["الطلبات الملغية", "الطلبيات الملغية", "ملغية"], navEn: ["Cancelled Orders", "Cancelled"] },
  { id: "postponed", metric: "postponed", tone: "postponed", ar: "مؤجلة", en: "Postponed", hintAr: "مواعيد لاحقة", hintEn: "Scheduled later", navAr: ["الطلبات المؤجلة", "الطلبيات المؤجلة", "مؤجلة"], navEn: ["Postponed Orders", "Postponed"] },
  { id: "returned", metric: "returned", tone: "returned", ar: "راجعة", en: "Returned", hintAr: "مرتجعات", hintEn: "Returns", navAr: ["الطلبات الراجعة", "الطلبيات الراجعة", "راجعة"], navEn: ["Returned Orders", "Returned"] },
  { id: "pickup", metric: "pickup", tone: "pickup", ar: "قيد الإحضار", en: "Pickup", hintAr: "إحضار وتوزيع", hintEn: "Pickup flow", navAr: ["الطلبات قيد الإحضار", "الطلبيات قيد الإحضار", "قيد الإحضار"], navEn: ["Pickup Orders", "Pickup"] },
  { id: "abu_dhabi", metric: "abuDhabi", tone: "local", ar: "أبوظبي", en: "Abu Dhabi", hintAr: "مسار محلي", hintEn: "Local route", navAr: ["طلبات أبوظبي", "طلبيات أبوظبي", "أبوظبي"], navEn: ["Abu Dhabi Orders", "Abu Dhabi"] },
  { id: "external", metric: "external", tone: "external", ar: "خارجي", en: "External", hintAr: "خارج الإمارة/دولي", hintEn: "External / international", navAr: ["الطلبات الخارجية", "الطلبيات الخارجية", "خارجي"], navEn: ["External Orders", "External"] },
  { id: "out_scope", metric: "outScope", tone: "danger", ar: "خارج النطاق", en: "Out of scope", hintAr: "يحتاج موافقة", hintEn: "Needs approval", navAr: ["الطلبات خارج النطاق", "الطلبيات خارج النطاق", "خارج النطاق"], navEn: ["Out of Scope"] },
];

let commandMetrics: AdminCommandMetrics = { ...EMPTY_COMMAND_METRICS };
let commandMetricsLoading = false;
let commandMetricsFetchedAt = 0;
let commandInterval: number | undefined;

function getAdminRoot() {
  return document.querySelector<HTMLElement>(".dn-admin-fullscreen");
}

function isAdminPage() {
  return window.location.pathname.startsWith("/admin") || Boolean(getAdminRoot());
}

function currentReplacements() {
  const root = getAdminRoot();
  const isArabic = root?.getAttribute("dir") !== "ltr";
  return isArabic ? AR_REPLACEMENTS : EN_REPLACEMENTS;
}

function polishText(value: string) {
  if (!value || !isAdminPage()) return value;
  let next = value;
  for (const [pattern, replacement] of currentReplacements()) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

function shouldSkipElement(element: Element | null) {
  const tag = element?.tagName?.toLowerCase();
  return tag === "script" || tag === "style" || tag === "textarea" || tag === "input" || tag === "option";
}

function polishNode(node: Node) {
  if (!isAdminPage()) return;
  if (node.nodeType === Node.TEXT_NODE) {
    if (shouldSkipElement(node.parentElement)) return;
    const current = node.nodeValue || "";
    const next = polishText(current);
    if (next !== current) node.nodeValue = next;
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const element = node as Element;
  if (shouldSkipElement(element)) return;

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(textNode) {
      return shouldSkipElement(textNode.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  for (const textNode of textNodes) polishNode(textNode);
}

function normalizeValue(value: unknown) {
  return String(value || "").toLowerCase().replace(/[_-]/g, " ").trim();
}

function orderRouteText(order: Record<string, unknown>) {
  return [
    order.sender_city,
    order.receiver_city,
    order.pickup_city,
    order.delivery_city,
    order.destination_country,
    order.shipping_scope,
    order.service_type,
  ].map((value) => String(value || "")).join(" ").toLowerCase();
}

function orderStatus(order: Record<string, unknown>) {
  return normalizeValue(order.status);
}

function isDelivered(order: Record<string, unknown>) {
  return /deliver|complete|تم التسليم|مكتمل/.test(orderStatus(order));
}

function isCancelled(order: Record<string, unknown>) {
  return /cancel|fail|ملغ/.test(orderStatus(order));
}

function isReturned(order: Record<string, unknown>) {
  return /return|راجع|مرتجع/.test(orderStatus(order));
}

function isReview(order: Record<string, unknown>) {
  return /pending|review|confirm|hold|مراجعة|انتظار/.test(orderStatus(order));
}

function isPostponed(order: Record<string, unknown>) {
  return /postpone|defer|schedule|مؤجل|تأجيل/.test(orderStatus(order));
}

function isPickup(order: Record<string, unknown>) {
  return /pick|assign|collect|إحضار|احضار|مندوب/.test(orderStatus(order));
}

function isAbuDhabi(order: Record<string, unknown>) {
  return /abu dhabi|mussafah|khalifa|mbz|أبوظبي|ابوظبي/.test(orderRouteText(order));
}

function isExternal(order: Record<string, unknown>) {
  return /international|external|gcc|world|saudi|kuwait|qatar|bahrain|oman|دولي|خارجي/.test(orderRouteText(order));
}

function isOutScope(order: Record<string, unknown>) {
  const text = `${order.status || ""} ${order.notes || ""} ${order.internal_notes || ""} ${order.admin_notes || ""}`.toLowerCase();
  return /out.?of.?scope|unsupported|خارج النطاق/.test(text);
}

function buildCommandMetrics(orders: Record<string, unknown>[]): AdminCommandMetrics {
  return {
    total: orders.length,
    review: orders.filter(isReview).length,
    cancelled: orders.filter(isCancelled).length,
    postponed: orders.filter(isPostponed).length,
    returned: orders.filter(isReturned).length,
    pickup: orders.filter(isPickup).length,
    abuDhabi: orders.filter(isAbuDhabi).length,
    external: orders.filter(isExternal).length,
    outScope: orders.filter(isOutScope).length,
  };
}

function readMetricsFromVisibleDashboard() {
  const root = getAdminRoot();
  if (!root) return null;
  const cards = Array.from(root.querySelectorAll<HTMLElement>(".dn-admin-dashboard-kpis > article"));
  if (!cards.length) return null;
  const next = { ...commandMetrics };
  for (const card of cards) {
    const valueText = card.querySelector("strong")?.textContent?.replace(/[^0-9.-]/g, "") || "";
    const value = Number(valueText || 0);
    const label = card.textContent || "";
    if (/إجمالي|Total/i.test(label)) next.total = value;
  }
  return next;
}

async function refreshCommandMetrics(force = false) {
  if (!isAdminPage() || commandMetricsLoading) return;
  const now = Date.now();
  if (!force && now - commandMetricsFetchedAt < 25000) return;
  commandMetricsLoading = true;
  commandMetricsFetchedAt = now;

  try {
    if (!supabase) throw new Error("Supabase client is not configured.");
    const { data, error } = await supabase.from("orders").select("*").limit(1000);
    if (error) throw error;
    commandMetrics = buildCommandMetrics((data || []) as Record<string, unknown>[]);
  } catch (error) {
    console.warn("Admin command deck metrics fallback:", error);
    commandMetrics = readMetricsFromVisibleDashboard() || commandMetrics;
  } finally {
    commandMetricsLoading = false;
    renderCommandDeck();
  }
}

function injectCommandDeckStyle() {
  if (document.getElementById("dn-admin-simple-shell-style")) return;
  const style = document.createElement("style");
  style.id = "dn-admin-simple-shell-style";
  style.textContent = `
    body:has(.dn-admin-fullscreen) { overflow-x: hidden !important; }
    .dn-admin-layout-full { gap: 10px !important; padding: 10px !important; grid-template-columns: minmax(0, 1fr) 250px !important; }
    .dn-admin-sidebar-full { position: sticky !important; top: 10px !important; max-height: calc(100dvh - 20px) !important; overflow-y: auto !important; border-radius: 18px !important; }
    .dn-admin-content-full { min-width: 0 !important; }
    .dn-admin-top-strip { min-height: 42px !important; padding: 6px 8px !important; margin-bottom: 8px !important; }
    .dn-admin-current-section { margin: 4px 0 8px !important; min-height: 32px !important; padding: 4px 8px !important; }
    .dn-admin-home-full { gap: 10px !important; grid-template-columns: 225px minmax(0, 1fr) !important; }
    .dn-admin-left-ai { max-height: calc(100dvh - 116px) !important; overflow-y: auto !important; border-radius: 18px !important; }
    .dn-admin-workspace-host, .dn-admin-center-zone { min-width: 0 !important; }
    .dn-admin-center-zone { padding: 0 !important; }
    .dn-admin-dashboard-polished { gap: 10px !important; }
    .dn-admin-dashboard-hero { min-height: auto !important; padding: 12px 16px !important; border-radius: 18px !important; }
    .dn-admin-dashboard-hero h1 { font-size: clamp(1.35rem, 2.2vw, 2.25rem) !important; line-height: 1.1 !important; }
    .dn-admin-dashboard-hero p { font-size: .8rem !important; }
    .dn-admin-dashboard-kpis { grid-template-columns: repeat(6, minmax(130px, 1fr)) !important; gap: 8px !important; }
    .dn-admin-dashboard-kpis > article { min-height: 70px !important; padding: 10px !important; border-radius: 14px !important; }
    .dn-admin-map-first-grid { grid-template-columns: minmax(0, 1fr) 310px !important; gap: 10px !important; justify-content: stretch !important; }
    .dn-admin-map-primary, .dn-live-map-shell { max-width: 100% !important; }
    .dn-live-map-shell { padding: 8px !important; border-radius: 16px !important; gap: 7px !important; }
    .dn-live-map-shell > .leaflet-container { min-height: 320px !important; aspect-ratio: 16 / 9 !important; border-radius: 14px !important; }
    .dn-map-control-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 6px !important; }
    .dn-map-mode-bar, .dn-map-region-chips, .dn-map-action-bar, .dn-map-route-summary { padding: 6px !important; gap: 5px !important; }
    .dn-map-mode-bar button, .dn-map-region-chips button, .dn-map-action-bar button { min-height: 28px !important; padding: 4px 8px !important; font-size: .66rem !important; }
    .dn-admin-quick-actions-compact { max-width: none !important; padding: 10px !important; border-radius: 16px !important; }
    .dn-admin-action-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 7px !important; }
    .dn-admin-action-tile { min-height: 48px !important; padding: 8px !important; border-radius: 12px !important; }
    .dn-admin-dashboard-secondary-grid { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)) !important; gap: 8px !important; }
    .dn-admin-secondary-panel { min-height: 82px !important; padding: 10px !important; border-radius: 14px !important; }
    .dn-admin-simple-command-deck { position: relative; z-index: 50; display: grid; grid-template-columns: repeat(9, minmax(95px, 1fr)); gap: 8px; margin: 0 0 10px; padding: 8px; border: 1px solid rgba(24,168,232,.18); border-radius: 18px; background: linear-gradient(135deg, rgba(7,26,51,.82), rgba(2,8,18,.66)); box-shadow: 0 16px 36px rgba(0,0,0,.18); }
    .dn-admin-simple-command-card { display: grid; align-content: center; gap: 2px; min-height: 68px; padding: 10px 12px; border: 1px solid rgba(245,183,0,.22); border-radius: 14px; background: linear-gradient(145deg, rgba(0,87,184,.16), rgba(7,26,51,.86)); color: #fff; text-align: center; cursor: pointer; transition: transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease; }
    .dn-admin-simple-command-card span { font-size: .82rem; font-weight: 1000; line-height: 1.25; }
    .dn-admin-simple-command-card strong { color: #facc15; font-size: 1.18rem; font-weight: 1000; line-height: 1.1; }
    .dn-admin-simple-command-card small { color: rgba(255,255,255,.58); font-size: .64rem; font-weight: 850; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .dn-admin-simple-command-card:hover { transform: translateY(-1px); border-color: rgba(250,204,21,.62); box-shadow: 0 12px 28px rgba(0,0,0,.22); }
    .dn-admin-simple-command-card.is-current { border-color: rgba(245,183,0,.78); background: linear-gradient(145deg, rgba(245,183,0,.34), rgba(7,26,51,.88)); }
    .dn-admin-simple-command-card[data-tone="review"] { background: linear-gradient(145deg, rgba(24,168,232,.2), rgba(7,26,51,.84)); }
    .dn-admin-simple-command-card[data-tone="cancelled"], .dn-admin-simple-command-card[data-tone="danger"] { background: linear-gradient(145deg, rgba(239,68,68,.18), rgba(7,26,51,.84)); }
    .dn-admin-simple-command-card[data-tone="postponed"] { background: linear-gradient(145deg, rgba(168,85,247,.18), rgba(7,26,51,.84)); }
    .dn-admin-simple-command-card[data-tone="returned"] { background: linear-gradient(145deg, rgba(251,146,60,.18), rgba(7,26,51,.84)); }
    .dn-admin-simple-command-card[data-tone="pickup"] { background: linear-gradient(145deg, rgba(20,184,166,.2), rgba(7,26,51,.84)); }
    .dn-admin-simple-command-card[data-tone="external"] { background: linear-gradient(145deg, rgba(59,130,246,.18), rgba(7,26,51,.84)); }
    @media (max-width: 1500px) { .dn-admin-simple-command-deck { grid-template-columns: repeat(5, minmax(110px, 1fr)); } .dn-admin-dashboard-kpis { grid-template-columns: repeat(3, minmax(150px, 1fr)) !important; } }
    @media (max-width: 1180px) { .dn-admin-layout-full { display: block !important; } .dn-admin-home-full { grid-template-columns: 1fr !important; } .dn-admin-left-ai { display: none !important; } .dn-admin-map-first-grid { grid-template-columns: 1fr !important; } .dn-admin-simple-command-deck { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    @media (max-width: 680px) { .dn-admin-simple-command-deck { grid-template-columns: repeat(2, minmax(0, 1fr)); } .dn-admin-dashboard-kpis { grid-template-columns: 1fr !important; } .dn-live-map-shell > .leaflet-container { min-height: 280px !important; } }
  `;
  document.head.appendChild(style);
}

function isArabicAdmin() {
  return getAdminRoot()?.getAttribute("dir") !== "ltr";
}

function getCurrentSectionText() {
  return getAdminRoot()?.querySelector(".dn-admin-current-section strong")?.textContent || "";
}

function isCurrentCommand(card: AdminCommandCard) {
  const current = getCurrentSectionText();
  const labels = isArabicAdmin() ? card.navAr : card.navEn;
  return labels.some((label) => current.includes(label) || label.includes(current));
}

function clickAdminSection(id: string) {
  const card = COMMAND_CARDS.find((item) => item.id === id);
  if (!card) return;
  const labels = isArabicAdmin() ? card.navAr : card.navEn;
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".dn-admin-side-nav button"));
  const target = buttons.find((button) => {
    const text = button.textContent?.replace(/\s+/g, " ").trim() || "";
    return labels.some((label) => text.includes(label));
  });
  target?.click();
}

function renderCommandDeck() {
  if (!isBrowser || !isAdminPage()) return;
  const root = getAdminRoot();
  const content = root?.querySelector<HTMLElement>(".dn-admin-content-full");
  if (!root || !content) return;
  injectCommandDeckStyle();

  let deck = content.querySelector<HTMLElement>(".dn-admin-simple-command-deck");
  const anchor = content.querySelector<HTMLElement>(".dn-admin-current-section");
  if (!deck) {
    deck = document.createElement("section");
    deck.className = "dn-admin-simple-command-deck";
    deck.setAttribute("aria-label", isArabicAdmin() ? "بطاقات الدخول السريع للأقسام" : "Quick section cards");
    deck.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("button[data-section]");
      if (!button) return;
      clickAdminSection(button.dataset.section || "");
    });
    if (anchor) anchor.insertAdjacentElement("afterend", deck);
    else content.insertAdjacentElement("afterbegin", deck);
  }

  deck.innerHTML = COMMAND_CARDS.map((card) => {
    const label = isArabicAdmin() ? card.ar : card.en;
    const hint = isArabicAdmin() ? card.hintAr : card.hintEn;
    const value = commandMetrics[card.metric] ?? 0;
    const current = isCurrentCommand(card) ? " is-current" : "";
    return `<button type="button" class="dn-admin-simple-command-card${current}" data-section="${card.id}" data-tone="${card.tone}" aria-label="${label}"><span>${label}</span><strong>${value}</strong><small>${hint}</small></button>`;
  }).join("");
}

function ensureCommandDeckRuntime() {
  if (!isBrowser || !isAdminPage()) return;
  renderCommandDeck();
  void refreshCommandMetrics();
  if (!commandInterval) {
    commandInterval = window.setInterval(() => {
      if (!isAdminPage()) return;
      void refreshCommandMetrics();
    }, 30000);
  }
}

function schedulePolish() {
  if (!isBrowser) return;
  window.requestAnimationFrame(() => {
    polishNode(document.body);
    ensureCommandDeckRuntime();
  });
}

if (isBrowser) {
  schedulePolish();
  const observer = new MutationObserver((mutations) => {
    if (!isAdminPage()) return;
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(polishNode);
      if (mutation.type === "characterData") polishNode(mutation.target);
    }
    renderCommandDeck();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  window.addEventListener("popstate", schedulePolish);
  window.addEventListener("hashchange", schedulePolish);
  window.addEventListener("dn-admin-settings-change", schedulePolish);
  window.setTimeout(schedulePolish, 300);
  window.setTimeout(schedulePolish, 1200);
}

export {};
