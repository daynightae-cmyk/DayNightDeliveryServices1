import { fetchAdminOrders, fetchFinanceSummary, fetchMerchants, type FinanceSummary } from "./adminData";
import { buildAdminSectionStats, normalizeOrderStatus } from "./adminOrderLogic";
import type { Merchant, Order } from "../types";
import "../styles/dn-admin-executive-polish.css";

const DECK_ID = "dn-admin-executive-polish";
const POLISHED_ATTR = "data-dn-admin-polished";
let executiveDeckRefreshPromise: Promise<void> | null = null;
let activeAdminRoot: HTMLElement | null = null;
let deckRefreshTimer: number | null = null;

type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const textReplacements: Array<[string, string]> = [
  ["المصدر: قاعدة البيانات", "متزامن مع سجلات التشغيل"],
  ["Source: database", "Synced with operations records"],
  ["بيانات مشتقة مؤقتاً", "ملخص تشغيلي محسوب"],
  ["Temporary derived data", "Calculated operations summary"],
  ["Supabase والجداول", "سلامة الربط"],
  ["Supabase tables", "Connection health"],
  ["فحص قاعدة البيانات", "سلامة النظام"],
  ["Database Health", "System Health"],
  ["جاهزية الإنتاج", "جاهزية التشغيل"],
  ["Production Readiness", "Operations Readiness"],
  ["تحميل البيانات الحية...", "تحديث لوحة الإدارة..."],
  ["Loading live data...", "Refreshing command dashboard..."],
  ["البيانات الحية جاهزة داخل مستودع العمليات", "تظهر مؤشرات التشغيل عند توفر بيانات مرتبطة."],
  ["Live data is ready inside the operations warehouse", "Operations indicators appear as linked records arrive."],
  ["ملخص مالي مشتق مؤقتاً من الطلبات", "ملخص مالي محسوب من سجلات الطلبات."],
  ["Finance summary temporarily derived from orders", "Finance summary calculated from order records."],
  [
    "إذا كان جدول متخصص غير متاح، يتم الاشتقاق بأمان من الطلبات دون عرض أخطاء Supabase الخام.",
    "تستمر اللوحة في عرض ملخص تشغيلي آمن حسب السجلات المتاحة.",
  ],
  [
    "If a specialized table is unavailable, this workspace safely derives from orders without exposing raw Supabase schema errors.",
    "The dashboard continues with a safe operations summary from available records.",
  ],
];

type DeckSnapshot = {
  orders: Order[];
  merchants: Merchant[];
  financeSummary: FinanceSummary | null;
  refreshedAt: Date;
};

function getAdminRoot() {
  return document.querySelector<HTMLElement>(".dn-admin-fullscreen");
}

function isAdminMounted() {
  return Boolean(getAdminRoot());
}

function isArabicAdmin() {
  return getAdminRoot()?.getAttribute("dir") !== "ltr";
}

function money(value: number) {
  return `${Number(value || 0).toFixed(2)} AED`;
}

function activeOrders(orders: Order[]) {
  return orders.filter((order) => !["delivered", "cancelled", "returned"].includes(normalizeOrderStatus(order))).length;
}

function deliveredOrders(orders: Order[]) {
  return orders.filter((order) => normalizeOrderStatus(order) === "delivered").length;
}

function unassignedOrders(orders: Order[]) {
  return orders.filter((order) => {
    const status = normalizeOrderStatus(order);
    if (["delivered", "cancelled", "returned"].includes(status)) return false;
    const row = order as unknown as Record<string, unknown>;
    return !row.driver_id && !row.assigned_driver_id && !row.driver_name;
  }).length;
}

function activeMerchants(merchants: Merchant[]) {
  return merchants.filter((merchant) => {
    const status = String((merchant as unknown as Record<string, unknown>).status || "active").toLowerCase();
    return !["deleted", "archived", "blocked", "suspended"].includes(status);
  }).length;
}

