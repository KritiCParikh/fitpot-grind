// FitPot push handler, loaded into the app's service worker (vite.config.js,
// workbox importScripts). Shows the reminder and opens the app when tapped.
// Firebase can wrap the message in a "data" field or send it flat; both work.
self.addEventListener('push', (event) => {
  let p = {}
  try { p = event.data ? event.data.json() : {} } catch { p = { body: event.data ? event.data.text() : '' } }
  const d = p.data || p.notification || p
  const title = d.title || 'FitPot'
  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: d.tag || 'fitpot',
    renotify: false,
    data: { url: d.url || './' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || './'
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const open = all.find((c) => c.url.startsWith(self.registration.scope))
    if (open) { await open.focus(); if ('navigate' in open) await open.navigate(url).catch(() => {}); return }
    await self.clients.openWindow(url)
  })())
})
