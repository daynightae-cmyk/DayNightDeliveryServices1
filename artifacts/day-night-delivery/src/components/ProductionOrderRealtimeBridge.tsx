import { useEffect } from "react";
import { supabase } from "../supabase";
import "../styles/dn-admin-status-auto-save.css";

const STATUS_CONTROL_SELECTOR = ".dn-order-status-control";

function clean(value: unknown) {
  return String(value ?? "").trim();
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

type RealtimeRow = Record<string, unknown>;
type RealtimePayload = {
  eventType?: string;
  new?: RealtimeRow;
  old?: RealtimeRow;
};

function publishProductionChange(detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent("dn-production-order-change", { detail }));
}

function publishOrderMutation(payload: RealtimePayload) {
  const eventType = clean(payload.eventType).toUpperCase();
  const next = payload.new && typeof payload.new === "object" ? payload.new : null;
  const previous = payload.old && typeof payload.old === "object" ? payload.old : null;

  publishProductionChange({ table: "orders", event: eventType });

  if ((eventType === "INSERT" || eventType === "UPDATE") && next) {
    window.dispatchEvent(
      new CustomEvent("dn-admin-orders-updated", {
        detail: {
          mutation: "upsert",
          order: next,
          source: "supabase_realtime",
        },
      }),
    );
    return;
  }

  if (eventType === "DELETE" && previous) {
    window.dispatchEvent(
      new CustomEvent("dn-admin-orders-updated", {
        detail: {
          mutation: "delete",
          deletedId: previous.id,
          deletedReference:
            previous.tracking_number ||
            previous.invoice_number ||
            previous.coupon_number,
          order: previous,
          source: "supabase_realtime",
        },
      }),
    );
  }
}

function publishStatusHistoryMutation(payload: RealtimePayload) {
  const row = payload.new && typeof payload.new === "object" ? payload.new : null;
  publishProductionChange({ table: "order_status_history", event: payload.eventType });
  if (!row) return;

  const orderId = row.order_id || row.orderId;
  const status = row.status || row.new_status;
  if (!clean(orderId) || !clean(status)) return;

  window.dispatchEvent(
    new CustomEvent("dn-admin-order-status-change", {
      detail: {
        orderId,
        status,
        source: "supabase_status_history_realtime",
      },
    }),
  );
}

function publishDriverLocationMutation(payload: RealtimePayload) {
  const row = payload.new && typeof payload.new === "object" ? payload.new : payload.old;
  publishProductionChange({ table: "driver_locations", event: payload.eventType });
  window.dispatchEvent(
    new CustomEvent("dn-admin-driver-location-change", {
      detail: {
        mutation: clean(payload.eventType).toLowerCase(),
        location: row || null,
        source: "supabase_realtime",
      },
    }),
  );
}

/**
 * Keeps admin order state synchronized without a browser reload or a global data
 * refresh. Realtime rows are published as exact local upsert/delete/status events,
 * preserving the active section, search, merchant filter, pagination and scroll.
 *
 * It also turns the existing status selector into an auto-save control: selecting
 * any status triggers the verified save action after React applies the new value.
 * The hidden legacy button remains available only as a visible retry on failure.
 */
export default function ProductionOrderRealtimeBridge() {
  useEffect(() => {
    if (!supabase || !window.location.pathname.startsWith("/admin")) return;

    const managedTimers = new Set<number>();
    const later = (callback: () => void, delay: number) => {
      const id = window.setTimeout(() => {
        managedTimers.delete(id);
        callback();
      }, delay);
      managedTimers.add(id);
      return id;
    };

    const channel = supabase
      .channel(`admin-orders-production-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => publishOrderMutation(payload as RealtimePayload),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_status_history" },
        (payload) => publishStatusHistoryMutation(payload as RealtimePayload),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations" },
        (payload) => publishDriverLocationMutation(payload as RealtimePayload),
      )
      .subscribe();

    const localStatusHandler = () =>
      publishProductionChange({ source: "local-status-event" });
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
