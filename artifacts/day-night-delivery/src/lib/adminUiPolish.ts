import { fetchAdminOrders, fetchFinanceSummary, fetchMerchants, type FinanceSummary } from "./adminData";
import { buildAdminSectionStats, normalizeOrderStatus } from "./adminOrderLogic";
import type { Merchant, Order } from "../types";
import "../styles/dn-admin-executive-polish.css";

const DECK_ID = "dn-admin-executive-polish";
const POLISHED_ATTR = "data-dn-admin-polished";

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

function isAdminMounted() {
  return Boolean(document.querySelector(".dn-admin-fullscreen"));
}

function isArabicAdmin() {
  return document.querySelector(".dn-admin-fullscreen")?.getAttribute("dir") !== "ltr";
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
    const row = order as Record<string, unknown>;
    return !row.driver_id && !row.assigned_driver_id && !row.driver_name;
  }).length;
}

function activeMerchants(merchants: Merchant[]) {
  return merchants.filter((merchant) => {
    const status = String((merchant as Record<string, unknown>).status || "active").toLowerCase();
    return !["deleted", "archived", "blocked", "suspended"].includes(status);
  }).length;
}

function replaceVisibleText(root: ParentNode = document.body) {
  if (!isAdminMounted()) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (!parent.closest(".dn-admin-fullscreen")) return NodeFilter.FILTER_REJECT;
      if (["SCRIPT", "STYLE", "TEXTAREA", "INPUT"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest(`#${DECK_ID}`)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);

  nodes.forEach((node) => {
    let next = node.nodeValue || "";
    textReplacements.forEach(([from, to]) => {
      if (next.includes(from)) next = next.replaceAll(from, to);
    });
    if (next !== node.nodeValue) node.nodeValue = next;
  });
}

function ensureDeck() {
  if (!isAdminMounted()) return null;
  const host = document.querySelector(".dn-admin-content-full") || document.querySelector(".dn-admin-fullscreen");
  if (!host) return null;

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
  if (!isAdminMounted()) return;
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
  const codPending = Number(snapshot.financeSummary?.cod_pending ?? snapshot.orders.reduce((sum, order) => sum + Number((order as Record<string, unknown>).cod_amount || 0), 0));
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
      ${cards
        .map(
          (card) => `
            <article class="dn-admin-executive-card" data-tone="${card.tone}">
              <small>${card.meta}</small>
              <strong>${card.value}</strong>
              <span>${card.label}</span>
              <em>${card.hint}</em>
            </article>
          `,
        )
        .join("")}
    </div>
    <div class="dn-admin-executive-foot">
      <span>${isArabic ? "قائمة تحتاج متابعة" : "Attention queue"}: <b>${attention}</b></span>
      <span>${isArabic ? "آخر تحديث" : "Last update"}: <b>${syncLabel}</b></span>
    </div>
  `;
}

async function refreshExecutiveDeck() {
  if (!isAdminMounted()) return;
  loadingDeck();
  const [ordersResult, merchantsResult, financeResult] = await Promise.allSettled([
    fetchAdminOrders(),
    fetchMerchants(),
    fetchFinanceSummary(),
  ]);

  renderDeck({
    orders: ordersResult.status === "fulfilled" && Array.isArray(ordersResult.value) ? ordersResult.value : [],
    merchants: merchantsResult.status === "fulfilled" && Array.isArray(merchantsResult.value) ? merchantsResult.value : [],
    financeSummary: financeResult.status === "fulfilled" ? financeResult.value.summary : null,
    refreshedAt: new Date(),
  });
}

function startAdminPolish() {
  if (typeof document === "undefined") return;
  if (isAdminMounted()) {
    replaceVisibleText();
    ensureDeck();
    void refreshExecutiveDeck();
  }

  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(() => {
      queued = false;
      if (!isAdminMounted()) return;
      replaceVisibleText();
      const deck = ensureDeck();
      if (deck && deck.getAttribute(POLISHED_ATTR) !== "ready") void refreshExecutiveDeck();
    });
  });

  observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  window.setInterval(() => {
    if (isAdminMounted()) void refreshExecutiveDeck();
  }, 60_000);
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startAdminPolish, { once: true });
  else startAdminPolish();
}

export {};
