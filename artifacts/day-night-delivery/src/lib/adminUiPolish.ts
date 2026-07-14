const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

const AR_REPLACEMENTS: Array<[RegExp, string]> = [
  [/الطلبات الخارجية/g, "الطلبات الدولية"],
  [/الطلبيات الخارجية/g, "الطلبيات الدولية"],
  [/خارجي/g, "دولي"],
  [/الطلبات خارج النطاق/g, "باقي الإمارات"],
  [/الطلبيات خارج النطاق/g, "باقي الإمارات"],
  [/خارج النطاق/g, "باقي الإمارات"],
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
  [/\bExternal\s*Orders\b/g, "International Orders"],
  [/\bExternal\b/g, "International"],
  [/\bOut\s*of\s*Scope\b/g, "Other Emirates"],
  [/\bCOD\s*Collection\b/g, "Cash on Delivery"],
  [/\bPending\s*COD\b/g, "Pending Cash"],
  [/\bOrder\s*COD\b/g, "Order Cash"],
  [/\bCOD\b/g, "Cash on Delivery"],
];

type MetricKey = "total" | "cancelled" | "review" | "postponed" | "returned" | "pickup" | "abuDhabi" | "external" | "outScope";
type Metrics = Record<MetricKey, number>;
type Card = { id: string; metric: MetricKey; tone: string; ar: string; en: string; hintAr: string; hintEn: string; navAr: string[]; navEn: string[] };

const EMPTY: Metrics = { total: 0, cancelled: 0, review: 0, postponed: 0, returned: 0, pickup: 0, abuDhabi: 0, external: 0, outScope: 0 };
const MENU_ORDER = ["dashboard", "new_order", "new_merchant", "merchants", "all_orders", "cancelled", "review", "postponed", "returned", "pickup", "abu_dhabi", "external", "out_scope", "finance_dashboard", "driver_statements", "merchant_statements", "income", "cod", "expenses", "accounts", "adjustments", "audit_log", "import", "print", "reports", "settings", "support", "database_health", "production_readiness", "logout"];
const CARDS: Card[] = [
  { id: "all_orders", metric: "total", tone: "all", ar: "الكل", en: "All", hintAr: "كل الطلبيات", hintEn: "All shipments", navAr: ["كافة الطلبات", "كافة الطلبيات"], navEn: ["All Orders", "All Shipments"] },
  { id: "cancelled", metric: "cancelled", tone: "cancelled", ar: "ملغية", en: "Cancelled", hintAr: "المكنسل", hintEn: "Cancelled", navAr: ["الطلبات الملغية", "الطلبيات الملغية", "ملغية"], navEn: ["Cancelled Orders", "Cancelled"] },
  { id: "review", metric: "review", tone: "review", ar: "قيد المراجعة", en: "Review", hintAr: "تحتاج قرار", hintEn: "Needs action", navAr: ["الطلبات قيد المراجعة", "الطلبيات قيد المراجعة", "قيد المراجعة"], navEn: ["Under Review", "Review"] },
  { id: "postponed", metric: "postponed", tone: "postponed", ar: "مؤجلة", en: "Postponed", hintAr: "مواعيد لاحقة", hintEn: "Scheduled later", navAr: ["الطلبات المؤجلة", "الطلبيات المؤجلة", "مؤجلة"], navEn: ["Postponed Orders", "Postponed"] },
  { id: "returned", metric: "returned", tone: "returned", ar: "راجعة", en: "Returned", hintAr: "مرتجعات", hintEn: "Returns", navAr: ["الطلبات الراجعة", "الطلبيات الراجعة", "راجعة"], navEn: ["Returned Orders", "Returned"] },
  { id: "pickup", metric: "pickup", tone: "pickup", ar: "قيد الإحضار", en: "Pickup", hintAr: "إحضار وتوزيع", hintEn: "Pickup flow", navAr: ["الطلبات قيد الإحضار", "الطلبيات قيد الإحضار", "قيد الإحضار"], navEn: ["Pickup Orders", "Pickup"] },
  { id: "abu_dhabi", metric: "abuDhabi", tone: "local", ar: "أبوظبي", en: "Abu Dhabi", hintAr: "محلي", hintEn: "Local", navAr: ["طلبات أبوظبي", "طلبيات أبوظبي", "أبوظبي"], navEn: ["Abu Dhabi Orders", "Abu Dhabi"] },
  { id: "external", metric: "external", tone: "external", ar: "الدولي", en: "International", hintAr: "خليجي/عالمي", hintEn: "GCC / worldwide", navAr: ["الطلبات الدولية", "الطلبيات الدولية", "الدولي"], navEn: ["International Orders", "International"] },
  { id: "out_scope", metric: "outScope", tone: "danger", ar: "باقي الإمارات", en: "Other Emirates", hintAr: "دبي/الشارقة/عجمان", hintEn: "Dubai / Sharjah / Ajman", navAr: ["باقي الإمارات"], navEn: ["Other Emirates"] },
];

