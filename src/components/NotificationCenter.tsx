import { useEffect, useRef, useState } from 'react';
import type { WorkspaceNotification } from '../lib/notifications';
import { updateNotificationPreferences, useNotificationPreferences } from '../lib/notification-preferences';
import Icon from './Icon';
import './notification-center.css';

type Entry = WorkspaceNotification & { id: number; time: number; read: boolean };
export default function NotificationCenter() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [open, setOpen] = useState(false);
  const preferences = useNotificationPreferences();
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const [ring, setRing] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const audio = useRef<AudioContext | null>(null);
  const lastSound = useRef(0);
  const seen = useRef(new Map<string, number>());
  const sequence = useRef(0);
  useEffect(() => {
    const unlock = () => {
      try { if (!audio.current || audio.current.state === 'closed') audio.current = new AudioContext(); void audio.current.resume().catch(() => {}); } catch {}
    };
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<WorkspaceNotification>).detail;
      if (!detail?.title || !detail.message || preferencesRef.current.notificationsMuted) return;
      const now = Date.now();
      if (now - (seen.current.get(detail.key) ?? 0) < 12000) return;
      seen.current.set(detail.key, now);
      if (seen.current.size > 100) seen.current.delete(seen.current.keys().next().value!);
      setEntries(previous => [{ ...detail, id: ++sequence.current, time: now, read: false }, ...previous].slice(0, 30));
      setRing(previous => previous + 1);
      const context = audio.current;
      if (!preferencesRef.current.soundMuted && context?.state === 'running' && now - lastSound.current > 1500) {
        lastSound.current = now;
        try {
          [784, 1046].forEach((frequency, index) => {
            const oscillator = context.createOscillator(), gain = context.createGain();
            const start = context.currentTime + index * .12;
            oscillator.frequency.value = frequency; oscillator.type = 'sine';
            gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.065, start + .015); gain.gain.exponentialRampToValueAtTime(.001, start + .28);
            oscillator.connect(gain); gain.connect(context.destination); oscillator.start(start); oscillator.stop(start + .3);
            oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
          });
        } catch {}
      }
    };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    window.addEventListener('folioecho-notification', receive);
    return () => {
      window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock);
      window.removeEventListener('folioecho-notification', receive); void audio.current?.close().catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!host.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    window.addEventListener('pointerdown', outside); window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', escape); };
  }, [open]);
  const unread = preferences.notificationsMuted ? 0 : entries.filter(entry => !entry.read).length;
  function toggleMute() {
    updateNotificationPreferences({ soundMuted: !preferences.soundMuted });
  }
  return <div className="notice-center" ref={host}>
    <button ref={trigger} className="icon-button notice-trigger" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} aria-controls="workspace-notifications" onClick={() => setOpen(!open)}>
      <span key={ring} className={ring ? 'notice-ring' : ''}><Icon name="bell" /></span>{unread > 0 && <span className="notice-badge">{unread > 9 ? '9+' : unread}</span>}
    </button>
    <span className="notice-announcement" role="status" aria-live="polite">{!preferences.notificationsMuted && entries[0] ? `${entries[0].title}. ${entries[0].message}` : ''}</span>
    {open && <section id="workspace-notifications" className="notice-popover" aria-label="Workspace notifications">
      <header><div><strong>Notifications</strong><small>{preferences.notificationsMuted ? 'Notifications muted' : unread ? `${unread} unread` : 'You’re all caught up'}</small></div><button onClick={() => setOpen(false)} aria-label="Close notifications"><Icon name="close" size={18} /></button></header>
      <div className="notice-tools"><button aria-pressed={preferences.soundMuted} onClick={toggleMute}>{preferences.soundMuted ? 'Sound off · Unmute' : 'Sound on · Mute'}</button><button disabled={!entries.some(entry => !entry.read)} onClick={() => setEntries(previous => previous.map(entry => ({ ...entry, read: true })))}>Mark all read</button></div>
      <div className="notice-feed">{entries.length ? <ul>{entries.map(entry => <li key={entry.id} className={`${entry.read ? '' : 'unread'} ${entry.kind}`}><Icon name={entry.kind === 'error' ? 'info' : 'check'} size={18} /><div><b>{entry.title}</b><p>{entry.message}</p><time dateTime={new Date(entry.time).toISOString()}>{new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div></li>)}</ul> : <p className="notice-empty">Your saves, imports and completed actions will appear here.</p>}</div>
      <footer><small>Activity from this session</small><button disabled={!entries.length} onClick={() => setEntries([])}>Clear all</button></footer>
    </section>}
  </div>;
}
