import { useEffect } from "react";

const ADMIN_FORM_SCOPE = [
  ".dncc-main",
  ".dn-admin-workspace-host",
  ".dn-employee-hr-embedded-root",
  ".dn-admin-fullscreen",
].join(",");

const ARROW_NAV_SOURCE_TYPES = new Set([
  "text",
  "number",
  "email",
  "tel",
  "password",
  "url",
]);

const EXCLUDED_TARGET_TYPES = new Set([
  "button",
  "submit",
  "reset",
  "checkbox",
  "radio",
  "file",
  "range",
  "color",
  "hidden",
  "image",
]);

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function inputType(input: HTMLInputElement) {
  return (input.getAttribute("type") || "text").toLowerCase();
}

function isVisible(control: FormControl) {
  if (control.hidden || control.disabled) return false;
  if (control instanceof HTMLInputElement && control.readOnly) return false;
  if (control instanceof HTMLTextAreaElement && control.readOnly) return false;
  if (control.closest("[hidden], [aria-hidden='true']")) return false;
  const style = window.getComputedStyle(control);
  return style.display !== "none" && style.visibility !== "hidden" && control.getClientRects().length > 0;
}

function isNavigationTarget(control: FormControl) {
  if (!control.closest(ADMIN_FORM_SCOPE)) return false;
  if (control.matches("[data-dn-arrow-nav='off']")) return false;
  if (control.closest(".dncc-search, [role='search'], [role='combobox'], [data-radix-popper-content-wrapper]")) return false;
  if (control instanceof HTMLInputElement && EXCLUDED_TARGET_TYPES.has(inputType(control))) return false;
  return isVisible(control);
}

function isArrowNavigationSource(input: HTMLInputElement) {
  return ARROW_NAV_SOURCE_TYPES.has(inputType(input)) && isNavigationTarget(input);
}

function navigationScope(input: HTMLInputElement) {
  return input.closest<HTMLElement>(
    "form, [role='dialog'], .dn-employee-hr-embedded-root, .dn-admin-workspace-host, .dncc-main",
  );
}

function availableControls(input: HTMLInputElement) {
  const scope = navigationScope(input);
  if (!scope) return [];
  return Array.from(scope.querySelectorAll<FormControl>("input, select, textarea")).filter(isNavigationTarget);
}

function focusRelativeControl(input: HTMLInputElement, direction: -1 | 1) {
  const controls = availableControls(input);
  const currentIndex = controls.indexOf(input);
  if (currentIndex < 0) return;

  const nextIndex = currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= controls.length) return;

  const next = controls[nextIndex];
  next.focus({ preventScroll: true });
  next.scrollIntoView({ block: "nearest", inline: "nearest" });

  if (next instanceof HTMLInputElement && ARROW_NAV_SOURCE_TYPES.has(inputType(next))) {
    try {
      next.select();
    } catch {
      // Focusing is sufficient for inputs that do not support selection.
    }
  }
}

function nearestScrollable(element: HTMLElement) {
  let current = element.parentElement;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    const scrollable = /(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight;
    if (scrollable) return current;
    current = current.parentElement;
  }
  return null;
}

function applyNumericInputMode(root: ParentNode = document) {
  root.querySelectorAll<HTMLInputElement>(`${ADMIN_FORM_SCOPE} input[type='number']`).forEach((input) => {
    const step = input.getAttribute("step");
    const integerOnly = step === "1" || input.dataset.integer === "true";
    input.inputMode = integerOnly ? "numeric" : "decimal";
    input.dataset.dnNumberEnhanced = "true";
  });
}

export function useAdminFormKeyboardNavigation(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    applyNumericInputMode();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) applyNumericInputMode(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (!(event.target instanceof HTMLInputElement)) return;

      const input = event.target;
      if (!isArrowNavigationSource(input)) return;

      event.preventDefault();
      focusRelativeControl(input, event.key === "ArrowDown" ? 1 : -1);
    };

    const handleWheel = (event: WheelEvent) => {
      if (!(event.target instanceof HTMLInputElement)) return;
      const input = event.target;
      if (inputType(input) !== "number" || !input.closest(ADMIN_FORM_SCOPE)) return;
      if (document.activeElement !== input) return;

      event.preventDefault();
      const scrollable = nearestScrollable(input);
      if (scrollable) {
        scrollable.scrollBy({ top: event.deltaY, left: event.deltaX, behavior: "auto" });
      } else {
        window.scrollBy({ top: event.deltaY, left: event.deltaX, behavior: "auto" });
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("wheel", handleWheel, { capture: true, passive: false });

    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("wheel", handleWheel, true);
    };
  }, [enabled]);
}
