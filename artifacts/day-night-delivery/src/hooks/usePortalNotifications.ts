import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

export type PortalNotification = {
  id: string;
  user_id?: string | null;
  title: string;
  message: string;
  type: string;
  metadata?: Record<string, unknown> | null;
  read_at?: string | null;
  created_at: string;
};

function rowsFromPayload(payload: unknown): PortalNotification[] {
  const value = payload as { notifications?: unknown } | null;
  return Array.isArray(value?.notifications) ? (value.notifications as PortalNotification[]) : [];
}

export function usePortalNotifications(userId: string | null | undefined) {
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!supabase || !userId) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const rpc = await supabase.rpc("portal_notifications", { p_limit: 60 });
      if (!rpc.error) {
        setNotifications(rowsFromPayload(rpc.data));
        return;
      }

      const direct = await supabase
        .from("notifications")
        .select("id,user_id,title,message,type,metadata,read_at,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(60);

      if (direct.error) throw direct.error;
      setNotifications((direct.data || []) as PortalNotification[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError || "notification_load_failed"));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
    if (!supabase || !userId) return;

    const channel = supabase
      .channel(`portal-notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [refresh, userId]);

  const unreadCount = useMemo(
    () => notifications.reduce((count, notification) => count + (notification.read_at ? 0 : 1), 0),
    [notifications],
  );

  const markRead = useCallback(async (notificationId: string) => {
    if (!supabase || !userId || !notificationId) return;

    setNotifications((current) => current.map((item) => (
      item.id === notificationId && !item.read_at
        ? { ...item, read_at: new Date().toISOString() }
        : item
    )));

    const rpc = await supabase.rpc("portal_mark_notification_read", { p_notification_id: notificationId });
    if (!rpc.error) return;

    const direct = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", userId);

    if (direct.error) {
      setError(direct.error.message);
      void refresh();
    }
  }, [refresh, userId]);

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((item) => !item.read_at);
    await Promise.all(unread.map((item) => markRead(item.id)));
  }, [markRead, notifications]);

  return { notifications, unreadCount, loading, error, refresh, markRead, markAllRead };
}
