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

function schedulePolish() {
  if (!isBrowser) return;
  window.requestAnimationFrame(() => polishNode(document.body));
}

if (isBrowser) {
  schedulePolish();
  const observer = new MutationObserver((mutations) => {
    if (!isAdminPage()) return;
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(polishNode);
      if (mutation.type === "characterData") polishNode(mutation.target);
    }
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
