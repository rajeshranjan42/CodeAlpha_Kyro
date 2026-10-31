// Service worker: shows notifications in the device notification panel
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data.json(); } catch { /* ignore */ }
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // If the app is open and in front, the in-app toast already shows it
    if (!d.force && wins.some((w) => w.visibilityState === 'visible' && w.focused)) return;
    await self.registration.showNotification(d.title || 'Kyro', {
      body: d.body || '', icon: '/icon-192.png', badge: '/badge-96.png', tag: d.tag,
      data: { boardId: d.boardId, cardId: d.cardId },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { boardId, cardId } = event.notification.data || {};
  const url = boardId ? `/?board=${boardId}${cardId ? `&card=${cardId}` : ''}` : '/';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if ('focus' in w) { await w.focus(); w.postMessage({ type: 'open', boardId, cardId }); return; }
    }
    await self.clients.openWindow(url);
  })());
});
