import { api } from './api.js';

const toKey = (s) => {
  const raw = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const registerSW = () => ('serviceWorker' in navigator ? navigator.serviceWorker.register('/sw.js').catch(() => null) : null);

// 'unsupported' | 'denied' | 'on' | 'off'
export async function pushState() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

export async function enablePush() {
  const { key } = await api('/push/key');
  if (!key) throw new Error('Push is not set up on the server. Add the VAPID keys to server/.env');
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Permission was not granted');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(key) }));
  await api('/push/subscribe', 'POST', { subscription: sub.toJSON() });
}

export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (sub) { await api('/push/unsubscribe', 'POST', { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
}

export const testPush = () => api('/push/test', 'POST');
