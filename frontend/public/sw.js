/**
 * "Kill switch" Service Worker
 *
 * Goal: recover users stuck on a cached old SPA shell (old hashed assets 404).
 * Strategy:
 * - On install/activate: delete ALL caches, take control immediately.
 * - Force all open tabs to reload (navigate to same URL).
 * - Never cache anything.
 *
 * Keep this file for a while after migration.
 */
/* eslint-disable no-restricted-globals */

self.addEventListener('install', event => {
  // Activate immediately
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      // Delete every cache (Workbox + custom)
      if (self.caches && self.caches.keys) {
        const keys = await self.caches.keys()
        await Promise.all(keys.map(k => self.caches.delete(k)))
      }

      // Take control of all clients
      await self.clients.claim()

      // Force reload of all open tabs (even if the page JS never booted)
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      await Promise.all(
        clients.map(client => {
          try {
            return client.navigate(client.url)
          } catch (_e) {
            return undefined
          }
        })
      )
    })()
  )
})

// Network-only: do not cache anything
self.addEventListener('fetch', () => {
  // Intentionally empty: default browser network behavior.
})
