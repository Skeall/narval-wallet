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
  const [enchere, setEnchere] = useState<Enchere | null>(null);
  const [bidders, setBidders] = useState<Bidder[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const router = useRouter();

  // Récupère l'enchère en cours
  useEffect(() => {
    const fetchEnchere = async () => {
      const { data, error } = await supabase
        .from("enchere")
        .select("*")
        .order("deadline", { ascending: false })
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

  if (loading || !enchere) return null;

  const leader = bidders[0];
  const second = bidders[1];

  return (
    <div className="w-full mb-6 rounded-2xl p-0 shadow-xl bg-white/5 backdrop-blur-md border border-white/10 flex flex-col items-stretch">
      {/* Timer en haut, séparé */}
      {/* Bloc haut : statut terminé */}
      <div className={`w-full flex flex-col items-center justify-center py-3 px-4 rounded-t-2xl bg-white/10 backdrop-blur-lg border-b border-white/10 shadow-inner`}>
        <span className="flex items-center gap-2 text-2xl md:text-3xl font-extrabold text-white drop-shadow-lg tracking-tight">
          <span className="text-yellow-300">🎉</span> Terminée
        </span>
      </div>
      {/* Bas du bloc : uniquement image + bouton teasing */}
      <div className="flex flex-row items-center gap-4 w-full px-5 py-5">
        <div className="flex-shrink-0">
          <img
            src={`/${enchere.lot_image || "booster homepage.png"}`}
            alt={enchere.lot_title}
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
