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
import NewsModal, { NewsItem } from "./components/NewsModal";

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
  // debug: news modal state
  const [newsOpen, setNewsOpen] = useState(false);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
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

  // debug: fetch last 30 days news and decide if we should show the modal
  useEffect(() => {
    const fetchNews = async () => {
      try {
        const now = new Date();
        const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const iso = past30.toISOString();
        const { data, error } = await supabase
          .from("news")
          .select("id, title, description, image_url, created_at")
          .gte("created_at", iso)
          .order("created_at", { ascending: false });
        if (error) {
          console.log("[News][fetch] error:", error);
          return;
        }
        const items = (data || []) as NewsItem[];
        setNewsItems(items);
        // decide visibility based on last seen timestamp
        if (items.length > 0) {
          const latest = items[0].created_at;
          const lastSeen = localStorage.getItem("news_last_seen_created_at");
          console.log("[News] latest:", latest, "lastSeen:", lastSeen);
          if (!lastSeen || latest > lastSeen) {
            setNewsOpen(true);
          }
        }
      } catch (e) {
        console.log("[News][fetch] exception:", e);
      }
    };
    // Fetch news right away when app loads
    fetchNews();
  }, []);

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

        {/* News modal */}
        <NewsModal
          items={newsItems}
          open={newsOpen}
          onClose={() => {
            try {
              // persist last seen as the newest created_at
              const latest = newsItems[0]?.created_at;
              if (latest) {
                localStorage.setItem("news_last_seen_created_at", latest);
              }
            } catch {}
            setNewsOpen(false);
          }}
        />

        {/* Toast transfert reçu */}
        {showTransferToast && (
          <ToastNotification message={transferToastMsg} onClose={() => setShowTransferToast(false)} />
        )}
        <div className="w-full flex flex-col items-center justify-center min-h-screen">
          <div className="w-full max-w-[430px] mx-auto flex flex-col gap-6 pt-8">

            {/* Header */}
          <div className="flex items-start justify-between w-full px-1 pt-0 pb-0 gap-2 -mt-3">
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
            {/* Groupe méga + notification côte à côte */}
            <div className="flex items-center gap-0">
              {/* debug: replaced Piñata icon with megaphone to open News manually */}
              <button
                onClick={() => setNewsOpen(true)}
                className="p-2 rounded-full hover:bg-[#232B42] transition"
                aria-label="Voir les nouveautés"
                title="Nouveautés"
              >
                {/* debug: replaced SVG by PNG icon from /public/icons */}
                <img src="/icons/megaphone.png" alt="Nouveautés" className="w-6 h-6 object-contain" />
              </button>
              <div className="relative flex-shrink-0">
                <button
                  aria-label="Voir le portefeuille"
                  className="p-2 rounded-full hover:bg-[#232B42] transition"
                  onClick={() => { console.debug('[Home] Go to /wallet'); router.push('/wallet'); }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-sky-300">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>

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
          {/* Bloc Enchère du mois */}
          <EnchereDuMoisHomeSection />
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

          {/* Halloween promo block - under quick actions */}
          {/* Debug: lightweight, no extra deps; subtle festive style with orange accents */}
          <div className="w-full -mt-1">
            <div className="relative rounded-2xl px-4 py-4 bg-gradient-to-br from-[#2A1F1F] to-[#1C1410] border border-orange-500/30 shadow-[0_0_18px_1px_rgba(249,115,22,0.15)] overflow-hidden">
              {/* Decorative emojis (non-blocking) */}
              <div className="pointer-events-none select-none absolute -top-2 -right-2 text-4xl opacity-20">🎃</div>
              <div className="pointer-events-none select-none absolute -bottom-2 -left-2 text-3xl opacity-15">👻</div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 text-2xl" aria-hidden>🕸️</div>
                <div className="flex-1">
                  <div className="text-[17px] font-semibold text-orange-300 leading-tight">
                    🕸️ Débloque ton skin Halloween !
                  </div>
                  <div className="mt-1 text-sm text-orange-100/90">
                    Transforme ton avatar en version Halloween.<br/>
                    <span className="text-orange-300/90">🎃 Disponible jusqu’au 31 octobre</span>
                  </div>
                  <div className="mt-3">
                    <a
                      href="https://tally.so/r/w2QleL"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => console.log('[Home][Halloween] CTA clicked')}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold shadow-lg transition focus:outline-none focus:ring-2 focus:ring-amber-300"
                      aria-label="Demander mon skin via Tally"
                    >
                      Demander mon skin 🎁
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* debug: removed 'Nouvelle édition en vue !' promo card as requested */}
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
