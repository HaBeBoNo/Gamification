// ═══════════════════════════════════════════════════════════════
// service-worker.js — Sektionen HQ · PWA Service Worker
//
// Hanteras av vite-plugin-pwa (injectManifest mode).
// Workbox injicerar precache-manifestet (self.__WB_MANIFEST).
//
// Strategier:
//   App-shell (JS/CSS/HTML) — CacheFirst via precacheAndRoute
//   API-anrop (/api/*)      — NetworkFirst (färsk data föredras, fallback cache)
//   Externa resurser        — StaleWhileRevalidate
//
// Push-notiser: hanteras direkt (vidarebefordras från Supabase Edge Function)
// ═══════════════════════════════════════════════════════════════

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

// ── Precache app-shell (injiceras av vite-plugin-pwa vid build) ──
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ── Runtime-strategier ───────────────────────────────────────────

// API-anrop: NetworkFirst med 10s timeout, faller tillbaka till cache
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName:              'sektionen-api-v1',
    networkTimeoutSeconds:  10,
  })
);

// Fonter och CDN-resurser: StaleWhileRevalidate
registerRoute(
  ({ url }) => url.origin !== self.location.origin,
  new StaleWhileRevalidate({ cacheName: 'sektionen-external-v1' })
);

// ── Push-notifikationer (Supabase Edge Function → Web Push) ─────

self.addEventListener('push', (event) => {
  const data    = event.data?.json() ?? {};
  const title   = data.title || 'Sektionen HQ';
  const options = {
    body:    data.body || '',
    icon:    '/icons/icon-192.png',
    badge:   '/icons/icon-192.png',
    data:    { url: data.url || '/' },
    vibrate: [100, 50, 100],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url || '/';
  const notificationUrl = String(rawUrl).startsWith('http')
    ? String(rawUrl)
    : `${self.location.origin}${String(rawUrl).startsWith('/') ? '' : '/'}${rawUrl}`;

  event.waitUntil((async () => {
    const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });

    for (const client of windowClients) {
      if ('focus' in client) {
        try {
          await client.focus();
          if ('navigate' in client) {
            await client.navigate(notificationUrl);
          }
          return;
        } catch {
          // Fallback to opening a new window below.
        }
      }
    }

    await clients.openWindow(notificationUrl);
  })());
});
