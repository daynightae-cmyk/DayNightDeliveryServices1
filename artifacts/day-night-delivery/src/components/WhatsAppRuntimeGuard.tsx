import { useEffect } from "react";
import {
  buildSynchronousContextualWhatsAppUrl,
  contextualSupportContext,
  openPreparedWhatsApp,
  prepareWhatsAppMessage,
} from "../services/whatsappMessageService";

function isWhatsAppHref(href: string) {
  return /https?:\/\/(?:api\.)?wa\.me\//i.test(href) || /https?:\/\/api\.whatsapp\.com\/send/i.test(href);
}

function isCatalogHref(href: string) {
  return /wa\.me\/c\//i.test(href);
}

function hasMessageText(href: string) {
  try {
    const url = new URL(href, window.location.origin);
    return Boolean(url.searchParams.get("text")?.trim());
  } catch {
    return false;
  }
}

function currentLocale() {
  return document.documentElement.lang.toLowerCase().startsWith("en") ? "en" as const : "ar" as const;
}

function markEmptyWhatsAppLinks(root: ParentNode = document) {
  root.querySelectorAll<HTMLAnchorElement>('a[href*="wa.me/"],a[href*="api.whatsapp.com/send"]').forEach((anchor) => {
    const href = anchor.href;
    if (!isWhatsAppHref(href) || isCatalogHref(href) || hasMessageText(href)) return;
    anchor.dataset.dnWhatsappGuarded = "true";
    anchor.href = buildSynchronousContextualWhatsAppUrl(window.location.pathname, window.location.search, currentLocale());
  });
}

export default function WhatsAppRuntimeGuard() {
  useEffect(() => {
    markEmptyWhatsAppLinks();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) markEmptyWhatsAppLinks(node);
        });
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const anchor = target?.closest<HTMLAnchorElement>('a[href*="wa.me/"],a[href*="api.whatsapp.com/send"]');
      if (!anchor || isCatalogHref(anchor.href)) return;
      if (hasMessageText(anchor.href) && !anchor.dataset.dnWhatsappGuarded) return;

      event.preventDefault();
      const context = contextualSupportContext(window.location.pathname, window.location.search, currentLocale());
      void prepareWhatsAppMessage(context)
        .then(openPreparedWhatsApp)
        .catch(() => {
          const safeUrl = buildSynchronousContextualWhatsAppUrl(
            window.location.pathname,
            window.location.search,
            currentLocale(),
          );
          window.open(safeUrl, "_blank", "noopener,noreferrer");
        });
    };

    document.addEventListener("click", onClick, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
