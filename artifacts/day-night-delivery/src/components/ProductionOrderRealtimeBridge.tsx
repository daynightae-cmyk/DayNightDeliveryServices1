import { useEffect } from "react";
import { supabase } from "../supabase";
import "../styles/dn-admin-status-auto-save.css";

const STATUS_CONTROL_SELECTOR = ".dn-order-status-control";

function clickAdminRefresh() {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>(".dn-admin-top-actions button"),
  );
  const refresh = buttons.find((button) => {
    const text = String(button.textContent || "").toLowerCase();
    return text.includes("تحديث") || text.includes("refresh");
  });
  if (refresh && !refresh.disabled) refresh.click();
}

function isArabicInterface() {
  return (
    document.documentElement.dir === "rtl" ||
    String(document.documentElement.lang || "").toLowerCase().startsWith("ar")
  );
}

function setAutoSaveState(
  control: HTMLElement,
  state: "idle" | "pending" | "saving" | "saved" | "error",
  label: string,
) {
  control.dataset.autoSaveEnabled = "true";
  control.dataset.autoSaveState = state;
  control.dataset.autoSaveLabel = label;
  control.setAttribute("aria-busy", state === "pending" || state === "saving" ? "true" : "false");
}

function enhanceStatusControls() {
  const arabic = isArabicInterface();
  document.querySelectorAll<HTMLElement>(STATUS_CONTROL_SELECTOR).forEach((control) => {
    if (control.dataset.autoSaveEnabled === "true") return;
    setAutoSaveState(
      control,
      "idle",
      arabic ? "يُحفظ تلقائياً عند اختيار الحالة" : "Saves automatically when selected",
    );
  });
}

/**
 * Keeps the legacy admin state synchronized without duplicating order data locally.
 * It also turns the existing status selector into an auto-save control: selecting
 * any status triggers the verified save action after React applies the new value.
 * The hidden legacy button remains available only as a visible retry on failure.
 */
export default function ProductionOrderRealtimeBridge() {
  useEffect(() => {
    if (!supabase || !window.location.pathname.startsWith("/admin")) return;

    let timer = 0;
    const managedTimers = new Set<number>();
    const later = (callback: () => void, delay: number) => {
      const id = window.setTimeout(() => {
        managedTimers.delete(id);
        callback();
      }, delay);
      managedTimers.add(id);
      return id;
    };

    const scheduleRefresh = (detail: Record<string, unknown>) => {
      window.dispatchEvent(new CustomEvent("dn-production-order-change", { detail }));
      window.clearTimeout(timer);
      timer = window.setTimeout(clickAdminRefresh, 350);
    };

    const channel = supabase
      .channel(`admin-orders-production-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => scheduleRefresh({ table: "orders", event: payload.eventType }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_status_history" },
        (payload) => scheduleRefresh({ table: "order_status_history", event: payload.eventType }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations" },
        (payload) => scheduleRefresh({ table: "driver_locations", event: payload.eventType }),
      )
      .subscribe();

    const localStatusHandler = () => scheduleRefresh({ source: "local-status-event" });
    window.addEventListener("dn-admin-order-status-change", localStatusHandler);

    enhanceStatusControls();
    const controlsObserver = new MutationObserver(() => enhanceStatusControls());
    controlsObserver.observe(document.body, { childList: true, subtree: true });

    const autoSaveStatus = (event: Event) => {
      const select = event.target;
      if (!(select instanceof HTMLSelectElement)) return;

      const control = select.closest<HTMLElement>(STATUS_CONTROL_SELECTOR);
      if (!control) return;

      const saveButton = control.querySelector<HTMLButtonElement>(":scope > button");
      if (!saveButton) return;

      const arabic = isArabicInterface();
      const selectedStatus = select.value;
      let enableAttempts = 0;
      let completionChecks = 0;
      let savingStarted = false;

      setAutoSaveState(
        control,
        "pending",
        arabic ? "جارٍ تجهيز الحفظ التلقائي…" : "Preparing automatic save…",
      );

      const watchCompletion = () => {
        if (!control.isConnected) return;

        completionChecks += 1;
        const buttonText = String(saveButton.textContent || "").toLowerCase();
        const currentlySaving =
          buttonText.includes("جارٍ الحفظ") ||
          buttonText.includes("جاري الحفظ") ||
          buttonText.includes("saving");

        if (currentlySaving) {
          savingStarted = true;
          setAutoSaveState(
            control,
            "saving",
            selectedStatus === "delivered"
              ? arabic
                ? "جارٍ التسليم والترحيل تلقائياً…"
                : "Delivering and posting automatically…"
              : arabic
                ? "جارٍ حفظ الحالة تلقائياً…"
                : "Saving status automatically…",
          );
        } else if (savingStarted) {
          if (saveButton.disabled) {
            setAutoSaveState(
              control,
              "saved",
              selectedStatus === "delivered"
                ? arabic
                  ? "تم التسليم والترحيل والحفظ تلقائياً"
                  : "Delivered, posted, and saved automatically"
                : arabic
                  ? "تم حفظ الحالة تلقائياً"
                  : "Status saved automatically",
            );
            later(() => {
              if (!control.isConnected || control.dataset.autoSaveState !== "saved") return;
              setAutoSaveState(
                control,
                "idle",
                arabic
                  ? "يُحفظ تلقائياً عند اختيار الحالة"
                  : "Saves automatically when selected",
              );
            }, 1800);
          } else {
            setAutoSaveState(
              control,
              "error",
              arabic
                ? "تعذر الحفظ التلقائي — استخدم زر إعادة المحاولة"
                : "Automatic save failed — use the retry button",
            );
          }
          return;
        }

        if (completionChecks >= 160) {
          setAutoSaveState(
            control,
            "error",
            arabic
              ? "انتهت مهلة الحفظ — استخدم زر إعادة المحاولة"
              : "Save timed out — use the retry button",
          );
          return;
        }

        later(watchCompletion, 75);
      };

      const clickWhenReady = () => {
        if (!control.isConnected) return;
        enableAttempts += 1;

        // Before React commits the newly selected option, the legacy button is
        // still disabled because draft === current. Wait for that commit, then
        // trigger exactly one verified save without requiring another click.
        if (saveButton.disabled) {
          if (enableAttempts >= 24) {
            setAutoSaveState(
              control,
              "error",
              arabic
                ? "لم يبدأ الحفظ التلقائي — استخدم زر إعادة المحاولة"
                : "Automatic save did not start — use the retry button",
            );
            return;
          }
          later(clickWhenReady, 50);
          return;
        }

        saveButton.click();
        later(watchCompletion, 20);
      };

      later(clickWhenReady, 0);
    };

    document.addEventListener("change", autoSaveStatus);

    return () => {
      window.clearTimeout(timer);
      managedTimers.forEach((id) => window.clearTimeout(id));
      managedTimers.clear();
      controlsObserver.disconnect();
      document.removeEventListener("change", autoSaveStatus);
      window.removeEventListener("dn-admin-order-status-change", localStatusHandler);
      void supabase?.removeChannel(channel);
    };
  }, []);

  return null;
}
