import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";

interface PendingByMeBetsSectionProps {
  user: { uid: string; pseudo: string };
  refreshData: () => void;
}

export default function PendingByMeBetsSection({ user, refreshData }: PendingByMeBetsSectionProps) {
  const [bets, setBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState("");

  useEffect(() => {
    const fetchBets = async () => {
      setLoading(true);
      const { data: bets } = await supabase
        .from("paris")
        .select("*, joueur2:joueur2_uid (pseudo)")
        .in("statut", ["en attente", "en attente de validation"])
        .eq("joueur1_uid", user.uid);
      setBets(bets || []);
      setLoading(false);
    };
    fetchBets();
  }, [user.uid]);

  const handleCancelBet = async (bet: any) => {
    setActionMsg("");
    setLoading(true);
    // TODO : Rendre la mise au joueur1 et supprimer le pari
    try {
      // 1. Rendre la mise au joueur1 (à améliorer selon logique transactionnelle)
      await supabase.rpc("rembourser_mise_pari", { pari_id: bet.id });
      // 2. Supprimer le pari (ou le passer à un statut annulé)
      await supabase.from("paris").update({ statut: "annulé" }).eq("id", bet.id);
      setActionMsg("Pari annulé, mise remboursée.");
      setTimeout(() => {
        refreshData();
      }, 1000);
    } catch (e: any) {
      setActionMsg("Erreur lors de l'annulation : " + (e.message || ""));
    }
    setLoading(false);
  };

  if (loading) return null;
  if (bets.length === 0) return null;

  return (
    <div className="w-full max-w-xl mb-8">
      <h2 className="text-lg font-bold mb-2 text-yellow-400">Paris en attente de validation (créés par vous)</h2>
      <ul className="space-y-4">
        {bets.map((pari) => (
          <li key={pari.id} className="bg-yellow-950 border border-yellow-700 rounded-xl p-5 flex flex-col shadow-lg animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 gap-2">
              <div className="text-base font-semibold text-yellow-200">{pari.description}</div>
              <div className="text-yellow-400 font-bold">₦{pari.montant}</div>
            </div>
            <div className="flex flex-row gap-4 text-sm text-yellow-300 mb-2">
              <span>Adversaire : {pari.joueur2?.pseudo || "?"}</span>
            </div>
            <button
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-4 rounded shadow mt-1"
              onClick={() => handleCancelBet(pari)}
            >
              Annuler / Récupérer la mise
            </button>
            {actionMsg && <div className="text-xs text-yellow-200 mt-1">{actionMsg}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
