import { supabase } from "../supabase";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  level: "info" | "warning" | "success";
  created_at: string;
};

export function subscribeToOrderStatusChanges(onNotify: (n: AppNotification) => void) {
  if (!supabase) return () => {};

  const channel = supabase
    .channel("dn-orders-status")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload: any) => {
      const next = payload?.new;
      if (!next) return;
      onNotify({
        id: `status-${next.id}-${Date.now()}`,
        title: "Shipment status updated",
        body: `Tracking ${next.tracking_code || next.id}: ${next.status}`,
        level: "info",
        created_at: new Date().toISOString()
      });
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToNewOrdersForAdmin(onNotify: (n: AppNotification) => void) {
  if (!supabase) return () => {};

  const channel = supabase
    .channel("dn-new-orders")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload: any) => {
      const created = payload?.new;
      if (!created) return;
      onNotify({
        id: `new-${created.id}-${Date.now()}`,
        title: "New order created",
        body: `New request from ${created.sender_name} to ${created.receiver_city}`,
        level: "success",
        created_at: new Date().toISOString()
      });
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function scheduleDeliveryReminder(trackingCode: string, etaText: string, notify: (n: AppNotification) => void) {
  const timeout = setTimeout(() => {
    notify({
      id: `reminder-${trackingCode}-${Date.now()}`,
      title: "Delivery reminder",
      body: `Tracking ${trackingCode}: expected ${etaText}`,
      level: "warning",
      created_at: new Date().toISOString()
    });
  }, 2000);

  return () => clearTimeout(timeout);
}

export function supportsPushNotifications() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}
