// Service Worker pour notifications push Web
self.addEventListener('push', function(event) {
  let title = 'Notification Narval';
  let options = {
    body: '',
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: {},
  };
  if (event.data) {
    try {
      const data = event.data.json();
      title = data.title || title;
      options.body = data.body || '';
      if (data.icon) options.icon = data.icon;
      if (data.badge) options.badge = data.badge;
      if (data.url) options.data.url = data.url;
    } catch (e) {
      // Si ce n'est pas du JSON, affiche le texte brut
      options.body = event.data.text();
    }
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});

// Permet d'afficher une notification locale via postMessage depuis le client
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'LOCAL_NOTIFICATION') {
    const { title, ...options } = event.data;
    self.registration.showNotification(title || 'Notification Narval', options);
  }
});
