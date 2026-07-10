import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { clearAdminNotifications, markAdminNotificationsRead, readAdminAudioSettings, readAdminNotifications, writeAdminAudioSettings, type AdminNotification } from "../../lib/adminAudio";
import "../../styles/dn-admin-audio.css";

type Props = { isArabic: boolean; open: boolean; onClose: () => void };
const typeLabel: Record<AdminNotification["type"], { ar: string; en: string }> = { success: { ar: "نجاح", en: "Success" }, warning: { ar: "تحذير", en: "Warning" }, error: { ar: "خطأ", en: "Error" }, info: { ar: "معلومة", en: "Info" }, new_order: { ar: "طلب جديد", en: "New order" }, cod: { ar: "COD", en: "COD" }, print: { ar: "طباعة", en: "Print" }, database: { ar: "قاعدة البيانات", en: "Database" }, daily_closing: { ar: "الإغلاق", en: "Daily closing" }, khalifa: { ar: "خليفة", en: "Khalifa" } };

export function AdminNotificationBell({ isArabic, onOpen }: { isArabic: boolean; onOpen: () => void }) {
  const [items, setItems] = useState<AdminNotification[]>(() => readAdminNotifications());
  const [muted, setMuted] = useState(() => readAdminAudioSettings().muted);
  useEffect(() => {
    const notificationHandler = () => setItems(readAdminNotifications());
    const audioHandler = () => setMuted(readAdminAudioSettings().muted);
    window.addEventListener("dn-admin-notifications-change", notificationHandler);
    window.addEventListener("dn-admin-audio-settings-change", audioHandler);
    return () => { window.removeEventListener("dn-admin-notifications-change", notificationHandler); window.removeEventListener("dn-admin-audio-settings-change", audioHandler); };
  }, []);
  const unread = items.filter((item) => !item.read).length;
  const toggleMute = () => { const next = { ...readAdminAudioSettings(), muted: !muted }; writeAdminAudioSettings(next); setMuted(next.muted); };
  return <div className="dn-admin-audio-topbar"><button type="button" onClick={onOpen} aria-label={isArabic ? "الإشعارات" : "Notifications"}><Bell className="h-4 w-4" />{isArabic ? "الإشعارات" : "Notifications"}{unread > 0 && <b>{unread}</b>}</button><button type="button" onClick={toggleMute}>{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}{muted ? (isArabic ? "كتم" : "Mute") : (isArabic ? "تشغيل الصوت" : "Sound on")}</button></div>;
}

export default function AdminNotificationCenter({ isArabic, open, onClose }: Props) {
  const [items, setItems] = useState<AdminNotification[]>(() => readAdminNotifications());
  useEffect(() => { const handler = () => setItems(readAdminNotifications()); window.addEventListener("dn-admin-notifications-change", handler); return () => window.removeEventListener("dn-admin-notifications-change", handler); }, []);
  useEffect(() => { if (open) markAdminNotificationsRead(); }, [open]);
  const sorted = useMemo(() => items.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [items]);
  if (!open) return null;
  return <aside className="dn-notification-center" dir={isArabic ? "rtl" : "ltr"} aria-label={isArabic ? "مركز الإشعارات" : "Notification center"}>
    <header><div><Bell className="h-5 w-5" /><strong>{isArabic ? "مركز الإشعارات" : "Notification Center"}</strong><span>{sorted.length}/30</span></div><button type="button" onClick={onClose}><X className="h-4 w-4" /></button></header>
    <div className="dn-notification-actions"><button type="button" onClick={() => { markAdminNotificationsRead(); setItems(readAdminNotifications()); }}><CheckCheck className="h-4 w-4" />{isArabic ? "تعليم كمقروء" : "Mark read"}</button><button type="button" onClick={() => { clearAdminNotifications(); setItems([]); }}><Trash2 className="h-4 w-4" />{isArabic ? "مسح الكل" : "Clear all"}</button></div>
    <ul>{sorted.map((item) => <li key={item.id} className={`is-${item.type} ${item.priority === "high" ? "is-high" : ""}`}><span>{isArabic ? typeLabel[item.type].ar : typeLabel[item.type].en}</span><strong>{isArabic ? item.titleAr : item.titleEn}</strong><p>{isArabic ? item.bodyAr : item.bodyEn}</p><small>{new Date(item.createdAt).toLocaleString(isArabic ? "ar-AE" : "en-AE")}</small></li>)}{!sorted.length && <li><strong>{isArabic ? "لا توجد إشعارات" : "No notifications"}</strong><p>{isArabic ? "سيظهر هنا تنبيه العمليات عند وجود أمر مهم." : "Important operations alerts will appear here."}</p></li>}</ul>
  </aside>;
}
