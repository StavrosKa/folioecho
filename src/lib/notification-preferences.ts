import { useEffect, useState } from 'react';

export type NotificationPreferences = { notificationsMuted: boolean; soundMuted: boolean };
const changedEvent = 'folioecho-notification-preferences';
function readPreferences(): NotificationPreferences {
  try { return { notificationsMuted: localStorage.getItem('folioecho-notifications-paused') === 'true', soundMuted: localStorage.getItem('folioecho-notifications-muted') === 'true' }; }
  catch { return { notificationsMuted: false, soundMuted: false }; }
}
export function updateNotificationPreferences(patch: Partial<NotificationPreferences>) {
  const preferences = { ...readPreferences(), ...patch };
  try {
    localStorage.setItem('folioecho-notifications-paused', String(preferences.notificationsMuted));
    localStorage.setItem('folioecho-notifications-muted', String(preferences.soundMuted));
  } catch {}
  window.dispatchEvent(new CustomEvent<NotificationPreferences>(changedEvent, { detail: preferences }));
}
export function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({ notificationsMuted: false, soundMuted: false });
  useEffect(() => {
    setPreferences(readPreferences());
    const changed = (event: Event) => setPreferences((event as CustomEvent<NotificationPreferences>).detail);
    const storage = (event: StorageEvent) => { if (!event.key || event.key.startsWith('folioecho-notifications-')) setPreferences(readPreferences()); };
    window.addEventListener(changedEvent, changed); window.addEventListener('storage', storage);
    return () => { window.removeEventListener(changedEvent, changed); window.removeEventListener('storage', storage); };
  }, []);
  return preferences;
}
