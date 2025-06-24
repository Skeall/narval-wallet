import { useState, useRef } from "react";
import { supabase } from "@/utils/supabaseClient";

interface PariTransactionItemProps {
  tx: any;
  user: any;
  badgeColors: Record<string, string>;
  typeLabels: Record<string, string>;
  refreshData: () => void;
}

function renderLabel(tx: any, user: any) {
  if (!user) return "";
  const isSender = tx.from === user.uid;
  const isReceiver = tx.to === user.uid;
  if (tx.type === "don" && isSender && tx.to_label === "pot_commun") {
    return `Tu as donné ${tx.montant} Narvals au pot commun`;
  }
  if (isSender && tx.to_pseudo && tx.to_label !== "pot_commun") {
    return `Tu as envoyé ${tx.montant} Narvals à ${tx.to_pseudo}`;
  }
  if (isReceiver && tx.from_pseudo) {
    return `${tx.from_pseudo} t'a envoyé ${tx.montant} Narvals`;
  }
  if (tx.from_pseudo && tx.to_pseudo && tx.to_label !== "pot_commun") {
    return `${tx.from_pseudo} a envoyé ${tx.montant} Narvals à ${tx.to_pseudo}`;
  }
  if (tx.type === "impôt") {
    return `Tu as payé un impôt de ${tx.montant} Narvals`;
  }
  if (tx.type === "pari" && isReceiver) {
    return `Tu as gagné ${tx.montant} Narvals sur un pari${tx.description ? ` : ${tx.description}` : ''}`;
  }
  if (tx.type === "enchère" && isReceiver) {
    return `Tu as remporté ${tx.montant} Narvals à une enchère`;
  }
  return `Transaction (${tx.montant} Narvals)`;
}

function formatDate(dateString: string) {
  const d = new Date(dateString);
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PariTransactionItem({ tx, user, badgeColors, typeLabels, refreshData }: PariTransactionItemProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [showWinnerChoice, setShowWinnerChoice] = useState(false);
  const [winnerActionMsg, setWinnerActionMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const isPari = tx.type === "pari";
  const canSetWinner = isPari && tx.statut === "en cours" && user && (tx.from === user.uid || tx.to === user.uid);

  const handleSetWinner = async (winnerUid: string) => {
    setLoading(true);
    setWinnerActionMsg("");
    try {
      const { data: pari } = await supabase.from("paris").select("*", { count: "exact" }).eq("id", tx.pari_id).single();
      if (!pari) {
        setWinnerActionMsg("Pari introuvable.");
        setLoading(false);
        return;
      }
      const montantTotal = pari.montant * 2;
      const gainGagnant = montantTotal; // Le gagnant reçoit tout, pas de taxe pot commun
      const { data: gagnant } = await supabase.from("users").select("solde").eq("uid", winnerUid).single();
      if (!gagnant) throw new Error("Le gagnant n'a pas été trouvé dans la base de données");
      await supabase.from("users").update({ solde: gagnant.solde + gainGagnant }).eq("uid", winnerUid);
      await supabase.from("transactions").insert([
        {
          type: "pari",
          from: null,
          to: winnerUid,
          montant: gainGagnant,
          description: `Gain pari #${pari.id} : ${pari.description}`,
          date: new Date().toISOString(),
        }
      ]);
      await supabase.from("paris").update({ statut: "terminé", gagnant_uid: winnerUid }).eq("id", pari.id);
      setWinnerActionMsg("Le gagnant a été défini et les gains distribués !");
      setShowWinnerChoice(false);
      // Play victory sound if the user is the winner
      if (winnerUid === user.uid && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      setTimeout(() => {
        if (refreshData) refreshData();
      }, 1200);
    } catch (e: any) {
      setWinnerActionMsg("Erreur lors de la distribution des gains : " + (e.message || ""));
    }
    setLoading(false);
  };

  return (
    <>
      <audio ref={audioRef} src="/victory.mp3" preload="auto" />
      <li className="flex items-center justify-between bg-[#232B42] rounded-lg px-4 py-3">
      <div>
        <div className="font-medium">
          {renderLabel(tx, user)}
        </div>
        {tx.description && (
          <div className="text-xs text-gray-400 italic">{tx.description}</div>
        )}
        <div className="text-xs text-gray-400">{formatDate(tx.date)}</div>
        {canSetWinner && !showWinnerChoice && (
          <>
            <div className="text-xs text-yellow-300 mb-1">
              En attente de désignation du gagnant par l’un des deux joueurs
            </div>
            <button
              className="mt-2 bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-4 rounded shadow"
              onClick={() => setShowWinnerChoice(true)}
            >
              Définir le gagnant
            </button>
          </>
        )}
        {showWinnerChoice && (
          <div className="mt-2 flex gap-2">
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded"
              disabled={loading}
              onClick={() => handleSetWinner(user.uid)}
            >
              Je gagne
            </button>
            <button
              className="bg-purple-700 hover:bg-purple-800 text-white py-1 px-3 rounded"
              disabled={loading}
              onClick={() => handleSetWinner(tx.from === user.uid ? tx.to : tx.from)}
            >
              L'autre gagne
            </button>
            <button
              className="bg-gray-600 hover:bg-gray-700 text-white py-1 px-3 rounded"
              disabled={loading}
              onClick={() => setShowWinnerChoice(false)}
            >
              Annuler
            </button>
          </div>
        )}
        {winnerActionMsg && <div className="mt-2 text-cyan-200 text-xs">{winnerActionMsg}</div>}
      </div>
      <span className={`px-2 py-1 rounded text-xs font-semibold ml-2 ${badgeColors[tx.type]}`}>{typeLabels[tx.type]}</span>
    </li>
    </>
  );
}
