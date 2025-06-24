"use client";
import { useState } from "react";

export default function PushTestButton() {
  const [permission, setPermission] = useState<string | null>(null);
  const [sub, setSub] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function registerSW() {
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('/sw-push.js');
        return reg;
      } catch (e) {
        setErr('Erreur SW: ' + (e as Error).message);
      }
    } else {
      setErr('Service worker non supporté');
    }
  }

  async function askPermissionAndSubscribe() {
    const reg = await registerSW();
    if (!reg) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== 'granted') return;
    // Génère une subscription push (clé publique VAPID à fournir pour le vrai usage)
    try {
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array("BIWVScDdtwsFeWnyVFabmtoTb5zr0FL72-8AHyQo8F5xwBcuUB-_ivXj-UIVFICbhIUmYxFT6ZbkFipu3qQP9U4")
      });
      setSub(sub);
    } catch (e) {
      setErr('Erreur subscription: ' + (e as Error).message);
    }
  }

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async function sendTestPush() {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration('/sw-push.js');
    if (!reg || !reg.active) return;
    if (Notification.permission !== 'granted') return;
    reg.active.postMessage({
      type: 'LOCAL_NOTIFICATION',
      title: "Maxime t’a envoyé ₦5 Narvals 🎉",
      body: 'Test notification push locale (via postMessage)',
      icon: '/favicon.png',
      badge: '/favicon.png',
    });
  }

  return (
    <div className="flex flex-col gap-2 items-start bg-slate-900 p-3 rounded-xl mt-4">
      <button className="bg-sky-700 hover:bg-sky-800 text-white px-4 py-2 rounded" onClick={askPermissionAndSubscribe}>
        Activer notifications push
      </button>
      {permission && <div>Permission: {permission}</div>}
      {sub && (
        <>
          <div className="break-all text-xs bg-black/30 p-2 rounded">{JSON.stringify(sub)}</div>
          <button className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded mt-2" onClick={sendTestPush}>
            Copier subscription pour test push
          </button>
        </>
      )}
      <button className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded mt-2" onClick={sendTestPush}>
        Envoyer notification test
      </button>
      {err && <div className="text-red-400">{err}</div>}
    </div>
  );
}
