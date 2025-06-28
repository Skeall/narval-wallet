"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";

interface Enchere {
  id: string;
  lot_image: string;
  lot_title: string;
  lot_description: string;
  current_bid: number;
  current_leader_uid: string | null;
  deadline: string;
}

interface Bidder {
  pseudo: string;
  montant: number;
  uid: string;
}

export default function EnchereDuMoisHomeSection() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [showAvatarModal, setShowAvatarModal] = useState<null | { src: string; alt: string }>(null);
  const [enchere, setEnchere] = useState<Enchere | null>(null);
  const [bidders, setBidders] = useState<Bidder[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const router = useRouter();

  // Récupère l'enchère en cours
  useEffect(() => {
    const fetchEnchere = async () => {
      // On récupère uniquement l'enchère en cours
      const { data, error } = await supabase
        .from("enchere")
        .select("*")
        .eq("statut", "en_cours")
        .order("deadline", { ascending: true })
        .limit(1)
        .single();
      if (!data || error) {
        setEnchere(null);
        setLoading(false);
        return;
      }
      setEnchere(data);
      setLoading(false);
    };
    fetchEnchere();
  }, []);

  // Récupère les 2 meilleurs enchérisseurs
  const [leaderAvatar, setLeaderAvatar] = useState<string | null>(null);
  const [secondAvatar, setSecondAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!enchere) return;
    const fetchBidders = async () => {
      const { data, error } = await supabase
        .from("enchere_historique")
        .select("pseudo, montant, uid")
        .eq("enchere_id", enchere.id)
        .order("montant", { ascending: false })
        .order("date", { ascending: false })
        .limit(2);
      if (!data || error) {
        setBidders([]);
        setLeaderAvatar(null);
        return;
      }
      // mapping pour garantir la présence de uid
      const biddersWithUid = data.map((b: any) => ({
        pseudo: b.pseudo,
        montant: b.montant,
        uid: b.uid
      }));
      setBidders(biddersWithUid);
      // Fetch avatar du leader et du second si présents
      if (biddersWithUid[0]?.uid) {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("avatar")
          .eq("uid", biddersWithUid[0].uid)
          .single();
        setLeaderAvatar(userData?.avatar || null);
      } else {
        setLeaderAvatar(null);
      }
      if (biddersWithUid[1]?.uid) {
        const { data: userData2, error: userError2 } = await supabase
          .from("users")
          .select("avatar")
          .eq("uid", biddersWithUid[1].uid)
          .single();
        setSecondAvatar(userData2?.avatar || null);
      } else {
        setSecondAvatar(null);
      }
    };
    fetchBidders();
  }, [enchere]);

  // Timer dynamique ultra fluide
  useEffect(() => {
    if (!enchere?.deadline) return;
    const updateTimer = () => {
      const now = new Date();
      const end = new Date(enchere.deadline);
      let diff = Math.max(0, end.getTime() - now.getTime());
      if (diff <= 0) {
        setTimeLeft("Terminé");
        return;
      }
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      diff -= d * 1000 * 60 * 60 * 24;
      const h = Math.floor(diff / (1000 * 60 * 60));
      diff -= h * 1000 * 60 * 60;
      const m = Math.floor(diff / (1000 * 60));
      diff -= m * 1000 * 60;
      const s = Math.floor(diff / 1000);
      setTimeLeft(
        `${d > 0 ? d + "j " : ""}${h > 0 ? h + "h " : ""}${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`
      );
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000); // update every second
    return () => clearInterval(interval);
  }, [enchere]);

  if (!mounted || loading) return null;

  // Si aucune enchère en cours, affiche le bloc "Terminée"
  if (!enchere) {
    return (
      <div className="w-full mb-6 rounded-2xl p-0 shadow-xl bg-white/5 backdrop-blur-md border border-white/10 flex flex-col items-stretch">
        <div className={`w-full flex flex-col items-center justify-center py-3 px-4 rounded-t-2xl bg-white/10 backdrop-blur-lg border-b border-white/10 shadow-inner`}>
          <span className="flex items-center gap-2 text-2xl md:text-3xl font-extrabold text-white drop-shadow-lg tracking-tight">
            <span className="text-yellow-300">🎉</span> Terminée
          </span>
        </div>
        <div className="flex flex-row items-center gap-4 w-full px-5 py-5">
          <div className="flex-shrink-0">
            <img
              src="/booster homepage.png"
              alt="Lot terminé"
              className="w-20 h-20 md:w-24 md:h-24 object-contain rounded-2xl shadow-2xl drop-shadow-xl bg-slate-800"
              style={{ background: "transparent" }}
            />
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-4 justify-center items-center">
            <button
              className="mt-2 w-full max-w-xs bg-gradient-to-r from-amber-400/90 to-yellow-500/90 text-slate-900 font-bold text-base md:text-lg py-3 rounded-xl shadow-lg hover:from-yellow-300 hover:to-yellow-400 transition focus:outline-none focus:ring-2 focus:ring-yellow-400 text-center"
              onClick={() => router.push("/gagnant")}
              aria-label="Découvrir le gagnant"
            >
              🎁 Découvrir le gagnant →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Bloc original : timer, avatars, badges, bouton 'Voir l\'enchère', etc.
  return (
    <div className="w-full mb-6 rounded-2xl p-0 shadow-xl bg-white/5 backdrop-blur-md border border-white/10 flex flex-col items-stretch">
      <div className="w-full flex flex-col items-center justify-center py-3 px-4 rounded-t-2xl bg-white/10 backdrop-blur-lg border-b border-white/10 shadow-inner">
        <span className="flex items-center gap-2 text-2xl md:text-3xl font-extrabold text-white drop-shadow-lg tracking-tight">
          <span className="text-yellow-300">⏳</span> {timeLeft}
        </span>
        <span className="text-white/60 text-xs mt-1 tracking-widest">TEMPS RESTANT</span>
      </div>
      <div className="flex flex-row items-center gap-4 w-full px-5 py-5">
        <div className="flex-shrink-0">
          <img
            src={`/${enchere.lot_image || "booster homepage.png"}`}
            alt={enchere.lot_title}
            className="w-20 h-20 md:w-24 md:h-24 object-contain rounded-2xl shadow-2xl drop-shadow-xl bg-slate-800"
            style={{ background: "transparent" }}
          />
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-2 justify-center items-center">
          {/* Leader */}
          {bidders[0] && (
            <div className="flex flex-row items-center gap-2 w-full justify-center">
              {leaderAvatar && (
  <img
    src={leaderAvatar}
    alt="avatar leader"
    className="w-7 h-7 rounded-full border-2 border-white/40 cursor-pointer hover:scale-110 transition-transform"
    onClick={() => setShowAvatarModal({ src: leaderAvatar, alt: bidders[0]?.pseudo || "avatar leader" })}
  />
)}
              <span className="text-white font-bold text-base flex items-center gap-1">
                {bidders[0].pseudo}
                <span className="bg-green-600 text-xs rounded-full px-2 py-0.5 ml-1 text-white">Leader</span>
              </span>
              <span className="bg-neutral-800 text-yellow-300 font-bold rounded-full px-2 py-0.5 ml-2 text-sm">₦{bidders[0].montant}</span>
            </div>
          )}
          {/* Second */}
          {bidders[1] && (
            <div className="flex flex-row items-center gap-2 w-full justify-center text-xs mt-1">
              {secondAvatar && (
  <img
    src={secondAvatar}
    alt="avatar second"
    className="w-6 h-6 rounded-full border border-white/30 cursor-pointer hover:scale-110 transition-transform"
    onClick={() => setShowAvatarModal({ src: secondAvatar, alt: bidders[1]?.pseudo || "avatar second" })}
  />
)}
              <span className="text-white/70">Suivi de près par <span className="font-semibold text-white/90">{bidders[1].pseudo}</span> avec <span className="text-yellow-300 font-bold">₦{bidders[1].montant}</span></span>
            </div>
          )}
          <button
            className="mt-4 w-full max-w-xs bg-gradient-to-r from-amber-400/90 to-yellow-500/90 text-slate-900 font-bold text-base md:text-lg py-3 rounded-xl shadow-lg hover:from-yellow-300 hover:to-yellow-400 transition focus:outline-none focus:ring-2 focus:ring-yellow-400 text-center"
            onClick={() => router.push("/enchere")}
            aria-label="Voir l'enchère"
          >
            Voir l'enchère →
          </button>
        </div>
      </div>
    {/* Modal d'avatar agrandi */}
    {showAvatarModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={() => setShowAvatarModal(null)}
        aria-modal="true"
        role="dialog"
      >
        <div
          className="relative flex flex-col items-center"
          onClick={e => e.stopPropagation()}
        >
          <button
            className="absolute -top-4 -right-4 bg-white/80 hover:bg-white text-black rounded-full p-1 shadow-lg"
            onClick={() => setShowAvatarModal(null)}
            aria-label="Fermer"
            tabIndex={0}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
          <img
            src={showAvatarModal.src}
            alt={showAvatarModal.alt}
            className="w-48 h-48 md:w-64 md:h-64 rounded-full object-cover border-4 border-white shadow-2xl"
            style={{ background: 'transparent' }}
          />
          <span className="mt-4 text-white text-lg font-bold drop-shadow-lg">{showAvatarModal.alt}</span>
        </div>
      </div>
    )}
  </div>
  );
}

