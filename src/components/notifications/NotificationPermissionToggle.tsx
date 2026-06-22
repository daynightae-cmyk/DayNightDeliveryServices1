import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import translations from '../../data/translations';

const STORAGE_KEY = 'daynight_notifications_enabled';

export default function NotificationPermissionToggle() {
  const { lang } = useLanguage();
  const t = translations[lang].notifications;
  const [supported, setSupported] = useState<boolean>(true);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [enabled, setEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'Notification' in window);
    if (typeof window !== 'undefined' && 'Notification' in window) setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch {}
  }, [enabled]);

  async function requestPermission() {
    if (!supported) {
      setMessage(t.unsupported);
      return;
    }

    if (permission === 'granted') {
      setEnabled(true);
      setMessage(t.enabled);
      return;
    }

    if (permission === 'denied') {
      setMessage(t.blocked);
      setEnabled(false);
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        setEnabled(true);
        setMessage(t.enabled);
        // send a test notification
        new Notification(lang === 'ar' ? 'تم تفعيل إشعارات DAY NIGHT' : 'DAY NIGHT Notifications Enabled', {
          body: lang === 'ar' ? 'ستصلك الآن تحديثات حالة الشحنات.' : 'You will now receive shipment status updates.'
        });
      } else if (result === 'denied') {
        setEnabled(false);
        setMessage(t.blocked);
      } else {
        setMessage(t.dismissed);
      }
    } catch (e) {
      setMessage(t.unsupported);
    }
  }

  return (
    <div className="mt-4 p-4 rounded-xl border border-white/10 bg-white/5 flex items-center gap-4">
      <div className={`p-3 rounded-lg bg-brand-deep/40 text-white`}> 
        <Bell className="w-5 h-5" />
      </div>
      <div className="flex-1 text-right">
        <h4 className="font-extrabold text-white text-sm">{t.title}</h4>
        <p className="text-white/60 text-xs mt-1">{t.description}</p>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={requestPermission}
            className={`px-3 py-2 rounded-xl font-bold text-xs ${enabled ? 'bg-brand-gold text-brand-deep' : 'bg-white/5 text-white'}`}
            aria-label={lang === 'ar' ? 'تفعيل الإشعارات' : 'Enable Notifications'}
          >
            {lang === 'ar' ? 'تفعيل الإشعارات' : 'Allow Notifications'}
          </button>
          <div className="text-[12px] text-white/60">{message}</div>
        </div>
      </div>
    </div>
  );
}
