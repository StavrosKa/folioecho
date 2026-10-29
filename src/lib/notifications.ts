export type WorkspaceNotification = { title: string; message: string; kind: 'success' | 'error'; key: string };

/** Client-only, session-local notices. Never include credentials or request bodies. */
export function notify(title: string, message: string, kind: WorkspaceNotification['kind'] = 'success', key = title) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<WorkspaceNotification>('folioecho-notification', { detail: { title, message, kind, key } }));
}
