// Escucha cuando llega un mensaje PUSH desde Supabase
self.addEventListener('push', (event) => {
  let data = {};
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Nueva Noticia', body: event.data.text() };
    }
  }

  const title = data.title || 'Nueva Noticia';
  const options = {
    body: data.body || 'Entra en la app para ver la última noticia publicada.',
    icon: '/icon.png', // Si tienes un icono de la app en tu web, pon su ruta aquí
    badge: '/icon.png',
    data: { url: data.url || '/' }
  };

  // Muestra la notificación nativa en la barra del teléfono
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Cuando el usuario pulsa sobre la notificación en el teléfono, abre la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});