function replaceVisibleText(root: ParentNode) {
  const adminRoot = getAdminRoot();
  if (!adminRoot) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || !adminRoot.contains(parent)) return NodeFilter.FILTER_REJECT;
      if (["SCRIPT", "STYLE", "TEXTAREA", "INPUT"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest(`#${DECK_ID}`)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const changes: Array<{ node: Text; value: string }> = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    let next = node.nodeValue || "";
    for (const [from, to] of textReplacements) {
      if (next.includes(from)) next = next.replaceAll(from, to);
    }
    if (next !== node.nodeValue) changes.push({ node, value: next });
  }
  for (const change of changes) change.node.nodeValue = change.value;
}

function ensureDeck() {
  const adminRoot = getAdminRoot();
  if (!adminRoot) return null;
  const host = adminRoot.querySelector<HTMLElement>(".dn-admin-content-full") || adminRoot;

  let deck = document.getElementById(DECK_ID);
  if (!deck) {
    deck = document.createElement("section");
    deck.id = DECK_ID;
    deck.className = "dn-admin-executive-polish";
    deck.setAttribute("aria-live", "polite");
    const topStrip = host.querySelector(".dn-admin-top-strip");
    if (topStrip?.nextSibling) host.insertBefore(deck, topStrip.nextSibling);
    else host.prepend(deck);
  }
  return deck;
}

function loadingDeck() {
  const isArabic = isArabicAdmin();
  const deck = ensureDeck();
  if (!deck || deck.getAttribute(POLISHED_ATTR) === "ready") return;
  deck.innerHTML = `
    <div class="dn-admin-executive-head">
      <span>${isArabic ? "لوحة الإدارة التنفيذية" : "Executive Admin Deck"}</span>
      <strong>${isArabic ? "تحديث المؤشرات" : "Refreshing indicators"}</strong>
      <p>${isArabic ? "تجهيز ملخص التشغيل من السجلات المتاحة." : "Preparing the operations summary from available records."}</p>
    </div>
    <div class="dn-admin-executive-loading">${isArabic ? "جارٍ التحديث..." : "Refreshing..."}</div>
  `;
}

function renderDeck(snapshot: DeckSnapshot) {
  if (!isAdminMounted()) return;
  const deck = ensureDeck();
  if (!deck) return;

  const isArabic = isArabicAdmin();
  const stats = buildAdminSectionStats(snapshot.orders);
  const active = activeOrders(snapshot.orders);
  const delivered = deliveredOrders(snapshot.orders);
  const unassigned = unassignedOrders(snapshot.orders);
  const merchants = activeMerchants(snapshot.merchants);
  const attention = stats.review + stats.postponed + stats.returned + unassigned;
  const deliveryRate = snapshot.orders.length ? Math.round((delivered / snapshot.orders.length) * 100) : 0;
  const codPending = Number(snapshot.financeSummary?.cod_pending ?? snapshot.orders.reduce((sum, order) => sum + Number((order as unknown as Record<string, unknown>).cod_amount || 0), 0));
  const syncLabel = snapshot.refreshedAt.toLocaleTimeString(isArabic ? "ar-AE" : "en-AE", { hour: "2-digit", minute: "2-digit" });

  const cards = isArabic
    ? [
        { tone: "gold", label: "قلب العمليات", value: active, hint: `${unassigned} بدون مندوب`, meta: "توزيع مباشر" },
        { tone: "sky", label: "التجار", value: merchants, hint: `${snapshot.merchants.length} ملف إجمالي`, meta: "حسابات نشطة" },
        { tone: "emerald", label: "التحصيل", value: money(codPending), hint: "قيد المتابعة", meta: "COD" },
        { tone: "violet", label: "جودة الخدمة", value: `${deliveryRate}%`, hint: `${delivered} تم تسليمها`, meta: "نسبة الإنجاز" },
      ]
    : [
        { tone: "gold", label: "Operations Core", value: active, hint: `${unassigned} unassigned`, meta: "Live dispatch" },
        { tone: "sky", label: "Merchants", value: merchants, hint: `${snapshot.merchants.length} total profiles`, meta: "Active accounts" },
        { tone: "emerald", label: "Collections", value: money(codPending), hint: "Under follow-up", meta: "COD" },
        { tone: "violet", label: "Service Quality", value: `${deliveryRate}%`, hint: `${delivered} delivered`, meta: "Completion rate" },
      ];

  deck.setAttribute(POLISHED_ATTR, "ready");
  deck.innerHTML = `
    <div class="dn-admin-executive-head">
      <span>${isArabic ? "لوحة الإدارة التنفيذية" : "Executive Admin Deck"}</span>
      <strong>${isArabic ? "قيادة فاخرة للتشغيل اليومي" : "Premium daily command layer"}</strong>
      <p>${isArabic ? "مؤشرات مختصرة مرتبطة بالطلبات والتجار والتحصيل دون أي بيانات إضافية مصطنعة." : "Compact indicators linked to orders, merchants, and collections without synthetic data."}</p>
    </div>
    <div class="dn-admin-executive-cards">
      ${cards.map((card) => `
        <article class="dn-admin-executive-card" data-tone="${card.tone}">
          <small>${card.meta}</small><strong>${card.value}</strong><span>${card.label}</span><em>${card.hint}</em>
        </article>`).join("")}
    </div>
    <div class="dn-admin-executive-foot">
      <span>${isArabic ? "قائمة تحتاج متابعة" : "Attention queue"}: <b>${attention}</b></span>
      <span>${isArabic ? "آخر تحديث" : "Last update"}: <b>${syncLabel}</b></span>
    </div>
  `;
}

