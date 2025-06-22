import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";

interface EnCoursBetsSectionProps {
  user: { uid: string; pseudo: string };
  refreshData: () => void;
}

export default function EnCoursBetsSection({ user, refreshData }: EnCoursBetsSectionProps) {
  const [bets, setBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBets = async () => {
      setLoading(true);
      const { data: bets } = await supabase
        .from("paris")
        .select("*, joueur1:joueur1_uid (pseudo), joueur2:joueur2_uid (pseudo)")
        .eq("statut", "en cours")
        .or(`joueur1_uid.eq.${user.uid},joueur2_uid.eq.${user.uid}`);
      const filteredBets = (bets || []).filter((bet: any) => bet.statut === 'en cours');
      setBets(filteredBets);
      setLoading(false);
    };
    fetchBets();
  }, [user.uid]);

  if (loading) return null;
  if (bets.length === 0) return null;

  return (
    <div className="w-full max-w-xl mb-8">
      <h2 className="text-lg font-bold mb-2 text-cyan-400">Paris en cours</h2>
      <ul className="space-y-4">
        {bets.map((pari) => {
          const canSetWinner =
            pari.statut === "en cours" && (pari.joueur1_uid === user.uid || pari.joueur2_uid === user.uid);
          return (
            <li key={pari.id} className="bg-cyan-950 border border-cyan-700 rounded-xl p-5 flex flex-col shadow-lg animate-fadeIn">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 gap-2">
                <div className="text-base font-semibold text-cyan-200">{pari.description}</div>
                <div className="text-cyan-400 font-bold">₦{pari.montant}</div>
              </div>
              <div className="flex flex-row gap-4 text-sm text-cyan-300 mb-2">
                <span>Joueur 1 : {pari.joueur1?.pseudo || "?"}</span>
                <span>Joueur 2 : {pari.joueur2?.pseudo || "?"}</span>
              </div>
              {canSetWinner && (
                <>
                  <div className="text-xs text-yellow-300 mb-1">
                    En attente de désignation du gagnant par l’un des deux joueurs
                  </div>
                  <button
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-4 rounded shadow mt-1"
                    onClick={() => {
                      // Pour UX : rediriger ou ouvrir le choix du gagnant (à intégrer selon le composant principal)
                      window.alert("Clique sur le bouton 'Définir le gagnant' dans la transaction correspondante pour désigner le gagnant.");
                    }}
                  >
                    Définir le gagnant
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