let metrics: Metrics = { ...EMPTY };
let loadingMetrics = false;
let lastFetch = 0;
let lastRender = "";
let scheduled = false;
let intervalId: number | undefined;

function root() { return document.querySelector<HTMLElement>(".dn-admin-fullscreen"); }
function isAdminPage() { return isBrowser && (window.location.pathname.startsWith("/admin") || Boolean(root())); }
function isArabic() { return root()?.getAttribute("dir") !== "ltr"; }
function skip(el: Element | null) { const tag = el?.tagName?.toLowerCase(); return tag === "script" || tag === "style" || tag === "textarea" || tag === "input" || tag === "option" || tag === "select"; }
function polishText(value: string) { let next = value; for (const [pattern, replacement] of (isArabic() ? AR_REPLACEMENTS : EN_REPLACEMENTS)) next = next.replace(pattern, replacement); return next; }

function polishNode(node: Node) {
  if (!isAdminPage()) return;
  if (node.nodeType === Node.TEXT_NODE) {
    if (skip(node.parentElement)) return;
    const current = node.nodeValue || "";
    const next = polishText(current);
    if (next !== current) node.nodeValue = next;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE || skip(node as Element)) return;
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, { acceptNode: (textNode) => skip(textNode.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const list: Text[] = [];
  while (walker.nextNode()) list.push(walker.currentNode as Text);
  list.forEach(polishNode);
}

function normalize(value: unknown) { return String(value || "").toLowerCase().replace(/[ـ]/g, "").replace(/[_-]/g, " ").trim(); }
function route(order: Record<string, unknown>) { return [order.sender_city, order.receiver_city, order.pickup_city, order.delivery_city, order.destination_country, order.shipping_scope, order.service_type, order.notes, order.internal_notes, order.admin_notes].map((value) => String(value || "")).join(" ").toLowerCase(); }
function status(order: Record<string, unknown>) { return normalize(`${order.status || ""} ${route(order)}`); }
function isInternational(order: Record<string, unknown>) { return /international|external|gcc|world|worldwide|saudi|kuwait|qatar|bahrain|oman|usa|uk|europe|canada|australia|دولي|خارجي|خليجي|السعودية|الكويت|قطر|البحرين|عمان/.test(route(order)); }
function isAbuDhabiRoute(order: Record<string, unknown>) { return !isInternational(order) && /abu dhabi|mussafah|khalifa|mbz|al ain|أبوظبي|ابوظبي|العين|مصفح/.test(route(order)); }
function isOtherEmirate(order: Record<string, unknown>) { return !isInternational(order) && !isAbuDhabiRoute(order) && /dubai|sharjah|ajman|umm al quwain|ras al khaimah|fujairah|khor fakkan|دبي|الشارقة|عجمان|أم القيوين|ام القيوين|رأس الخيمة|راس الخيمة|الفجيرة|خورفكان/.test(route(order)); }
function calc(data: Record<string, unknown>[]): Metrics {
  return {
    total: data.length,
    cancelled: data.filter((order) => /cancel|canceled|cancelled|fail|ملغ|الغاء|إلغاء|كنسل/.test(status(order))).length,
    review: data.filter((order) => /review|under.?review|manual|hold|مراجعة/.test(status(order))).length,
    postponed: data.filter((order) => /postpone|defer|schedule|later|مؤجل|تأجيل/.test(status(order))).length,
    returned: data.filter((order) => /return|returned|راجع|راجعة|مرتجع|مرتجعة|ارجاع|إرجاع/.test(status(order))).length,
    pickup: data.filter((order) => /pick|pickup|assign|assigned|collect|إحضار|احضار|مندوب/.test(status(order))).length,
    abuDhabi: data.filter(isAbuDhabiRoute).length,
    external: data.filter(isInternational).length,
    outScope: data.filter(isOtherEmirate).length,
  };
}

function readVisibleTotal() {
  const cards = Array.from(document.querySelectorAll<HTMLElement>(".dn-admin-dashboard-kpis > article"));
  const total = cards.find((card) => /إجمالي|Total/i.test(card.textContent || ""));
  return Number(total?.querySelector("strong")?.textContent?.replace(/[^0-9.-]/g, "") || 0);
}

async function refreshMetrics(force = false) {
  if (!isAdminPage() || loadingMetrics) return;
  const now = Date.now();
  if (!force && now - lastFetch < 25000) return;
  lastFetch = now;
  loadingMetrics = true;
  try {
    const { supabase } = await import("../supabase");
    if (!supabase) throw new Error("Supabase client not ready");
    const { data, error } = await supabase.from("orders").select("*").limit(2000);
    if (error) throw error;
    metrics = calc((data || []) as Record<string, unknown>[]);
  } catch (error) {
    const total = readVisibleTotal();
    if (Number.isFinite(total) && total > 0) metrics = { ...metrics, total };
    console.warn("DAY NIGHT command cards metrics fallback:", error);
  } finally {
    loadingMetrics = false;
    renderDeck();
  }
}

function injectStyle() {
  if (document.getElementById("dn-admin-command-style")) return;
  const style = document.createElement("style");
  style.id = "dn-admin-command-style";
  style.textContent = `
    .dn-admin-fullscreen .dn-admin-layout-full { grid-template-columns: minmax(0, 1fr) clamp(282px, 17vw, 330px) !important; gap: 10px !important; padding: 9px !important; }
    .dn-admin-fullscreen .dn-admin-home-full { grid-template-columns: 205px minmax(0, 1fr) !important; gap: 9px !important; align-items: start !important; }
    .dn-admin-fullscreen .dn-admin-sidebar-full { position: sticky !important; top: 9px !important; width: 100% !important; min-width: 282px !important; max-width: 330px !important; max-height: calc(100dvh - 18px) !important; overflow-y: auto !important; overflow-x: hidden !important; border-radius: 16px !important; padding: 8px !important; }
    .dn-admin-fullscreen .dn-admin-brand-block { padding: 8px !important; border-radius: 13px !important; } .dn-admin-fullscreen .dn-admin-brand-block img { width: 62px !important; height: 62px !important; }
    .dn-admin-fullscreen .dn-admin-side-nav { gap: 5px !important; }
    .dn-admin-fullscreen .dn-admin-side-nav h3 { margin: 5px 0 2px !important; font-size: .64rem !important; }
    .dn-admin-fullscreen .dn-admin-side-nav button { display: grid !important; grid-template-columns: 38px minmax(0, 1fr) !important; align-items: center !important; gap: 8px !important; width: 100% !important; min-height: 32px !important; padding: 4px 7px !important; border-radius: 10px !important; font-size: .73rem !important; line-height: 1.25 !important; }
    .dn-admin-fullscreen[dir="rtl"] .dn-admin-side-nav button { grid-template-columns: minmax(0, 1fr) 38px !important; }
    .dn-admin-fullscreen[dir="rtl"] .dn-admin-side-nav button .dn-admin-sidebar-icon { grid-column: 2 !important; grid-row: 1 !important; }
    .dn-admin-fullscreen[dir="rtl"] .dn-admin-side-nav button > span:last-child { grid-column: 1 !important; grid-row: 1 !important; text-align: right !important; }
    .dn-admin-fullscreen[dir="ltr"] .dn-admin-side-nav button .dn-admin-sidebar-icon { grid-column: 1 !important; grid-row: 1 !important; }
    .dn-admin-fullscreen[dir="ltr"] .dn-admin-side-nav button > span:last-child { grid-column: 2 !important; grid-row: 1 !important; text-align: left !important; }
    .dn-admin-fullscreen .dn-admin-side-nav button > span:last-child { display: block !important; min-width: 0 !important; width: 100% !important; opacity: 1 !important; visibility: visible !important; color: inherit !important; white-space: normal !important; overflow: visible !important; text-overflow: clip !important; font-weight: 950 !important; }
    .dn-admin-fullscreen .dn-admin-sidebar-icon { width: 38px !important; min-width: 38px !important; height: 24px !important; min-height: 24px !important; }
    .dn-admin-left-ai { max-height: calc(100dvh - 110px) !important; overflow-y: auto !important; border-radius: 15px !important; }
    .dn-admin-top-strip { min-height: 36px !important; padding: 6px 8px !important; margin-bottom: 6px !important; } .dn-admin-current-section { min-height: 28px !important; margin: 2px 0 7px !important; padding: 4px 8px !important; }
    .dn-admin-dashboard-hero { min-height: auto !important; padding: 12px 16px !important; border-radius: 18px !important; } .dn-admin-dashboard-hero h1 { font-size: clamp(1.35rem, 2.4vw, 2.35rem) !important; line-height: 1.1 !important; }
    .dn-admin-dashboard-kpis { grid-template-columns: repeat(6, minmax(125px, 1fr)) !important; gap: 8px !important; } .dn-admin-dashboard-kpis > article { min-height: 68px !important; padding: 9px !important; border-radius: 14px !important; }
    .dn-admin-map-first-grid { grid-template-columns: 250px minmax(0, 1fr) !important; gap: 10px !important; justify-content: stretch !important; } [dir="rtl"] .dn-admin-map-first-grid .dn-admin-quick-actions-compact { order: 1 !important; } [dir="rtl"] .dn-admin-map-first-grid .dn-admin-map-primary { order: 2 !important; }
    .dn-admin-map-primary, .dn-live-map-shell { max-width: 100% !important; } .dn-live-map-shell { padding: 8px !important; border-radius: 16px !important; gap: 7px !important; } .dn-live-map-shell > .leaflet-container { min-height: 340px !important; aspect-ratio: 16 / 9 !important; border-radius: 14px !important; }
    .dn-admin-action-grid { grid-template-columns: 1fr !important; gap: 7px !important; } .dn-admin-action-tile { min-height: 42px !important; padding: 7px !important; border-radius: 12px !important; }
    .dn-admin-command-deck { position: relative; z-index: 25; display: grid; grid-template-columns: repeat(9, minmax(92px, 1fr)); gap: 8px; margin: 0 0 10px; padding: 8px; border: 1px solid rgba(24,168,232,.18); border-radius: 18px; background: linear-gradient(135deg, rgba(7,26,51,.92), rgba(2,8,18,.74)); box-shadow: 0 14px 32px rgba(0,0,0,.18); }
    .dn-admin-command-card { display: grid; align-content: center; gap: 2px; min-height: 66px; padding: 9px 10px; border: 1px solid rgba(245,183,0,.22); border-radius: 14px; background: linear-gradient(145deg, rgba(0,87,184,.16), rgba(7,26,51,.88)); color: #fff; text-align: center; cursor: pointer; transition: transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease; }
    .dn-admin-command-card span { font-size: .8rem; font-weight: 1000; line-height: 1.2; } .dn-admin-command-card strong { color: #facc15; font-size: 1.18rem; font-weight: 1000; line-height: 1; } .dn-admin-command-card small { color: rgba(255,255,255,.6); font-size: .62rem; font-weight: 850; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .dn-admin-command-card:hover { transform: translateY(-1px); border-color: rgba(250,204,21,.68); box-shadow: 0 12px 28px rgba(0,0,0,.22); } .dn-admin-command-card.is-current { border-color: rgba(245,183,0,.8); background: linear-gradient(145deg, rgba(245,183,0,.34), rgba(7,26,51,.9)); }
    .dn-admin-command-card[data-tone="review"] { background: linear-gradient(145deg, rgba(24,168,232,.22), rgba(7,26,51,.88)); } .dn-admin-command-card[data-tone="cancelled"], .dn-admin-command-card[data-tone="danger"] { background: linear-gradient(145deg, rgba(239,68,68,.2), rgba(7,26,51,.88)); } .dn-admin-command-card[data-tone="postponed"] { background: linear-gradient(145deg, rgba(168,85,247,.2), rgba(7,26,51,.88)); } .dn-admin-command-card[data-tone="returned"] { background: linear-gradient(145deg, rgba(251,146,60,.2), rgba(7,26,51,.88)); } .dn-admin-command-card[data-tone="pickup"] { background: linear-gradient(145deg, rgba(20,184,166,.22), rgba(7,26,51,.88)); } .dn-admin-command-card[data-tone="external"] { background: linear-gradient(145deg, rgba(59,130,246,.2), rgba(7,26,51,.88)); }
    @media (max-width: 1500px) { .dn-admin-command-deck { grid-template-columns: repeat(5, minmax(105px, 1fr)); } .dn-admin-dashboard-kpis { grid-template-columns: repeat(3, minmax(145px, 1fr)) !important; } }
    @media (max-width: 1180px) { .dn-admin-layout-full { display: block !important; } .dn-admin-home-full { grid-template-columns: 1fr !important; } .dn-admin-left-ai { display: none !important; } .dn-admin-map-first-grid { grid-template-columns: 1fr !important; } .dn-admin-command-deck { grid-template-columns: repeat(3, minmax(0, 1fr)); } .dn-admin-sidebar-full { position: fixed !important; inset: 12px 12px auto auto !important; width: min(92vw, 330px) !important; min-width: 0 !important; max-height: calc(100dvh - 24px) !important; z-index: 70 !important; } }
    @media (max-width: 680px) { .dn-admin-command-deck { grid-template-columns: repeat(2, minmax(0, 1fr)); } .dn-admin-dashboard-kpis { grid-template-columns: 1fr !important; } .dn-live-map-shell > .leaflet-container { min-height: 300px !important; } }
  `;
  document.head.appendChild(style);
}

function currentText() { return root()?.querySelector(".dn-admin-current-section strong")?.textContent || ""; }
function isCurrent(card: Card) { const current = polishText(currentText()); const labels = isArabic() ? [...card.navAr, card.ar] : [...card.navEn, card.en]; return labels.some((label) => current.includes(label) || label.includes(current)); }
function clickSection(id: string) {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".dn-admin-side-nav button"));
  const card = CARDS.find((item) => item.id === id);
  const labels = card ? (isArabic() ? card.navAr : card.navEn).map((label) => polishText(label).replace(/\s+/g, " ").trim()) : [];
  const targetByText = buttons.find((button) => {
    const text = polishText(button.textContent || "").replace(/\s+/g, " ").trim();
    return labels.some((label) => text === label || text.endsWith(label));
  });
  const targetByIndex = buttons[MENU_ORDER.indexOf(id)];
  const target = targetByText || targetByIndex;
  if (!target) return;
  if (target.classList.contains("is-active")) return;
  target.click();
}