function refreshExecutiveDeck(): Promise<void> {
  if (!isAdminMounted()) return Promise.resolve();
  if (executiveDeckRefreshPromise) return executiveDeckRefreshPromise;

  loadingDeck();
  ensureDeck()?.setAttribute(POLISHED_ATTR, "loading");
  executiveDeckRefreshPromise = (async () => {
    const [ordersResult, merchantsResult, financeResult] = await Promise.allSettled([
      fetchAdminOrders(),
      fetchMerchants(),
      fetchFinanceSummary(),
    ]);
    if (!isAdminMounted()) return;
    renderDeck({
      orders: ordersResult.status === "fulfilled" && Array.isArray(ordersResult.value) ? ordersResult.value : [],
      merchants: merchantsResult.status === "fulfilled" && Array.isArray(merchantsResult.value) ? merchantsResult.value : [],
      financeSummary: financeResult.status === "fulfilled" ? financeResult.value.summary : null,
      refreshedAt: new Date(),
    });
  })().finally(() => {
    executiveDeckRefreshPromise = null;
  });
  return executiveDeckRefreshPromise;
}

function runWhenIdle(callback: () => void, timeout = 3000) {
  const idleWindow = window as IdleWindow;
  if (typeof idleWindow.requestIdleCallback === "function") {
    idleWindow.requestIdleCallback(() => callback(), { timeout });
  } else {
    window.setTimeout(callback, Math.min(timeout, 1200));
  }
}

function initializeAdminPolish(root: HTMLElement) {
  activeAdminRoot = root;
  ensureDeck();
  runWhenIdle(() => {
    if (activeAdminRoot !== root || !document.contains(root)) return;
    replaceVisibleText(root);
    void refreshExecutiveDeck();
  }, 2200);

  if (deckRefreshTimer) window.clearInterval(deckRefreshTimer);
  deckRefreshTimer = window.setInterval(() => {
    if (!isAdminMounted()) return;
    runWhenIdle(() => void refreshExecutiveDeck(), 2500);
  }, 60_000);
}

function checkAdminLifecycle() {
  const root = getAdminRoot();
  if (!root) {
    activeAdminRoot = null;
    return;
  }
  if (root === activeAdminRoot) return;
  initializeAdminPolish(root);
}

function startAdminPolish() {
  if (typeof document === "undefined") return;
  checkAdminLifecycle();
  window.setInterval(checkAdminLifecycle, 1500);
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startAdminPolish, { once: true });
  else startAdminPolish();
}

export {};
