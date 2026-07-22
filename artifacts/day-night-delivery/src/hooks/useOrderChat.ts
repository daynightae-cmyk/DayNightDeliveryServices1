import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";

export type OrderChatRole = "driver" | "customer" | "admin";

export type OrderChatMessage = {
  id: string;
  order_id: string;
  sender_user_id?: string | null;
  sender_role: OrderChatRole | string;
  sender_name?: string | null;
  body?: string | null;
  message_type: "text" | "location" | "system" | string;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
};

function messageOf(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String(error.message);
  return String(error || "Unknown chat error");
}

function friendlyError(error: unknown, isArabic: boolean) {
  const raw = messageOf(error);
  if (/not_authenticated/i.test(raw)) return isArabic ? "سجّل الدخول لفتح محادثة الطلبية." : "Sign in to open the order conversation.";
  if (/order_chat_access_denied|row-level security|permission/i.test(raw)) return isArabic ? "هذه المحادثة متاحة فقط للعميل والمندوب المسند والإدارة." : "This conversation is limited to the customer, assigned driver, and operations.";
  if (/order_chat_list|order_chat_send|does not exist|schema cache/i.test(raw)) return isArabic ? "خدمة المحادثة تحتاج تفعيل تحديث قاعدة البيانات الجديد." : "The new database chat update still needs to be activated.";
  return isArabic ? "تعذر تحديث المحادثة الآن. أعد المحاولة." : "The conversation could not be refreshed. Please retry.";
}

export function useOrderChat(orderId: string | null | undefined, isArabic: boolean) {
  const [messages, setMessages] = useState<OrderChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const refreshTimer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase || !orderId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("order_chat_list", { p_order_id: orderId });
    if (rpcError) {
      setError(friendlyError(rpcError, isArabic));
    } else {
      setMessages(((Array.isArray(data) ? data : []) as OrderChatMessage[]).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    }
    setLoading(false);
  }, [isArabic, orderId]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => void refresh(), 120);
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!supabase || !orderId) return;
    const channel = supabase
      .channel(`order-chat-${orderId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_conversation_messages" }, scheduleRefresh)
      .subscribe();
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      void supabase?.removeChannel(channel);
    };
  }, [orderId, scheduleRefresh]);

  const send = useCallback(async (body: string) => {
    if (!supabase || !orderId || !body.trim()) return false;
    setSending(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("order_chat_send", {
      p_order_id: orderId,
      p_body: body.trim(),
      p_message_type: "text",
      p_latitude: null,
      p_longitude: null,
    });
    if (rpcError) setError(friendlyError(rpcError, isArabic));
    else await refresh();
    setSending(false);
    return !rpcError;
  }, [isArabic, orderId, refresh]);

  const sendLocation = useCallback(async () => {
    if (!supabase || !orderId) return false;
    if (!navigator.geolocation) {
      setError(isArabic ? "هذا الجهاز لا يدعم مشاركة الموقع." : "This device does not support location sharing.");
      return false;
    }
    setSending(true);
    setError("");
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 }));
      const { error: rpcError } = await supabase.rpc("order_chat_send", {
        p_order_id: orderId,
        p_body: isArabic ? "تمت مشاركة الموقع الحالي" : "Current location shared",
        p_message_type: "location",
        p_latitude: position.coords.latitude,
        p_longitude: position.coords.longitude,
      });
      if (rpcError) throw rpcError;
      await refresh();
      return true;
    } catch (locationError) {
      const raw = messageOf(locationError);
      setError(/permission|denied/i.test(raw)
        ? (isArabic ? "اسمح للموقع من إعدادات المتصفح ثم أعد المحاولة." : "Allow location access in browser settings, then retry.")
        : friendlyError(locationError, isArabic));
      return false;
    } finally {
      setSending(false);
    }
  }, [isArabic, orderId, refresh]);

  return useMemo(() => ({ messages, loading, sending, error, refresh, send, sendLocation }), [error, loading, messages, refresh, send, sendLocation, sending]);
}
