// FitPot is now Arth. This replaces the old FitPot app saved on phones:
// it clears the saved copy, removes itself and opens the page that leads to Arth.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key)
    await self.registration.unregister()
    const windows = await self.clients.matchAll({ type: 'window' })
    for (const w of windows) w.navigate(self.registration.scope)
  })())
})