function renderDeck() {
  if (!isAdminPage()) return;
  const content = root()?.querySelector<HTMLElement>(".dn-admin-content-full"); if (!content) return;
  injectStyle();
  let deck = content.querySelector<HTMLElement>(".dn-admin-command-deck");
  const anchor = content.querySelector<HTMLElement>(".dn-admin-current-section");
  if (!deck) {
    deck = document.createElement("section"); deck.className = "dn-admin-command-deck"; deck.setAttribute("aria-label", isArabic() ? "بطاقات حالات الطلبيات" : "Shipment status cards");
    deck.addEventListener("click", (event) => { const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("button[data-section]"); if (button) clickSection(button.dataset.section || ""); });
    if (anchor) anchor.insertAdjacentElement("afterend", deck); else content.insertAdjacentElement("afterbegin", deck);
  }
  const signature = `${isArabic() ? "ar" : "en"}|${currentText()}|${JSON.stringify(metrics)}`;
  if (signature === lastRender && deck.children.length === CARDS.length) return;
  lastRender = signature;
  deck.innerHTML = CARDS.map((card) => {
    const label = isArabic() ? card.ar : card.en; const hint = isArabic() ? card.hintAr : card.hintEn; const current = isCurrent(card) ? " is-current" : "";
    return `<button type="button" class="dn-admin-command-card${current}" data-section="${card.id}" data-tone="${card.tone}" aria-label="${label}"><span>${label}</span><strong>${metrics[card.metric] || 0}</strong><small>${hint}</small></button>`;
  }).join("");
}

function run() { if (!isAdminPage()) return; polishNode(document.body); renderDeck(); void refreshMetrics(); }
function schedule() { if (!isBrowser || scheduled) return; scheduled = true; window.requestAnimationFrame(() => { scheduled = false; run(); }); }

if (isBrowser) {
  schedule();
  const observer = new MutationObserver((mutations) => { if (!isAdminPage()) return; for (const mutation of mutations) { mutation.addedNodes.forEach(polishNode); if (mutation.type === "characterData") polishNode(mutation.target); } schedule(); });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener("popstate", schedule);
  window.addEventListener("hashchange", schedule);
  window.addEventListener("dn-admin-settings-change", schedule);
  window.setTimeout(schedule, 250); window.setTimeout(schedule, 900); window.setTimeout(schedule, 1800);
  intervalId = window.setInterval(() => { if (isAdminPage()) void refreshMetrics(); }, 30000);
  window.addEventListener("beforeunload", () => { if (intervalId) window.clearInterval(intervalId); });
}

export {};
