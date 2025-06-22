"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import EnCoursBetsSection from "./EnCoursBetsSection";
import PendingByMeBetsSection from "./PendingByMeBetsSection";
import PariTransactionItem from "./PariTransactionItem";

// DEBUG: Affiche la variable d'environnement Supabase côté front
console.log("SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);

const POT_COMMUN_OBJECTIF = 1500;

// Types
interface UserJoin {
  pseudo?: string | null;
}
interface Transaction {
  id: string;
  type: "don" | "transfert" | "pari" | "impôt" | "enchère";
  from: string | null;
  to: string | null;
  to_label?: string | null;
  montant: number;
  description?: string;
  date: string;
  from_pseudo?: string | null;
  to_pseudo?: string | null;
}

interface User {
  uid: string;
  pseudo: string;
}

const typeLabels: Record<string, string> = {
  don: "Don",
  transfert: "Transfert",
  pari: "Pari",
  "impôt": "Impôt",
  "enchère": "Enchère",
};

const badgeColors: Record<string, string> = {
  don: "bg-blue-700 text-blue-200",
  transfert: "bg-green-700 text-green-200",
  pari: "bg-purple-700 text-purple-200",
  impôt: "bg-red-700 text-red-200",
  enchère: "bg-yellow-700 text-yellow-200",
};

export default function PortefeuillePage() {
  const [pendingBets, setPendingBets] = useState<any[]>([]);
  const [betActionMsg, setBetActionMsg] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [user, setUser] = useState<User|null>(null);
  const [solde, setSolde] = useState<number>(0);
  const [potCommun, setPotCommun] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  

  // Déclare fetchData ici pour qu'elle soit accessible partout
  const fetchData = async () => {
      // Récupère aussi les paris en attente où l'utilisateur est joueur2
      let pendingBets: any[] = [];
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const { data: bets } = await supabase
            .from("paris")
            .select("*, joueur1:joueur1_uid (pseudo), joueur2:joueur2_uid (pseudo)")
            .in("statut", ["en attente", "en attente de validation"])
            .eq("joueur2_uid", authUser.id);
          pendingBets = bets || [];
        }
      } catch (e) { /* ignore */ }
      setPendingBets(pendingBets);

      try {
        setLoading(true);
        // 1. Récupérer l'utilisateur connecté
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          setLoading(false);
          return;
        }
        const useruid = authUser.id;
        console.log("useruid:", useruid);
        // 2. Récupérer le profil user (pour le pseudo et solde)
        const { data: userData } = await supabase
          .from("users")
          .select("uid, pseudo, solde")
          .eq("uid", useruid)
          .single();
        if (!userData) {
          setLoading(false);
          return;
        }
        setUser({ uid: userData.uid, pseudo: userData.pseudo });
        setSolde(userData.solde);

        // NOUVEAU : Récupérer la somme du pot commun
        const { data: potTxs, error: potError } = await supabase
          .from("transactions")
          .select("montant")
          .eq("to_label", "pot_commun");
        const potTotal = (potTxs || []).reduce((sum, tx) => sum + (tx.montant ?? 0), 0);
        setPotCommun(potTotal);

        // 1. Récupérer les transactions où l'utilisateur est impliqué (from ou to), AVEC jointure sur users
        const { data: tx1, error: error1 } = await supabase
          .from("transactions")
          .select(`id, type, from, to, to_label, montant, description, date, from_user:from (pseudo), to_user:to (pseudo)`)
          .or(`from.eq.${useruid},to.eq.${useruid}`)
          .order("date", { ascending: false });
        // 2. Récupérer les dons au pot commun
        const { data: tx2, error: error2 } = await supabase
          .from("transactions")
          .select(`id, type, from, to, to_label, montant, description, date, from_user:from (pseudo), to_user:to (pseudo)`)
          .eq("from", useruid)
          .eq("to_label", "pot_commun")
          .order("date", { ascending: false });

        // Fusionne, supprime les doublons, trie par date décroissante, limite à 10
        let allTxs = [...(tx1 || []), ...(tx2 || [])];
        allTxs = allTxs.filter((tx, idx, arr) => arr.findIndex(t => t.id === tx.id) === idx);
        allTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        allTxs = allTxs.slice(0, 10);

        // Mapping explicite des pseudos pour affichage (robuste et valeurs par défaut)
        allTxs = allTxs.map(tx => ({
          ...tx,
          from_pseudo: (
            Array.isArray(tx.from_user)
              ? ((tx.from_user[0] as UserJoin)?.pseudo ?? "inconnu")
              : (typeof tx.from_user === "object" && tx.from_user !== null && "pseudo" in tx.from_user)
                ? (tx.from_user as UserJoin).pseudo
                : "inconnu"
          ),
          to_pseudo: tx.to_label === "pot_commun"
            ? "pot commun"
            : (
              Array.isArray(tx.to_user)
                ? ((tx.to_user[0] as UserJoin)?.pseudo ?? "inconnu")
                : (typeof tx.to_user === "object" && tx.to_user !== null && "pseudo" in tx.to_user)
                  ? (tx.to_user as UserJoin).pseudo
                  : "inconnu"
            ),
          id: tx.id ?? Math.random().toString(36).slice(2),
          type: tx.type ?? "transfert",
          montant: tx.montant ?? 0,
          date: tx.date ?? new Date().toISOString()
        }));

        console.log("allTxs après mapping:", allTxs);
        if (error1 || error2) {
          setTransactions([]);
          setErrorMsg('Erreur lors de la récupération des transactions: ' + (error1?.message || error2?.message));
        } else {
          setTransactions(allTxs);
          setErrorMsg("");
        }
        setLoading(false);
      } catch (e) {
        console.error("Erreur fetchData portefeuille:", e);
        setErrorMsg("Erreur interne: " + (e as Error).message);
        setLoading(false);
      }
  };


  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#0B0F1C] text-white">Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0B0F1C] text-white flex flex-col items-center pt-20">

      {/* Section Paris en cours */}
      {user && (
        <EnCoursBetsSection user={user} refreshData={fetchData} />
      )}
      {/* Bloc Paris à valider */}
      {pendingBets.length > 0 && (
        <div className="w-full max-w-xl mb-8">
          <h2 className="text-xl font-bold mb-4 text-center text-cyan-400">Paris à valider (reçus)</h2>
          {pendingBets.map((pari) => (
            <div key={pari.id} className="bg-blue-900 border border-blue-700 rounded-xl p-6 mb-4 flex flex-col items-center shadow-lg animate-fadeIn">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded">Nouveau pari à valider</span>
              </div>
              <div className="text-lg mb-2">{pari.joueur1?.pseudo || "Un joueur"} te propose un pari de <span className="font-bold text-cyan-300">₦{pari.montant}</span></div>
              {pari.description && (
                <div className="mb-2 text-xs italic text-blue-200">Sujet : {pari.description}</div>
              )}
              <div className="flex gap-4 mt-2">
                <button
                  className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-6 rounded-lg shadow transition focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  onClick={async () => {
                    setBetActionMsg("");
                    // Vérifie le solde des DEUX joueurs
                    const { data: { user: authUser } } = await supabase.auth.getUser();
                    if (!authUser) throw new Error("Utilisateur non authentifié");
                    const { data: user2 } = await supabase
                      .from("users")
                      .select("uid, solde")
                      .eq("uid", authUser.id)
                      .single();
                    const { data: user1 } = await supabase
                      .from("users").select("uid, solde").eq("uid", pari.joueur1_uid).single();
                    if (!user2 || user2.solde < pari.montant) {
                      setBetActionMsg("Solde insuffisant pour accepter ce pari (toi).");
                      return;
                    }
                    if (!user1 || user1.solde < pari.montant) {
                      setBetActionMsg("Solde insuffisant pour l'autre joueur. Pari annulé.");
                      await supabase.from("paris").update({ statut: "annulé" }).eq("id", pari.id);
                      setPendingBets(pendingBets.filter(b => b.id !== pari.id));
                      return;
                    }
                    // Débite les DEUX joueurs
                    await supabase.from("users").update({ solde: user1.solde - pari.montant }).eq("uid", user1.uid);
                    await supabase.from("users").update({ solde: user2.solde - pari.montant }).eq("uid", user2.uid);
                    await supabase.from("paris").update({ statut: "en cours" }).eq("id", pari.id);
                    setBetActionMsg("Pari accepté ! En attente de validation de l'admin.");
                    setPendingBets(pendingBets.filter(b => b.id !== pari.id));
                  }}
                >Accepter</button>
                <button
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg shadow transition focus:outline-none focus:ring-2 focus:ring-red-400"
                  onClick={async () => {
                    setBetActionMsg("");
                    await supabase.from("paris").update({ statut: "refusé" }).eq("id", pari.id);
                    setBetActionMsg("Pari refusé.");
                    setPendingBets(pendingBets.filter(b => b.id !== pari.id));
                  }}
                >Refuser</button>
              </div>
              {betActionMsg && <div className="mt-4 text-center text-cyan-200 text-sm">{betActionMsg}</div>}
            </div>
          ))}
        </div>
      )}


      <div className="bg-[#1C2233] rounded-xl p-8 w-full max-w-xl shadow-lg">
        <h1 className="text-3xl font-bold mb-2 text-center text-sky-400">Portefeuille</h1>
        <div className="mb-6 text-center text-lg">
          Solde&nbsp;: <span className="font-bold text-sky-300">{solde} Narvals</span>
        </div>
        <h2 className="text-xl font-semibold mb-4">Dernières transactions</h2>
        {errorMsg && (
          <div className="text-center text-red-400 mb-2">{errorMsg}</div>
        )}
        {transactions.length > 0 && (
          <ul className="space-y-3">
            {transactions
              .filter((tx) => {
                // Affiche toutes les transactions sauf les "pari" qui ne concernent pas l'utilisateur ou qui ne sont pas terminées
                if (tx.type !== "pari") return true;
                // On n'affiche que si la transaction est liée à un gain ou une perte (c'est-à-dire une fois le gagnant défini, donc transaction créée)
                // On suppose que la transaction est créée uniquement pour le gagnant, donc si l'utilisateur est destinataire
                return tx.to === user?.uid;
              })
              .map((tx) => (
                <PariTransactionItem
                  key={tx.id}
                  tx={tx}
                  user={user}
                  badgeColors={badgeColors}
                  typeLabels={typeLabels}
                  refreshData={fetchData}
                />
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
