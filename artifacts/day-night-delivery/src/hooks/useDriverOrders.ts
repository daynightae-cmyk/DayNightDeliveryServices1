import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import type { DriverOrder } from "../types/driver";

const closedStatuses = new Set(["delivered", "cancelled", "returned"]);

export function useDriverOrders(driverId?: string) {
  const [orders, setOrders] = useState<DriverOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!supabase || !driverId) return;
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .or(`driver_id.eq.${driverId},assigned_driver_id.eq.${driverId}`)
      .order("created_at", { ascending: false })
      .limit(100);

    if (fetchError) setError(fetchError.message);
    else setOrders((data || []) as DriverOrder[]);
    setLoading(false);
  }, [driverId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const client = supabase;
    if (!client || !driverId) return;

    const channel = client
      .channel(`driver-orders-${driverId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void refresh())
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [driverId, refresh]);

  const activeOrders = useMemo(
    () => orders.filter((order) => !closedStatuses.has(String(order.status || "").toLowerCase())),
    [orders],
  );
  const completedOrders = useMemo(
    () => orders.filter((order) => closedStatuses.has(String(order.status || "").toLowerCase())),
    [orders],
  );
  const deliveredToday = useMemo(() => {
    const today = new Date().toDateString();
    return orders.filter(
      (order) =>
        String(order.status || "").toLowerCase() === "delivered" &&
        new Date(order.updated_at || order.created_at).toDateString() === today,
    ).length;
  }, [orders]);
  const activeCod = useMemo(
    () => activeOrders.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0),
    [activeOrders],
  );

  return {
    orders,
    activeOrders,
    completedOrders,
    deliveredToday,
    activeCod,
    loading,
    error,
    refresh,
  };
}
