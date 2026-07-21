import { useEffect } from "react";
import { supabase } from "../supabase";

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

/**
 * Keeps the legacy admin state synchronized without duplicating order data locally.
 * The source of truth remains the production Supabase `orders` table.
 */
export default function ProductionOrderRealtimeBridge() {
  useEffect(() => {
    if (!supabase || !window.location.pathname.startsWith("/admin")) return;

    let timer = 0;
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

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("dn-admin-order-status-change", localStatusHandler);
      void supabase?.removeChannel(channel);
    };
  }, []);

  return null;
}
