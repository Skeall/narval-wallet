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
import WalletHistoryEmbed from "./components/WalletHistoryEmbed";
import LoadingVideo from "./components/LoadingVideo";

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
    return <LoadingVideo label="Chargement de l’accueil" />;
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

          {/* debug: seasonal promo removed (2025-11) */}
          {/* Section Paris en cours (en bas de la home) */}
          {user && (
            <ParisEnCoursHomeSection userId={user.uid} userPseudo={user.pseudo} />
          )}
        {/* Bottom sheet profil + historique (inspiré du screenshot) */}
        {showAvatarModal && user && (
          <div
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-md"
            onClick={() => { console.debug('[Home][ProfileSheet] overlay click -> close'); setShowAvatarModal(false); }}
            aria-modal="true"
            role="dialog"
          >
            <div
              className="absolute inset-x-0 bottom-0 w-full bg-[#0F172A] border border-white/10 rounded-t-3xl shadow-2xl h-[85vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* handle + close */}
              <div className="relative pt-3 pb-2">
                <div className="mx-auto h-1.5 w-12 rounded-full bg-white/20" />
                <button
                  className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white rounded-full p-1.5 border border-white/20"
                  onClick={() => { console.debug('[Home][ProfileSheet] close click'); setShowAvatarModal(false); }}
                  aria-label="Fermer"
                >
                  ✖
                </button>
              </div>
              {/* header avatar + pseudo */}
              <div className="px-5 -mt-10 flex flex-col items-center">
                <div className="w-28 h-28 rounded-full border-4 border-white shadow-lg overflow-hidden bg-[#0B0F1C]">
                  <img src={user.avatar || "/avatar-paysage.jpg"} alt={user.pseudo} className="w-full h-full object-cover" />
                </div>
                <div className="mt-3 text-2xl font-extrabold tracking-wide uppercase bg-white text-black px-3 py-1 rounded">
                  {user.pseudo}
                </div>
                <div className="mt-3 text-lg font-bold text-white">Historique du portefeuille</div>
                <div className="text-sm text-gray-300 mb-2">Tes bonus récents, classés par jour.</div>
              </div>
              {/* content scroll area (fits within sheet height) */}
              <div className="px-5 pb-6 h-[calc(85vh-170px)] overflow-y-auto">
                <WalletHistoryEmbed />
              </div>
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
