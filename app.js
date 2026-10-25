// --- CONFIGURACIÓN ---
const VAPID_PUBLIC_KEY =
  'BOAc5cc3PkiempnN5vlERe7jnjkRTSQ1mtll8jhRgWMA8-EDTyZklQK9xHCwdMvW1OVxgY7N1-PHOOIloBHTLiQ';

const SUPABASE_URL = 'https://oxqgceyugjahicnqgtsq.supabase.co';

// Clave anon tradicional (JWT) de Supabase
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94cWdjZXl1Z2phaGljbnFndHNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0OTIzNzgsImV4cCI6MjEwNzA2ODM3OH0.M2EMLBUDLQb4Jv8BUntGjPXtqNCfmA4QXl4fxvk_-No';

// --- FUNCIÓN PARA REGISTRAR LAS NOTIFICACIONES ---
async function activarNotificacionesPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Este navegador o entorno no soporta notificaciones push');
    return;
  }

  try {
    const registro = await navigator.serviceWorker.register('./sw.js');
    console.log('Service Worker registrado correctamente');

    const permiso = await Notification.requestPermission();

    if (permiso === 'granted') {
      let suscripcion = await registro.pushManager.getSubscription();

      if (!suscripcion) {
        suscripcion = await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      console.log('Enviando suscripción a Supabase...');

      const respuesta = await fetch(
        `${SUPABASE_URL}/rest/v1/push_subscriptions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Prefer': 'resolution=ignore-duplicates'
          },
          body: JSON.stringify({
            endpoint: suscripcion.endpoint,
            subscription_data: suscripcion
          })
        }
      );

      if (!respuesta.ok) {
        const errorText = await respuesta.text();
        throw new Error(`Supabase HTTP ${respuesta.status}: ${errorText}`);
      }

      console.log('¡Suscripción guardada con éxito en Supabase!');
    } else {
      console.log('El permiso de notificaciones no fue concedido');
    }
  } catch (error) {
    console.error('Error durante la suscripción:', error);
  }
}

function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

// Ejecutar al abrir la app
window.addEventListener('load', activarNotificacionesPush);