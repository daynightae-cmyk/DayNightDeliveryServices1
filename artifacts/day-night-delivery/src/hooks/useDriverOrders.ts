import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import type { Order } from "../types";

const activeStatuses = ["assigned", "accepted", "picked_up", "in_transit", "postponed", "review", "confirmed"];

export function useDriverOrders(driverId?: string) {
  const [orders, setOrders] = useState<Order[]>([]);
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
      .in("status", activeStatuses)
      .order("created_at", { ascending: false })
      .limit(50);

    if (fetchError) setError(fetchError.message);
    else setOrders((data || []) as Order[]);
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

  return { orders, loading, error, refresh };
}
