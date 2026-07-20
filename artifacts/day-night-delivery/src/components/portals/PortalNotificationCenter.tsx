import { Bell, CheckCheck, CheckCircle2, Clock3, RefreshCw, X } from "lucide-react";
import type { PortalNotification } from "../../hooks/usePortalNotifications";

function localized(notification: PortalNotification, isArabic: boolean) {
  const metadata = notification.metadata || {};
  const titleAr = typeof metadata.title_ar === "string" ? metadata.title_ar : "";
  const messageAr = typeof metadata.message_ar === "string" ? metadata.message_ar : "";
  return {
    title: isArabic && titleAr ? titleAr : notification.title,
    message: isArabic && messageAr ? messageAr : notification.message,
  };
}

export default function PortalNotificationCenter({
  open,
  isArabic,
  notifications,
  loading,
  error,
  onClose,
  onRefresh,
  onMarkRead,
  onMarkAllRead,
}: {
  open: boolean;
  isArabic: boolean;
  notifications: PortalNotification[];
  loading: boolean;
  error?: string;
  onClose: () => void;
  onRefresh: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  if (!open) return null;

  return (
    <div className="dn-portal-notification-layer" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside className="dn-portal-notification-panel" dir={isArabic ? "rtl" : "ltr"} role="dialog" aria-modal="true" aria-label={isArabic ? "الإشعارات" : "Notifications"}>
        <header>
          <div>
            <span><Bell /></span>
            <div>
              <small>DAY NIGHT</small>
              <h2>{isArabic ? "مركز الإشعارات" : "Notification center"}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={isArabic ? "إغلاق" : "Close"}><X /></button>
        </header>

        <div className="dn-portal-notification-tools">
          <button type="button" onClick={onRefresh} disabled={loading}><RefreshCw className={loading ? "dn-spin" : ""} />{isArabic ? "تحديث" : "Refresh"}</button>
          <button type="button" onClick={onMarkAllRead} disabled={!notifications.some((item) => !item.read_at)}><CheckCheck />{isArabic ? "قراءة الكل" : "Mark all read"}</button>
        </div>

        {error && <p className="dn-portal-notification-error">{isArabic ? "تعذر تحميل بعض الإشعارات حالياً." : "Some notifications could not be loaded right now."}</p>}

        <div className="dn-portal-notification-list">
          {notifications.length === 0 && !loading ? (
            <div className="dn-portal-notification-empty">
              <CheckCircle2 />
              <strong>{isArabic ? "لا توجد إشعارات جديدة" : "No notifications yet"}</strong>
              <p>{isArabic ? "ستظهر هنا تحديثات الطلبات والإسناد والتسليم فور حدوثها." : "Order, assignment, and delivery updates will appear here in realtime."}</p>
            </div>
          ) : notifications.map((notification) => {
            const copy = localized(notification, isArabic);
            return (
              <button
                key={notification.id}
                type="button"
                className={notification.read_at ? "is-read" : "is-unread"}
                onClick={() => onMarkRead(notification.id)}
              >
                <span className="dn-portal-notification-dot" />
                <div>
                  <strong>{copy.title}</strong>
                  <p>{copy.message}</p>
                  <small><Clock3 />{new Date(notification.created_at).toLocaleString(isArabic ? "ar-AE" : "en-AE", { dateStyle: "medium", timeStyle: "short" })}</small>
                </div>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
