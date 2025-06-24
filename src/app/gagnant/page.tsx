"use client";
import { useEffect, useState, useRef } from "react";
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

interface EnchereHistorique {
  id: string;
  enchere_id: string;
  uid: string;
  pseudo: string;
  montant: number;
  date: string;
}

interface User {
  uid: string;
  pseudo: string;
  avatar: string;
}

export default function GagnantPage() {
  const [enchere, setEnchere] = useState<Enchere | null>(null);
  const [historique, setHistorique] = useState<EnchereHistorique[]>([]);
  const [leader, setLeader] = useState<User | null>(null);
  const [runnerUp, setRunnerUp] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // Dernière enchère terminée
      const { data: enchereData } = await supabase
        .from("enchere")
        .select("*")
        .order("deadline", { ascending: false })
        .limit(1)
        .single();
      setEnchere(enchereData);
      if (!enchereData) { setLoading(false); return; }
      // Historique trié par montant desc puis date asc
      const { data: histoData } = await supabase
        .from("enchere_historique")
        .select("id, enchere_id, uid, pseudo, montant, date")
        .eq("enchere_id", enchereData.id)
        .order("montant", { ascending: false })
        .order("date", { ascending: true });
      setHistorique(histoData || []);
      // Gagnant
      const gagnant = histoData?.[0];
      if (gagnant) {
        const { data: gagnantUser } = await supabase
          .from("users")
          .select("uid, pseudo, avatar")
          .eq("uid", gagnant.uid)
          .single();
        setLeader(gagnantUser);
      }
      // Runner-up
      const second = histoData?.[1];
      if (second) {
        const { data: runnerUser } = await supabase
          .from("users")
          .select("uid, pseudo, avatar")
          .eq("uid", second.uid)
          .single();
        setRunnerUp(runnerUser);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // Jingle victoire à l'arrivée
  useEffect(() => {
    if (!loading && audioRef.current) {
      audioRef.current.volume = 0.6;
      audioRef.current.play().catch(() => {});
    }
  }, [loading]);

  if (loading || !enchere || !leader) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F1C] text-white">
        <div className="text-2xl animate-pulse">Chargement de la révélation...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0B0F1C] text-white px-2 pb-10">
      <audio ref={audioRef} src="/winning-218995.mp3" preload="auto" />
      <div className="w-full max-w-xl mx-auto flex flex-col items-center mt-6 animate-fadeIn">
        {/* Titre */}
        <h1 className="text-4xl md:text-5xl font-extrabold text-yellow-300 drop-shadow-glow mb-2 text-center tracking-tight">
          🏆 Grand Gagnant !
        </h1>
        {/* Avatar gagnant */}
        <div className="mt-4 mb-2 flex flex-col items-center">
          <img
            src={leader.avatar}
            alt={leader.pseudo}
            className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-yellow-400 shadow-2xl bg-slate-800 object-cover animate-crown"
          />
          <div className="mt-2 text-3xl md:text-4xl font-extrabold text-yellow-200 flex items-center gap-3">
            {leader.pseudo}
            <span className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-lg font-bold text-base md:text-lg ml-2">Vainqueur</span>
          </div>
          <div className="text-xl md:text-2xl text-yellow-300 font-bold mt-2">
            ₦{historique[0]?.montant}
          </div>
        </div>
        {/* Booster */}
        <div className="mt-6 flex flex-col items-center">
          <span className="text-lg text-cyan-300 font-semibold mb-1">Lot remporté :</span>
          <img
            src={`/${enchere.lot_image || "booster homepage.png"}`}
            alt={enchere.lot_title}
            className="w-28 h-28 md:w-32 md:h-32 object-contain rounded-2xl shadow-2xl drop-shadow-xl bg-slate-800"
          />
          <div className="text-center text-cyan-200 mt-2 font-bold text-lg">{enchere.lot_title}</div>
        </div>
        {/* Runner-up */}
        {runnerUp && (
          <div className="mt-8 flex flex-col items-center">
            <span className="text-base text-gray-300 mb-1">🥈 Suivi de près par</span>
            <img
              src={runnerUp.avatar}
              alt={runnerUp.pseudo}
              className="w-16 h-16 rounded-full border-2 border-gray-400 shadow bg-slate-800 object-cover grayscale opacity-70"
            />
            <div className="mt-1 text-xl font-semibold text-gray-300 flex items-center gap-2">
              {runnerUp.pseudo}
              <span className="ml-2 text-yellow-200 font-bold text-lg">₦{historique[1]?.montant}</span>
            </div>
          </div>
        )}
        {/* Historique enchère */}
        <div className="mt-10 w-full">
          <h2 className="text-xl font-bold text-yellow-300 mb-3 text-center">Historique complet de l’enchère</h2>
          <ul className="space-y-2">
            {historique.map((h, idx) => (
              <li key={h.id} className={`bg-gray-700 rounded p-2 flex items-center gap-3 border-l-4 ${idx === 0 ? "border-yellow-400 bg-yellow-300/10 shadow-yellow-200/10" : "border-transparent"} transition-all`}>
                <img
                  alt={h.pseudo}
                  className="w-8 h-8 rounded-full object-cover bg-slate-800 border border-gray-600"
                  src={idx === 0 ? leader.avatar : runnerUp && h.uid === runnerUp.uid ? runnerUp.avatar : "/default-avatar.png"}
                />
                <span className={`font-semibold ${idx === 0 ? "text-yellow-300" : "text-cyan-300"}`}>{h.pseudo}</span>
                {idx === 0 && <span className="ml-1 px-2 py-0.5 rounded bg-yellow-400 text-yellow-900 text-xs font-bold">Leader</span>}
                <span className="flex-1"></span>
                <span className="text-yellow-300 font-bold">₦{h.montant}</span>
                <span className="text-xs text-gray-400 ml-3">{new Date(h.date).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
              </li>
            ))}
          </ul>
        </div>
        {/* CTA retour */}
        <button
          className="mt-12 px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-bold text-lg shadow-lg hover:from-cyan-300 hover:to-blue-400 transition"
          onClick={() => router.push("/")}
        >
          Retour à l’accueil
        </button>
      </div>
      <style jsx>{`
        .animate-fadeIn { animation: fadeIn 1s cubic-bezier(.4,0,.2,1); }
        @keyframes fadeIn { from { opacity: 0; transform: scale(.97); } to { opacity: 1; transform: scale(1); } }
        .animate-crown { animation: crownPop 1.2s cubic-bezier(.4,0,.2,1); }
        @keyframes crownPop { 0% { transform: scale(0.7) rotate(-10deg); opacity: 0; } 70% { transform: scale(1.1) rotate(6deg); opacity: 1; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
        .drop-shadow-glow { text-shadow: 0 0 12px #ffe066, 0 0 2px #fff; }
      `}</style>
    </div>
  );
}
