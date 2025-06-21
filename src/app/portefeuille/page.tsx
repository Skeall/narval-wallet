"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";

// DEBUG: Affiche la variable d'environnement Supabase côté front
console.log("SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);


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
            .eq("statut", "en attente")
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
      {/* Bloc Paris à valider */}
      {pendingBets.length > 0 && (
        <div className="w-full max-w-xl mb-8">
          {pendingBets.map((pari) => (
            <div key={pari.id} className="bg-blue-900 border border-blue-700 rounded-xl p-6 mb-4 flex flex-col items-center shadow-lg animate-fadeIn">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded">Nouveau pari à valider</span>
              </div>
              <div className="text-lg mb-2">{pari.joueur1?.pseudo || "Un joueur"} te propose un pari de <span className="font-bold text-cyan-300">₦{pari.montant}</span></div>
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
                    await supabase.from("paris").update({ statut: "en attente de validation" }).eq("id", pari.id);
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
        {transactions.length === 0 ? (
          <>
            <div className="text-center text-gray-400">Aucune transaction récente</div>
          </>
        ) : (
        <ul className="space-y-4">
          {transactions.map((tx) => (
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

function renderLabel(tx: Transaction, user: User|null) {
  if (!user) return "";
  const isSender = tx.from === user.uid;
  const isReceiver = tx.to === user.uid;

  // 1. Don au pot commun
  if (tx.type === "don" && isSender && tx.to_label === "pot_commun") {
    return `Tu as donné ${tx.montant} Narvals au pot commun`;
  }
  // 2. Transfert où user est l'émetteur
  if (isSender && tx.to_pseudo && tx.to_label !== "pot_commun") {
    return `Tu as envoyé ${tx.montant} Narvals à ${tx.to_pseudo}`;
  }
  // 3. Transfert où user est le destinataire
  if (isReceiver && tx.from_pseudo) {
    return `Tu as reçu ${tx.montant} Narvals de ${tx.from_pseudo}`;
  }
  // 4. Transfert où user n'est ni émetteur ni destinataire
  if (tx.from_pseudo && tx.to_pseudo && tx.to_label !== "pot_commun") {
    return `${tx.from_pseudo} a envoyé ${tx.montant} Narvals à ${tx.to_pseudo}`;
  }
  // 5. Cas spéciaux
  if (tx.type === "impôt") {
    return `Tu as payé un impôt de ${tx.montant} Narvals`;
  }
  if (tx.type === "pari" && isReceiver) {
    return `Tu as gagné ${tx.montant} Narvals sur un pari`;
  }
  if (tx.type === "enchère" && isReceiver) {
    return `Tu as remporté ${tx.montant} Narvals à une enchère`;
  }
  // 6. Fallback
  return `Transaction (${tx.montant} Narvals)`;
}


// La fonction pseudoOrPot n'est plus utile, les pseudos sont maintenant dynamiques.


function PariTransactionItem({ tx, user, badgeColors, typeLabels, refreshData }: any) {
  const [showWinnerChoice, setShowWinnerChoice] = useState(false);
  const [winnerActionMsg, setWinnerActionMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Affiche le bouton seulement si c'est un pari en attente de validation ou en cours
  // et que l'utilisateur est joueur1 ou joueur2
  const isPari = tx.type === "pari";
  const canSetWinner = isPari && tx.statut && ["en attente de validation", "en cours"].includes(tx.statut) && user && (tx.from === user.uid || tx.to === user.uid);

  // On suppose que tx contient l'id du pari dans tx.pari_id OU on va chercher le pari par une jointure (sinon il faut l'ajouter dans la requête transactions)
  // Pour la démo, on suppose que tx.pari_id existe (sinon il faudra adapter la récupération)

  const handleSetWinner = async (winnerUid: string) => {
    setLoading(true);
    setWinnerActionMsg("");
    try {
      // Récupérer le pari pour avoir le montant exact et les deux joueurs
      const { data: pari } = await supabase.from("paris").select("*", { count: "exact" }).eq("id", tx.pari_id).single();
      if (!pari) {
        setWinnerActionMsg("Pari introuvable.");
        setLoading(false);
        return;
      }
      const montantTotal = pari.montant * 2;
      const gainGagnant = Math.floor(montantTotal * 0.9);
      const gainPot = montantTotal - gainGagnant;
      // 1. Créditer le gagnant
      const { data: gagnant } = await supabase.from("users").select("solde").eq("uid", winnerUid).single();
      await supabase.from("users").update({ solde: gagnant.solde + gainGagnant }).eq("uid", winnerUid);
      // 2. Créditer le pot commun
      // (ici, on suppose que le pot commun est un "user" spécial avec uid "pot_commun" ou via une transaction dédiée)
      await supabase.from("transactions").insert([
        {
          type: "pari",
          from: null,
          to: winnerUid,
          montant: gainGagnant,
          description: `Gain pari #${pari.id}`,
          date: new Date().toISOString(),
        },
        {
          type: "don",
          from: null,
          to: null,
          to_label: "pot_commun",
          montant: gainPot,
          description: `10% pot commun pari #${pari.id}`,
          date: new Date().toISOString(),
        }
      ]);
      // 3. Mettre à jour le pari
      await supabase.from("paris").update({ statut: "terminé", gagnant_uid: winnerUid }).eq("id", pari.id);
      setWinnerActionMsg("Le gagnant a été défini et les gains distribués !");
      setShowWinnerChoice(false);
      setTimeout(() => {
        refreshData();
      }, 1200);
    } catch (e: any) {
      setWinnerActionMsg("Erreur lors de la distribution des gains : " + (e.message || ""));
    }
    setLoading(false);
  };

  return (
    <li className="flex items-center justify-between bg-[#232B42] rounded-lg px-4 py-3">
      <div>
        <div className="font-medium">
          {renderLabel(tx, user)}
        </div>
        <div className="text-xs text-gray-400">{formatDate(tx.date)}</div>
        {canSetWinner && !showWinnerChoice && (
          <button
            className="mt-2 bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-4 rounded shadow"
            onClick={() => setShowWinnerChoice(true)}
          >
            Définir le gagnant
          </button>
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
  );
}

function formatDate(dateString: string) {
  const d = new Date(dateString);
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
