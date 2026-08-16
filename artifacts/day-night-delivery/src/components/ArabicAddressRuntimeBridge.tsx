import { useEffect } from "react";
import { useAppContext } from "../lib/AppContext";
import { isLikelyLocationText, localizeExportText } from "../lib/exportLocalization";

const LOCATION_CONTEXT = /(?:address|location|route|pickup|drop[ -]?off|delivery|destination|city|area|emirate|district|street|road|building|tower|villa|apartment|flat|floor|office|shop|warehouse|block|sector|zone|landmark|map|عنوان|موقع|مسار|استلام|تسليم|وجهة|مدينة|منطقة|إمارة|شارع|طريق|مبنى|برج|فيلا|شقة|طابق|معلم)/i;
const BLOCKED_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "CODE", "PRE"]);
const originals = new WeakMap<Text, string>();
const tracked = new Set<Text>();
const localizedWrites = new WeakSet<Text>();

type IdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const UAE_LOCATION_PARTS = [
  "mohammed bin zayed city",
  "mohamed bin zayed city",
  "ras al khaimah",
  "umm al quwain",
  "western region",
  "khalifa city",
  "khor fakkan",
  "khorfakkan",
  "abu dhabi",
  "al ain",
  "mussafah",
  "musaffah",
  "dubai",
  "sharjah",
  "ajman",
  "fujairah",
] as const;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const UAE_LOCATION_PATTERN = new RegExp(
  `\\b(?:${UAE_LOCATION_PARTS.map(escapeRegExp).join("|")})\\b`,
  "gi",
);

function isKnownUaeLocationText(value: string) {
  const compact = value.trim();
  if (!compact || !/[A-Za-z]/.test(compact) || !UAE_LOCATION_PATTERN.test(compact)) {
    UAE_LOCATION_PATTERN.lastIndex = 0;
    return false;
  }
  UAE_LOCATION_PATTERN.lastIndex = 0;
  const remainder = compact
    .toLowerCase()
    .replace(UAE_LOCATION_PATTERN, "")
    .replace(/\b(?:city|emirate|region|uae|united arab emirates)\b/gi, "")
    .replace(/[0-9\s()[\]{}.,،:;'"`~!@#$%^&*_+=?<>/\\|→←–—-]/g, "");
  UAE_LOCATION_PATTERN.lastIndex = 0;
  return remainder.length === 0;
}

function elementContext(element: Element | null) {
  let current = element;
  const tokens: string[] = [];
  for (let depth = 0; current && depth < 5; depth += 1, current = current.parentElement) {
    tokens.push(
      current.id,
      typeof current.className === "string" ? current.className : "",
      current.getAttribute("aria-label") || "",
      current.getAttribute("title") || "",
      current.getAttribute("data-label") || "",
      current.getAttribute("data-field") || "",
      current.getAttribute("data-column") || "",
    );
  }
  const previous = element?.previousElementSibling;
  if (previous) tokens.push(previous.textContent || "");
  return tokens.join(" ");
}

function isOperationalToken(text: string) {
  const compact = text.trim();
  if (!compact || !/[A-Za-z]/.test(compact)) return true;
  if (/https?:|www\.|@|\+?\d[\d\s-]{5,}/i.test(compact)) return true;
  if (/^[A-Z0-9_-]{6,}$/i.test(compact) && !/\s/.test(compact)) return true;
  return false;
}

function shouldLocalize(node: Text) {
  const parent = node.parentElement;
  if (!parent || BLOCKED_TAGS.has(parent.tagName)) return false;
  if (parent.closest("[data-dn-no-localize='true'], [translate='no']")) return false;
  const text = node.nodeValue || "";
  if (isOperationalToken(text)) return false;
  return isKnownUaeLocationText(text) || isLikelyLocationText(text) || LOCATION_CONTEXT.test(elementContext(parent));
}

function processText(node: Text) {
  const current = node.nodeValue || "";
  if (localizedWrites.has(node)) {
    localizedWrites.delete(node);
    tracked.add(node);
    return;
  }

  const saved = originals.get(node);
  const savedLocalized = saved === undefined ? "" : localizeExportText(saved, "ar");
  if (!shouldLocalize(node)) {
    if (saved !== undefined && current !== savedLocalized) originals.set(node, current);
    return;
  }

  const original = saved !== undefined && current === savedLocalized ? saved : current;
  originals.set(node, original);
  const localized = localizeExportText(original, "ar");
  if (localized !== current) {
    localizedWrites.add(node);
    node.nodeValue = localized;
  }
  tracked.add(node);
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    processText(root as Text);
    return;
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    processText(node as Text);
    node = walker.nextNode();
  }
}

function restoreEnglish() {
  tracked.forEach((node) => {
    const original = originals.get(node);
    if (original !== undefined && node.isConnected) node.nodeValue = original;
  });
  tracked.clear();
}

export default function ArabicAddressRuntimeBridge() {
  const { language } = useAppContext();

  useEffect(() => {
    if (language !== "ar") {
      restoreEnglish();
      return;
    }

    const root = document.getElementById("root") || document.body;
    const pending = new Set<Node>();
    let idleHandle = 0;
    let timeoutHandle = 0;

    const flush = () => {
      idleHandle = 0;
      timeoutHandle = 0;
      const nodes = Array.from(pending);
      pending.clear();
      nodes.forEach((node) => {
        if (node.isConnected || node === root) walk(node);
      });
    };
    const schedule = (node: Node) => {
      pending.add(node);
      if (idleHandle || timeoutHandle) return;
      const idleWindow = window as IdleWindow;
      if (idleWindow.requestIdleCallback) {
        idleHandle = idleWindow.requestIdleCallback(flush, { timeout: 500 });
      } else {
        timeoutHandle = window.setTimeout(flush, 32);
      }
    };

    // Preserve immediate localization for the already-rendered surface. New
    // React nodes are localized off the interaction frame below.
    walk(root);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") schedule(mutation.target);
        mutation.addedNodes.forEach(schedule);
      }
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true });
    return () => {
      observer.disconnect();
      const idleWindow = window as IdleWindow;
      if (idleHandle && idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(idleHandle);
      if (timeoutHandle) window.clearTimeout(timeoutHandle);
    };
  }, [language]);

  return null;
}
