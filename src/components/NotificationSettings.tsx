import { updateNotificationPreferences, useNotificationPreferences } from '../lib/notification-preferences';

export default function NotificationSettings() {
  const preferences = useNotificationPreferences();
  return <div className="notification-preferences">
    <label className="notification-preference"><span><b>Mute notifications</b><small>Pause new bell notifications, unread badges and ringing. Existing history stays available.</small></span><input type="checkbox" role="switch" checked={preferences.notificationsMuted} onChange={event => updateNotificationPreferences({ notificationsMuted: event.target.checked })} /></label>
    <label className="notification-preference"><span><b>Mute notification sounds</b><small>Keep visual notifications and turn off the chime.</small></span><input type="checkbox" role="switch" checked={preferences.soundMuted} onChange={event => updateNotificationPreferences({ soundMuted: event.target.checked })} /></label>
    <p className="notification-preference-note">Saved automatically for this browser. Messages inside your workspace remain visible.</p>
  </div>;
}
