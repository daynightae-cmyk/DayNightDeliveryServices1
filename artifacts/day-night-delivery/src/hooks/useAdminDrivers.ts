import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import type {
  DriverLocation,
  DriverOverviewRow,
  DriverPresence,
  DriverProfile,
  DriverTrailPoint,
  DriverOrder,
} from "../types/driver";

export type AdminDriverRow = DriverOverviewRow;

export function driverPresence(lastSeen?: string | null, onlineFlag?: boolean | null): DriverPresence {
  if (!lastSeen || onlineFlag === false) return "offline";
  const time = new Date(lastSeen).getTime();
  if (!Number.isFinite(time)) return "problem";
  const age = Date.now() - time;
  if (age < 120_000) return "online";
  if (age < 600_000) return "idle";
  return "offline";
}

export function useAdminDrivers() {
  const [drivers, setDrivers] = useState<AdminDriverRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const client = supabase;
    if (!client) return;
    setLoading(true);
    setError("");

    const [profilesResult, locationsResult, ordersResult, trailResult] = await Promise.all([
      client.from("driver_profiles").select("*").order("created_at", { ascending: false }),
      client.from("driver_locations").select("*").order("last_seen_at", { ascending: false }),
      client.from("orders").select("*").or("driver_id.not.is.null,assigned_driver_id.not.is.null").order("created_at", { ascending: false }).limit(1000),
      client.from("driver_location_history").select("*").order("recorded_at", { ascending: false }).limit(3000),
    ]);

    const firstError = profilesResult.error || locationsResult.error || ordersResult.error || trailResult.error;
    if (firstError) setError(firstError.message);

    const profiles = (profilesResult.data || []) as DriverProfile[];
    const locations = (locationsResult.data || []) as DriverLocation[];
    const orderRows = (ordersResult.data || []) as DriverOrder[];
    const trails = (trailResult.data || []) as DriverTrailPoint[];
    const today = new Date().toDateString();

    setDrivers(
      profiles.map((driver) => {
        const location = locations.find((row) => row.driver_id === driver.id) || null;
        const orders = orderRows.filter(
          (order) => order.driver_id === driver.id || order.assigned_driver_id === driver.id,
        );
        const activeOrders = orders.filter(
          (order) => !["delivered", "cancelled", "returned"].includes(String(order.status || "").toLowerCase()),
        );
        const deliveredToday = orders.filter(
          (order) =>
            String(order.status || "").toLowerCase() === "delivered" &&
            new Date(order.updated_at || order.created_at).toDateString() === today,
        ).length;
        return {
          ...driver,
          location,
          orders,
          trail: trails.filter((point) => point.driver_id === driver.id).slice(0, 120).reverse(),
          presence: driverPresence(location?.last_seen_at, location?.is_online),
          active_orders: activeOrders.length,
          delivered_today: deliveredToday,
          cod_active: activeOrders.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0),
        };
      }),
    );
    setLastUpdatedAt(new Date().toISOString());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const channel = client
      .channel("admin-driver-operations-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_profiles" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_location_history" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void refresh())
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [refresh]);

  const stats = useMemo(
    () => ({
      total: drivers.length,
      online: drivers.filter((driver) => driver.presence === "online").length,
      idle: drivers.filter((driver) => driver.presence === "idle").length,
      offline: drivers.filter((driver) => driver.presence === "offline").length,
      activeOrders: drivers.reduce((sum, driver) => sum + driver.active_orders, 0),
      codActive: drivers.reduce((sum, driver) => sum + driver.cod_active, 0),
      deliveredToday: drivers.reduce((sum, driver) => sum + driver.delivered_today, 0),
    }),
    [drivers],
  );

  return { drivers, stats, loading, error, lastUpdatedAt, refresh };
}
