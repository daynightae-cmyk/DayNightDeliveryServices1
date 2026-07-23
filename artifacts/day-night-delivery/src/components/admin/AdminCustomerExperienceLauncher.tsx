import { useEffect, useState } from "react";
import { MessageSquareWarning } from "lucide-react";
import { supabase } from "../../supabase";

export default function AdminCustomerExperienceLauncher() {
  const [count, setCount] = useState(0);
  const isAdminRoute = /^\/admin(?:\/|$)/.test(window.location.pathname) && window.location.pathname !== "/admin/customer-experience";

  useEffect(() => {
    if (!isAdminRoute || !supabase) return;
    const client = supabase;
    let active = true;
    const refresh = async () => {
      const { count: total } = await client
        .from("complaints")
        .select("id", { count: "exact", head: true })
        .not("status", "in", '("resolved","closed","rejected")');
      if (active) setCount(total || 0);
    };
    void refresh();
    const channel = client
      .channel(`admin-customer-experience-launcher-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, refresh)
      .subscribe();
    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [isAdminRoute]);

  if (!isAdminRoute) return null;
  return (
    <a
      href="/admin/customer-experience"
      className="fixed bottom-24 end-4 z-[90000] flex min-h-14 items-center gap-3 rounded-2xl border border-white/15 bg-[#071A33] px-4 py-3 text-white shadow-[0_20px_60px_rgba(7,26,51,0.35)] transition hover:-translate-y-0.5 sm:bottom-6 sm:end-6"
      aria-label="تجربة العملاء والشكاوى"
    >
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-[#0057B8]">
        <MessageSquareWarning className="h-5 w-5" />
        {count > 0 && <b className="absolute -end-2 -top-2 min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] text-white">{count > 99 ? "99+" : count}</b>}
      </span>
      <span className="hidden text-start sm:block"><strong className="block text-xs">تجربة العملاء</strong><small className="text-[10px] text-white/55">التقييمات والشكاوى</small></span>
    </a>
  );
}
