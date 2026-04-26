// Client-side push notification helpers
// debug: all push subscription lifecycle logged

/**
 * Vérifie si les notifications push sont supportées par le navigateur
 */
export function isPushSupported(): boolean {
  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
  console.debug('[Push] isPushSupported:', supported);
  return supported;
}

/**
 * Récupère l'état actuel de la permission notification
 */
export function getNotificationPermission(): NotificationPermission | null {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  return Notification.permission;
}

/**
 * Enregistre le Service Worker si pas déjà fait
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.debug('[Push] Service Workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.debug('[Push] Service Worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('[Push] Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Convertit la clé VAPID public (base64) en Uint8Array pour l'API Push
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Souscrit aux notifications push et retourne la subscription PushSubscription
 * Demande la permission si pas encore accordée
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  console.debug('[Push] subscribeToPush called');

  if (!isPushSupported()) {
    console.debug('[Push] Push not supported, aborting');
    return null;
  }

  // Demande la permission
  const permission = await Notification.requestPermission();
  console.debug('[Push] Permission result:', permission);

  if (permission !== 'granted') {
    console.debug('[Push] Permission denied by user');
    return null;
  }

  // Enregistre le SW
  const registration = await registerServiceWorker();
  if (!registration) return null;

  // Attends que le SW soit actif
  await navigator.serviceWorker.ready;
  console.debug('[Push] Service Worker is ready');

  // Vérifie si une subscription existe déjà
  const existingSub = await registration.pushManager.getSubscription();
  if (existingSub) {
    console.debug('[Push] Existing subscription found:', existingSub.endpoint.slice(0, 60));
    return existingSub;
  }

  // Crée une nouvelle subscription
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    console.error('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing from env');
    return null;
  }

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });
    console.debug('[Push] New subscription created:', subscription.endpoint.slice(0, 60));
    return subscription;
  } catch (error) {
    console.error('[Push] Subscription failed:', error);
    return null;
  }
}

/**
 * Envoie la subscription au serveur pour la sauvegarder dans Supabase
 */
export async function saveSubscriptionToServer(
  subscription: PushSubscription,
  userUid: string
): Promise<boolean> {
  console.debug('[Push] Saving subscription to server for user:', userUid);

  try {
    const response = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_uid: userUid,
        subscription: subscription.toJSON(),
      }),
    });

    const result = await response.json();
    console.debug('[Push] Save subscription result:', result);
    return result.success === true;
  } catch (error) {
    console.error('[Push] Save subscription error:', error);
    return false;
  }
}

/**
 * Désabonne l'utilisateur des notifications push
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  console.debug('[Push] unsubscribeFromPush called');

  if (!('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const success = await subscription.unsubscribe();
      console.debug('[Push] Unsubscribed:', success);
      return success;
    }

    console.debug('[Push] No subscription to unsubscribe');
    return true;
  } catch (error) {
    console.error('[Push] Unsubscribe error:', error);
    return false;
  }
}

/**
 * Helper pour envoyer une notification à un utilisateur via l'API
 * Appelé côté client après une action (pari créé, accepté, etc.)
 */
export async function sendNotificationToUser(
  targetUserUid: string,
  title: string,
  body: string,
  url: string = '/',
  tag: string = 'narval-notification'
): Promise<boolean> {
  console.debug('[Push] sendNotificationToUser:', { targetUserUid, title, body, url, tag });

  try {
    const response = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_user_uid: targetUserUid,
        title,
        body,
        url,
        tag,
      }),
    });

    const result = await response.json();
    console.debug('[Push] Send notification result:', result);
    return result.success === true;
  } catch (error) {
    console.error('[Push] Send notification error:', error);
    return false;
  }
}
