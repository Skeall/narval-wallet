"use client";
import { useEffect, useState } from "react";
import {
  isPushSupported,
  getNotificationPermission,
  subscribeToPush,
  saveSubscriptionToServer,
  registerServiceWorker,
} from "@/utils/notifications";
import { supabase } from "@/utils/supabaseClient";

// debug: Composant cloche de notifications
// Affiche une cloche dans le header de la home
// Gère l'inscription aux push notifications de manière transparente

export default function NotificationBell() {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [supported, setSupported] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // debug: check support + current permission on mount
  useEffect(() => {
    const isSupp = isPushSupported();
    setSupported(isSupp);
    setPermission(getNotificationPermission());

    // Si la permission est déjà accordée, enregistre le SW + souscrit silencieusement
    if (isSupp && getNotificationPermission() === 'granted') {
      console.debug('[NotifBell] Permission already granted, auto-subscribing');
      autoSubscribe();
    }
  }, []);

  // Auto-subscribe quand la permission est déjà accordée (re-enregistre le SW à chaque visite)
  const autoSubscribe = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.debug('[NotifBell] No user logged in, skip auto-subscribe');
        return;
      }

      const subscription = await subscribeToPush();
      if (subscription) {
        await saveSubscriptionToServer(subscription, user.id);
        setSubscribed(true);
        console.debug('[NotifBell] Auto-subscribed successfully');
      }
    } catch (error) {
      console.error('[NotifBell] Auto-subscribe error:', error);
    }
  };

  // Handler clic sur la cloche
  const handleClick = async () => {
    console.debug('[NotifBell] Bell clicked, current permission:', permission);

    if (!supported) {
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 3000);
      return;
    }

    if (permission === 'denied') {
      // L'utilisateur a bloqué — on ne peut pas re-demander
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 4000);
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.debug('[NotifBell] No user logged in');
        setLoading(false);
        return;
      }

      const subscription = await subscribeToPush();
      if (subscription) {
        const saved = await saveSubscriptionToServer(subscription, user.id);
        if (saved) {
          setSubscribed(true);
          setPermission('granted');
          console.debug('[NotifBell] Subscription saved successfully');
        }
      } else {
        // L'utilisateur a refusé ou erreur
        setPermission(getNotificationPermission());
      }
    } catch (error) {
      console.error('[NotifBell] Subscribe error:', error);
    }

    setLoading(false);
  };

  // Ne pas afficher si pas supporté
  if (!supported) return null;

  // Déterminer l'icône et le style selon l'état
  const isActive = permission === 'granted' && subscribed;
  const isDenied = permission === 'denied';

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={loading}
        className={
          "relative w-10 h-10 rounded-full flex items-center justify-center transition-all " +
          (isActive
            ? "bg-sky-500/20 text-sky-400"
            : isDenied
              ? "bg-red-500/20 text-red-400"
              : "bg-slate-700/60 text-gray-300 hover:bg-slate-600/80 hover:text-sky-300")
        }
        aria-label={
          isActive
            ? "Notifications activées"
            : isDenied
              ? "Notifications bloquées"
              : "Activer les notifications"
        }
        title={
          isActive
            ? "Notifications activées ✅"
            : isDenied
              ? "Notifications bloquées dans les paramètres du navigateur"
              : "Activer les notifications"
        }
      >
        {/* Icône cloche SVG */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className={`w-5 h-5 ${loading ? 'animate-pulse' : ''}`}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>

        {/* Pastille verte si actif */}
        {isActive && (
          <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border border-[#0B0F1C]" />
        )}

        {/* Barre rouge si bloqué */}
        {isDenied && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-6 h-0.5 bg-red-400 rotate-45 rounded-full" />
          </span>
        )}
      </button>

      {/* Tooltip contextuel */}
      {showTooltip && (
        <div className="absolute top-12 right-0 z-50 bg-[#1C2233] border border-white/10 rounded-xl px-4 py-3 shadow-lg w-64 text-sm">
          {!supported ? (
            <p className="text-gray-300">
              Les notifications ne sont pas supportées sur ce navigateur.
              <br />
              <span className="text-xs text-gray-400">Essaie Chrome ou ajoute l'app à ton écran d'accueil (iOS).</span>
            </p>
          ) : isDenied ? (
            <p className="text-gray-300">
              Tu as bloqué les notifications.
              <br />
              <span className="text-xs text-gray-400">
                Pour les réactiver, va dans les paramètres de ton navigateur → Site → Notifications → Autoriser.
              </span>
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
