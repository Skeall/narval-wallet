// Service Worker pour les notifications push Narval
// debug: SW lifecycle events logged

self.addEventListener('install', (event) => {
  console.debug('[SW] Install event');
  // Force activation immédiate sans attendre les autres tabs
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.debug('[SW] Activate event');
  // Prend le contrôle de toutes les pages immédiatement
  event.waitUntil(self.clients.claim());
});

// Réception d'une notification push
self.addEventListener('push', (event) => {
  console.debug('[SW] Push event received', event.data?.text());

  let data = {};
  try {
    data = event.data?.json() || {};
  } catch (e) {
    console.debug('[SW] Push data parse error, using text fallback');
    data = { title: 'Narval', body: event.data?.text() || 'Nouvelle notification' };
  }

  const title = data.title || 'Narval';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'narval-notification',
    // Regroup les notifs du même tag (évite le spam)
    renotify: true,
    // Vibration pattern pour mobile
    vibrate: [100, 50, 100],
    // Données custom pour le clic
    data: {
      url: data.url || '/',
      type: data.type || 'generic',
    },
  };

  // debug: log notification details
  console.debug('[SW] Showing notification:', title, options);

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Clic sur la notification → ouvre/focus la bonne page
self.addEventListener('notificationclick', (event) => {
  console.debug('[SW] Notification click:', event.notification.data);

  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si une fenêtre Narval est déjà ouverte, on la focus et on navigue
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Sinon on ouvre un nouvel onglet
      return self.clients.openWindow(targetUrl);
    })
  );
});
