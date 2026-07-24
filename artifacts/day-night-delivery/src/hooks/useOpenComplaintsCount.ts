import { useEffect, useState } from "react";
import { supabase } from "../supabase";

const CLOSED_COMPLAINT_STATUSES = '("resolved","closed","rejected")';

export default function useOpenComplaintsCount(enabled = true) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled || !supabase) {
      setCount(0);
      return;
    }

    const client = supabase;
    let active = true;

    const refresh = async () => {
      try {
        const { count: total, error } = await client
          .from("complaints")
          .select("id", { count: "exact", head: true })
          .not("status", "in", CLOSED_COMPLAINT_STATUSES);

        if (!active) return;
        setCount(error ? 0 : total || 0);
      } catch {
        if (active) setCount(0);
      }
    };

    void refresh();

    const channel = client
      .channel(`admin-open-complaints-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "complaints" },
        () => void refresh(),
      )
      .subscribe();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", handleVisibility);
      void client.removeChannel(channel);
    };
  }, [enabled]);

  return count;
}
