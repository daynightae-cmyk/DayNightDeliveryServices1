import { useEffect } from "react";

const ADMIN_FORM_SCOPE = [
  ".dncc-main",
  ".dn-admin-workspace-host",
  ".dn-employee-hr-embedded-root",
  ".dn-admin-fullscreen",
].join(",");

const NAVIGABLE_INPUT_TYPES = new Set([
  "text",
  "number",
  "email",
  "tel",
  "search",
  "password",
  "url",
]);

function inputType(input: HTMLInputElement) {
  return (input.getAttribute("type") || "text").toLowerCase();
}

function isVisible(input: HTMLInputElement) {
  if (input.hidden || input.disabled || input.readOnly) return false;
  if (input.closest("[hidden], [aria-hidden='true']")) return false;
  const style = window.getComputedStyle(input);
  return style.display !== "none" && style.visibility !== "hidden" && input.getClientRects().length > 0;
}

function isNavigableInput(input: HTMLInputElement) {
  if (!input.closest(ADMIN_FORM_SCOPE)) return false;
  if (input.matches("[data-dn-arrow-nav='off']")) return false;
  if (input.closest("[role='combobox'], [data-radix-popper-content-wrapper]")) return false;
  return NAVIGABLE_INPUT_TYPES.has(inputType(input)) && isVisible(input);
}

function navigationScope(input: HTMLInputElement) {
  return input.closest<HTMLElement>(
    "form, [role='dialog'], .dn-employee-hr-embedded-root, .dn-admin-workspace-host, .dncc-main",
  );
}

function availableInputs(input: HTMLInputElement) {
  const scope = navigationScope(input);
  if (!scope) return [];
  return Array.from(scope.querySelectorAll<HTMLInputElement>("input")).filter(isNavigableInput);
}

function focusRelativeInput(input: HTMLInputElement, direction: -1 | 1) {
  const inputs = availableInputs(input);
  const currentIndex = inputs.indexOf(input);
  if (currentIndex < 0) return;

  const nextIndex = currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= inputs.length) return;

  const next = inputs[nextIndex];
  next.focus({ preventScroll: true });
  next.scrollIntoView({ block: "nearest", inline: "nearest" });

  try {
    next.select();
  } catch {
    // Some input types do not support selection. Focusing is sufficient.
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
      if (!isNavigableInput(input)) return;

      event.preventDefault();
      focusRelativeInput(input, event.key === "ArrowDown" ? 1 : -1);
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
