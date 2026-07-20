import { useEffect, useMemo, useState } from "react";
import { Bell, Headphones, Languages, Laptop2, Moon, Sun } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAppContext } from "../../lib/AppContext";
import companyMeta from "../../data/companyMeta";
import { supabase } from "../../supabase";
import { usePortalNotifications } from "../../hooks/usePortalNotifications";
import PortalNotificationCenter from "./PortalNotificationCenter";
import "../../styles/dn-portals-live.css";
import "../../styles/dn-portal-route-lock.css";
import "../../styles/dn-portal-overlay.css";
import "../../styles/dn-portal-auth-v5.css";

export const PORTAL_NOTIFICATIONS_OPEN_EVENT = "daynight:portal-notifications-open";

function isPortalPath(pathname: string) {
  return pathname === "/merchant" || pathname.startsWith("/merchant/") || pathname === "/driver" || pathname.startsWith("/driver/");
}

export default function PortalRuntimeOverlay() {
  const location = useLocation();
  const { language, themeMode, toggleLanguage, toggleTheme } = useAppContext();
  const isArabic = language === "ar";
  const portalActive = isPortalPath(location.pathname);
  const [userId, setUserId] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notifications = usePortalNotifications(portalActive ? userId : null);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-portal-route", portalActive);
    if (!portalActive) {
      setNotificationsOpen(false);
      setUserId(null);
      return;
    }

    if (!supabase) return;
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) setUserId(data.session?.user?.id || null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
      if (!session?.user) setNotificationsOpen(false);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [portalActive]);

  useEffect(() => {
    if (!portalActive) return;
    const openNotifications = () => setNotificationsOpen(true);
    window.addEventListener(PORTAL_NOTIFICATIONS_OPEN_EVENT, openNotifications);
    return () => window.removeEventListener(PORTAL_NOTIFICATIONS_OPEN_EVENT, openNotifications);
  }, [portalActive]);

  const ThemeIcon = useMemo(() => themeMode === "dark" ? Moon : themeMode === "light" ? Sun : Laptop2, [themeMode]);
  const themeLabel = themeMode === "dark"
    ? (isArabic ? "ليلي" : "Night")
    : themeMode === "light"
      ? (isArabic ? "نهاري" : "Light")
      : (isArabic ? "تلقائي" : "System");

  if (!portalActive) return null;

  return (
    <>
      <div className="dn-portal-floating-tools" dir={isArabic ? "rtl" : "ltr"}>
        <button type="button" onClick={toggleTheme} title={isArabic ? `المظهر: ${themeLabel}` : `Appearance: ${themeLabel}`}>
          <ThemeIcon />
          <span>{themeLabel}</span>
        </button>
        <button type="button" onClick={toggleLanguage} title={isArabic ? "English" : "العربية"}>
          <Languages />
          <span>{isArabic ? "EN" : "عربي"}</span>
        </button>
        <a href={companyMeta.whatsappUrl} target="_blank" rel="noreferrer" className="is-support" title={isArabic ? "البلاغات والدعم" : "Reports and support"}>
          <Headphones />
          <span>{isArabic ? "الدعم" : "Support"}</span>
        </a>
        {userId && (
          <button type="button" className="is-notification" onClick={() => setNotificationsOpen(true)} title={isArabic ? "الإشعارات" : "Notifications"}>
            <Bell />
            <span>{isArabic ? "تنبيهات" : "Alerts"}</span>
            {notifications.unreadCount > 0 && <b>{notifications.unreadCount}</b>}
          </button>
        )}
      </div>

      <PortalNotificationCenter
        open={notificationsOpen}
        isArabic={isArabic}
        notifications={notifications.notifications}
        loading={notifications.loading}
        error={notifications.error}
        onClose={() => setNotificationsOpen(false)}
        onRefresh={() => void notifications.refresh()}
        onMarkRead={(id) => void notifications.markRead(id)}
        onMarkAllRead={() => void notifications.markAllRead()}
      />
    </>
  );
}
