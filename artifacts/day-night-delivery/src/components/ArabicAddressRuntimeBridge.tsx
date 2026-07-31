import { useEffect } from "react";
import { useAppContext } from "../lib/AppContext";
import { isLikelyLocationText, localizeExportText } from "../lib/exportLocalization";

const LOCATION_CONTEXT = /(?:address|location|route|pickup|drop[ -]?off|delivery|destination|city|area|emirate|district|street|road|building|tower|villa|apartment|flat|floor|office|shop|warehouse|block|sector|zone|landmark|map|عنوان|موقع|مسار|استلام|تسليم|وجهة|مدينة|منطقة|إمارة|شارع|طريق|مبنى|برج|فيلا|شقة|طابق|معلم)/i;
const BLOCKED_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "OPTION", "CODE", "PRE"]);
const originals = new WeakMap<Text, string>();
const tracked = new Set<Text>();

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
  return isLikelyLocationText(text) || LOCATION_CONTEXT.test(elementContext(parent));
}

function processText(node: Text) {
  const current = node.nodeValue || "";
  if (!shouldLocalize(node)) return;
  const original = originals.get(node) || current;
  if (!originals.has(node)) originals.set(node, original);
  const localized = localizeExportText(original, "ar");
  if (localized !== current) node.nodeValue = localized;
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
    walk(root);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") processText(mutation.target as Text);
        mutation.addedNodes.forEach(walk);
      }
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);

  return null;
}
