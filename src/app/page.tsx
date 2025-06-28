"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/utils/supabaseClient";
import ParisEnCoursHomeSection from "./ParisEnCoursHomeSection";
import { VictorySoundProvider } from "./VictorySoundProvider";
import { LooseSoundProvider } from "./LooseSoundProvider";
import { PariSoundProvider } from "./PariSoundProvider";
import EnchereDuMoisHomeSection from "./EnchereDuMoisHomeSection";
import ToastNotification from "./ToastNotification";

interface UserData {
  uid: string;
  pseudo: string;
  solde: number;
  role: string;
  avatar: string;
}

export default function Home() {
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTransferToast, setShowTransferToast] = useState(false);
  const [transferToastMsg, setTransferToastMsg] = useState("");
  const router = useRouter();

  // Toast transfert reçu (notification visuelle)
  useEffect(() => {
    if (!user) return;
    const checkLastTransfer = async () => {
      // Récupère la dernière transaction transfert reçue
      const { data: txs, error } = await supabase
        .from("transactions")
        .select("id, from, montant, date")
        .eq("type", "transfert")
        .eq("to", user.uid)
        .order("date", { ascending: false })
        .limit(1);
      if (error || !txs || txs.length === 0) {
        console.log("[Narval][Toast] Aucune transaction de transfert reçue trouvée", { error, txs });
        return;
      }
      const lastTx = txs[0];
      const localKey = `last_seen_transfer_id_${user.uid}`;
      const lastSeenId = localStorage.getItem(localKey);
      console.log("[Narval][Toast] Transaction reçue:", lastTx);
      console.log("[Narval][Toast] lastSeenId:", lastSeenId);
      if (lastTx.id && lastTx.id.toString() !== lastSeenId) {
        // Récupère le pseudo de l'expéditeur via une requête séparée
        let pseudo = "Un joueur";
        try {
          const { data: expData } = await supabase
            .from("users")
            .select("pseudo")
            .eq("uid", lastTx.from)
            .single();
          pseudo = expData?.pseudo || "Un joueur";
        } catch (e) { /* fallback "Un joueur" */ }
        setTransferToastMsg(`🎉 ${pseudo} t’a envoyé ₦${lastTx.montant} Narvals !`);
        setShowTransferToast(true);
        console.log("[Narval][Toast] Affichage de la notification toast !");
        // Après 5s, masque le toast et marque comme vu
        setTimeout(() => {
          setShowTransferToast(false);
          localStorage.setItem(localKey, lastTx.id.toString());
          console.log("[Narval][Toast] Toast masqué, id marqué comme vu:", lastTx.id);
        }, 5000);
      } else {
        console.log("[Narval][Toast] Pas de toast : transaction déjà vue ou id manquant.");
      }
    };
    checkLastTransfer();
  }, [user]);

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      // On suppose que le profil est dans la table "users" (clé: id = user.id)
      const { data, error } = await supabase
        .from("users")
        .select("uid, pseudo, solde, role, avatar")
        .eq("uid", user.id)
        .single();
      if (!data || error) {
        router.push("/login");
        return;
      }
      setUser(data);
      setLoading(false);
    };
    fetchUser();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F1C] text-white">
        Chargement…
      </div>
    );
  }

  return (
    <PariSoundProvider>
      <LooseSoundProvider>
        <VictorySoundProvider>
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B0F1C] text-white relative">

        {/* Toast transfert reçu */}
        {showTransferToast && (
          <ToastNotification message={transferToastMsg} onClose={() => setShowTransferToast(false)} />
        )}
        <div className="w-full flex flex-col items-center justify-center min-h-screen">
          <div className="w-full max-w-[430px] mx-auto flex flex-col gap-6 pt-8">

            {/* Header */}
          <div className="flex items-start justify-between w-full px-1 pt-2 pb-0 gap-2">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-sky-400 to-blue-800 flex items-center justify-center overflow-hidden border-2 border-[#232B42]">
                <img
                  src={user?.avatar || "/avatar-paysage.jpg"}
                  alt="Avatar"
                  className="object-cover w-full h-full cursor-pointer hover:scale-110 transition-transform"
                  onClick={() => setShowAvatarModal(true)}
                />
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-base font-medium text-gray-300 leading-tight whitespace-nowrap">Salut <span role="img" aria-label="wave">👋</span> <span className="text-white font-semibold">{user?.pseudo}</span></span>
              </div>
            </div>
            {/* Groupe Piñata + notification côte à côte */}
            <div className="flex items-center gap-0">
              <button
                onClick={() => { sessionStorage.setItem("unmuteIntro", "1"); router.push('/pinata'); }}
                className="bg-transparent p-0 m-0 hover:bg-transparent focus:outline-none flex items-center justify-center"
                aria-label="Aller à la Piñata"
              >
                <img src="/iconpinata.png" alt="Piñata" className="w-6 h-6 object-contain" />
              </button>
              <div className="relative flex-shrink-0">
                <button
                  aria-label="Voir le portefeuille"
                  className="p-2 rounded-full hover:bg-[#232B42] transition"
                  onClick={() => router.push("/portefeuille")}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-sky-300">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {/* Badge notification rouge */}
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                </button>
              </div>
            </div>
          </div>
          {/* Solde */}
          <div className="mt-0 mb-0 flex flex-col items-center">
            <div className="text-4xl md:text-5xl font-bold text-sky-300 mt-0 select-none tracking-tight text-center" style={{letterSpacing: '-1px', marginTop: 0, marginBottom: '0.10rem'}}>
              ₦{user?.solde}
            </div>
          </div>
          {/* Actions rapides */}
          <div className="flex gap-4 mt-2 w-full">
            <button
              className="flex-1 flex flex-col items-center justify-center py-3 rounded-2xl bg-[#232B42] hover:shadow-[0_0_12px_2px_rgba(56,189,248,0.4)] hover:bg-sky-800/40 transition group"
              onClick={() => router.push("/transfert")}
            >
              <span className="text-2xl mb-1 group-hover:animate-bounce">📤</span>
              <span className="font-semibold text-base">Envoyer</span>
            </button>
            <button
              className="flex-1 flex flex-col items-center justify-center py-3 rounded-2xl bg-[#232B42] hover:shadow-[0_0_12px_2px_rgba(139,92,246,0.4)] hover:bg-purple-800/40 transition group"
              onClick={() => router.push("/pari")}
            >
              <span className="text-2xl mb-1 group-hover:animate-bounce">🎯</span>
              <span className="font-semibold text-base">Parier</span>
            </button>
          </div>
          {/* Bloc Enchère du mois */}
<div className="w-full flex items-center justify-center mb-2 mt-2">
  <h2 className="font-bold text-lg md:text-xl text-amber-400 drop-shadow text-center tracking-tight select-none">
    🧨 Enchère du mois
  </h2>
</div>
<EnchereDuMoisHomeSection />

          {/* Pot commun en bas */}
          <div className="w-full mt-10">
            <div className="flex items-center bg-[#232B42] rounded-2xl p-4 shadow-lg">
              {/* Booster image */}
              <div className="w-16 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center mr-4">
                <img
                  src="/card.png"
                  alt="Booster"
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="flex-1 flex flex-col justify-between">
                <div className="font-bold text-lg text-sky-300">Nouvelle édition en vue !</div>
                <div className="text-xs text-gray-300 mt-1 mb-3">Quand le pot commun est complet, une nouvelle série de cartes sort. À vous de jouer <span role="img" aria-label="eyes">👀</span></div>
                <div className="w-full flex items-center gap-2">
                  <div className="flex-1 h-3 bg-[#1C2233] rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-blue-600 rounded-full transition-all duration-700"
                      style={{ width: `${540 / 1500 * 100}%` }}
                    ></div>
                  </div>
                  <div className="text-xs font-semibold text-sky-200 ml-2 whitespace-nowrap">540 / 1500</div>
                </div>
              </div>
            </div>
          </div>
          {/* Section Paris en cours (en bas de la home) */}
          {user && (
            <ParisEnCoursHomeSection userId={user.uid} userPseudo={user.pseudo} />
          )}
        {/* Modal d'avatar agrandi */}
        {showAvatarModal && user && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAvatarModal(false)}
            aria-modal="true"
            role="dialog"
          >
            <div
              className="relative flex flex-col items-center"
              onClick={e => e.stopPropagation()}
            >
              <button
                className="absolute -top-4 -right-4 bg-white/80 hover:bg-white text-black rounded-full p-1 shadow-lg"
                onClick={() => setShowAvatarModal(false)}
                aria-label="Fermer"
                tabIndex={0}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
              <img
                src={user.avatar || "/avatar-paysage.jpg"}
                alt={user.pseudo}
                className="w-48 h-48 md:w-64 md:h-64 rounded-full object-cover border-4 border-white shadow-2xl"
                style={{ background: 'transparent' }}
              />
              <span className="mt-4 text-white text-lg font-bold drop-shadow-lg">{user.pseudo}</span>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
        </VictorySoundProvider>
      </LooseSoundProvider>
    </PariSoundProvider>
  );
}
