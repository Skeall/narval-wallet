"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/utils/supabaseClient";

interface User { uid: string; pseudo: string; solde: number; }
interface Enchere {
  id: string;
  lot_title: string;
  lot_description: string;
  lot_image: string;
  current_bid: number;
  current_leader_uid: string;
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

export default function EncherePage() {
  const [avatarsByUid, setAvatarsByUid] = useState<Record<string, string>>({});
  const [enchere, setEnchere] = useState<Enchere|null>(null);
  const [historique, setHistorique] = useState<EnchereHistorique[]>([]);
  const [currentUser, setCurrentUser] = useState<User|null>(null);
  // Nouveau leader calculé dynamiquement
  const topBid = historique.length > 0 ? historique.reduce((max, h) => h.montant >= max.montant ? h : max, historique[0]) : null;
  const leaderPseudo = topBid ? topBid.pseudo : (enchere?.current_leader_uid ? (currentUser?.pseudo || "-") : "-");
  const [montant, setMontant] = useState(0);
  const [minBid, setMinBid] = useState(0);
  const [timer, setTimer] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout|null>(null);

  // Récupère l'enchère en cours, l'utilisateur et l'historique
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // Utilisateur connecté
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: userData } = await supabase
        .from("users")
        .select("uid, pseudo, solde")
        .eq("uid", user.id)
        .single();
      setCurrentUser(userData);
      // Enchère du mois (on suppose une seule active)
      const { data: enchereData } = await supabase
        .from("enchere")
        .select("*")
        .order("deadline", { ascending: false })
        .limit(1)
        .single();
      setEnchere(enchereData);
      // Récupération des avatars des enchérisseurs
      if (enchereData?.id) {
        const { data: histoData } = await supabase
          .from("enchere_historique")
          .select("uid")
          .eq("enchere_id", enchereData.id);
        const uniqueUids = [...new Set((histoData || []).map((h: any) => h.uid))];
        if (uniqueUids.length > 0) {
          const { data: usersData } = await supabase
            .from("users")
            .select("uid, avatar")
            .in("uid", uniqueUids);
          const avatars: Record<string, string> = {};
          (usersData || []).forEach((u: any) => { avatars[u.uid] = u.avatar || "/default-avatar.png"; });
          setAvatarsByUid(avatars);
        }
      }
      // Leader pseudo
      if (enchereData?.current_leader_uid) {
        const { data: leaderData } = await supabase
          .from("users")
          .select("pseudo")
          .eq("uid", enchereData.current_leader_uid)
          .single();

      } else {
  
      }
      // Historique
      if (enchereData?.id) {
        const { data: histoData } = await supabase
          .from("enchere_historique")
          .select("id, enchere_id, uid, pseudo, montant, date")
          .eq("enchere_id", enchereData.id)
          .order("date", { ascending: false });
        setHistorique(histoData || []);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // Calcul du minimum requis
  useEffect(() => {
    if (enchere) {
      const min = Math.ceil((enchere.current_bid || 0) * 1.05) || 1;
      setMinBid(min);
      setMontant(m => (m < min ? min : m));
    }
  }, [enchere]);

  // Timer dynamique
  useEffect(() => {
    if (!enchere?.deadline) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    const updateTimer = () => {
      const now = new Date();
      const deadline = new Date(enchere.deadline);
      const diff = deadline.getTime() - now.getTime();
      if (diff <= 0) {
        setTimer("Terminé");
        return;
      }
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setTimer(`${d > 0 ? d + 'j ' : ''}${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`);
    };
    updateTimer();
    intervalRef.current = setInterval(updateTimer, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enchere?.deadline]);

  // Gestion surenchère
  const handleBid = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    if (!currentUser || !enchere) {
      setMessage("Utilisateur ou enchère non chargés.");
      return;
    }
    if (topBid && currentUser.uid === topBid.uid) {
      setMessage("Tu es déjà le leader !");
      return;
    }
    if (montant < minBid) {
      setMessage(`Le montant minimum requis est ₦${minBid}`);
      return;
    }
    if (montant > currentUser.solde) {
      setMessage("Solde insuffisant.");
      return;
    }
    setLoading(true);
    try {
      console.log("[Enchere] Soumission offre", { montant, minBid, currentUser, enchere });
      // Remboursement ancien leader
      if (enchere.current_leader_uid) {
        const { data: prevLeader, error: prevErr } = await supabase
          .from("users")
          .select("solde")
          .eq("uid", enchere.current_leader_uid)
          .single();
        if (prevErr) console.error("Erreur récupération ancien leader:", prevErr);
        if (prevLeader) {
          const { error: refundErr } = await supabase
            .from("users")
            .update({ solde: prevLeader.solde + enchere.current_bid })
            .eq("uid", enchere.current_leader_uid);
          if (refundErr) console.error("Erreur remboursement leader:", refundErr);
        }
      }
      // Débit nouvel enchérisseur
      const { error: debitErr } = await supabase
        .from("users")
        .update({ solde: currentUser.solde - montant })
        .eq("uid", currentUser.uid);
      if (debitErr) {
        setMessage("Erreur lors du débit utilisateur: " + debitErr.message);
        setLoading(false);
        return;
      }
      // Prolongation deadline si offre < 5min avant la fin
      let newDeadline = enchere.deadline;
      const now = new Date();
      const deadline = new Date(enchere.deadline);
      if ((deadline.getTime() - now.getTime()) <= 5 * 60 * 1000) {
        newDeadline = new Date(deadline.getTime() + 2 * 60 * 1000).toISOString();
      }
      // Update enchere
      const { error: enchereErr } = await supabase
        .from("enchere")
        .update({
          current_bid: montant,
          current_leader_uid: currentUser.uid,
          deadline: newDeadline,
        })
        .eq("id", enchere.id);
      if (enchereErr) {
        setMessage("Erreur lors de la mise à jour de l'enchère: " + enchereErr.message);
        setLoading(false);
        return;
      }
      // Insert historique
      const { error: histoErr } = await supabase
        .from("enchere_historique")
        .insert([
          {
            enchere_id: enchere.id,
            uid: currentUser.uid,
            pseudo: currentUser.pseudo,
            montant,
            date: new Date().toISOString(),
          },
        ]);
      if (histoErr) {
        setMessage("Erreur lors de l'enregistrement de l'historique: " + histoErr.message);
        setLoading(false);
        return;
      }
      setMessage("🎉 Tu es en tête de l’enchère !");
      // Refresh data
      const { data: userData } = await supabase
        .from("users")
        .select("uid, pseudo, solde")
        .eq("uid", currentUser.uid)
        .single();
      setCurrentUser(userData);
      const { data: enchereData } = await supabase
        .from("enchere")
        .select("*")
        .eq("id", enchere.id)
        .single();
      setEnchere(enchereData);
      if (enchereData?.current_leader_uid) {
        const { data: leaderData } = await supabase
          .from("users")
          .select("pseudo")
          .eq("uid", enchereData.current_leader_uid)
          .single();

      }
      if (enchereData?.id) {
        const { data: histoData } = await supabase
          .from("enchere_historique")
          .select("id, enchere_id, uid, pseudo, montant, date")
          .eq("enchere_id", enchereData.id)
          .order("date", { ascending: false });
        setHistorique(histoData || []);
      }
    } catch (e: any) {
      setMessage("Erreur inattendue: " + (e?.message || e));
      console.error(e);
    }
    setLoading(false);
  };


  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-900 py-8 px-2">
      <div className="bg-gray-800 rounded-lg shadow-md w-full max-w-lg p-6 mt-6 flex flex-col items-center">
        {/* LOT EN JEU */}
        <div className="flex flex-col items-center mb-6">
  
          <img src={enchere?.lot_image || "/booster.png"} alt="Booster" className="w-32 h-32 object-contain mb-2 rounded shadow" />
          <div className="text-xl font-bold text-cyan-400">{enchere?.lot_title || "Booster X1"}</div>
          <div className="text-gray-300 text-center mt-1">{enchere?.lot_description || "Un paquet de cartes contenant 5 cartes ✨"}</div>
        </div>
        {/* ENCHERE EN COURS */}
        <div className="bg-gray-700 rounded-lg p-4 w-full flex flex-col items-center mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🧨</span>
            <span className="text-lg font-bold text-cyan-300">Enchère du mois</span>
          </div>
          <div className="text-3xl font-bold text-yellow-400 mb-2">{enchere ? `₦${historique && historique.length > 0 ? Math.max(...historique.map(h => h.montant)) : enchere.current_bid}` : "-"}</div>
          <div className="text-md text-cyan-200 mb-1">Leader : <span className="font-semibold">{leaderPseudo}</span></div>
          <div className="text-sm text-gray-300 flex items-center gap-1 mb-1"><span>⏳</span>Temps restant : <span className="font-mono">{timer}</span></div>
        </div>
        {/* FORMULAIRE SURENCHERE */}
        <form onSubmit={handleBid} className="flex flex-col items-center w-full gap-2">
          <label className="text-gray-200">Montant de la surenchère</label>
          <div className="flex flex-col items-center gap-2 mb-2 w-full">
            <div className="text-3xl font-bold text-yellow-300 mb-2">₦{montant}</div>
            <div className="flex items-center w-full gap-2">
              <button
                type="button"
                className="bg-gray-700 text-cyan-400 rounded-full w-8 h-8 flex items-center justify-center text-xl hover:bg-gray-600"
                onClick={() => setMontant(m => Math.max(minBid, m - 1))}
                aria-label="Diminuer"
                disabled={!currentUser || (topBid && currentUser.uid === topBid.uid) || loading}
              >-</button>
              <input
                type="range"
                min={minBid}
                max={currentUser ? currentUser.solde : minBid}
                value={montant}
                onChange={e => setMontant(Number(e.target.value))}
                className="flex-1 accent-yellow-400"
                disabled={!currentUser || (topBid && currentUser.uid === topBid.uid) || loading}
              />
              <button
                type="button"
                className="bg-gray-700 text-cyan-400 rounded-full w-8 h-8 flex items-center justify-center text-xl hover:bg-gray-600"
                onClick={() => setMontant(m => Math.min(currentUser ? currentUser.solde : minBid, m + 1))}
                aria-label="Augmenter"
                disabled={!currentUser || (topBid && currentUser.uid === topBid.uid) || loading}
              >+</button>
            </div>
            <div className="text-xs text-gray-400">Minimum requis : <span className="font-semibold text-cyan-300">₦{minBid}</span> &nbsp;|&nbsp; Max : <span className="font-semibold text-cyan-300">₦{currentUser ? currentUser.solde : minBid}</span></div>
          </div>
          <button
            type="submit"
            className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-2 px-4 rounded mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!currentUser || (topBid && currentUser.uid === topBid.uid) || montant < minBid || montant > (currentUser?.solde || 0) || loading}
          >{loading ? "Patiente..." : "Faire une offre"}</button>
        </form>
        {message && <div className="mt-4 text-center text-cyan-300 animate-bounce">{message}</div>}
        {/* HISTORIQUE DES ENCHERES */}
        <div className="mt-8 w-full">
          <div className="text-lg font-bold text-gray-200 mb-2 flex items-center gap-2"><span>📜</span>Historique des enchères</div>
          <ul className="space-y-2">
            {historique.length === 0 && <li className="text-gray-400 text-center">Aucune offre pour le moment.</li>}
            {historique.map(h => {
              const isLeader = topBid && h.uid === topBid.uid && h.montant === topBid.montant;
              const avatarUrl = avatarsByUid[h.uid] || '/default-avatar.png';
              return (
                <li key={h.id} className={`bg-gray-700 rounded p-2 flex items-center gap-3 border-l-4 ${isLeader ? 'border-yellow-400 bg-yellow-300/10 shadow-yellow-200/10' : 'border-transparent'} transition-all`}>
                  <img src={avatarUrl} alt={h.pseudo} className="w-8 h-8 rounded-full object-cover bg-slate-800 border border-gray-600" />
                  <span className={`font-semibold ${isLeader ? 'text-yellow-300' : 'text-cyan-300'}`}>{h.pseudo}</span>
                  {isLeader && <span className="ml-1 px-2 py-0.5 rounded bg-yellow-400 text-yellow-900 text-xs font-bold">Leader</span>}
                  <span className="flex-1"></span>
                  <span className="text-yellow-300 font-bold">₦{h.montant}</span>
                  <span className="text-xs text-gray-400 ml-3">{new Date(h.date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
